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
 * Generates and outputs XML for a dataset
 * 
 * Attempts to generate XML via API call first, falls back to in-memory generation if needed.
 * If filename is provided in $_POST, triggers file download.
 * 
 * @param int $resource_id The resource ID to generate XML for
 * @return void Outputs XML or error response, may exit
 * @throws Exception If critical errors occur during XML generation
 */
function generateAndOutputXml($resource_id)
{
    global $connection, $showGGMsProperties;
    
    try {
        require_once __DIR__ . '/../api/v2/controllers/ICGEMController.php';
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
    } catch (\Throwable $e) {
        error_log("[\xF0\x9F\x92\xBFSAVE]: Error loading controllers: " . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Could not initialize XML generator: ' . $e->getMessage()]);
        exit();
    }

    // Handle file download if requested
    if (isset($_POST['filename'])) {
        $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_POST['filename']) . '.xml';

        // Clear any accidental output from require'd files before setting headers
        if (ob_get_level() > 0 && ob_get_length() > 0) {
            error_log("[\xF0\x9F\x92\xBFSAVE]: Clearing " . ob_get_length() . " bytes of buffered output before XML response");
            ob_clean();
        }

        header('Content-Type: application/xml');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        error_log("[\xF0\x9F\x92\xBFSAVE]: Headers set for XML download, resource_id=$resource_id, filename=$filename");

        try {
            error_log("[\xF0\x9F\x92\xBFSAVE]: Creating controllers for XML generation...");
            $controller = new DatasetController();
            $ICGEMcontroller = new ICGEMController();
            error_log("[\xF0\x9F\x92\xBFSAVE]: Calling envelopeXmlAsString for resource_id=$resource_id, showGGMsProperties=" . var_export($showGGMsProperties, true));
            $xmlString = $showGGMsProperties
                ? $ICGEMcontroller->createICGEMxml($resource_id)
                : $controller->envelopeXmlAsString($connection, $resource_id);

            if ($xmlString) {
                error_log("[\xF0\x9F\x92\xBFSAVE]: XML generated successfully, length=" . strlen($xmlString) . " bytes");
                echo $xmlString;
            } else {
                error_log("[\xF0\x9F\x92\xBFSAVE]: XML generation returned empty for resource ID: $resource_id");
                http_response_code(500);
                echo "Error: Could not retrieve or generate XML file.";
            }
        } catch (\Throwable $e) {
            error_log("[💿SAVE]: XML generation failed for resource ID: $resource_id. Error: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => "Sorry, we encountered an error while generating an XML file with your data:\n\n" .
                $e->getMessage() . "\n\n" .
                "Your data has been saved in our system.\n\n" .
                "Please contact the data curation team at " . ($GLOBALS['xmlSubmitAddress'] ?? 'the support team') . ".\n" .
                "In your Email, make sure to reference this Resource ID: " . ($resource_id !== false ? $resource_id : 'N/A') . "\n\n" .
                "We will be glad to fix the issue and see your data resubmitted.\n\n" .
                "ELMO team"
            ]);
        }
        exit();
    }
}

/**
 * Existing functions dont alwys throw an exception, but sometimes just return false. This won't interrupt the save process
 * SO, This Wrapper to convert false returns from save functions into exceptions.
 *
 * @param callable $callback The function to call
 * @param mixed ...$args Arguments to pass to the function
 * @return mixed The return value from the callback
 * @throws Exception If the callback returns false
 */
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

// only process requests
if (($_SERVER['REQUEST_METHOD'] ?? null) !== 'POST') {
    exit();
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
    if ($showGcmdThesauri) {
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
    
    // ===== ONLY AFTER SUCCESSFUL COMMIT: Generate XML =====
    try {
        generateAndOutputXml($resource_id);
    } catch (\Throwable $e) {
        error_log("[\xF0\x9F\x92\xBFSAVE]: XML generation failed after successful database commit for resource ID: " . $resource_id . ". Error: " . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Data saved but XML generation failed: ' . $e->getMessage()]);
    }
    
} catch (\Throwable $e) {
    // Transaction or save operation failed
    $connection->rollback();
    error_log("[💿SAVE]: Transaction rolled back. Save process failed for resource ID: " . (isset($resource_id) ? $resource_id : 'N/A') . ". Error: " . $e->getMessage());
    // Return error response
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => "Sorry, we encountered an error while saving your data in the database system:\n\n" .
                     $e->getMessage() . "\n\n" .
                     "Your data has NOT been saved in our system. Sorry for the inconvenience.\n\n" .
                     "Please contact the data curation team at {$GLOBALS['xmlSubmitAddress']}.\n" .
                     "In your Email, make sure to reference this Resource ID: " . ($resource_id !== false ? $resource_id : 'N/A') . "\n\n" .
                     "We will be glad to fix the issue and see your data resubmitted.\n\n" .
                     "ELMO team"
    ]);
}