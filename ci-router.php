<?php

/**
 * Router script for PHP's built-in web server used in CI.
 *
 * The built-in server does not support .htaccess rewrite rules,
 * so API routes (api/v2/…) would return 404 without this router.
 *
 * Usage:
 *   php -S localhost:8000 ci-router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Existing files (JS, CSS, JSON, images, PHP) – let the built-in server
// handle them natively for maximum performance.
if ($uri !== '/' && is_file(__DIR__ . $uri)) {
    return false;
}

// Rewrite API routes to the API entry point (replaces .htaccess RewriteRule).
if (preg_match('#^/api(/|$)#', $uri)) {
    require __DIR__ . '/api/index.php';
    return;
}

// Everything else (including /) → index.php
require __DIR__ . '/index.php';
