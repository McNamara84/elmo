<?php
/**
 *
 * Contains database connection settings, API keys, and application configuration variables.
 *
 */

// Load environment configuration
require_once __DIR__ . '/config/env_reading.php';

/**
 * Establishes a connection to the database.
 *
 * @return mysqli The MySQLi connection object.
 */
function connectDb()
{
    $host = getenv('DB_HOST') ?: 'db';  // Use 'db' as default
    $username = getenv('DB_USER') ?: 'metadata_user';
    $password = getenv('DB_PASSWORD') ?: 'secret';
    $database = getenv('DB_NAME') ?: 'metadata_db';
    $conn = new mysqli($host, $username, $password, $database);
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }
    return $conn;
}

/**
 * Outputs the Google Maps API key in JSON format.
 *
 * @return void
 */
function getApiKey()
{
    // Google Maps API Key
    $apiKeyGoogleMaps = 'AIzaSyD4c-fpy1mBQ0DwckCAQtQsVJdUMq2YYpg';
    // Set the correct header for a JSON response
    header('Content-Type: application/json');
    // Return API key as JSON
    echo json_encode(['apiKey' => $apiKeyGoogleMaps]);
    // Stop the script to prevent any further output
    exit;
}

// Check if the file is accessed directly via an HTTP request
if (basename(__FILE__) == basename($_SERVER['PHP_SELF'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        getApiKey();
    }
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
/**
 * Custom logging function for the ELMO application.
 * Writes messages to a dedicated log file in the /logs directory.
 *
 * @param string $msg The message to log.
 * @return void
 */
function elmo_log($msg) {
    // Define the path to the log file, relative to the project root.
    $log_file_path = __DIR__ . '/logs/elmo.log';
    
    // Ensure the logs directory exists.
    $log_dir = dirname($log_file_path);
    if (!is_dir($log_dir)) {
        @mkdir($log_dir, 0775, true);
    }

    // Format the message with a timestamp.
    $log_message = date('Y-m-d H:i:s') . " - " . $msg . "\n";

    // Append the message to the log file.
    // FILE_APPEND prevents the file from being overwritten on each call.
    file_put_contents($log_file_path, $log_message, FILE_APPEND);
}