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
    $host = getenv('DB_HOST') ?: "db";
    $username = getenv('DB_USER') ?: "elmo";
    $password = getenv('DB_PASSWORD') ?: "password";
    $database = getenv('DB_NAME') ?: "elmocache";
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

function loadEnvVariables($path = null) {
    // Default to .env file in the root directory if no path specified
    $path = $path ?: __DIR__ . '/.env';
    
    // Check if file exists
    if (!file_exists($path)) {
        elmo_log("Environment file not found: $path");
        return false;
    }
    
    // Read file
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    // Parse each line
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        // Parse line and set environment variable
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            
            // Remove quotes if present
            if (strpos($value, '"') === 0 && strrpos($value, '"') === strlen($value) - 1) {
                $value = substr($value, 1, -1);
            } elseif (strpos($value, "'") === 0 && strrpos($value, "'") === strlen($value) - 1) {
                $value = substr($value, 1, -1);
            }
            
            // Convert boolean-like values (true, false, yes, no, 1, 0)
            if (in_array(strtolower($value), ['true', 'false', 'yes', 'no', '1', '0', 'on', 'off'])) {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
                
                // Set as global PHP variable directly (for use in templates)
                global $$name;
                $$name = $value;
            }
            
            putenv("$name=$value");
        }
    }
    
    return true;
}

// Initialize logging    
function elmo_log($prefix, $msg) {
    error_log("[ELMO $prefix] $msg");
}