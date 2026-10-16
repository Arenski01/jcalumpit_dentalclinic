<?php
// Streams a stored record file (X-ray, PDF...) to signed-in staff only.
require __DIR__ . '/bootstrap.php';
require_staff();

$st = db()->prepare('SELECT file_name, file_path, file_mime FROM records WHERE id = ? AND file_path IS NOT NULL');
$st->execute([(int) ($_GET['id'] ?? 0)]);
$r = $st->fetch();
$path = $r ? __DIR__ . '/../storage/records/' . basename($r['file_path']) : '';
if (!$r || !is_file($path)) {
    fail('File not found.', 404);
}

header('Content-Type: ' . $r['file_mime']);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: inline; filename="' . str_replace('"', '', $r['file_name'] ?: 'record') . '"');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
readfile($path);
