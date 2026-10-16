<?php
// Patient endpoint: how much I've been billed / paid / still owe, plus my payment history.
require __DIR__ . '/bootstrap.php';
$user = require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed.', 405);
}

$st = db()->prepare(
    'SELECT p.id, p.amount, p.method, p.reference, p.paid_at, a.id AS appt_id, a.service, a.appt_date, a.status
     FROM payments p JOIN appointments a ON a.id = p.appointment_id
     WHERE p.user_id = ? ORDER BY p.paid_at DESC, p.id DESC LIMIT 100'
);
$st->execute([$user['id']]);

$payments = [];
foreach ($st->fetchAll() as $p) {
    $payments[] = [
        'id' => (int) $p['id'], 'amount' => money($p['amount']), 'method' => $p['method'],
        'reference' => $p['reference'], 'paidAt' => $p['paid_at'], 'appointmentId' => (int) $p['appt_id'],
        'service' => $p['service'], 'apptDate' => $p['appt_date'], 'apptStatus' => $p['status'],
    ];
}
json_out(['summary' => billing_totals((int) $user['id']), 'payments' => $payments]);
