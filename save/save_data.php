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

// Include required configuration and helper files so that they are accessible for testing as well
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
require_once __DIR__ . '/formgroups/save_fundingreferences.php';
require_once __DIR__ . '/formgroups/save_ggmsproperties.php';

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
    global $connection;
    
    try {
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
    } catch (Exception $e) {
        error_log("Error accessing DatasetController: " . $e->getMessage());
        http_response_code(500);
        echo "Error: Could not initialize XML generator";
        exit();
    }

    // Handle file download if requested
    if (isset($_POST['filename'])) {
        $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_POST['filename']) . '.xml';

        header('Content-Type: application/xml');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://';
        $base_url = $protocol . $_SERVER['HTTP_HOST'];
        $project_path = rtrim(dirname(dirname($_SERVER['PHP_SELF'])), '/\\');
        $url = $base_url . $project_path . "/api/v2/dataset/export/" . $resource_id . "/all";

        // Try API call first
        $bytesRead = @readfile($url);

        if ($bytesRead === false) {
            error_log("[💿SAVE]: readfile from URL failed. Attempting in-memory generation. Resource ID: $resource_id, URL: $url");

            try {
                $datasetController = new DatasetController();
                $xmlString = $datasetController->envelopeXmlAsString($connection, $resource_id);

                if ($xmlString) {
                    echo $xmlString;
                } else {
                    http_response_code(500);
                    echo "Error: Could not retrieve or generate XML file.";
                }
            } catch (Exception $e) {
                error_log("[💿SAVE]: XML in-memory generation failed for resource ID: $resource_id. Error: " . $e->getMessage());
                http_response_code(500);
                echo "Error: XML generation failed";
            }
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
    $result = $callback(...$args);
    
    if ($result === false) {
        error_log("[💿SAVE]: Save operation failed: " . (is_array($callback) 
            ? $callback[1] 
            : $callback) . " returned false");
        throw new Exception("Save operation failed: " . (is_array($callback) 
            ? $callback[1] 
            : $callback) . " returned false");
    }
    
    return $result;
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
    if ($showFundingReference) {
        executeSaveFunction('saveFundingReferences', $connection, $_POST, $resource_id);
    }
    if ($showGGMsProperties) {
        executeSaveFunction('saveGGMsProperties', $connection, $_POST, $resource_id);
    }

    // Validate transaction commit
    if (!$connection->commit()) {
        throw new Exception("Transaction commit failed - database returned false");
    }
    
    error_log("[💿SAVE]: Transaction committed successfully for resource ID: " . $resource_id);
    
    // ===== ONLY AFTER SUCCESSFUL COMMIT: Generate XML =====
    try {
        generateAndOutputXml($resource_id);
    } catch (Exception $e) {
        error_log("[💿SAVE]: XML generation failed after successful database commit for resource ID: " . $resource_id . ". Error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Data saved but XML generation failed: ' . $e->getMessage()]);
    }
    
} catch (Exception $e) {
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
                     "Please contact the data curation team at datapub@gfz.de.\n" .
                     "In your Email, make sure to reference this Resource ID: " . ($resource_id !== false ? $resource_id : 'N/A') . "\n\n" .
                     "We will be glad to fix the issue and see your data resubmitted.\n\n" .
                     "ELMO team"
    ]);
}