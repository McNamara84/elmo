<?php
/**
 * @description Handles dataset saving and XML file generation
 * 
 * This script processes form submissions for dataset metadata:
 * - Saves metadata to database
 * - Generates XML files
 * - Handles both initial save requests and file downloads
 * 
 * @requires settings.php
 * @requires formgroups/*.php
 */

// only process requests (use return instead of exit to avoid killing
// the PHPUnit process when this file is loaded via require_once)
if (($_SERVER['REQUEST_METHOD'] ?? null) !== 'POST') {
    return;
}
// access connection
global $connection;
// Only load settings if connection not already injected (for testing)
if (!isset($GLOBALS['connection']) || $GLOBALS['connection'] === null) {
    require_once __DIR__ . '/../settings.php';
}
// Check if this is a resource ID request
if (isset($_POST['get_resource_id']) && $_POST['get_resource_id'] === '1') {
    $resource_id = saveResourceInformationAndRights($connection, $_POST);
    header('Content-Type: application/json');
    echo json_encode(['resource_id' => $resource_id]);
    exit();
}

// step 1: save the info into the database. 
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
}
/**
 * Generates and outputs a download for a dataset
 * 
 * Supports XML and JSON-LD generation based on the requested download format.
 * If filename is provided in $_POST, triggers file download.
 * 
 * @param int $resource_id The resource ID to generate output for
 * @return void Outputs XML or error response, may exit
 * @throws Exception If critical errors occur during generation
 */
function generateAndOutputDownload($resource_id)
{
    global $connection, $showGGMsProperties;
    
    try {
        require_once __DIR__ . '/../api/v2/controllers/ICGEMController.php';
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
    } catch (\Throwable $e) {
        error_log("[SAVE] Error loading controllers: " . $e->getMessage());
        throw new \RuntimeException('Could not initialize XML generator: ' . $e->getMessage(), 0, $e);
    }

    // Only handle download when filename is in POST
    if (!isset($_POST['filename'])) {
        return;
    }

    $baseFilename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_POST['filename']);
    $downloadFormat = strtolower($_POST['download_format'] ?? 'xml');
    error_log("[SAVE] Starting generation for resource_id=$resource_id, format=$downloadFormat");

    try {
        $controller = new DatasetController();

        if ($downloadFormat === 'jsonld') {
            $payload = $controller->transformResourceToJsonLd((int) $resource_id);
            $filename = $baseFilename . '.jsonld';
            $contentType = 'application/ld+json';
        } else {
            $ICGEMcontroller = new ICGEMController();
            $payload = $showGGMsProperties
                ? $ICGEMcontroller->createICGEMxml($resource_id)
                : $controller->envelopeXmlAsString($connection, $resource_id);
            $filename = $baseFilename . '.xml';
            $contentType = 'application/xml';
        }
    } catch (\Throwable $e) {
        error_log("[SAVE] Generation threw: " . $e->getMessage());
        throw new \RuntimeException(
            "Download generation failed for resource $resource_id: " . $e->getMessage(),
            0,
            $e
        );
    }

    if (!$payload) {
        error_log("[SAVE] Generation returned empty for resource_id=$resource_id");
        throw new \RuntimeException("Download generation returned empty result for resource $resource_id");
    }

    error_log("[SAVE] Payload generated successfully, length=" . strlen($payload) . " bytes");

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
}
    
// ===== Step 2: generate a file based on resource_id  =====
try {
    generateAndOutputDownload($resource_id);
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
}