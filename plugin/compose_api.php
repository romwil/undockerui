<?php
declare(strict_types=1);

/**
 * UnDocker — read/write compose files and run `docker compose up -d` on the Unraid host.
 * Restricted to paths under /mnt/user, /mnt/cache, /mnt/disk*, and /boot/config.
 * Uses realpath() so symlink tricks cannot bypass the prefix rules.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_SLASHES);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

$var = @parse_ini_file('/var/local/emhttp/var.ini') ?: [];
$expected = (string)($var['csrf_token'] ?? '');
$csrf = (string)($body['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
if ($expected === '' || !hash_equals($expected, $csrf)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Invalid CSRF']);
    exit;
}

function norm_path(string $p): string
{
    $p = str_replace('\\', '/', $p);
    if (strpos($p, '..') !== false || strpos($p, "\0") !== false) {
        return '';
    }
    return $p;
}

function allowed_prefix(string $norm): bool
{
    foreach (['/mnt/user/', '/mnt/cache/', '/boot/config/'] as $pre) {
        if (strncmp($norm, $pre, strlen($pre)) === 0) {
            return true;
        }
    }
    if (preg_match('#^/mnt/disk[0-9]+/#', $norm)) {
        return true;
    }
    return false;
}

/** True when the resolved directory path is under allowed roots (trailing slash). */
function allowed_resolved_dir(string $realDir): bool
{
    $s = str_replace('\\', '/', $realDir);
    return allowed_prefix(rtrim($s, '/') . '/');
}

/**
 * Existing .yml / .yaml file: logical path must look allowed, then realpath must
 * stay under the same roots (blocks symlinks to /etc, etc.).
 */
function validate_compose_file_existing(string $path): ?string
{
    $norm = norm_path($path);
    if ($norm === '') {
        return null;
    }
    $bn = strtolower(basename($norm));
    if (!preg_match('/\.(ya?ml)$/', $bn)) {
        return null;
    }
    if (!allowed_prefix($norm)) {
        return null;
    }
    $real = realpath($norm);
    if ($real === false || !is_file($real)) {
        return null;
    }
    $realS = str_replace('\\', '/', $real);
    if (!allowed_resolved_dir(dirname($realS))) {
        return null;
    }
    return $realS;
}

/**
 * Target path for write: string checks only (file may not exist yet).
 * Caller must realpath() the parent directory after mkdir before writing.
 */
function validate_compose_file_write_target(string $path): ?string
{
    $norm = norm_path($path);
    if ($norm === '') {
        return null;
    }
    $bn = strtolower(basename($norm));
    if (!preg_match('/\.(ya?ml)$/', $bn)) {
        return null;
    }
    if (!allowed_prefix($norm)) {
        return null;
    }
    return $norm;
}

/** Directory for listDir: must exist, resolve, and stay under roots. */
function validate_list_dir(string $path): ?string
{
    $norm = norm_path(rtrim($path, '/'));
    if ($norm === '') {
        return null;
    }
    if (!allowed_prefix($norm . '/')) {
        return null;
    }
    $real = realpath($norm);
    if ($real === false || !is_dir($real)) {
        return null;
    }
    $realS = str_replace('\\', '/', $real);
    if (!allowed_resolved_dir($realS)) {
        return null;
    }
    return $realS;
}

/** listDir entry must resolve under allowed roots (drops symlink escapes). */
function list_entry_allowed(string $fullPath): bool
{
    $rp = realpath($fullPath);
    if ($rp === false) {
        return false;
    }
    $s = str_replace('\\', '/', $rp);
    if (is_dir($s)) {
        return allowed_resolved_dir($s);
    }
    if (is_file($s)) {
        return allowed_resolved_dir(dirname($s));
    }
    return false;
}

$action = (string)($body['action'] ?? '');
$pathRaw = (string)($body['path'] ?? '');
$pathExisting = validate_compose_file_existing($pathRaw);
$pathWrite = validate_compose_file_write_target($pathRaw);

