<?php
// Names offered in the "Dentist" drop-downs.
require __DIR__ . '/bootstrap.php';
require_staff();
$st = db()->query("SELECT last_name FROM users WHERE role = 'dentist' AND is_active = 1 ORDER BY last_name");
$names = [];
foreach ($st->fetchAll() as $r) {
    $names['Dr. ' . $r['last_name']] = true;
}
if (!$names) {
    $names['Dr. Calumpit'] = true;
}
json_out(['dentists' => array_keys($names)]);
