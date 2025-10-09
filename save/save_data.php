<?php
/**
 * @description Handles dataset saving and XML file generation
 * 
 * This script processes form submissions for dataset metadata:
 * - Saves metadata to database
 * - Generates XML files
 * - Handles both initial save requests and file downloads
 * 
 * @requires helper_functions.php
 * @requires formgroups/*.php
 */

/**
 * Process form submission based on action type
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Include required configuration and helper files
    require_once __DIR__ . '/../helper_functions.php';
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

    // Check if this is a resource ID request
    if (isset($_POST['get_resource_id']) && $_POST['get_resource_id'] === '1') {
        $resource_id = saveResourceInformationAndRights($connection, $_POST);
        header('Content-Type: application/json');
        echo json_encode(['resource_id' => $resource_id]);
        exit();
    }

    // Saving all mandatory fields & optional fields if needed
    $resource_id = saveResourceInformationAndRights($connection, $_POST);
    saveAuthors($connection, $_POST, $resource_id);
    saveContactPerson($connection, $_POST, $resource_id);
    if ($showMslLabs) {
        saveOriginatingLaboratories($connection, $_POST, $resource_id);
    }
    if ($showContributorPersons) {
        saveContributorPersons($connection, $_POST, $resource_id);
    }
    if ($showContributorInstitutions) {
        saveContributorInstitutions($connection, $_POST, $resource_id);
    }
    saveDescriptions($connection, $_POST, $resource_id);
    if ($showGcmdThesauri) {
        saveKeywords($connection, $_POST, $resource_id);
    }
    if ($showFreeKeywords) {
        saveFreeKeywords($connection, $_POST, $resource_id);
    }
    if ($showSpatialTemporalCoverage) {
        saveSpatialTemporalCoverage($connection, $_POST, $resource_id);
    }
    if ($showRelatedWork) {
        saveRelatedWork($connection, $_POST, $resource_id);
    }
    if ($showFundingReference) {
        saveFundingReferences($connection, $_POST, $resource_id);
    }
    if ($showGGMsProperties) {
        saveGGMsProperties($connection, $_POST, $resource_id);
    }

    try {
    // Logic in these lines is to enable XML save
    // After the resource information is written to the db,
    // Currently, nothing transfers the information to xml format.
    // in the meanwhile, if this lines do work,
    // the xml file will be generated on the run
    require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
    $datasetController = new DatasetController();
    } catch (Exception $e) {
        error_log("Error accessing DatasetController: function getResourceAsXml is not available. Exception: " . $e->getMessage());
    }
    // Handle file download if requested
    if (isset($_POST['filename'])) {
        $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_POST['filename']) . '.xml';

        header('Content-Type: application/xml');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://';
        $base_url = $protocol . $_SERVER['HTTP_HOST'];
        $project_path = rtrim(dirname(dirname($_SERVER['PHP_SELF'])), '/\\'); // Ensure no trailing slashes
        $url = $base_url . $project_path . "/api/v2/dataset/export/" . $resource_id . "/all";

        // readfile() returns the number of bytes read, or false on failure.
        $bytesRead = @readfile($url);

        if ($bytesRead === false) {
            error_log("save_data.php: readfile from URL failed. URL: $url . Falling back to direct generation for resource ID: $resource_id");

            try {
                // The controller is already included, so we can use it.
                $datasetController = new DatasetController();
                // Generate XML directly in-memory
                $xmlString = $datasetController->envelopeXmlAsString($connection, $resource_id);

                if ($xmlString) {
                    echo $xmlString;
                } else {
                    // This part of the code will only be reached if both methods fail.
                    http_response_code(500);
                    echo "Error: Could not retrieve or generate XML file.";
                }
            } catch (Exception $e) {
                error_log("Error in save_data.php fallback: " . $e->getMessage());
                http_response_code(500);
                echo "Error: XML generation inside save_data failed";
            }
        }
        exit();
    }    
}