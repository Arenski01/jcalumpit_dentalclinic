<?php
// Staff endpoint for treatments / treatment plans.
//   GET ?status=&q=  -> list + counts      POST create | update | delete (admin only)
require __DIR__ . '/bootstrap.php';
$staff = require_staff();
$pdo = db();

const TR_STATUSES = ['plan', 'ongoing', 'completed', 'cancelled'];
const TR_SELECT = "SELECT t.*, CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name
                   FROM treatments t JOIN users p ON p.id = t.patient_id";

function tr_out(array $t): array
{
    return [
        'id' => (int) $t['id'], 'patientId' => (int) $t['patient_id'], 'patientName' => preg_replace('/\s+/', ' ', $t['patient_name']),
        'name' => $t['name'], 'dentist' => $t['dentist'], 'startDate' => $t['start_date'], 'status' => $t['status'],
        'completedOn' => $t['completed_on'], 'notes' => $t['notes'],
    ];
}

function tr_fields(array $d): array
{
    $name = field($d, 'name');
    if ($name === '' || mb_strlen($name) > 150) {
        fail('Enter the treatment name (150 characters max).');
    }
    $dentist = field($d, 'dentist') ?: 'Dr. Calumpit';
    if (mb_strlen($dentist) > 100) {
        fail('The dentist name is too long.');
    }
    $start = field($d, 'startDate');
    if (!valid_date($start)) {
        fail('Enter a valid start date.');
    }
    $status = field($d, 'status');
    if (!in_array($status, TR_STATUSES, true)) {
        fail('Choose a status.');
    }
    $notes = field($d, 'notes');
    if (mb_strlen($notes) > 5000) {
        fail('The notes are too long.');
    }
    return [$name, $dentist, $start, $status, $notes !== '' ? $notes : null];
}

function fetch_tr(PDO $pdo, int $id): array
{
    $st = $pdo->prepare(TR_SELECT . ' WHERE t.id = ?');
    $st->execute([$id]);
    $t = $st->fetch();
    if (!$t) {
        fail('Treatment not found.', 404);
    }
    return $t;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $args = [];
    $status = (string) ($_GET['status'] ?? '');
    if ($status !== '' && $status !== 'all') {
        if (!in_array($status, TR_STATUSES, true)) {
            fail('Unknown status.');
        }
        $where[] = 't.status = ?';
        $args[] = $status;
    }
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $like = '%' . addcslashes($q, '%_\\') . '%';
        $where[] = "(t.name LIKE ? OR t.dentist LIKE ? OR CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) LIKE ?)";
        array_push($args, $like, $like, $like);
    }
    $st = $pdo->prepare(TR_SELECT . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY t.start_date DESC, t.id DESC LIMIT 1000');
    $st->execute($args);
    $counts = array_fill_keys(TR_STATUSES, 0);
    foreach ($pdo->query('SELECT status, COUNT(*) AS c FROM treatments GROUP BY status')->fetchAll() as $row) {
        $counts[$row['status']] = (int) $row['c'];
    }
    json_out(['treatments' => array_map('tr_out', $st->fetchAll()), 'counts' => $counts]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();
$action = field($d, 'action');

if ($action === 'create') {
    $pt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'patient'");
    $pt->execute([(int) ($d['patientId'] ?? 0)]);
    if (!$pt->fetchColumn()) {
        fail('Choose a patient.', 404);
    }
    [$name, $dentist, $start, $status, $notes] = tr_fields($d);
    $pdo->prepare(
        'INSERT INTO treatments (patient_id, name, dentist, start_date, status, completed_on, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([(int) $d['patientId'], $name, $dentist, $start, $status, $status === 'completed' ? date('Y-m-d') : null, $notes, $staff['id']]);
    json_out(['treatment' => tr_out(fetch_tr($pdo, (int) $pdo->lastInsertId()))], 201);
}

$id = (int) ($d['id'] ?? 0);
$t = fetch_tr($pdo, $id);

if ($action === 'update') {
    [$name, $dentist, $start, $status, $notes] = tr_fields($d);
    $completedOn = $status === 'completed' ? ($t['completed_on'] ?: date('Y-m-d')) : null;
    $pdo->prepare('UPDATE treatments SET name = ?, dentist = ?, start_date = ?, status = ?, completed_on = ?, notes = ? WHERE id = ?')
        ->execute([$name, $dentist, $start, $status, $completedOn, $notes, $id]);
    json_out(['treatment' => tr_out(fetch_tr($pdo, $id))]);
}

if ($action === 'delete') {
    if ($staff['role'] !== 'admin') {
        fail('Only an administrator can delete a treatment.', 403);
    }
    $pdo->prepare('DELETE FROM treatments WHERE id = ?')->execute([$id]);
    json_out([]);
}

fail('Unknown action.');
