<?php
// Staff endpoint.
//   GET  = list/filter appointments (+ overall counts)
//   POST = approve | decline | reschedule | complete | cancel | create (walk-in/phone booking) | delete (admin)
require __DIR__ . '/bootstrap.php';
$staff = require_staff();
$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

const SELECT_APPT = 'SELECT ' . APPT_COLS . ' FROM appointments a JOIN users u ON u.id = a.user_id';

if ($method === 'GET') {
    $where = [];
    $args = [];

    $status = (string) ($_GET['status'] ?? '');
    if ($status !== '' && $status !== 'all') {
        $list = array_values(array_filter(explode(',', $status)));
        foreach ($list as $s) {
            if (!in_array($s, STATUSES, true)) {
                fail('Unknown status.');
            }
        }
        $where[] = 'a.status IN (' . implode(',', array_fill(0, count($list), '?')) . ')';
        array_push($args, ...$list);
    }
    $date = (string) ($_GET['date'] ?? '');
    if ($date !== '') {
        if (!valid_date($date)) {
            fail('Invalid date.');
        }
        $where[] = 'a.appt_date = ?';
        $args[] = $date;
    }
    foreach (['from' => '>=', 'to' => '<='] as $key => $op) {
        $v = (string) ($_GET[$key] ?? '');
        if ($v !== '') {
            if (!valid_date($v)) {
                fail('Invalid date.');
            }
            $where[] = "a.appt_date $op ?";
            $args[] = $v;
        }
    }
    $range = (string) ($_GET['range'] ?? 'all');
    $order = 'ASC';
    if ($range === 'upcoming') {
        $where[] = 'a.appt_date >= CURDATE()';
    } elseif ($range === 'past') {
        $where[] = 'a.appt_date < CURDATE()';
        $order = 'DESC';
    }
    if (($_GET['sort'] ?? '') === 'desc') {
        $order = 'DESC';
    } elseif (($_GET['sort'] ?? '') === 'asc') {
        $order = 'ASC';
    }
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $like = '%' . addcslashes($q, '%_\\') . '%';
        $where[] = '(a.patient_name LIKE ? OR a.phone LIKE ? OR a.email LIKE ? OR u.username LIKE ? OR a.service LIKE ?)';
        array_push($args, $like, $like, $like, $like, $like);
    }

    $sql = SELECT_APPT . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . " ORDER BY a.appt_date $order, a.appt_time $order LIMIT 500";
    $st = $pdo->prepare($sql);
    $st->execute($args);

    $c = $pdo->query(
        "SELECT COUNT(*) AS total,
                COALESCE(SUM(status = 'pending'), 0) AS pending,
                COALESCE(SUM(status IN ('approved','rescheduled') AND appt_date >= CURDATE()), 0) AS upcoming,
                COALESCE(SUM(status = 'completed'), 0) AS completed,
                COALESCE(SUM(status IN ('cancelled','declined')), 0) AS cancelled
         FROM appointments"
    )->fetch();
    json_out([
        'appointments' => array_map('appt_out', $st->fetchAll()),
        'counts' => array_map('intval', $c),
    ]);
}

if ($method !== 'POST') {
    fail('Method not allowed.', 405);
}

$d = read_json();
$action = field($d, 'action');
$note = field($d, 'note');
if (mb_strlen($note) > 500) {
    fail('The note is too long (500 characters max).');
}

function fetch_appt(PDO $pdo, int $id): array
{
    $row = $pdo->prepare(SELECT_APPT . ' WHERE a.id = ?');
    $row->execute([$id]);
    return appt_out($row->fetch());
}

