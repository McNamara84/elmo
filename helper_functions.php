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