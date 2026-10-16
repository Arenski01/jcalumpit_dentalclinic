<?php
// Any signed-in user changes their own password.
require __DIR__ . '/bootstrap.php';
$user = require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();
$current = is_string($d['current'] ?? null) ? $d['current'] : '';
$new = is_string($d['password'] ?? null) ? $d['password'] : '';

if (!password_verify($current, $user['password_hash'])) {
    usleep(400000);
    fail('Your current password is incorrect.', 403);
}
check_password_rules($new);
if ($new !== ($d['confirmPassword'] ?? null)) {
    fail('The new passwords do not match.');
}
if ($new === $current) {
    fail('Choose a password that is different from the current one.');
}
db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    ->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);
json_out([]);
