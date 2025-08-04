<?php
/**
 * Contains database connection settings, API keys, and application configuration variables.
 */

/**
 * Retrieve a boolean from the environment, or return the provided default.
 */
function envBool(string $key, bool $default): bool {
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }
    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

/**
 * Retrieve an integer from the environment, or return the provided default.
 */
function envInt(string $key, int $default): int {
    $value = getenv($key);
    return $value === false ? $default : (int)$value;
}

/**
 * Retrieve a string from the environment, or return the provided default.
 */
function envStr(string $key, string $default): string {
    $value = getenv($key);
    return $value === false ? $default : $value;
}

/**
 * Establishes a connection to the database.
 *
 * @return mysqli The MySQLi connection object.
 */
function connectDb()
{
    $host = envStr('DB_HOST', 'localhost');
    $username = envStr('DB_USER', 'root');
    $password = envStr('DB_PASSWORD', '');
    $database = envStr('DB_NAME', 'elmov2');
    $conn = new mysqli($host, $username, $password, $database);
    return $conn;
}

// Establish the database connection
$connection = connectDb();

// ELMO API Key
$apiKeyElmo = envStr('ELMO_API_KEY', '1234-1234-1234-1234');
// Google Maps API Key
$apiKeyGoogleMaps = envStr('GOOGLE_MAPS_API_KEY', 'xxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxx');
// API Key for https://timezonedb.com/
$apiKeyTimezone = envStr('TIMEZONE_API_KEY', 'your_timezone_api_key');

// SETTINGS FOR GENERIC DATACITE RESEARCH DATA
// maximale Anzahl der eingebbaren Titel
$maxTitles = envInt('MAX_TITLES', 2);
// Show Contributor Persons form group
$showContributorPersons = envBool('SHOW_CONTRIBUTOR_PERSONS', true);
// Show Contrubutor Institutions form group
$showContributorInstitutions = envBool('SHOW_CONTRIBUTOR_INSTITUTIONS', true);
// Show GCMD Thesauri form group
$showGcmdThesauri = envBool('SHOW_GCMD_THESAURI', true);
// Show Free Keywords form group
$showFreeKeywords = envBool('SHOW_FREE_KEYWORDS', true);
// Show Spatial and Temporal Coverage form group
$showSpatialTemporalCoverage = envBool('SHOW_SPATIAL_TEMPORAL_COVERAGE', true);
// Show Related Work form group
$showRelatedWork = envBool('SHOW_RELATED_WORK', true);
// Show Funding Reference form group
$showFundingReference = envBool('SHOW_FUNDING_REFERENCE', true);

// SETTINGS FOR EPOS MSL
// Show MSL labs form group
$showMslLabs = envBool('SHOW_MSL_LABS', true);
// URL to the source with all laboratories for MSL
$mslLabsUrl = envStr('MSL_LABS_URL', 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/laboratories.json');
// Show MSL vocabularies
$showMslVocabs = envBool('SHOW_MSL_VOCABS', true);
// URL to the source with all vocabularies for MSL
$mslVocabsUrl = envStr('MSL_VOCABS_URL', 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/');

// SETTINGS FOR ICGEM
// Show GGMs Properties form group
$showGGMsProperties = envBool('SHOW_GGMS_PROPERTIES', true);
// Show Characteristics of the model form group
$characteristicsOfTheModel = envBool('CHARACTERISTICS_OF_THE_MODEL', false);

// Display the feedback link (true to display, false to hide)
$showFeedbackLink = envBool('SHOW_FEEDBACK_LINK', true);

// Settings for sending mail with SMTP
$smtpHost = envStr('SMTP_HOST', 'your_smtp_host');
$smtpPort = envInt('SMTP_PORT', 465);
$smtpUser = envStr('SMTP_USER', 'your_smtp_username');
$smtpPassword = envStr('SMTP_PASSWORD', 'your_smtp_password');
$smtpSender = envStr('SMTP_SENDER', 'your_smtp_sender_email');

// Target address for feedback
$feedbackAddress = envStr('FEEDBACK_ADDRESS', 'feedback@example.com');

// Target address for XML submit
$xmlSubmitAddress = envStr('XML_SUBMIT_ADDRESS', 'xmlsubmit@example.com');

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
