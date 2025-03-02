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
    $host = "localhost";
    $username = "your_database_username";
    $password = "your_database_password";
    $database = "your_database_name";
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

// Maximum number of titles that can be entered
$maxTitles = 2;

// Show Contributor Persons form group
$showContributorPersons = true;
// Show Contrubutor Institutios form group
$showContributorInstitutions = true;
// Show MSL labs form group
$showMslLabs = true;
// URL to the source with all laboratories for MSL
$mslLabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/laboratories.json';
// Show MSL vocabularies
$showMslVocabs = true;
// URL to the source with all vocabularies for MSL
$mslVocabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';
// Show GCMD Thesauri form group
$showGcmdThesauri = true;
// Show Free Keywords form group
$showFreeKeywords = true;

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