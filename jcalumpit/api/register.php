<?php
require __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();

$p = validate_profile($d, true);

$username = field($d, 'username');
check_username($username);

$password = isset($d['password']) && is_string($d['password']) ? $d['password'] : '';
check_password_rules($password);
if ($password !== ($d['confirmPassword'] ?? null)) {
    fail('Passwords do not match!');
}

assert_unique($username, $p['email']);

$pdo = db();
try {
    $ins = $pdo->prepare(
        "INSERT INTO users (first_name, middle_name, last_name, gender, birth_date, email, phone, address, username, password_hash, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient')"
    );
    $ins->execute([
        $p['first'], $p['middle'], $p['last'], $p['gender'], $p['birth'], $p['email'], $p['phone'], $p['address'],
        $username, password_hash($password, PASSWORD_DEFAULT),
    ]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        fail('That username or email is already registered.', 409);
    }
    throw $e;
}

// Creating an account signs the patient in right away.
session_regenerate_id(true);
$_SESSION['uid'] = (int) $pdo->lastInsertId();
$pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$_SESSION['uid']]);
json_out(['user' => public_user(current_user())], 201);
