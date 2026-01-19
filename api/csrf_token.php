<?php
/**
 * CSRF Token Generator Endpoint
 * 
 * Generates and returns a CSRF token for form protection.
 * The token is stored in the session and must be validated on form submission.
 */

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Generate a new CSRF token
$token = bin2hex(random_bytes(32));

// Store in session
$_SESSION['csrf_token'] = $token;
$_SESSION['csrf_token_time'] = time();

echo json_encode([
    'success' => true,
    'token' => $token
]);
