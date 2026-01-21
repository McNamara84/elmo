<?php
/**
 * CSRF Token Generator Endpoint
 * 
 * Generates and returns a CSRF token for form protection.
 * The token is stored in the session and must be validated on form submission.
 */

// Start session BEFORE any output
session_start();

require_once __DIR__ . '/security.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Generate a new CSRF token using shared security utility
$token = generateCsrfToken();

echo json_encode([
    'success' => true,
    'token' => $token
]);
