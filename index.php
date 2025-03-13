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
$optionresourcentype = generateOptions(
    $connection,
    "SELECT resource_name_id, resource_type_general FROM Resource_Type",
    "resource_name_id",
    "resource_type_general"
);
$optionlanguage = generateOptions(
    $connection,
    "SELECT language_id, name FROM Language",
    "language_id",
    "name"
);

$optiontitle_type = generateOptions(
    $connection,
    "SELECT title_type_id, name FROM Title_Type",
    "title_type_id",
    "name"
);

// Include HTML components
include("header.html");
include("formgroups/resourceInformation.html");
include("formgroups/rights.html");
include("formgroups/authors.html");
if ($characteristicsOfTheModel) {
    include("formgroups/GGMsCharacteristics.html");
}
if ($showContributorPersons) {
    include("formgroups/contributorPersons.html");
}
if ($showContributorInstitutions) {
    include("formgroups/contributorInstitutions.html");
}
if ($showMslLabs) {
    include("formgroups/originatingLaboratory.html");
}
include("formgroups/descriptions.html");
if ($showMslVocabs) {
    include("formgroups/mslKeywords.html");
}
if ($showGcmdThesauri) {
    include("formgroups/thesaurusKeywords.html");
}
if ($showFreeKeywords) {
    include("formgroups/freeKeywords.html");
}
include("formgroups/dates.html");
if ($showSpatialTemporalCoverage) {
    include("formgroups/coverage.html");
}
if ($showRelatedWork) {
    include("formgroups/relatedwork.html");
}
if ($showFundingReference) {
    include("formgroups/fundingreference.html");
}
include("modals.html");
include("footer.html");

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    include("save/save_data.php");
}
