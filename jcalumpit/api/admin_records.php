<?php
// Staff endpoint for patient records.
//   GET ?type=&q=   -> list + counts per type
//   POST create (optional base64 file) | update | delete (admin only)
require __DIR__ . '/bootstrap.php';
$staff = require_staff();
$pdo = db();

const REC_TYPES = ['medical_history', 'prescription', 'xray', 'lab_result', 'document'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
$dir = __DIR__ . '/../storage/records';

const REC_SELECT = "SELECT r.*, CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                           CONCAT_WS(' ', s.first_name, s.last_name) AS added_by_name
                    FROM records r JOIN users p ON p.id = r.patient_id LEFT JOIN users s ON s.id = r.added_by";

function rec_out(array $r): array
{
    return [
        'id' => (int) $r['id'], 'patientId' => (int) $r['patient_id'], 'patientName' => preg_replace('/\s+/', ' ', $r['patient_name']),
        'type' => $r['record_type'], 'title' => $r['title'], 'details' => $r['details'], 'date' => $r['record_date'],
        'hasFile' => $r['file_path'] !== null, 'fileName' => $r['file_name'], 'fileMime' => $r['file_mime'],
        'addedBy' => $r['added_by_name'] ?: null,
    ];
}

function rec_fields(array $d): array
{
    $type = field($d, 'type');
    if (!in_array($type, REC_TYPES, true)) {
        fail('Choose a record type.');
    }
    $title = field($d, 'title');
    if ($title === '' || mb_strlen($title) > 150) {
        fail('Enter a title (150 characters max).');
    }
    $details = field($d, 'details');
    if (mb_strlen($details) > 5000) {
        fail('The details are too long (5000 characters max).');
    }
    $date = field($d, 'date');
    if (!valid_date($date)) {
        fail('Enter a valid record date.');
    }
    return [$type, $title, $details !== '' ? $details : null, $date];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $args = [];
    $type = (string) ($_GET['type'] ?? '');
    if ($type !== '' && $type !== 'all') {
        if (!in_array($type, REC_TYPES, true)) {
            fail('Unknown record type.');
        }
        $where[] = 'r.record_type = ?';
        $args[] = $type;
    }
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $like = '%' . addcslashes($q, '%_\\') . '%';
        $where[] = "(r.title LIKE ? OR CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) LIKE ?)";
        array_push($args, $like, $like);
    }
    $st = $pdo->prepare(REC_SELECT . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY r.record_date DESC, r.id DESC LIMIT 1000');
    $st->execute($args);

    $counts = array_fill_keys(REC_TYPES, 0);
    foreach ($pdo->query('SELECT record_type, COUNT(*) AS c FROM records GROUP BY record_type')->fetchAll() as $row) {
        $counts[$row['record_type']] = (int) $row['c'];
    }
    json_out(['records' => array_map('rec_out', $st->fetchAll()), 'counts' => $counts + ['all' => array_sum($counts)]]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();
$action = field($d, 'action');

function fetch_rec(PDO $pdo, int $id): array
{
    $st = $pdo->prepare(REC_SELECT . ' WHERE r.id = ?');
    $st->execute([$id]);
    $r = $st->fetch();
    if (!$r) {
        fail('Record not found.', 404);
    }
    return $r;
}

if ($action === 'create') {
    $pt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'patient'");
    $pt->execute([(int) ($d['patientId'] ?? 0)]);
    if (!$pt->fetchColumn()) {
        fail('Choose a patient.', 404);
    }
    [$type, $title, $details, $date] = rec_fields($d);

    $fileName = $filePath = $fileMime = null;
    $file = $d['file'] ?? null;
    if (is_array($file) && !empty($file['data'])) {
        $bytes = base64_decode((string) $file['data'], true);
        if ($bytes === false || $bytes === '') {
            fail('The file could not be read. Please try again.');
        }
        if (strlen($bytes) > MAX_FILE_BYTES) {
            fail('The file is too large (5 MB max).');
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if (!array_key_exists($mime, FILE_TYPES)) {
            fail('Only JPG, PNG, WebP or PDF files are allowed.');
        }
        if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
            fail('The server could not create the storage folder.', 500);
        }
        $filePath = bin2hex(random_bytes(16)) . '.' . FILE_TYPES[$mime];
        if (file_put_contents($dir . '/' . $filePath, $bytes) === false) {
            fail('The server could not save the file.', 500);
        }
        $fileMime = $mime;
        $fileName = substr(preg_replace('/[^A-Za-z0-9._ -]/', '_', basename((string) ($file['name'] ?? 'file'))), 0, 200);
    }

    $pdo->prepare(
        'INSERT INTO records (patient_id, record_type, title, details, file_name, file_path, file_mime, record_date, added_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([(int) $d['patientId'], $type, $title, $details, $fileName, $filePath, $fileMime, $date, $staff['id']]);
    json_out(['record' => rec_out(fetch_rec($pdo, (int) $pdo->lastInsertId()))], 201);
}

$id = (int) ($d['id'] ?? 0);
$r = fetch_rec($pdo, $id);

if ($action === 'update') {
    [$type, $title, $details, $date] = rec_fields($d);
    $pdo->prepare('UPDATE records SET record_type = ?, title = ?, details = ?, record_date = ? WHERE id = ?')
        ->execute([$type, $title, $details, $date, $id]);
    json_out(['record' => rec_out(fetch_rec($pdo, $id))]);
}

if ($action === 'delete') {
    if ($staff['role'] !== 'admin') {
        fail('Only an administrator can delete a record.', 403);
    }
    if ($r['file_path']) {
        @unlink($dir . '/' . basename($r['file_path']));
    }
    $pdo->prepare('DELETE FROM records WHERE id = ?')->execute([$id]);
    json_out([]);
}

fail('Unknown action.');
