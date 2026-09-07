<?php
/**
 *
 * Contains database connection settings, API keys, and application configuration variables.
 *
 */

/**
 * Establishes a connection to the database.
 *
 * @return mysqli The MySQLi connection object.
 */
function connectDb()
{
    $host = getenv('DB_HOST') ?: "localhost";
    $username = getenv('DB_USER') ?: "your_database_username";
    $password = getenv('DB_PASSWORD') ?: "your_database_password";
    $database = getenv('DB_NAME') ?: "your_database_name";
    $conn = new mysqli($host, $username, $password, $database);
    return $conn;
}

// Establish the database connection
$connection = connectDb();

// ELMO API Key
$apiKeyElmo = getenv('ELMO_API_KEY') ?: '1234-1234-1234-1234';
// Google Maps API Key
$apiKeyGoogleMaps = 'xxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxx';
// Google Maps Map ID (required for AdvancedMarkerElement)
$mapIdGoogleMaps = '';
// API Key for https://timezonedb.com/
$apiKeyTimezone = 'your_timezone_api_key';

// ERNIE Integration (External Vocabulary Service)
$ernieUrl = getenv('ERNIE_URL') ?: '';
$ernieApiKey = getenv('ERNIE_API_KEY') ?: '';
// Cache TTL for all ERNIE data in seconds (default: 6 hours)
$ernieCacheTtl = 21600;

// Funder PID mode: 'CFID' = Crossref Funder ID (default), 'ROR' = ROR ID
$funderPidMode = getenv('FUNDER_PID') ?: 'CFID';

// URL for primary data upload (shown after successful submit)
$dataUploadUrl = getenv('DATA_UPLOAD_URL') ?: '';

// SETTINGS FOR GENERIC DATACITE RESEARCH DATA
// maximale Anzahl der eingebbaren Titel
$maxTitles = 2;

// having the MSL logo in the header:
$showMslLogo = false;

// Show Contributor Persons form group
$showContributorPersons = true;
// Show Contributor Institutios form group
$showContributorInstitutions = true;
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
// Show Author Institution form group
$showAuthorInstitution = true;
// Show license form group. if not shown defaults to CC-BY 4.0
$showLicense = true;
$defaultLicense = 'CC-BY-4.0'; 

// SETTINGS FOR EPOS MSL
// Show MSL labs form group
$showMslLabs = false;
// Show MSL vocabularies
$showMslVocabs = false;
// URL to the source with all vocabularies for MSL
$mslVocabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';

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

// Display the feedback link (true to display, false to hide)
$showFeedbackLink = true;

// Settings for sending mail with SMTP
$smtpHost = getenv('SMTP_HOST') ?: 'your_smtp_host';
$smtpPort = getenv('SMTP_PORT') ?: 465;
$smtpUser = getenv('SMTP_USER') ?: '';
$smtpPassword = getenv('SMTP_PASSWORD') ?: '';
$smtpSender = getenv('SMTP_SENDER') ?: 'your_smtp_sender_email';
$smtpSecure = getenv('SMTP_SECURE') ?: '';
$smtpAuth   = getenv('SMTP_AUTH') ?: '';

// Target address for feedback
$feedbackAddress = getenv('FEEDBACK_ADDRESS') ?: 'feedback@example.com';

// Target address for XML submit
$xmlSubmitAddress = getenv('XML_SUBMIT_ADDRESS') ?: 'xmlsubmit@example.com';

// Target address for the ELMO GEM ICGEM registration mail.
$icgemSubmitAddress = getenv('ICGEM_SUBMIT_ADDRESS') ?: 'icgem@gfz.de';

function getSettings($setting)
{
    global $apiKeyGoogleMaps, $mapIdGoogleMaps, $showMslLabs;

    header('Content-Type: application/json; charset=utf-8');

    switch ($setting) {
        case 'apiKey':
            echo json_encode([
                'apiKey' => $apiKeyGoogleMaps,
                'mapId' => $mapIdGoogleMaps
            ]);
            break;

        case 'all':
            echo json_encode([
                'apiKey' => $apiKeyGoogleMaps,
                'mapId' => $mapIdGoogleMaps,
                'showMslLabs' => $showMslLabs
            ]);
            break;

        default:
            echo json_encode(['error' => 'Unknown setting']);
            break;
    }
    exit;
}

if (isset($_GET['setting'])) {
    getSettings($_GET['setting']);
    exit;
}

// Initialize logging    
function elmo_log($msg) {
    error_log('[ELMO save_data] ' . $msg);
}
