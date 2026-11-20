<?php
/**
 *
 * feature flags, addresses, and other application configuration, that is not subject to change from the .env
 * Database credentials stay in the environment. includes/connect_db.php opens the connection.
 *
 */

// Cache TTL for all ERNIE data in seconds (default: 24 hours).
$ernieCacheTtl = 86400;

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

// MSL data sources.
$mslVocabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';


// SETTINGS FOR PID4INST INSTRUMENTS
// Show Used Instruments form group (PID4INST via ERNIE API)
$showUsedInstruments = false;

$envShowUsedInstruments = getenv('SHOW_USED_INSTRUMENTS');

if ($envShowUsedInstruments !== false) {
    $showUsedInstruments = filter_var($envShowUsedInstruments, FILTER_VALIDATE_BOOLEAN);
}


// Display the feedback link (true to display, false to hide)
$showFeedbackLink = true;


// Simulate email (true = skip actual sending, only log. Set to false in production)
$SIMULATE_EMAIL = false;


if (isset($_GET['setting'])) {
    getSettings($_GET['setting']);
    exit;
}

// Instance title for header (can be overridden via environment variable)
$instanceTitle = getenv('INSTANCE_TITLE') ?: 'ELMO – GFZ Metadata Editor';