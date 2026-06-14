<?php
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_authors.php';
require_once __DIR__ . '/../save/formgroups/save_contactperson.php';
require_once __DIR__ . '/../save/formgroups/save_freekeywords.php';
require_once __DIR__ . '/../save/formgroups/save_contributorpersons.php';
require_once __DIR__ . '/../save/formgroups/save_contributorinstitutions.php';
require_once __DIR__ . '/../save/formgroups/save_descriptions.php';
require_once __DIR__ . '/../save/formgroups/save_thesauruskeywords.php';
require_once __DIR__ . '/../save/formgroups/save_spatialtemporalcoverage.php';
require_once __DIR__ . '/../save/formgroups/save_relatedwork.php';
require_once __DIR__ . '/../save/formgroups/save_usedinstruments.php';
require_once __DIR__ . '/../save/formgroups/save_fundingreferences.php';
global $showGGMsProperties;
if ($showGGMsProperties) {
    require_once __DIR__ . '/../save/formgroups/save_ggms_properties.php';
    require_once __DIR__ . '/../save/formgroups/save_ggms_definition.php';
    require_once __DIR__ . '/../save/formgroups/save_ggms_modeltypes.php';
    require_once __DIR__ . '/../save/formgroups/save_ggms_datasources.php';
}
/**
 * Existing functions (included above) dont alwys throw an exception, but sometimes just return false. This won't interrupt the save process
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

// includes all save functions and executes them with database connectio
function saveALL(array $postData, mysqli $connection): int {
    $connection->begin_transaction();
    try {
        // main line: Saving all mandatory fields & optional fields if needed
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

        $connection->commit();
        return $resource_id;
    } catch (Exception $e) {
        $connection->rollback();
        throw $e;
    }
}