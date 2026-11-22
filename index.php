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

// ENV variables inclusion
include_once __DIR__ . '/feature_flags.php';


// Translate into the PHP environment the variables set in .env 
include_once __DIR__ . '/includes/env_variables_reader.php';

// A developer settings.php may override the committed flags. CI does not have one.
if (is_readable(__DIR__ . '/settings.php')) {
    include_once __DIR__ . '/settings.php';
}
// Playwright variant setup writes this lock file after env overrides so local
if (is_readable(__DIR__ . '/playwright_variant_lock.php')) {
    require __DIR__ . '/playwright_variant_lock.php';
}

// Provide default feature toggles when settings.php does not define them.
// This keeps the application resilient in environments that bootstrap a minimal
// settings file (e.g. automated tests) and ensures important form groups remain
// accessible by default.
include_once __DIR__ . '/includes/feature_toggles.php';

require_once __DIR__ . '/api/security.php';
ensureAppSession(); // for rate limiting based on session
resetPageInteractionTime('form'); // mark when this page visit began

// Treat requests without query parameters as "new records"
$isNewRecord = empty($_GET);

/** @var bool $showLicense */
$showLicense = resolveFeatureToggle($showLicense ?? null, false);   
/** @var bool $showAuthorInstitution */
$showAuthorInstitution = resolveFeatureToggle($showAuthorInstitution ?? null, true);
/** @var bool $showContactInstitution */
$showContactInstitution = filter_var(getenv('SHOW_CONTACT_INSTITUTION'), FILTER_VALIDATE_BOOLEAN);
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
/** @var bool $showGGMsProperties */
$showGGMsProperties = resolveFeatureToggle($showGGMsProperties ?? null, false);
/** @var bool $showMslMode */
$showMslMode = resolveFeatureToggle($showMslMode ?? null, false);

// Apply cross-feature overrides for specific ELMO GEM variant
$variantOverrides = applyELMOGEMFeatureOverrides([
    'showGGMsProperties' => $showGGMsProperties,
    'thesauriHiddenKeys' => [],
]);

$thesauriHiddenKeys = $variantOverrides['thesauriHiddenKeys'];

// Include HTML components using absolute paths to ensure reliable file access
$mslLogoHtml = '<a href="https://epos-msl.uu.nl/" target="_blank" rel="noopener noreferrer"> <img src="assets/logos/epos-logo.png" alt="MSL Logo" class="logo logo-right logo-msl"> </a>';

$baseDir = __DIR__ . '/';
include $baseDir . 'header.php';
include $baseDir . 'formgroups/resource-information.html';
include $baseDir . 'formgroups/honeypot.html';

include $baseDir . 'formgroups/authors.html';
if ($showGGMsProperties) {
    include $baseDir . 'formgroups/ggms-definition.html';
    include $baseDir . "formgroups/GGMsModelTypes.html";
    include $baseDir . 'formgroups/ggms-properties.html';
    include $baseDir . 'formgroups/ggms-data-sources.html';
}
include $baseDir . 'formgroups/contributors.html';
if ($showMslMode) {
    include $baseDir . 'formgroups/originatingLaboratory.html';
}
if ($showGGMsProperties) {
    include $baseDir . 'formgroups/GGMsDescriptions.html';
} else {
    include $baseDir . 'formgroups/descriptions.html';
}
if ($showMslMode) {
    include $baseDir . 'formgroups/mslKeywords.html';
}
if ($showThesauri) {
    include $baseDir . 'formgroups/thesaurus-keywords.html';
}
if ($showFreeKeywords) {
    include $baseDir . 'formgroups/free-keywords.html';
}
include $baseDir . 'formgroups/dates.html';
if ($showSpatialTemporalCoverage) {
    include $baseDir . 'formgroups/coverage.html';
}
include $baseDir . 'formgroups/usedInstruments.html';
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
