<?php
// Staff endpoint.
//   GET ?q=...        -> patient list + stats      GET ?brief=1 -> id/name list for drop-downs
//   GET ?id=N         -> one patient + billing + visit history + records + treatments
//   POST create | update | reset_password | delete (delete = admin only)
require __DIR__ . '/bootstrap.php';
$staff = require_staff();
$pdo = db();

function patient_out(array $u): array
{
    $age = (new DateTimeImmutable($u['birth_date']))->diff(new DateTimeImmutable('today'))->y;
    return [
        'id' => (int) $u['id'], 'firstName' => $u['first_name'], 'middleName' => $u['middle_name'], 'lastName' => $u['last_name'],
        'fullName' => public_user($u)['fullName'], 'username' => $u['username'],
        'email' => $u['email'], 'phone' => $u['phone'], 'address' => $u['address'] ?? '', 'gender' => $u['gender'],
        'birthDate' => $u['birth_date'], 'age' => $age, 'joined' => substr($u['created_at'], 0, 10),
    ];
}

function get_patient(PDO $pdo, int $id): array
{
    $st = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role = 'patient'");
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u) {
        fail('Patient not found.', 404);
    }
    return $u;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['brief'])) {
        $rows = $pdo->query("SELECT * FROM users WHERE role = 'patient' ORDER BY first_name, last_name LIMIT 2000")->fetchAll();
        json_out(['patients' => array_map(function ($u) {
            return ['id' => (int) $u['id'], 'fullName' => public_user($u)['fullName'], 'username' => $u['username']];
        }, $rows)]);
    }

    if (isset($_GET['id'])) {
        $u = get_patient($pdo, (int) $_GET['id']);
        $h = $pdo->prepare(
            'SELECT ' . APPT_COLS . ' FROM appointments a JOIN users u ON u.id = a.user_id
             WHERE a.user_id = ? ORDER BY a.appt_date DESC, a.appt_time DESC'
        );
        $h->execute([$u['id']]);
        $rec = $pdo->prepare('SELECT id, record_type, title, record_date FROM records WHERE patient_id = ? ORDER BY record_date DESC, id DESC LIMIT 50');
        $rec->execute([$u['id']]);
        $tr = $pdo->prepare('SELECT id, name, dentist, start_date, status FROM treatments WHERE patient_id = ? ORDER BY start_date DESC, id DESC LIMIT 50');
        $tr->execute([$u['id']]);
        json_out([
            'patient'      => patient_out($u),
            'billing'      => billing_totals((int) $u['id']),
            'appointments' => array_map('appt_out', $h->fetchAll()),
            'records'      => $rec->fetchAll(),
            'treatments'   => $tr->fetchAll(),
        ]);
    }

    $where = "u.role = 'patient'";
    $args = [];
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $like = '%' . addcslashes($q, '%_\\') . '%';
        $where .= " AND (CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.username LIKE ? OR u.address LIKE ?)";
        array_push($args, $like, $like, $like, $like, $like);
    }
    $st = $pdo->prepare(
        "SELECT u.*, COUNT(a.id) AS visits,
                MAX(CASE WHEN a.appt_date <= CURDATE() THEN a.appt_date END) AS last_visit,
                (SELECT COALESCE(SUM(GREATEST(b.fee - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.appointment_id = b.id), 0), 0)), 0)
                   FROM appointments b WHERE b.user_id = u.id AND b.status IN " . BILLABLE_SQL . ") AS due
         FROM users u LEFT JOIN appointments a ON a.user_id = u.id AND a.status IN ('approved','rescheduled','completed')
         WHERE $where GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500"
    );
    $st->execute($args);
    $out = [];
    foreach ($st->fetchAll() as $u) {
        $out[] = patient_out($u) + ['visits' => (int) $u['visits'], 'lastVisit' => $u['last_visit'], 'due' => money($u['due'])];
    }
    $s = $pdo->query(
        "SELECT COUNT(*) AS total, COALESCE(SUM(gender = 'male'), 0) AS male, COALESCE(SUM(gender = 'female'), 0) AS female,
                COALESCE(SUM(created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')), 0) AS new_month
         FROM users WHERE role = 'patient'"
    )->fetch();
    json_out(['patients' => $out, 'stats' => [
        'total' => (int) $s['total'], 'male' => (int) $s['male'], 'female' => (int) $s['female'], 'newMonth' => (int) $s['new_month'],
    ]]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();
$action = field($d, 'action');

if ($action === 'create') {
    $p = validate_profile($d, false);
    $username = field($d, 'username');
    if ($username === '') {
        $username = make_username((string) $p['first'], (string) $p['last']);
    }
    check_username($username);
    assert_unique($username, $p['email']);
    $temp = temp_password();
    $pdo->prepare(
        "INSERT INTO users (first_name, middle_name, last_name, gender, birth_date, email, phone, address, username, password_hash, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient')"
    )->execute([$p['first'], $p['middle'], $p['last'], $p['gender'], $p['birth'], $p['email'], $p['phone'], $p['address'],
                $username, password_hash($temp, PASSWORD_DEFAULT)]);
    json_out(['id' => (int) $pdo->lastInsertId(), 'username' => $username, 'tempPassword' => $temp], 201);
}

$u = get_patient($pdo, (int) ($d['id'] ?? 0));

if ($action === 'update') {
    $p = validate_profile($d, false);
    assert_unique($u['username'], $p['email'], (int) $u['id']);
    $pdo->prepare(
        'UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, gender = ?, birth_date = ?, email = ?, phone = ?, address = ? WHERE id = ?'
    )->execute([$p['first'], $p['middle'], $p['last'], $p['gender'], $p['birth'], $p['email'], $p['phone'], $p['address'], $u['id']]);
    json_out([]);
}

if ($action === 'reset_password') {
    $temp = temp_password();
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($temp, PASSWORD_DEFAULT), $u['id']]);
    json_out(['username' => $u['username'], 'tempPassword' => $temp]);
}

if ($action === 'delete') {
    if ($staff['role'] !== 'admin') {
        fail('Only an administrator can delete a patient.', 403);
    }
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
    json_out([]);
}

fail('Unknown action.');
