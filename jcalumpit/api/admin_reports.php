<?php
// Staff reports.  GET ?period=this_month|last_month|last_30|this_year
require __DIR__ . '/bootstrap.php';
require_staff();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed.', 405);
}
$pdo = db();
$today = new DateTimeImmutable('today');
$period = (string) ($_GET['period'] ?? 'this_month');

switch ($period) {
    case 'last_month':
        $from = $today->modify('first day of last month');
        $to = $today->modify('last day of last month');
        $pFrom = $from->modify('first day of last month');
        $pTo = $from->modify('-1 day');
        break;
    case 'last_30':
        $from = $today->modify('-29 days');
        $to = $today;
        $pFrom = $today->modify('-59 days');
        $pTo = $today->modify('-30 days');
        break;
    case 'this_year':
        $from = new DateTimeImmutable($today->format('Y') . '-01-01');
        $to = new DateTimeImmutable($today->format('Y') . '-12-31');
        $pFrom = $from->modify('-1 year');
        $pTo = $to->modify('-1 year');
        break;
    case 'this_month':
    default:
        $period = 'this_month';
        $from = $today->modify('first day of this month');
        $to = $today->modify('last day of this month');
        $pFrom = $from->modify('first day of last month');
        $pTo = $from->modify('-1 day');
}

function metrics(PDO $pdo, string $from, string $to): array
{
    $one = function (string $sql) use ($pdo, $from, $to) {
        $st = $pdo->prepare($sql);
        $st->execute([$from, $to]);
        return $st->fetchColumn();
    };
    return [
        'appointments' => (int) $one("SELECT COUNT(*) FROM appointments WHERE appt_date BETWEEN ? AND ? AND status NOT IN ('declined','cancelled')"),
        'newPatients'  => (int) $one("SELECT COUNT(*) FROM users WHERE role = 'patient' AND DATE(created_at) BETWEEN ? AND ?"),
        'revenue'      => round((float) $one('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(paid_at) BETWEEN ? AND ?'), 2),
        'treatments'   => (int) $one("SELECT COUNT(*) FROM treatments WHERE status = 'completed' AND completed_on BETWEEN ? AND ?"),
    ];
}

$f = $from->format('Y-m-d');
$t = $to->format('Y-m-d');
$cur = metrics($pdo, $f, $t);
$prev = metrics($pdo, $pFrom->format('Y-m-d'), $pTo->format('Y-m-d'));
$change = [];
foreach ($cur as $k => $v) {
    $change[$k] = $prev[$k] > 0 ? (int) round(($v - $prev[$k]) / $prev[$k] * 100) : null;
}

// Per-day counts / revenue, then bucketed below
$ap = [];
$st = $pdo->prepare("SELECT appt_date AS d, COUNT(*) AS c FROM appointments WHERE appt_date BETWEEN ? AND ? AND status NOT IN ('declined','cancelled') GROUP BY appt_date");
$st->execute([$f, $t]);
foreach ($st->fetchAll() as $r) {
    $ap[$r['d']] = (int) $r['c'];
}
$rv = [];
$st = $pdo->prepare('SELECT DATE(paid_at) AS d, SUM(amount) AS s FROM payments WHERE DATE(paid_at) BETWEEN ? AND ? GROUP BY DATE(paid_at)');
$st->execute([$f, $t]);
foreach ($st->fetchAll() as $r) {
    $rv[$r['d']] = (float) $r['s'];
}

$appointmentsSeries = [];
$revenueSeries = [];
if ($period === 'this_year') {
    for ($m = 1; $m <= 12; $m++) {
        $key = sprintf('%s-%02d', $today->format('Y'), $m);
        $c = 0;
        $s = 0.0;
        foreach ($ap as $d => $v) {
            if (strpos($d, $key) === 0) {
                $c += $v;
            }
        }
        foreach ($rv as $d => $v) {
            if (strpos($d, $key) === 0) {
                $s += $v;
            }
        }
        $label = date('M', strtotime($key . '-01'));
        $appointmentsSeries[] = ['label' => $label, 'value' => $c];
        $revenueSeries[] = ['label' => $label, 'value' => round($s, 2)];
    }
} else {
    for ($d = $from; $d <= $to; $d = $d->modify('+1 day')) {
        $appointmentsSeries[] = ['label' => $d->format('M j'), 'value' => $ap[$d->format('Y-m-d')] ?? 0];
    }
    // revenue in 7-day blocks
    for ($start = $from; $start <= $to; $start = $start->modify('+7 days')) {
        $end = $start->modify('+6 days');
        if ($end > $to) {
            $end = $to;
        }
        $sum = 0.0;
        for ($d = $start; $d <= $end; $d = $d->modify('+1 day')) {
            $sum += $rv[$d->format('Y-m-d')] ?? 0;
        }
        $revenueSeries[] = ['label' => $start->format('M j'), 'value' => round($sum, 2)];
    }
}

$st = $pdo->prepare("SELECT service, COUNT(*) AS c FROM appointments WHERE appt_date BETWEEN ? AND ? AND status NOT IN ('declined','cancelled') GROUP BY service ORDER BY c DESC");
$st->execute([$f, $t]);
$services = [];
$other = 0;
foreach ($st->fetchAll() as $i => $r) {
    if ($i < 4) {
        $services[] = ['label' => $r['service'], 'value' => (int) $r['c']];
    } else {
        $other += (int) $r['c'];
    }
}
if ($other > 0) {
    $services[] = ['label' => 'Other', 'value' => $other];
}

json_out([
    'period' => $period, 'from' => $f, 'to' => $t,
    'metrics' => $cur, 'previous' => $prev, 'change' => $change,
    'appointmentsSeries' => $appointmentsSeries, 'revenueSeries' => $revenueSeries, 'services' => $services,
]);
