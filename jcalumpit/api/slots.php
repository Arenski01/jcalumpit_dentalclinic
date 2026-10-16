<?php
// GET api/slots.php?date=YYYY-MM-DD[&exclude=ID]  ->  open/taken time slots for that day
require __DIR__ . '/bootstrap.php';
$user = require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed.', 405);
}

$dateStr = (string) ($_GET['date'] ?? '');
$d = valid_date($dateStr);
if (!$d) {
    fail('Please choose a valid date.');
}

$min = earliest_bookable($user);
$max = (new DateTimeImmutable('today'))->modify('+' . BOOKING_WINDOW_DAYS . ' days');
if ($d < $min || $d > $max) {
    json_out(['date' => $dateStr, 'open' => false, 'slots' => [],
              'message' => $d < $min ? 'Please pick a later date.' : 'That date is too far ahead.']);
}

$times = slot_times($d);
if (!$times) {
    json_out(['date' => $dateStr, 'open' => false, 'slots' => [],
              'message' => 'The clinic is closed on Sundays. Please pick another date.']);
}

$exclude = is_staff($user) ? (int) ($_GET['exclude'] ?? 0) : 0;
$taken = taken_times($dateStr, $exclude);
$isToday = $dateStr === date('Y-m-d');

$slots = [];
foreach ($times as $t) {
    $past = $isToday && strtotime($t) <= time();
    $slots[] = ['time' => $t, 'label' => time_label($t), 'taken' => $past || in_array($t, $taken, true)];
}
json_out(['date' => $dateStr, 'open' => true, 'slots' => $slots]);