if ($action === 'listDir') {
    $dirNorm = validate_list_dir($pathRaw);
    if (!$dirNorm) {
        echo json_encode(['ok' => false, 'error' => 'Invalid or inaccessible directory']);
        exit;
    }
    $entries = [];
    $scan = @scandir($dirNorm);
    if ($scan === false) {
        echo json_encode(['ok' => false, 'error' => 'Could not read directory']);
        exit;
    }
    foreach ($scan as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $full = $dirNorm . '/' . $name;
        if (!list_entry_allowed($full)) {
            continue;
        }
        $rp = realpath($full);
        if ($rp === false) {
            continue;
        }
        $rpS = str_replace('\\', '/', $rp);
        if (is_dir($rpS)) {
            $entries[] = ['name' => $name, 'path' => $rpS, 'type' => 'dir'];
        } elseif (is_file($rpS) && preg_match('/\.(ya?ml)$/i', $name)) {
            $entries[] = ['name' => $name, 'path' => $rpS, 'type' => 'file'];
        }
    }
    usort(
        $entries,
        static function (array $a, array $b): int {
            if ($a['type'] !== $b['type']) {
                return $a['type'] === 'dir' ? -1 : 1;
            }
            return strcasecmp((string) $a['name'], (string) $b['name']);
        }
    );
    echo json_encode(['ok' => true, 'path' => $dirNorm, 'entries' => $entries], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'read') {
    if (!$pathExisting) {
        echo json_encode(['ok' => false, 'error' => 'Invalid or disallowed compose file path']);
        exit;
    }
    $content = file_get_contents($pathExisting);
    if ($content === false) {
        echo json_encode(['ok' => false, 'error' => 'Could not read file']);
        exit;
    }
    echo json_encode(['ok' => true, 'content' => $content, 'path' => $pathExisting], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'composeUp') {
    if (!$pathExisting) {
        echo json_encode(['ok' => false, 'error' => 'Invalid path or missing compose file']);
        exit;
    }
    $dirReal = dirname($pathExisting);
    $file = basename($pathExisting);
    $cmd = 'cd ' . escapeshellarg($dirReal) . ' && docker compose -f ' . escapeshellarg($file) . ' up -d 2>&1';
    $lines = [];
    $code = 0;
    exec($cmd, $lines, $code);
    $log = implode("\n", $lines);
    echo json_encode(['ok' => $code === 0, 'log' => $log, 'exitCode' => $code], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'writeApply') {
    $yaml = (string)($body['yaml'] ?? '');
    if (!$pathWrite) {
        echo json_encode(['ok' => false, 'error' => 'Invalid or disallowed compose file path']);
        exit;
    }
    if ($yaml === '') {
        echo json_encode(['ok' => false, 'error' => 'YAML is empty']);
        exit;
    }
    $dir = dirname($pathWrite);
    $dirNorm = norm_path($dir);
    if ($dirNorm === '' || !allowed_prefix($dirNorm . '/')) {
        echo json_encode(['ok' => false, 'error' => 'Invalid directory']);
        exit;
    }
    if (!is_dir($dirNorm)) {
        if (!@mkdir($dirNorm, 0777, true)) {
            echo json_encode(['ok' => false, 'error' => 'Could not create directory']);
            exit;
        }
    }
    $dirReal = realpath($dirNorm);
    if ($dirReal === false || !allowed_resolved_dir($dirReal)) {
        echo json_encode(['ok' => false, 'error' => 'Invalid directory (resolved path)']);
        exit;
    }
    $file = basename($pathWrite);
    if (!preg_match('/\.(ya?ml)$/i', $file)) {
        echo json_encode(['ok' => false, 'error' => 'Invalid compose file name']);
        exit;
    }
    $dest = str_replace('\\', '/', $dirReal) . '/' . $file;
    if (realpath(dirname($dest)) !== realpath($dirReal)) {
        echo json_encode(['ok' => false, 'error' => 'Path traversal rejected']);
        exit;
    }
    if (file_put_contents($dest, $yaml) === false) {
        echo json_encode(['ok' => false, 'error' => 'Could not write compose file']);
        exit;
    }
    $cmd = 'cd ' . escapeshellarg($dirReal) . ' && docker compose -f ' . escapeshellarg($file) . ' up -d 2>&1';
    $lines = [];
    $code = 0;
    exec($cmd, $lines, $code);
    $log = implode("\n", $lines);
    echo json_encode(['ok' => $code === 0, 'log' => $log, 'exitCode' => $code, 'path' => $dest], JSON_UNESCAPED_SLASHES);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Unknown action']);
