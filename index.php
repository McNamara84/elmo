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
include_once __DIR__ . '/settings.php';

// Provide default feature toggles when settings.php does not define them.
// This keeps the application resilient in environments that bootstrap a minimal
// settings file (e.g. automated tests) and ensures important form groups remain
// accessible by default.
include_once __DIR__ . '/includes/feature_toggles.php';

// Treat requests without query parameters as "new records"
$isNewRecord = empty($_GET);

/** @var bool $showLicense */
$showLicense = resolveFeatureToggle($showLicense ?? null, false);   
/** @var bool $showAuthorInstitution */
$showAuthorInstitution = resolveFeatureToggle($showAuthorInstitution ?? null, true);
/** @var bool $showContributorPersons */
$showContributorPersons = resolveFeatureToggle($showContributorPersons ?? null, true);
/** @var bool $showContributorInstitutions */
$showContributorInstitutions = resolveFeatureToggle($showContributorInstitutions ?? null, true);
/** @var bool $showThesauri */
$showThesauri = resolveFeatureToggle($showThesauri ?? null, true);
/** @var bool $showFreeKeywords */
$showFreeKeywords = resolveFeatureToggle($showFreeKeywords ?? null, true);
/** @var bool $showSpatialTemporalCoverage */
$showSpatialTemporalCoverage = resolveFeatureToggle($showSpatialTemporalCoverage ?? null, true);
/** @var bool $showRelatedWork */
$showRelatedWork = resolveFeatureToggle($showRelatedWork ?? null, true);
/** @var bool $showFundingReference */
$showFundingReference = resolveFeatureToggle($showFundingReference ?? null, true);
/** @var bool $showUsedInstruments */
$showUsedInstruments = resolveFeatureToggle($showUsedInstruments ?? null, false);
/** @var bool $showGGMsProperties */
$showGGMsProperties = resolveFeatureToggle($showGGMsProperties ?? null, false);
/** @var bool $showMslLabs */
$showMslLabs = resolveFeatureToggle($showMslLabs ?? null, false);
/** @var bool $showMslVocabs */
$showMslVocabs = resolveFeatureToggle($showMslVocabs ?? null, false);
/** @var bool $showMslDefaultFreeKeywords */
$showMslDefaultFreeKeywords = resolveFeatureToggle($showMslDefaultFreeKeywords ?? null, false);
/** @var bool $showMslLogo */
$showMslLogo = resolveFeatureToggle($showMslLogo ?? null, false);

// Include HTML components using absolute paths to ensure reliable file access
$mslLogoHtml = '<a href="https://epos-msl.uu.nl/" target="_blank" rel="noopener noreferrer"> <img src="logos/EPOS_logo.png" alt="MSL Logo" class="logo logo-right logo-msl"> </a>';

$baseDir = __DIR__ . '/';
include $baseDir . 'header.php';
include $baseDir . 'formgroups/resourceInformation.html';
include $baseDir . 'formgroups/honeypot.html';

include $baseDir . 'formgroups/authors.html';

if ($showAuthorInstitution) {
    include("formgroups/authorInstitution.html");
}
if ($showGGMsProperties) {
    include $baseDir . 'formgroups/GGMsDefinition.html';
    include $baseDir . "formgroups/GGMsModelTypes.html";
    include $baseDir . 'formgroups/GGMsDataSources.html';
    include $baseDir . 'formgroups/GGMsProperties.html';
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
if ($showGGMsProperties) {
    include $baseDir . 'formgroups/GGMsDescriptions.html';
} else {
    include $baseDir . 'formgroups/descriptions.html';
}
if ($showMslVocabs) {
    include $baseDir . 'formgroups/mslKeywords.html';
}
if ($showThesauri) {
    include $baseDir . 'formgroups/thesaurusKeywords.html';
}
if ($showFreeKeywords) {
    include $baseDir . 'formgroups/freeKeywords.html';
}
include $baseDir . 'formgroups/dates.html';
if ($showSpatialTemporalCoverage) {
    include $baseDir . 'formgroups/coverage.html';
}
if ($showUsedInstruments) {
    include $baseDir . 'formgroups/usedInstruments.html';
}
if ($showRelatedWork) {
    include $baseDir . 'formgroups/relatedwork.html';
}
if ($showFundingReference) {
    include $baseDir . 'formgroups/fundingreference.html';
}
if ($showLicense) {
    include $baseDir . 'formgroups/rights.html';
}
include $baseDir . 'modals.html';
include $baseDir . 'footer.html';

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    include("save/save_data.php");
}
