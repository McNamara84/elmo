<?php
/**
 * Interaction Timer Endpoint
 *
 * Resets the server-side minimum-interaction timer for a scope without issuing
 * a CSRF token. Used when a user opens the feedback modal.
 */

require_once __DIR__ . '/security.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$scope = isset($_GET['scope']) ? (string) $_GET['scope'] : 'form';
$normalizedScope = normalizeInteractionScope($scope);
resetPageInteractionTime($normalizedScope);

echo json_encode([
    'success' => true,
    'scope' => $normalizedScope,
]);
