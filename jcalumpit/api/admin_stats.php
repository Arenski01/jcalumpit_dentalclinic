<?php
// Staff dashboard numbers (cards, weekly chart, patient statistics, bell badge).
require __DIR__ . '/bootstrap.php';
require_staff();
$pdo = db();

$r = $pdo->query(
    "SELECT
        COALESCE(SUM(status = 'pending'), 0) AS pending,
        COALESCE(SUM(status IN ('pending','approved','rescheduled','completed') AND appt_date = CURDATE()), 0) AS today,
        COALESCE(SUM(status IN ('approved','rescheduled') AND appt_date >= CURDATE()), 0) AS upcoming,
        COALESCE(SUM(status = 'completed'), 0) AS completed,
        COUNT(*) AS total
     FROM appointments"
)->fetch();

$p = $pdo->query(
    "SELECT COUNT(*) AS total,
            COALESCE(SUM(u.created_at >= (CURDATE() - INTERVAL 30 DAY)), 0) AS new_p,
            COALESCE(SUM(u.created_at < (CURDATE() - INTERVAL 30 DAY) AND EXISTS (
                SELECT 1 FROM appointments a WHERE a.user_id = u.id AND a.status IN ('approved','rescheduled','completed')
                AND a.appt_date >= (CURDATE() - INTERVAL 180 DAY))), 0) AS returning_p
     FROM users u WHERE u.role = 'patient'"
)->fetch();
$new = (int) $p['new_p'];
$returning = (int) $p['returning_p'];
$patients = (int) $p['total'];

// Appointments per week of the current month (week 1 = days 1-7, ...)
$weeks = (int) ceil((int) date('t') / 7);
$weekly = array_fill(1, $weeks, 0);
$w = $pdo->query(
    "SELECT FLOOR((DAY(appt_date) - 1) / 7) + 1 AS wk, COUNT(*) AS c FROM appointments
     WHERE appt_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND appt_date <= LAST_DAY(CURDATE())
       AND status NOT IN ('declined','cancelled') GROUP BY wk"
)->fetchAll();
foreach ($w as $row) {
    $weekly[(int) $row['wk']] = (int) $row['c'];
}

$outstanding = (float) $pdo->query(
    "SELECT COALESCE(SUM(GREATEST(a.fee - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.appointment_id = a.id), 0), 0)), 0)
     FROM appointments a WHERE a.status IN " . BILLABLE_SQL
)->fetchColumn();
$collected = (float) $pdo->query(
    "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE paid_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')"
)->fetchColumn();

json_out(['stats' => [
    'pending'          => (int) $r['pending'],
    'today'            => (int) $r['today'],
    'upcoming'         => (int) $r['upcoming'],
    'completed'        => (int) $r['completed'],
    'total'            => (int) $r['total'],
    'patients'         => $patients,
    'activeTreatments' => (int) $pdo->query("SELECT COUNT(*) FROM treatments WHERE status = 'ongoing'")->fetchColumn(),
    'records'          => (int) $pdo->query('SELECT COUNT(*) FROM records')->fetchColumn(),
    'outstanding'      => round($outstanding, 2),
    'collected'        => round($collected, 2),
    'weekly'           => array_values($weekly),
    'patientStats'     => ['new' => $new, 'returning' => $returning, 'inactive' => max($patients - $new - $returning, 0)],
]]);
