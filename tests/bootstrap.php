<?php
/**
 * PHPUnit Bootstrap file
 * 
 * Initializes the test environment by setting up required superglobals
 * and loading the autoloader.
 */

// Set up default $_SERVER values to prevent "undefined array key" warnings
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$_SERVER['HTTP_HOST'] = $_SERVER['HTTP_HOST'] ?? 'localhost';
$_SERVER['SCRIPT_NAME'] = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
$_SERVER['REQUEST_URI'] = $_SERVER['REQUEST_URI'] ?? '/';
$_SERVER['SERVER_PROTOCOL'] = $_SERVER['SERVER_PROTOCOL'] ?? 'HTTP/1.1';
$_SERVER['REMOTE_ADDR'] = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

// Load Composer autoloader
require_once __DIR__ . '/../vendor/autoload.php';

// Prevent settings.php from establishing a database connection during tests
if (!defined('INCLUDED_FROM_TEST')) {
    define('INCLUDED_FROM_TEST', true);
}
