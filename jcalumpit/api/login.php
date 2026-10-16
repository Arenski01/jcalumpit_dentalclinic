<?php
require __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();

$id = field($d, 'identifier');
$password = isset($d['password']) && is_string($d['password']) ? $d['password'] : '';
if ($id === '' || $password === '') {
    fail('Please enter your username/email and password.');
}

$st = db()->prepare('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1');
$st->execute([$id, strtolower($id)]);
$u = $st->fetch();

if (!$u || !password_verify($password, $u['password_hash'])) {
    usleep(400000);   // slow down password guessing a little
    fail('Incorrect username/email or password.', 401);
}

if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
}

if (!(int) $u['is_active']) {
    fail('This account has been deactivated. Please contact the clinic.', 403);
}

session_regenerate_id(true);
$_SESSION['uid'] = (int) $u['id'];
db()->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$u['id']]);

if (!empty($d['remember'])) {
    setcookie(session_name(), session_id(), [
        'expires' => time() + 60 * 60 * 24 * 30, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
    ]);
}

json_out(['user' => public_user($u)]);
