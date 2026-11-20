<?php
// Translate the environment secret variables to the PHP used on application level.
// ELMO API Key
$ELMO_API_KEY = getenv('ELMO_API_KEY');
// Google Maps API Key
$apiKeyGoogleMaps = getenv('GOOGLE_MAPS_API_KEY');
// Google Maps Map ID (required for AdvancedMarkerElement)
$mapIdGoogleMaps = getenv('GOOGLE_MAPS_MAP_ID');
// API Key for https://timezonedb.com/
$apiKeyTimezone = getenv('TIMEZONE_API_KEY');

// ERNIE Integration (External Vocabulary Service)
$ernieUrl = getenv('ERNIE_URL');
$ernieApiKey = getenv('ERNIE_API_KEY');

// Funder PID mode: 'CFID' = Crossref Funder ID (default), 'ROR' = ROR ID
$funderPidMode = getenv('FUNDER_PID') ?: 'CFID';

// URL for primary data upload (shown after successful submit)
$dataUploadUrl = getenv('DATA_UPLOAD_URL');


// SETTING FOR MSL MODE
$showMslMode = getenv('SHOW_MSL_MODE');
// Keep all MSL-related UI elements in sync with MSL mode.
$showMslLabs = $showMslMode;
$showMslVocabs = $showMslMode;
$showMslDefaultFreeKeywords = $showMslMode;
$showMslLogo = $showMslMode;

// SETTINGS FOR ICGEM
$envShowGGMsProperties = getenv('SHOW_GGMS_PROPERTIES');
