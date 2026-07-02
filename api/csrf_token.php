<?php
/**
 * CSRF Token Generator Endpoint
 *
 * Returns the current CSRF token, creating one only when missing or expired.
 * The token is stored in the session and must be validated on submission.
 */

require_once __DIR__ . '/security.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$token = getOrCreateCsrfToken();

echo json_encode([
    'success' => true,
    'token' => $token,
]);
