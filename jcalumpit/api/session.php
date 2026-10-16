<?php
require __DIR__ . '/bootstrap.php';
$u = current_user();
json_out(['loggedIn' => (bool) $u, 'user' => $u ? public_user($u) : null]);
