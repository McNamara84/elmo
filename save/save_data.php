<?php
/**
 * @description Handles dataset saving and XML file generation with security validations
 * 
 * This script processes form submissions for dataset metadata:
 * - Validates CSRF token
 * - Checks honeypot field
 * - Enforces rate limiting for save operations
 * - Saves metadata to database
 * - Generates XML files
 * - Handles both initial save requests and file downloads
 * 
 * @requires settings.php
 * @requires api/security.php
 * @requires formgroups/*.php
 */

// Guard for PHPUnit
if (defined('PHPUNIT_RUNNING')) {
    return;
}

// Only process POST requests
if (($_SERVER['REQUEST_METHOD'] ?? null) !== 'POST') {
    return;
}

require_once __DIR__ . '/../api/security.php';

// Only load settings if connection not already injected (for testing)
if (!isset($GLOBALS['connection']) || $GLOBALS['connection'] === null) {
    require_once __DIR__ . '/../settings.php';
}
global $connection;

// ========= EXECUTION PIPELINE =========

// Step 0: Security Validation — exits on any failure
validateRequestSecurity('save', $_POST);
// ===== Step 1: save the info into the database.  =====
// include a helper function to execute save functions and handle errors
require_once __DIR__ . '/../includes/save_to_db_helper.php';
try {
    $resource_id = saveALL($_POST, $connection);
} catch (\Throwable $e) {
    // Transaction or save operation failed
    error_log("[SAVE] Transaction rolled back for resource_id=" . (isset($resource_id) ? $resource_id : 'N/A') . ": " . $e->getMessage());
    // Flush any buffers
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(500);
    $errorJson = json_encode([
        'success' => false,
        'message' => 'Save process failed: ' . $e->getMessage()
    ]);
    header('Content-Type: application/json');
    header('Content-Length: ' . strlen($errorJson));
    echo $errorJson;
    flush();
    return;
}
// ===== Step 2: generate a file based on resource_id  =====
if (isset($_POST['filename'])) {
    try {
        $baseFilename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_POST['filename']);
        $downloadFormat = strtolower($_POST['download_format'] ?? 'xml');
        error_log("[SAVE] Starting generation for resource_id=$resource_id, format=$downloadFormat");

        $generated = generateDatasetPayloadByResourceId(
            (int) $resource_id,
            [
                'format' => $downloadFormat,
                'postData' => $_POST,
            ]
        );

        $filename = $baseFilename . '.' . $generated['extension'];
        $payload = $generated['payload'];
        $contentType = $generated['contentType'];

        error_log("[SAVE] Payload generated via {$generated['generator']}, length=" . strlen($payload) . " bytes");

        // Flush any stale output buffers before sending the response
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        // Set headers and send the body with explicit Content-Length
        header('Content-Type: ' . $contentType);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($payload));
        echo $payload;
        flush();
        return;
    } catch (\Throwable $e) {
        error_log("[SAVE] Download generation failed after DB commit for resource_id=$resource_id: " . $e->getMessage());
        // Flush any buffers from the failed generation attempt
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(500);
        $errorJson = json_encode(['error' => 'Data saved but download generation failed: ' . $e->getMessage()]);
        header('Content-Type: application/json');
        header('Content-Length: ' . strlen($errorJson));
        echo $errorJson;
        flush();
        return;
    }
}

// ===== Step 3: Return success response if no download was requested =====
$successJson = json_encode([
    'success' => true,
    'resource_id' => $resource_id,
    'message' => 'Data saved successfully'
]);
header('Content-Type: application/json');
header('Content-Length: ' . strlen($successJson));
echo $successJson;
flush();
