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

/**
 * Process form submission based on action type
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Include required configuration and helper files
    require_once __DIR__ . '/../settings.php';
    require_once __DIR__ . '/formgroups/save_resourceinformation_and_rights.php';
    require_once __DIR__ . '/formgroups/save_authors.php';
    require_once __DIR__ . '/formgroups/save_contactperson.php';
    require_once __DIR__ . '/formgroups/save_originatinglaboratory.php';
    require_once __DIR__ . '/formgroups/save_freekeywords.php';
    require_once __DIR__ . '/formgroups/save_contributorpersons.php';
    require_once __DIR__ . '/formgroups/save_contributorinstitutions.php';
    require_once __DIR__ . '/formgroups/save_descriptions.php';
    require_once __DIR__ . '/formgroups/save_thesauruskeywords.php';
    require_once __DIR__ . '/formgroups/save_spatialtemporalcoverage.php';
    require_once __DIR__ . '/formgroups/save_relatedwork.php';
    require_once __DIR__ . '/formgroups/save_usedinstruments.php';
    require_once __DIR__ . '/formgroups/save_fundingreferences.php';
    // ICGEM related formgroups
    require_once __DIR__ . '/formgroups/save_ggms_definition.php';
    require_once __DIR__ . '/formgroups/save_ggms_properties.php';
    require_once __DIR__ . '/formgroups/save_ggms_datasources.php';
    require_once __DIR__ . '/formgroups/save_ggms_modeltypes.php';
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
if (!function_exists('generateAndOutputDownload')) {
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
} // end function_exists('generateAndOutputDownload')

/**
 * Existing functions dont alwys throw an exception, but sometimes just return false. This won't interrupt the save process
 * SO, This Wrapper to convert false returns from save functions into exceptions.
 *
 * @param callable $callback The function to call
 * @param mixed ...$args Arguments to pass to the function
 * @return mixed The return value from the callback
 * @throws Exception If the callback returns false
 */
if (!function_exists('executeSaveFunction')) {
function executeSaveFunction($callback, ...$args)
{
    $functionName = is_array($callback) ? $callback[1] : $callback;
    
    try {
        $result = $callback(...$args);
        
        if ($result === false) {
            error_log("[💿SAVE]: Save operation failed: " . $functionName . " returned false");
            throw new Exception("Save operation failed: " . $functionName . " returned false");
        }
        
        return $result;
    } catch (Exception $e) {
        error_log("[💿SAVE]: Exception in " . $functionName . ": " . $e->getMessage());
        throw $e; // Re-throw so outer catch can handle it
    }
}
} // end function_exists('executeSaveFunction')

// only process requests (use return instead of exit to avoid killing
// the PHPUnit process when this file is loaded via require_once)
if (($_SERVER['REQUEST_METHOD'] ?? null) !== 'POST') {
    return;
}

// Only load settings if connection not already injected (for testing)
if (!isset($GLOBALS['connection']) || $GLOBALS['connection'] === null) {
    require_once __DIR__ . '/../settings.php';
}
global $connection;

// Check if this is a resource ID request
if (isset($_POST['get_resource_id']) && $_POST['get_resource_id'] === '1') {
    $resource_id = saveResourceInformationAndRights($connection, $_POST);
    header('Content-Type: application/json');
    echo json_encode(['resource_id' => $resource_id]);
    exit();
}

// main line: data saving process and XML generation.
try {
    // Saving all mandatory fields & optional fields if needed
    $connection->begin_transaction();
    error_log("[💿SAVE]:Starting save process in save_data.php");
    $resource_id = executeSaveFunction('saveResourceInformationAndRights', $connection, $_POST);
    error_log("[💿SAVE]:the id generated is " . $resource_id);
    executeSaveFunction('saveAuthors', $connection, $_POST, $resource_id);
    executeSaveFunction('saveContactPerson', $connection, $_POST, $resource_id);
    if ($showMslLabs) {
        executeSaveFunction('saveOriginatingLaboratories', $connection, $_POST, $resource_id);
    }
    if ($showContributorPersons) {
        executeSaveFunction('saveContributorPersons', $connection, $_POST, $resource_id);
    }
    if ($showContributorInstitutions) {
        executeSaveFunction('saveContributorInstitutions', $connection, $_POST, $resource_id);
    }
    executeSaveFunction('saveDescriptions', $connection, $_POST, $resource_id);
    if ($showThesauri) {
        executeSaveFunction('saveKeywords', $connection, $_POST, $resource_id);
    }
    if ($showFreeKeywords) {
        executeSaveFunction('saveFreeKeywords', $connection, $_POST, $resource_id);
    }
    if ($showSpatialTemporalCoverage) {
        executeSaveFunction('saveSpatialTemporalCoverage', $connection, $_POST, $resource_id);
    }
    if ($showRelatedWork) {
        executeSaveFunction('saveRelatedWork', $connection, $_POST, $resource_id);
    }
    if ($showUsedInstruments) {
        executeSaveFunction('saveUsedInstruments', $connection, $_POST, $resource_id);
    }
    if ($showFundingReference) {
        executeSaveFunction('saveFundingReferences', $connection, $_POST, $resource_id);
    }
    if ($showGGMsProperties) {
        executeSaveFunction('saveGGMsDefinition', $connection, $_POST, $resource_id);
        executeSaveFunction('saveGGMsProperties', $connection, $_POST, $resource_id);
        executeSaveFunction('saveGGMsDataSources', $connection, $_POST, $resource_id);
        executeSaveFunction('saveGGMsModeltypes', $connection, $_POST, $resource_id);
    }

    // Validate transaction commit
    if (!$connection->commit()) {
        throw new Exception("Transaction commit failed - database returned false");
    }
    
    error_log("[💿SAVE]: Transaction committed successfully for resource ID: " . $resource_id);
    
    // ===== ONLY AFTER SUCCESSFUL COMMIT: Generate download =====
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
    
} catch (\Throwable $e) {
    // Transaction or save operation failed
    $connection->rollback();
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