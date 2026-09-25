<?php

/**
 * Router script for PHP's built-in web server used in CI.
 *
 * The built-in server does not support .htaccess rewrite rules, so this file
 * mirrors the compatibility aliases, script access boundary and API routing.
 *
 * Usage: php -S localhost:8000 ci-router.php
 */

$projectRoot = __DIR__;
require_once $projectRoot . '/includes/http_routing.php';

$uri = elmoRequestPath($_SERVER['REQUEST_URI'] ?? '/');

if (elmoIsHttpBlockedPath($uri)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not Found';
    return true;
}

$compatibilityTarget = elmoCompatibilityTarget($uri);
if ($compatibilityTarget !== null) {
    $targetFile = $projectRoot . $compatibilityTarget;
    if (!is_file($targetFile)) {
        http_response_code(404);
        return true;
    }

    if (str_ends_with($targetFile, '.php')) {
        require $targetFile;
        return true;
    }

    header('Content-Type: ' . elmoStaticContentType($targetFile));
    readfile($targetFile);
    return true;
}

// Existing assets and PHP files are handled natively by the built-in server.
if ($uri !== '/' && is_file($projectRoot . $uri)) {
    return false;
}

if (preg_match('#^/api(/|$)#', $uri)) {
    require $projectRoot . '/api/index.php';
    return true;
}

require $projectRoot . '/index.php';
return true;
