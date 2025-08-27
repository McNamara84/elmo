<?php
/**
 * This script initializes the application, handles error reporting,
 * includes necessary HTML components, and processes form submissions.
 *
 */

// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Start output buffering
ob_start();

// Include settings and configurations
include_once("settings.php");

/**
 * Generates HTML <option> elements from database query results.
 *
 * @param mysqli  $conn      The MySQLi connection object.
 * @param string  $query     The SQL query to fetch data.
 * @param string  $idField   The field name to be used as the option value.
 * @param string  $nameField The field name to be used as the option display text.
 *
 * @return string The generated HTML <option> elements.
 */
function generateOptions($conn, $query, $idField, $nameField)
{
    $options = "";
    if ($stmt = $conn->prepare($query)) {
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $options .= "<option value='" . htmlspecialchars($row[$idField]) . "'>" . htmlspecialchars($row[$nameField]) . "</option>";
        }
        $stmt->close();
    }
    return $options;
}

// Generate dropdown options
$optiontitle_type = generateOptions(
    $connection,
    "SELECT title_type_id, name FROM Title_Type",
    "title_type_id",
    "name"
);

// Include HTML components using absolute paths to ensure reliable file access
$baseDir = __DIR__ . '/';
include $baseDir . 'header.php';
include $baseDir . 'formgroups/resourceInformation.html';
include $baseDir . 'formgroups/rights.html';
include $baseDir . 'formgroups/authors.html';


if ($showAuthorInstitution) {
    include("formgroups/authorInstitution.html");
}
if ($showGGMsProperties) {
    include $baseDir . 'formgroups/GGMsProperties.html';
    include $baseDir . 'formgroups/dataSources.html';
}
if ($showContributorPersons) {
    include $baseDir . 'formgroups/contributorPersons.html';
}
if ($showContributorInstitutions) {
    include $baseDir . 'formgroups/contributorInstitutions.html';
}
if ($showMslLabs) {
    include $baseDir . 'formgroups/originatingLaboratory.html';
}
include $baseDir . 'formgroups/descriptions.html';
if ($showMslVocabs) {
    include $baseDir . 'formgroups/mslKeywords.html';
}
if ($showGcmdThesauri) {
    include $baseDir . 'formgroups/thesaurusKeywords.html';
}
if ($showFreeKeywords) {
    include $baseDir . 'formgroups/freeKeywords.html';
}
include $baseDir . 'formgroups/dates.html';
if ($showSpatialTemporalCoverage) {
    include $baseDir . 'formgroups/coverage.html';
}
if ($showRelatedWork) {
    include $baseDir . 'formgroups/relatedwork.html';
}
if ($showFundingReference) {
    include $baseDir . 'formgroups/fundingreference.html';
}
include $baseDir . 'modals.html';
include $baseDir . 'footer.html';

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    include("save/save_data.php");
}
