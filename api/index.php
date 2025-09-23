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
ini_set('display_errors', '1');

/**
 * Determine the API version from the provided server array.
 *
 * @param array<string, mixed> $server
 * @return non-empty-string
 */
function determineApiVersion(array $server): string
{
    $uri = isset($server['REQUEST_URI']) ? (string) $server['REQUEST_URI'] : '';
    $uri = trim($uri);

    if ($uri === '') {
        return 'v2';
    }

    $segments = explode('/', trim($uri, '/'));
    $uriParts = array_values(array_filter(
        $segments,
        static function (string $segment): bool {
            return $segment !== '';
        }
    ));

    $apiIndex = array_search('api', $uriParts, true);

    if ($apiIndex !== false && isset($uriParts[$apiIndex + 1])) {
        $candidate = $uriParts[$apiIndex + 1];

        if (preg_match('/^v\d+$/', $candidate) === 1) {
            return $candidate;
        }
    }

    return 'v2';
}

/**
 * Resolve and serve the API version specified in the server array.
 *
 * @param array<string, mixed> $server
 */
function serveApi(array $server): void
{
    $version = determineApiVersion($server);
    $versionFile = __DIR__ . '/' . $version . '/index.php';

    if (is_file($versionFile)) {
        require_once $versionFile;

        return;
    }

    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'API version not found']);
}

if (!defined('ELMO_API_INDEX_INCLUDE_ONLY')) {
    serveApi($_SERVER);
}
