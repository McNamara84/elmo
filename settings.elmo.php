<?php
/**
 *
 * feature flags, addresses, and other application configuration, that is not subject to change from the .env
 * Database credentials stay in the environment. includes/connect_db.php opens the connection.
 *
 */

// maximale Anzahl der eingebbaren Titel
$maxTitles = 2;

$showContactInstitution = true;
// Show Thesauri Keywords form group (master switch; individual thesauri controlled by ERNIE)
$showThesauri = true;
// Show Free Keywords form group
$showFreeKeywords = true;
// Show Spatial and Temporal Coverage form group
$showSpatialTemporalCoverage = true;
// Show Related Work form group
$showRelatedWork = true;
// Show Funding Reference form group
$showFundingReference = true;

$showAuthorInstitution = true;
// Show license formgroup. if not shown defaults to CC-BY 4.0
$showLicense = true;
$defaultLicense = 'CC-BY-4.0';



// MSL-specific UI elements are disabled by default.
$showMslLogo = false;
$showMslLabs = false;
$showMslVocabs = false;
$showMslDefaultFreeKeywords = false;

// MSL data sources.
$mslVocabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';

// Single source of truth for all MSL-specific features.
$showMslMode = false;
$envShowMslMode = getenv('SHOW_MSL_MODE');

if ($envShowMslMode !== false) {
    $showMslMode = filter_var($envShowMslMode, FILTER_VALIDATE_BOOLEAN);
}

// Keep all MSL-related UI elements in sync with MSL mode.
$showMslLabs = $showMslMode;
$showMslVocabs = $showMslMode;
$showMslDefaultFreeKeywords = $showMslMode;
$showMslLogo = $showMslMode;


// SETTINGS FOR PID4INST INSTRUMENTS
// Show Used Instruments form group (PID4INST via ERNIE API)
$showUsedInstruments = false;

$envShowUsedInstruments = getenv('SHOW_USED_INSTRUMENTS');

if ($envShowUsedInstruments !== false) {
    $showUsedInstruments = filter_var($envShowUsedInstruments, FILTER_VALIDATE_BOOLEAN);
}

// SETTINGS FOR ICGEM
// Show ICGEM form groups (GGMs Properties and Characteristics of the model)
$showGGMsProperties = false;

$envShowGGMsProperties = getenv('SHOW_GGMS_PROPERTIES');

if ($envShowGGMsProperties !== false) {
    $showGGMsProperties = filter_var($envShowGGMsProperties, FILTER_VALIDATE_BOOLEAN);
}

// Environment variable overrides for additional form groups
$envShowThesauri = getenv('SHOW_THESAURI');
$envShowFreeKeywords = getenv('SHOW_FREE_KEYWORDS');
$envShowSpatialTemporalCoverage = getenv('SHOW_SPATIAL_TEMPORAL_COVERAGE');
$envShowRelatedWork = getenv('SHOW_RELATED_WORK');

if ($envShowThesauri !== false) {
    $showThesauri = filter_var($envShowThesauri, FILTER_VALIDATE_BOOLEAN);
}
if ($envShowFreeKeywords !== false) {
    $showFreeKeywords = filter_var($envShowFreeKeywords, FILTER_VALIDATE_BOOLEAN);
}
if ($envShowSpatialTemporalCoverage !== false) {
    $showSpatialTemporalCoverage = filter_var($envShowSpatialTemporalCoverage, FILTER_VALIDATE_BOOLEAN);
}
if ($envShowRelatedWork !== false) {
    $showRelatedWork = filter_var($envShowRelatedWork, FILTER_VALIDATE_BOOLEAN);
}

// Playwright variant setup writes this lock file after env overrides so local
// Docker env vars (SHOW_GGMS_PROPERTIES, SHOW_MSL_MODE, etc.) cannot override
// the active test variant on a single shared container.
if (is_readable(__DIR__ . '/playwright-variant-lock.php')) {
    require __DIR__ . '/playwright-variant-lock.php';
}

// Display the feedback link (true to display, false to hide)
$showFeedbackLink = true;


// Simulate email (true = skip actual sending, only log. Set to false in production)
$SIMULATE_EMAIL = filter_var(getenv('SIMULATE_EMAIL') ?: 'false', FILTER_VALIDATE_BOOLEAN);


// ELMO-GEM only ($showGGMsProperties). Other variants always mail researchers.
// true: send confirmation emails to contact persons. false: do not email them.
$sendResearcherConfirmationEmail = filter_var(
    getenv('SEND_RESEARCHER_CONFIRMATION_EMAIL') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// ELMO-GEM only ($showGGMsProperties). Upload page linked from the ICGEM registration mail.
// Empty means the mail falls back to the test database URL.
$icgemDatabaseUrl = getenv('ICGEM_UPLOAD_URL') ?: '';


if (isset($_GET['setting'])) {
    getSettings($_GET['setting']);
    exit;
}

// Instance title for header (can be overridden via environment variable)
$instanceTitle = getenv('INSTANCE_TITLE') ?: 'ELMO – GFZ Metadata Editor';