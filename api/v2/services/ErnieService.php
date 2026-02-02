<?php

/**
 * Service for communicating with the ERNIE API
 * 
 * This service handles fetching resource types from the external ERNIE vocabulary service
 * with caching support to minimize API calls and provide fallback when ERNIE is unavailable.
 */

require_once __DIR__ . '/../../../settings.php';

class ErnieService
{
    /**
     * @var string The base URL for the ERNIE API
     */
    private string $baseUrl;

    /**
     * @var string The API key for ERNIE authentication
     */
    private string $apiKey;

    /**
     * @var int Cache time-to-live in seconds
     */
    private int $cacheTtl;

    /**
     * @var string Path to the cache file
     */
    private string $cacheFile;

    /**
     * ErnieService constructor.
     * 
     * Initializes the service with configuration from global settings.
     */
    public function __construct()
    {
        global $ernieUrl, $ernieApiKey, $ernieResourceTypesCacheTtl;

        $this->baseUrl = rtrim($ernieUrl ?? '', '/');
        $this->apiKey = $ernieApiKey ?? '';
        $this->cacheTtl = $ernieResourceTypesCacheTtl ?? 21600; // Default: 6 hours
        $this->cacheFile = __DIR__ . '/../../../storage/cache/ernie_resource_types.json';
    }

    /**
     * Checks if the ERNIE service is configured
     * 
     * @return bool True if both URL and API key are configured
     */
    public function isConfigured(): bool
    {
        return !empty($this->baseUrl) && !empty($this->apiKey);
    }

    /**
     * Fetches resource types from ERNIE API
     * 
     * @return array|null Array of resource types or null on failure
     */
    public function fetchResourceTypes(): ?array
    {
        if (!$this->isConfigured()) {
            error_log("ERNIE: Missing URL or API key configuration");
            return null;
        }

        $url = $this->baseUrl . '/api/v1/resource-types/elmo';

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => [
                    'X-API-KEY: ' . $this->apiKey,
                    'Accept: application/json'
                ],
                'timeout' => 10,
                'ignore_errors' => true
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true
            ]
        ]);

        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            error_log("ERNIE: Failed to fetch resource types from $url");
            return null;
        }

        // Check HTTP status code
        if (isset($http_response_header)) {
            $statusLine = $http_response_header[0] ?? '';
            if (preg_match('/HTTP\/\d\.\d\s+(\d+)/', $statusLine, $matches)) {
                $statusCode = (int) $matches[1];
                if ($statusCode !== 200) {
                    error_log("ERNIE: HTTP error $statusCode when fetching resource types");
                    return null;
                }
            }
        }

        $data = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("ERNIE: Invalid JSON response - " . json_last_error_msg());
            return null;
        }

        // Validate response structure
        if (!is_array($data)) {
            error_log("ERNIE: Response is not an array");
            return null;
        }

        return $data;
    }

    /**
     * Gets resource types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Empty array (last resort)
     * 
     * @return array Resource types from cache or ERNIE
     */
    public function getResourceTypesWithCache(): array
    {
        // Check if cache is valid
        if ($this->isCacheValid()) {
            $cachedData = $this->readCache();
            if (!empty($cachedData)) {
                return $cachedData;
            }
        }

        // Try to fetch from ERNIE
        $ernieData = $this->fetchResourceTypes();

        if ($ernieData !== null && !empty($ernieData)) {
            $this->writeCache($ernieData);
            return $ernieData;
        }

        // Fallback to stale cache if ERNIE unavailable
        $staleCache = $this->readCache(ignoreExpiry: true);
        if (!empty($staleCache)) {
            error_log("ERNIE: Using stale cache as fallback");
            return $staleCache;
        }

        return [];
    }

    /**
     * Checks if cache file exists and is not expired
     * 
     * @return bool True if cache is valid
     */
    private function isCacheValid(): bool
    {
        if (!file_exists($this->cacheFile)) {
            return false;
        }

        $content = @file_get_contents($this->cacheFile);
        if ($content === false) {
            return false;
        }

        $cache = json_decode($content, true);

        if (!isset($cache['lastUpdated'])) {
            return false;
        }

        $lastUpdated = strtotime($cache['lastUpdated']);
        if ($lastUpdated === false) {
            return false;
        }

        $age = time() - $lastUpdated;

        return $age < $this->cacheTtl;
    }

    /**
     * Reads cache file
     * 
     * @param bool $ignoreExpiry Whether to read cache even if expired
     * @return array Cached data or empty array
     */
    private function readCache(bool $ignoreExpiry = false): array
    {
        if (!file_exists($this->cacheFile)) {
            return [];
        }

        $content = @file_get_contents($this->cacheFile);
        if ($content === false) {
            return [];
        }

        $cache = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }

        return $cache['data'] ?? [];
    }

    /**
     * Writes data to cache file
     * 
     * @param array $data Resource types to cache
     * @return bool True if cache was written successfully
     */
    private function writeCache(array $data): bool
    {
        $cacheDir = dirname($this->cacheFile);

        if (!is_dir($cacheDir)) {
            if (!mkdir($cacheDir, 0755, true)) {
                error_log("ERNIE: Failed to create cache directory: $cacheDir");
                return false;
            }
        }

        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => $this->cacheTtl,
            'source' => 'ernie',
            'data' => $data
        ];

        $result = file_put_contents(
            $this->cacheFile,
            json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($result === false) {
            error_log("ERNIE: Failed to write cache file: $this->cacheFile");
            return false;
        }

        return true;
    }

    /**
     * Forces cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshCache(): bool
    {
        $data = $this->fetchResourceTypes();

        if ($data !== null && !empty($data)) {
            return $this->writeCache($data);
        }

        return false;
    }

    /**
     * Gets cache status information
     * 
     * @return array Cache status including validity, age, and item count
     */
    public function getCacheStatus(): array
    {
        if (!file_exists($this->cacheFile)) {
            return [
                'exists' => false,
                'valid' => false,
                'lastUpdated' => null,
                'age' => null,
                'itemCount' => 0
            ];
        }

        $content = @file_get_contents($this->cacheFile);
        if ($content === false) {
            return [
                'exists' => true,
                'valid' => false,
                'lastUpdated' => null,
                'age' => null,
                'itemCount' => 0,
                'error' => 'Unable to read cache file'
            ];
        }

        $cache = json_decode($content, true);

        $lastUpdated = isset($cache['lastUpdated']) ? strtotime($cache['lastUpdated']) : null;
        $age = $lastUpdated ? time() - $lastUpdated : null;

        return [
            'exists' => true,
            'valid' => $this->isCacheValid(),
            'lastUpdated' => $cache['lastUpdated'] ?? null,
            'age' => $age,
            'ageFormatted' => $age ? $this->formatAge($age) : null,
            'ttl' => $this->cacheTtl,
            'itemCount' => isset($cache['data']) ? count($cache['data']) : 0
        ];
    }

    /**
     * Formats age in seconds to human-readable string
     * 
     * @param int $seconds Age in seconds
     * @return string Formatted age string
     */
    private function formatAge(int $seconds): string
    {
        if ($seconds < 60) {
            return "$seconds seconds";
        } elseif ($seconds < 3600) {
            $minutes = floor($seconds / 60);
            return "$minutes minute" . ($minutes > 1 ? 's' : '');
        } else {
            $hours = floor($seconds / 3600);
            $minutes = floor(($seconds % 3600) / 60);
            return "$hours hour" . ($hours > 1 ? 's' : '') . " $minutes minute" . ($minutes > 1 ? 's' : '');
        }
    }
}
