<?php
/**
 * Entry point for the API.
 *
 * This script determines the API version from the request URI and delegates
 * the request to the appropriate version-specific `index.php` file.
 * If no version is specified, it defaults to version 2 (`v2`).
 */

// Enable error reporting for debugging purposes.
error_reporting(E_ALL);
ini_set('display_errors', 1);

/**
 * Retrieve the request URI from the server variables.
 *
 * @var string $uri The full request URI.
 */
$uri = $_SERVER['REQUEST_URI'];

/**
 * Split the URI into parts by '/' and trim any leading/trailing slashes.
 *
 * @var array $uriParts An array of URI segments.
 */
$uriParts = explode('/', trim($uri, '/'));

/**
 * Find the index of 'api' in the URI segments.
 *
 * @var int|false $apiIndex The index of 'api' in $uriParts, or false if not found.
 */
$apiIndex = array_search('api', $uriParts);

/**
 * Determine the API version from the URI.
 *
 * If a version is specified immediately after 'api' in the URI (e.g., 'v1', 'v2'),
 * it uses that version. Otherwise, it defaults to 'v2'.
 *
 * @var string $version The API version to use.
 */
if ($apiIndex !== false && isset($uriParts[$apiIndex + 1]) && preg_match('/^v\d+$/', $uriParts[$apiIndex + 1])) {
    $version = $uriParts[$apiIndex + 1];
} else {
    // Default to v2 if no version is specified
    $version = 'v2';
}

/**
 * Construct the path to the version-specific index.php file.
 *
 * @var string $versionFile The file path to the version-specific index.php.
 */
$versionFile = __DIR__ . '/' . $version . '/index.php';

/**
 * Check if the version-specific index.php file exists.
 * If it does, require it to handle the request.
 * Otherwise, send a 404 Not Found response with an error message.
 */
if (file_exists($versionFile)) {
    require_once $versionFile;
} else {
    http_response_code(404);
    echo json_encode(['error' => 'API version not found']);
}
