<?php
// Staff endpoint.  GET ?appointment_id=N -> fee, payments, balance
//                   POST {action: set_fee | add_payment | delete_payment, ...}
require __DIR__ . '/bootstrap.php';
$staff = require_staff();
$pdo = db();

const PAY_METHODS = ['cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other'];

function peso(float $n): string
{
    return '₱' . number_format($n, 2);
}

function parse_amount($v): float
{
    if (is_string($v)) {
        $v = str_replace(',', '', trim($v));
    }
    if ($v === '' || $v === null || !is_numeric($v)) {
        fail('Enter a valid amount.');
    }
    $n = round((float) $v, 2);
    if ($n < 0 || $n > 1000000) {
        fail('Amount must be between 0 and 1,000,000.');
    }
    return $n;
}

function billing_state(PDO $pdo, int $apptId): array
{
    $st = $pdo->prepare('SELECT ' . APPT_COLS . ' FROM appointments a JOIN users u ON u.id = a.user_id WHERE a.id = ?');
    $st->execute([$apptId]);
    $a = $st->fetch();
    if (!$a) {
        fail('Appointment not found.', 404);
    }
    $p = $pdo->prepare(
        'SELECT p.*, r.first_name AS rec_name FROM payments p LEFT JOIN users r ON r.id = p.recorded_by
         WHERE p.appointment_id = ? ORDER BY p.paid_at DESC, p.id DESC'
    );
    $p->execute([$apptId]);
    $payments = [];
    foreach ($p->fetchAll() as $row) {
        $payments[] = [
            'id' => (int) $row['id'], 'amount' => money($row['amount']), 'method' => $row['method'],
            'reference' => $row['reference'], 'note' => $row['note'], 'paidAt' => $row['paid_at'],
            'recordedBy' => $row['rec_name'],
        ];
    }
    return ['appointment' => appt_out($a), 'payments' => $payments];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['list'])) {
        json_out(billing_state($pdo, (int) ($_GET['appointment_id'] ?? 0)));
    }

    // Invoice list: every approved/rescheduled/completed visit, with its fee, payments and status.
    $rows = $pdo->query(
        'SELECT ' . APPT_COLS . ' FROM appointments a JOIN users u ON u.id = a.user_id
         WHERE a.status IN ' . BILLABLE_SQL . ' ORDER BY COALESCE(a.billed_at, a.created_at) DESC, a.id DESC LIMIT 1000'
    )->fetchAll();
    $today = date('Y-m-d');
    $invoices = [];
    $billed = 0.0;
    $paidTotal = 0.0;
    $count = 0;
    foreach ($rows as $r) {
        $fee = money($r['fee']);
        $paid = min(money($r['paid']), $fee);
        $date = $r['billed_at'] ? substr($r['billed_at'], 0, 10) : null;
        $due = $date ? date('Y-m-d', strtotime($date . ' +' . INVOICE_DUE_DAYS . ' days')) : null;
        if ($fee <= 0) {
            $status = 'notbilled';
        } else {
            $status = $paid >= $fee ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');
            $billed += $fee;
            $paidTotal += $paid;
            $count++;
        }
        $invoices[] = [
            'id' => (int) $r['id'], 'userId' => (int) $r['user_id'], 'patientName' => $r['patient_name'], 'service' => $r['service'],
            'apptDate' => $r['appt_date'], 'invoiceDate' => $date, 'dueDate' => $due, 'fee' => $fee, 'paid' => $paid,
            'balance' => round(max($fee - $paid, 0), 2), 'status' => $status,
            'overdue' => $status !== 'paid' && $status !== 'notbilled' && $due !== null && $due < $today,
        ];
    }
    json_out(['invoices' => $invoices, 'stats' => [
        'billed' => round($billed, 2), 'paid' => round($paidTotal, 2),
        'outstanding' => round(max($billed - $paidTotal, 0), 2), 'invoices' => $count,
    ]]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}

$d = read_json();
$action = field($d, 'action');

if ($action === 'delete_payment') {
    if ($staff['role'] !== 'admin') {
        fail('Only an admin can remove a payment.', 403);
    }
    $st = $pdo->prepare('SELECT appointment_id FROM payments WHERE id = ?');
    $st->execute([(int) ($d['paymentId'] ?? 0)]);
    $apptId = $st->fetchColumn();
    if (!$apptId) {
        fail('Payment not found.', 404);
    }
    $pdo->prepare('DELETE FROM payments WHERE id = ?')->execute([(int) $d['paymentId']]);
    json_out(billing_state($pdo, (int) $apptId));
}

if (!in_array($action, ['set_fee', 'add_payment'], true)) {
    fail('Unknown action.');
}

$apptId = (int) ($d['appointmentId'] ?? 0);
$pdo->beginTransaction();
$st = $pdo->prepare('SELECT * FROM appointments WHERE id = ? FOR UPDATE');
$st->execute([$apptId]);
$a = $st->fetch();
if (!$a) {
    fail('Appointment not found.', 404);
}
if (!in_array($a['status'], BILLABLE, true)) {
    fail('Billing is available once an appointment is approved.', 409);
}

$sum = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE appointment_id = ?');
$sum->execute([$apptId]);
$paid = money($sum->fetchColumn());
$fee = money($a['fee']);

if ($action === 'set_fee') {
    $newFee = parse_amount($d['fee'] ?? null);
    if ($newFee < $paid) {
        fail('The fee can\'t be lower than the ' . peso($paid) . ' already paid. Remove a payment first if it was a mistake.', 409);
    }
    $pdo->prepare('UPDATE appointments SET fee = ?, billed_at = CASE WHEN ? > 0 THEN COALESCE(billed_at, NOW()) ELSE NULL END WHERE id = ?')
        ->execute([$newFee, $newFee, $apptId]);
} else {
    $amount = parse_amount($d['amount'] ?? null);
    if ($amount <= 0) {
        fail('Enter a payment amount greater than zero.');
    }
    if ($fee <= 0) {
        fail('Set the fee for this visit before recording a payment.', 409);
    }
    if ($amount > round($fee - $paid, 2) + 0.001) {
        fail('That is more than the remaining balance of ' . peso(max($fee - $paid, 0)) . '.', 409);
    }
    $method = field($d, 'method');
    if (!in_array($method, PAY_METHODS, true)) {
        fail('Choose a payment method.');
    }
    $ref = field($d, 'reference');
    $note = field($d, 'note');
    if (mb_strlen($ref) > 100 || mb_strlen($note) > 255) {
        fail('The reference or note is too long.');
    }
    $pdo->prepare(
        'INSERT INTO payments (appointment_id, user_id, amount, method, reference, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([$apptId, $a['user_id'], $amount, $method, $ref !== '' ? $ref : null, $note !== '' ? $note : null, $staff['id']]);
}
$pdo->commit();
json_out(billing_state($pdo, $apptId));
