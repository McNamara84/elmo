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
$apiKeyElmo = getenv('API_KEY_ELMO') ?: '1234-1234-1234-1234';

// Google Maps API Key
$apiKeyGoogleMaps = getenv('API_KEY_GOOGLE_MAPS') ?: 'xxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxx';

// API Key for https://timezonedb.com/
$apiKeyTimezone = getenv('API_KEY_TIMEZONE') ?: 'your_timezone_api_key';

// SETTINGS FOR GENERIC DATACITE RESEARCH DATA
// maximale Anzahl der eingebbaren Titel
$maxTitles = getenv('MAX_TITLES') ? intval(getenv('MAX_TITLES')) : 2;

// Show Contributor Persons form group
$showContributorPersons = filter_var(
    getenv('SHOW_CONTRIBUTOR_PERSONS') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// Show Contributor Institutions form group
$showContributorInstitutions = filter_var(
    getenv('SHOW_CONTRIBUTOR_INSTITUTIONS') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// Show GCMD Thesauri form group
$showGcmdThesauri = filter_var(
    getenv('SHOW_GCMD_THESAURI') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// Show Free Keywords form group
$showFreeKeywords = filter_var(
    getenv('SHOW_FREE_KEYWORDS') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// Show Spatial and Temporal Coverage form group
$showSpatialTemporalCoverage = filter_var(
    getenv('SHOW_SPATIAL_TEMPORAL_COVERAGE') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// Show Related Work form group
$showRelatedWork = filter_var(
    getenv('SHOW_RELATED_WORK') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// Show Funding Reference form group
$showFundingReference = filter_var(
    getenv('SHOW_FUNDING_REFERENCE') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// SETTINGS FOR EPOS MSL
// Show MSL labs form group
$showMslLabs = filter_var(
    getenv('SHOW_MSL_LABS') ?: 'false',
    FILTER_VALIDATE_BOOLEAN
);

// URL to the source with all laboratories for MSL
$mslLabsUrl = getenv('MSL_LABS_URL') ?: 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/laboratories.json';

// Show MSL vocabularies
$showMslVocabs = filter_var(
    getenv('SHOW_MSL_VOCABS') ?: 'false',
    FILTER_VALIDATE_BOOLEAN
);

// URL to the source with all vocabularies for MSL
$mslVocabsUrl = getenv('MSL_VOCABS_URL') ?: 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';

// SETTINGS FOR ICGEM
// Show GGMs Properties form group
$showGGMsProperties = filter_var(
    getenv('SHOW_GGMS_PROPERTIES') ?: 'false',
    FILTER_VALIDATE_BOOLEAN
);

// Show Characteristics of the model form group
$characteristicsOfTheModel = filter_var(
    getenv('CHARACTERISTICS_OF_THE_MODEL') ?: 'false',
    FILTER_VALIDATE_BOOLEAN
);

// Display the feedback link (true to display, false to hide)
$showFeedbackLink = filter_var(
    getenv('SHOW_FEEDBACK_LINK') ?: 'true',
    FILTER_VALIDATE_BOOLEAN
);

// Settings for sending mail with SMTP
$smtpHost = getenv('SMTP_HOST') ?: 'your_smtp_host';
$smtpPort = getenv('SMTP_PORT') ? intval(getenv('SMTP_PORT')) : 465;
$smtpUser = getenv('SMTP_USER') ?: 'your_smtp_username';
$smtpPassword = getenv('SMTP_PASSWORD') ?: 'your_smtp_password';
$smtpSender = getenv('SMTP_SENDER') ?: 'your_smtp_sender_email';

// Target address for feedback
$feedbackAddress = getenv('FEEDBACK_ADDRESS') ?: 'feedback@example.com';

// Target address for XML submit
$xmlSubmitAddress = getenv('XML_SUBMIT_ADDRESS') ?: 'xmlsubmit@example.com';

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