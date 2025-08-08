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
$apiKeyElmo = '1234-1234-1234-1234';
// Google Maps API Key
$apiKeyGoogleMaps = 'xxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxx';
// API Key for https://timezonedb.com/
$apiKeyTimezone = 'your_timezone_api_key';

// SETTINGS FOR GENERIC DATACITE RESEARCH DATA
// maximale Anzahl der eingebbaren Titel
$maxTitles = 2;
// Show Contributor Persons form group
$showContributorPersons = true;
// Show Contrubutor Institutios form group
$showContributorInstitutions = true;
// Show GCMD Thesauri form group
$showGcmdThesauri = true;
// Show Free Keywords form group
$showFreeKeywords = true;
// Show Spatial and Temporal Coverage form group
$showSpatialTemporalCoverage = true;
// Show Related Work form group
$showRelatedWork = true;
// Show Funding Reference form group
$showFundingReference = true;

// SETTINGS FOR EPOS MSL
// Show MSL labs form group
$showMslLabs = true;
// URL to the source with all laboratories for MSL
$mslLabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/laboratories.json';
// Show MSL vocabularies
$showMslVocabs = true;
// URL to the source with all vocabularies for MSL
$mslVocabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';

// SETTINGS FOR ICGEM
// Show GGMs Properties form group
$showGGMsProperties = false;
// Show Characteristics of the model form group
$characteristicsOfTheModel = false;

// Display the feedback link (true to display, false to hide)
$showFeedbackLink = true;

// Settings for sending mail with SMTP
$smtpHost = 'your_smtp_host';
$smtpPort = 465;
$smtpUser = 'your_smtp_username';
$smtpPassword = 'your_smtp_password';
$smtpSender = 'your_smtp_sender_email';

// Target address for feedback
$feedbackAddress = 'feedback@example.com';

// Target address for XML submit
$xmlSubmitAddress = 'xmlsubmit@example.com';

function getSettings($setting)
{
    global $apiKeyGoogleMaps, $showMslLabs;

    header('Content-Type: application/json; charset=utf-8');

    switch ($setting) {
        case 'apiKey':
            echo json_encode([
                'apiKey' => $apiKeyGoogleMaps
            ]);
            break;

        case 'all':
            echo json_encode([
                'apiKey' => $apiKeyGoogleMaps,
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