<?php

function connectDb()
{
    // $host = "localhost";
    // $username = "ali";
    // $password = "ali";
    // $database = "mslmetadaten";
    // $conn = new mysqli($host, $username, $password, $database);
    // return $conn;

    $host = getenv('DB_HOST') ?: "localhost";
    $username = getenv('DB_USER') ?: "ali";
    $password = getenv('DB_PASSWORD') ?: "ali";
    $database = getenv('DB_NAME') ?: "mslmetadaten";
    $conn = new mysqli($host, $username, $password, $database);
    return $conn;
}


// // // // // -------------------------------- OLD-------------------------------- // // // // // // // // // // // // // // // // // 


// function getApiKey()
// {
//     // Google Maps API Key
//     $apiKeyGoogleMaps = 'AIzaSyDsVnvjw64n6ON1GZWt-xVkGtCqc5n6utk';
//     // API-Key als JSON zurückgeben
//     echo json_encode(['apiKey' => $apiKeyGoogleMaps]);
// }

// // Prüfe, ob die Datei direkt über eine HTTP-Anfrage aufgerufen wird
// if (basename(__FILE__) == basename($_SERVER['PHP_SELF'])) {
//     if ($_SERVER['REQUEST_METHOD'] === 'GET') {
//         getApiKey();
//     }
// }


// // // // // -------------------------------- OLD-------------------------------- // // // // // // // // // // // // // // // // // 

$connection = connectDb();

// ELMO API Key
$apiKeyElmo = '1234-1234-1234-1234';

// Google Maps API Key
$apiKeyGoogleMaps = 'AIzaSyDsVnvjw64n6ON1GZWt-xVkGtCqc5n6utk';

// API Key für https://timezonedb.com/
// $apiKeyTimezone = '56O5LUQP81ZI';
$apiKeyTimezone = 'PVJNK6RN5G1B';
// maximale Anzahl der eingebbaren Titel
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
// Show Spatial and Temporal Coverage form group
$showSpatialTemporalCoverage = true;
// Show Related Work form group
$showRelatedWork = true;
// Show Funding Reference form group
$showFundingReference = true;
// Show GCMD Thesauri form group
$showAuthorInstitution = true;


// SETTINGS FOR ICGEM
// Show GGMs Properties form group
$showGGMsProperties = true;
// Show Characteristics of the model form group
$characteristicsOfTheModel = false;

// Display the feedback link (true to display, false to hide)
$showFeedbackLink = true;

/////////////////////////////////////////OLD////////////////////////////////////////////////////////
// Show MSL labs form group
// $showMslLabs = true;
// // URL to the source with all laboratories for MSL
// $mslLabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/laboratories.json';
// // $mslLabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/labnames.json';
// // Show MSL vocabularies
// $showMslVocabs = true;
// // URL to the source with all vocabularies for MSL
// $mslVocabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';

// // Display the feedback link (true to display, false to hide)
// $showFeedbackLink = true;

/////////////////////////////////////////OLD////////////////////////////////////////////////////////


// Einstellungen für Mailversand mit SMTP
$smtpHost = 'mx2fe1.netcup.net';
$smtpPort = 465;
$smtpUser = 'mde2@cats4future.de';
$smtpPassword = 'AliMachtDasSchon2024!';
$smtpSender = 'mde2@cats4future.de';
// Zieladresse für Feedback
$feedbackAddress = 'ali.mohammed@gfz-potsdam.de';
// Vokabularien einbinden
$mslLabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/labnames.json'; // URL zur Quelle mit sämtlichen Laboren für MSL
$mslVocabsUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/'; // URL zum Ordner mit den MSL-Vokabularien
// Zieladresse für XML-Submit
$xmlSubmitAddress = 'ali.mohammed@gfz-potsdam.de';



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