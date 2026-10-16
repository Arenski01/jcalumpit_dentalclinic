<?php
// Patient endpoint.  GET = my appointments, POST = request a new appointment.
require __DIR__ . '/bootstrap.php';
$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if ($method === 'GET') {
    $st = $pdo->prepare(
        'SELECT ' . APPT_COLS . ' FROM appointments a JOIN users u ON u.id = a.user_id
         WHERE a.user_id = ? ORDER BY a.appt_date DESC, a.appt_time DESC'
    );
    $st->execute([$user['id']]);
    json_out(['appointments' => array_map('appt_out', $st->fetchAll())]);
}

if ($method !== 'POST') {
    fail('Method not allowed.', 405);
}
if (is_staff($user)) {
    fail('Staff accounts manage appointments from the admin page. Please sign in with a patient account to book.', 403);
}

$d = read_json();
$name    = preg_replace('/\s+/', ' ', field($d, 'patient'));
$phone   = normalize_phone(field($d, 'phone'));
$email   = strtolower(field($d, 'email'));
$service = field($d, 'service');
$dentist = field($d, 'dentist') ?: 'Dr. Calumpit';
$date    = field($d, 'date');
$time    = field($d, 'slot');
$notes   = field($d, 'notes');

if (mb_strlen($name) < 2 || mb_strlen($name) > 150) {
    fail("Enter the patient's full name.");
}
if (!valid_phone($phone)) {
    fail('Use a valid PH number, e.g. 09171234567.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
    fail('Enter a valid email address.');
}
if ($service === '' || mb_strlen($service) > 100) {
    fail('Choose a service.');
}
if (mb_strlen($dentist) > 100) {
    fail('Invalid dentist.');
}
if (mb_strlen($notes) > 1000) {
    fail('Notes are too long (1000 characters max).');
}
check_slot($user, $date, $time);

$pdo->beginTransaction();

$cnt = $pdo->prepare(
    'SELECT COUNT(*) FROM appointments WHERE user_id = ? AND appt_date >= CURDATE() AND status IN ' . ACTIVE_SQL
);
$cnt->execute([$user['id']]);
if ((int) $cnt->fetchColumn() >= MAX_ACTIVE_PER_PATIENT) {
    fail('You already have ' . MAX_ACTIVE_PER_PATIENT . ' upcoming appointments. Please cancel one or wait for the clinic to complete it before booking another.', 409);
}

// Lock the slot so two patients can't take it at the same moment.
$clash = $pdo->prepare(
    'SELECT id FROM appointments WHERE appt_date = ? AND appt_time = ? AND status IN ' . ACTIVE_SQL . ' FOR UPDATE'
);
$clash->execute([$date, $time . ':00']);
if ($clash->fetch()) {
    fail('Sorry, that time was just taken. Please pick another slot.', 409, ['code' => 'slot_taken']);
}

$ins = $pdo->prepare(
    "INSERT INTO appointments (user_id, patient_name, phone, email, service, dentist, appt_date, appt_time, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
);
$ins->execute([$user['id'], $name, $phone, $email, $service, $dentist, $date, $time . ':00', $notes !== '' ? $notes : null]);
$id = (int) $pdo->lastInsertId();
$pdo->commit();

$row = $pdo->prepare('SELECT ' . APPT_COLS . ' FROM appointments a JOIN users u ON u.id = a.user_id WHERE a.id = ?');
$row->execute([$id]);
json_out(['appointment' => appt_out($row->fetch())], 201);
