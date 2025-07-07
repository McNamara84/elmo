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
    require_once '../settings.php';
    require_once 'formgroups/save_resourceinformation_and_rights.php';
    require_once 'formgroups/save_authors.php';
    require_once 'formgroups/save_contactperson.php';
    require_once 'formgroups/save_originatinglaboratory.php';
    require_once 'formgroups/save_freekeywords.php';
    require_once 'formgroups/save_contributorpersons.php';
    require_once 'formgroups/save_contributorinstitutions.php';
    require_once 'formgroups/save_descriptions.php';
    require_once 'formgroups/save_thesauruskeywords.php';
    require_once 'formgroups/save_spatialtemporalcoverage.php';
    require_once 'formgroups/save_relatedwork.php';
    require_once 'formgroups/save_fundingreferences.php';
    require_once 'formgroups/save_ggmsproperties.php';

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


require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
$datasetController = new DatasetController();
$xmlString = $datasetController->getResourceAsXml($connection, $resource_id);

 // Handle file download if requested
if (isset($_POST['filename'])) {
    $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_POST['filename']) . '.xml';

    header('Content-Type: application/xml');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    // Build API URL and local file path
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://';
    $base_url = $protocol . $_SERVER['HTTP_HOST'];
    $project_path = dirname(dirname($_SERVER['PHP_SELF']));
    $url = $base_url . $project_path . "/api/v2/dataset/export/" . $resource_id . "/all";
    $localpath = "/var/www/html/xml/resource_" . $resource_id . ".xml";

    // Try to fetch via HTTP first
    $data = @file_get_contents($url);
    if ($data !== false) {
        elmo_log("Fetched XML via API: $url");
        echo $data;
    } elseif (file_exists($localpath)) {
        elmo_log("Fetched XML from local file: $localpath");
        readfile($localpath);
    } else {
        elmo_log("File not found (neither remote nor local). URL tried: $url, local path: $localpath");
        http_response_code(404);
        echo "File not found (neither remote nor local).";
    }
    exit();
    }
}