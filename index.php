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

// Provide default feature toggles when settings.php does not define them.
// This keeps the application resilient in environments that bootstrap a minimal
// settings file (e.g. automated tests) and ensures important form groups remain
// accessible by default.
$featureToggles = [
    'showAuthorInstitution' => true,
    'showContributorPersons' => true,
    'showContributorInstitutions' => true,
    'showGcmdThesauri' => true,
    'showFreeKeywords' => true,
    'showSpatialTemporalCoverage' => true,
    'showRelatedWork' => true,
    'showFundingReference' => true,
    'showGGMsProperties' => false,
    'showMslLabs' => false,
    'showMslVocabs' => false,
];

foreach ($featureToggles as $toggle => $defaultValue) {
    if (!isset($$toggle)) {
        $$toggle = $defaultValue;
    }
}

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
    include $baseDir . 'formgroups/GGMsTechnical.html';
    include $baseDir . "formgroups/GGMsModelTypes.html";
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
