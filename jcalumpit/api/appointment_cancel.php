<?php
// Patient cancels one of their own upcoming appointments.
require __DIR__ . '/bootstrap.php';
$user = require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();
$id = (int) ($d['id'] ?? 0);

$pdo = db();
$st = $pdo->prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?');
$st->execute([$id, $user['id']]);
$a = $st->fetch();
if (!$a) {
    fail('Appointment not found.', 404);
}
if (!in_array($a['status'], ['pending', 'approved', 'rescheduled'], true)) {
    fail('This appointment can no longer be cancelled.', 409);
}
if ($a['appt_date'] < date('Y-m-d')) {
    fail('Past appointments cannot be cancelled.', 409);
}

$pdo->prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?")->execute([$id]);
json_out([]);