/* ----- staff books on behalf of a patient (approved straight away) ----- */
if ($action === 'create') {
    $pu = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role = 'patient'");
    $pu->execute([(int) ($d['patientId'] ?? 0)]);
    $patient = $pu->fetch();
    if (!$patient) {
        fail('Choose a patient.', 404);
    }
    $service = field($d, 'service');
    $dentist = field($d, 'dentist') ?: 'Dr. Calumpit';
    $date = field($d, 'date');
    $time = field($d, 'time');
    $notes = field($d, 'notes');
    if ($service === '' || mb_strlen($service) > 100) {
        fail('Choose a service.');
    }
    if (mb_strlen($dentist) > 100 || mb_strlen($notes) > 1000) {
        fail('Dentist or notes are too long.');
    }
    check_slot($staff, $date, $time);

    $pdo->beginTransaction();
    $clash = $pdo->prepare(
        'SELECT id FROM appointments WHERE appt_date = ? AND appt_time = ? AND status IN ' . ACTIVE_SQL . ' FOR UPDATE'
    );
    $clash->execute([$date, $time . ':00']);
    if ($clash->fetch()) {
        fail('That slot is already taken by another appointment.', 409, ['code' => 'slot_taken']);
    }
    $pdo->prepare(
        "INSERT INTO appointments (user_id, patient_name, phone, email, service, dentist, appt_date, appt_time, notes, admin_note, status, handled_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)"
    )->execute([
        $patient['id'], public_user($patient)['fullName'], $patient['phone'], $patient['email'], $service, $dentist,
        $date, $time . ':00', $notes !== '' ? $notes : null, $note !== '' ? $note : null, $staff['id'],
    ]);
    $id = (int) $pdo->lastInsertId();
    $pdo->commit();
    json_out(['appointment' => fetch_appt($pdo, $id)], 201);
}

$id = (int) ($d['id'] ?? 0);

if ($action === 'delete') {
    if ($staff['role'] !== 'admin') {
        fail('Only an administrator can delete an appointment.', 403);
    }
    $pdo->prepare('DELETE FROM appointments WHERE id = ?')->execute([$id]);
    json_out([]);
}

$allowed = [
    'pending'     => ['approve', 'decline', 'reschedule', 'cancel'],
    'approved'    => ['reschedule', 'complete', 'cancel'],
    'rescheduled' => ['reschedule', 'complete', 'cancel'],
];

$pdo->beginTransaction();
$st = $pdo->prepare('SELECT * FROM appointments WHERE id = ? FOR UPDATE');
$st->execute([$id]);
$a = $st->fetch();
if (!$a) {
    fail('Appointment not found.', 404);
}
if (!in_array($action, $allowed[$a['status']] ?? [], true)) {
    fail('You can\'t "' . $action . '" an appointment that is ' . $a['status'] . '.', 409);
}

$noteVal = $note !== '' ? $note : null;

if ($action === 'reschedule') {
    $newDate = field($d, 'date');
    $newTime = field($d, 'time');
    check_slot($staff, $newDate, $newTime);
    if ($newDate === $a['appt_date'] && $newTime . ':00' === $a['appt_time']) {
        fail('Choose a different date or time than the current one.');
    }
    $clash = $pdo->prepare(
        'SELECT id FROM appointments WHERE appt_date = ? AND appt_time = ? AND id <> ? AND status IN ' . ACTIVE_SQL . ' FOR UPDATE'
    );
    $clash->execute([$newDate, $newTime . ':00', $id]);
    if ($clash->fetch()) {
        fail('That slot is already taken by another appointment.', 409, ['code' => 'slot_taken']);
    }
    $pdo->prepare(
        "UPDATE appointments SET prev_date = appt_date, prev_time = appt_time, appt_date = ?, appt_time = ?,
         status = 'rescheduled', admin_note = ?, handled_by = ? WHERE id = ?"
    )->execute([$newDate, $newTime . ':00', $noteVal, $staff['id'], $id]);
} else {
    if ($action === 'complete' && $a['appt_date'] > date('Y-m-d')) {
        fail('A visit can only be marked completed on or after its appointment date.', 409);
    }
    $newStatus = ['approve' => 'approved', 'decline' => 'declined', 'cancel' => 'cancelled', 'complete' => 'completed'][$action];
    $pdo->prepare('UPDATE appointments SET status = ?, admin_note = ?, handled_by = ? WHERE id = ?')
        ->execute([$newStatus, $noteVal, $staff['id'], $id]);
}
$pdo->commit();

json_out(['appointment' => fetch_appt($pdo, $id)]);
