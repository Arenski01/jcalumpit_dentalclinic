<?php
// Administrator-only: manage staff, dentist and admin accounts.
//   GET -> list + counts      POST create | update | set_active | reset_password | delete
require __DIR__ . '/bootstrap.php';
$admin = require_admin();
$pdo = db();

const STAFF_ROLES = ['admin', 'dentist', 'staff'];
const STAFF_ADDRESS = '2nd floor Banlicom Sentre 217 Maharlika Hwy, Banlic, Cabuyao, Philippines, 4025';

function user_out(array $u): array
{
    return [
        'id' => (int) $u['id'], 'firstName' => $u['first_name'], 'lastName' => $u['last_name'], 'fullName' => public_user($u)['fullName'],
        'role' => $u['role'], 'email' => $u['email'], 'phone' => $u['phone'], 'username' => $u['username'],
        'isActive' => (bool) (int) $u['is_active'], 'lastLogin' => $u['last_login'],
    ];
}

function staff_user(PDO $pdo, int $id): array
{
    $st = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role IN ('admin','dentist','staff')");
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u) {
        fail('User not found.', 404);
    }
    return $u;
}

/** Another active admin must always remain. */
function ensure_other_admin(PDO $pdo, int $exceptId): void
{
    $st = $pdo->prepare("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?");
    $st->execute([$exceptId]);
    if ((int) $st->fetchColumn() < 1) {
        fail('There must be at least one active administrator.', 409);
    }
}

function staff_fields(array $d): array
{
    $names = [];
    foreach (['firstName' => 'first name', 'lastName' => 'last name'] as $k => $label) {
        $v = preg_replace('/\s+/', ' ', field($d, $k));
        if ($v === '' || mb_strlen($v) > 60 || !preg_match("/^\p{L}[\p{L} .'\-]*$/u", $v)) {
            fail("Enter a valid $label.");
        }
        $names[$k] = $v;
    }
    $email = strtolower(field($d, 'email'));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
        fail('Enter a valid email address.');
    }
    $phone = normalize_phone(field($d, 'phone'));
    if (!valid_phone($phone)) {
        fail('Use a valid PH mobile number, e.g. 09171234567.');
    }
    $role = field($d, 'role');
    if (!in_array($role, STAFF_ROLES, true)) {
        fail('Choose a role.');
    }
    return [$names['firstName'], $names['lastName'], $email, $phone, $role];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query("SELECT * FROM users WHERE role IN ('admin','dentist','staff') ORDER BY FIELD(role,'admin','dentist','staff'), first_name")->fetchAll();
    $counts = ['total' => count($rows), 'admin' => 0, 'dentist' => 0, 'staff' => 0];
    foreach ($rows as $r) {
        $counts[$r['role']]++;
    }
    json_out(['users' => array_map('user_out', $rows), 'counts' => $counts, 'meId' => (int) $admin['id']]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}
$d = read_json();
$action = field($d, 'action');

if ($action === 'create') {
    [$first, $last, $email, $phone, $role] = staff_fields($d);
    $username = field($d, 'username');
    check_username($username);
    assert_unique($username, $email);
    $password = is_string($d['password'] ?? null) ? $d['password'] : '';
    $generated = false;
    if ($password === '') {
        $password = temp_password();
        $generated = true;
    } else {
        check_password_rules($password);
    }
    $pdo->prepare(
        "INSERT INTO users (first_name, middle_name, last_name, gender, birth_date, email, phone, address, username, password_hash, role)
         VALUES (?, NULL, ?, 'prefer-not-to-say', '1990-01-01', ?, ?, ?, ?, ?, ?)"
    )->execute([$first, $last, $email, $phone, STAFF_ADDRESS, $username, password_hash($password, PASSWORD_DEFAULT), $role]);
    json_out(['id' => (int) $pdo->lastInsertId(), 'username' => $username, 'tempPassword' => $generated ? $password : null], 201);
}

$u = staff_user($pdo, (int) ($d['id'] ?? 0));
$isSelf = (int) $u['id'] === (int) $admin['id'];

if ($action === 'update') {
    [$first, $last, $email, $phone, $role] = staff_fields($d);
    assert_unique($u['username'], $email, (int) $u['id']);
    if ($role !== $u['role']) {
        if ($isSelf) {
            fail('You can\'t change your own role.', 409);
        }
        if ($u['role'] === 'admin') {
            ensure_other_admin($pdo, (int) $u['id']);
        }
    }
    $pdo->prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ? WHERE id = ?')
        ->execute([$first, $last, $email, $phone, $role, $u['id']]);
    json_out([]);
}

if ($action === 'set_active') {
    $active = !empty($d['active']) ? 1 : 0;
    if (!$active) {
        if ($isSelf) {
            fail('You can\'t deactivate your own account.', 409);
        }
        if ($u['role'] === 'admin') {
            ensure_other_admin($pdo, (int) $u['id']);
        }
    }
    $pdo->prepare('UPDATE users SET is_active = ? WHERE id = ?')->execute([$active, $u['id']]);
    json_out([]);
}

if ($action === 'reset_password') {
    $temp = temp_password();
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($temp, PASSWORD_DEFAULT), $u['id']]);
    json_out(['username' => $u['username'], 'tempPassword' => $temp]);
}

if ($action === 'delete') {
    if ($isSelf) {
        fail('You can\'t delete your own account.', 409);
    }
    if ($u['role'] === 'admin') {
        ensure_other_admin($pdo, (int) $u['id']);
    }
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
    json_out([]);
}

fail('Unknown action.');
