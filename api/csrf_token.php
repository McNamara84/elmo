<?php
/**
 * CSRF Token Generator Endpoint
 * 
 * Returns the current CSRF token for form protection, creating one only when
 * missing or expired. The token is stored in the session and must be validated
 * on form submission.
 */

require_once __DIR__ . '/security.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$scope = isset($_GET['scope']) ? (string) $_GET['scope'] : 'form';
$normalizedScope = normalizeCsrfScope($scope);
$token = getOrCreateScopedCsrfToken($normalizedScope);

// For non-form scopes (e.g. feedback), this endpoint is called when the modal opens.
// Reset the interaction timer so the minimum-time check measures from this moment.
if ($normalizedScope !== 'form') {
    resetPageInteractionTime($normalizedScope);
}

echo json_encode([
    'success' => true,
    'token' => $token,
    'scope' => $normalizedScope
]);
