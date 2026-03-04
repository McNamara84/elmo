<?php

/**
 * Service for communicating with the ERNIE API
 * 
 * This service handles fetching resource types and title types from the external 
 * ERNIE vocabulary service with caching support to minimize API calls and provide 
 * fallback when ERNIE is unavailable.
 */

// Only require settings.php if not in a test environment that already defined the globals
if (!defined('ERNIE_SERVICE_TEST_MODE')) {
    require_once __DIR__ . '/../../../settings.php';
}

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
     * @var string Path to the resource types cache file
     */
    private string $cacheFile;

    /**
     * @var string Path to the title types cache file
     */
    private string $titleTypesCacheFile;

    /**
     * ErnieService constructor.
     * 
     * Initializes the service with configuration from global settings.
     */
    public function __construct()
    {
        global $ernieUrl, $ernieApiKey, $ernieCacheTtl, $ernieResourceTypesCacheTtl;

        $this->baseUrl = rtrim($ernieUrl ?? '', '/');
        $this->apiKey = $ernieApiKey ?? '';
        // Support both new shared variable and legacy variable for backwards compatibility
        $this->cacheTtl = $ernieCacheTtl ?? $ernieResourceTypesCacheTtl ?? 21600; // Default: 6 hours
        $this->cacheFile = __DIR__ . '/../../../storage/cache/ernie_resource_types.json';
        $this->titleTypesCacheFile = __DIR__ . '/../../../storage/cache/ernie_title_types.json';
    }

    /**
     * Gets the resource types cache file path
     * 
     * @return string Path to the cache file
     */
    protected function getCacheFile(): string
    {
        return $this->cacheFile;
    }

    /**
     * Gets the title types cache file path
     * 
     * @return string Path to the title types cache file
     */
    protected function getTitleTypesCacheFile(): string
    {
        return $this->titleTypesCacheFile;
    }

    /**
     * Checks if the ERNIE service is configured and logs the result
     * 
     * @param bool $logResult Whether to log the configuration status (default: false)
     * @return bool True if both URL and API key are configured
     */
    public function isConfigured(bool $logResult = false): bool
    {
        $configured = !empty($this->baseUrl) && !empty($this->apiKey);
        
        if ($logResult) {
            if ($configured) {
                error_log("ERNIE: Service is configured (URL: " . $this->baseUrl . ")");
            } else {
                error_log("ERNIE: Service is NOT configured - will use local database");
            }
        }
        
        return $configured;
    }

    // ──────────────────────────────────────────────────────────────
    //  Generic HTTP & Cache helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches data from a given ERNIE API endpoint
     * 
     * @param string $endpoint The API endpoint path (e.g. '/api/v1/resource-types/elmo')
     * @param string $label Human-readable label for error logging
     * @return array<mixed>|null Array of data or null on failure
     */
    private function fetchFromErnie(string $endpoint, string $label): ?array
    {
        if (!$this->isConfigured()) {
            error_log("ERNIE: Missing URL or API key configuration");
            return null;
        }

        $url = $this->baseUrl . $endpoint;

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
            error_log("ERNIE: Failed to fetch $label from $url");
            return null;
        }

        // Check HTTP status code - $http_response_header is set by file_get_contents
        // @phpstan-ignore-next-line - $http_response_header is a magic PHP variable
        $responseHeaders = $http_response_header ?? [];
        if (!empty($responseHeaders)) {
            $statusLine = $responseHeaders[0];
            if (preg_match('/HTTP\/\d\.\d\s+(\d+)/', $statusLine, $matches)) {
                $statusCode = (int) $matches[1];
                if ($statusCode !== 200) {
                    error_log("ERNIE: HTTP error $statusCode when fetching $label");
                    return null;
                }
            }
        }

        $data = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("ERNIE: Invalid JSON response for $label - " . json_last_error_msg());
            return null;
        }

        // Validate response structure
        if (!is_array($data)) {
            error_log("ERNIE: Response for $label is not an array");
            return null;
        }

        return $data;
    }

    /**
     * Checks if a cache file exists and is not expired
     * 
     * @param string $cacheFilePath Path to the cache file
     * @return bool True if cache is valid
     */
    private function isCacheFileValid(string $cacheFilePath): bool
    {
        if (!file_exists($cacheFilePath)) {
            return false;
        }

        $content = @file_get_contents($cacheFilePath);
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
     * Reads data from a cache file
     * 
     * @param string $cacheFilePath Path to the cache file
     * @param bool $ignoreExpiry Whether to read cache even if expired
     * @return array<mixed> Cached data or empty array
     */
    private function readCacheFile(string $cacheFilePath, bool $ignoreExpiry = false): array
    {
        if (!file_exists($cacheFilePath)) {
            return [];
        }

        $content = @file_get_contents($cacheFilePath);
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
     * Writes data to a cache file
     * 
     * @param string $cacheFilePath Path to the cache file
     * @param array<mixed> $data Data to cache
     * @return bool True if cache was written successfully
     */
    private function writeCacheFile(string $cacheFilePath, array $data): bool
    {
        $cacheDir = dirname($cacheFilePath);

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
            $cacheFilePath,
            json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($result === false) {
            error_log("ERNIE: Failed to write cache file: $cacheFilePath");
            return false;
        }

        return true;
    }

    /**
     * Gets cache status information for a given cache file
     * 
     * @param string $cacheFilePath Path to the cache file
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    private function getCacheFileStatus(string $cacheFilePath): array
    {
        if (!file_exists($cacheFilePath)) {
            return [
                'exists' => false,
                'valid' => false,
                'lastUpdated' => null,
                'age' => null,
                'itemCount' => 0
            ];
        }

        $content = @file_get_contents($cacheFilePath);
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
            'valid' => $this->isCacheFileValid($cacheFilePath),
            'lastUpdated' => $cache['lastUpdated'] ?? null,
            'age' => $age,
            'ageFormatted' => $age ? $this->formatAge($age) : null,
            'ttl' => $this->cacheTtl,
            'itemCount' => isset($cache['data']) ? count($cache['data']) : 0
        ];
    }

    // ──────────────────────────────────────────────────────────────
    //  Generic cache workflow helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Gets data from ERNIE with full cache fallback chain
     *
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback as last resort
     *
     * @param string $endpoint The API endpoint path
     * @param string $label Human-readable label for logging
     * @param string $cacheFile Path to the cache file
     * @param callable(): array<int, mixed> $fallbackFn Function returning fallback data
     * @return array<mixed> Data from cache, ERNIE, or fallback
     */
    private function getDataWithCache(
        string $endpoint,
        string $label,
        string $cacheFile,
        callable $fallbackFn
    ): array {
        if ($this->isCacheFileValid($cacheFile)) {
            $cachedData = $this->readCacheFile($cacheFile);
            if (!empty($cachedData)) {
                return $cachedData;
            }
        }

        $ernieData = $this->fetchFromErnie($endpoint, $label);
        if ($ernieData !== null && !empty($ernieData)) {
            $this->writeCacheFile($cacheFile, $ernieData);
            return $ernieData;
        }

        $staleCache = $this->readCacheFile($cacheFile, ignoreExpiry: true);
        if (!empty($staleCache)) {
            error_log("ERNIE: Using stale cache as fallback for $label");
            return $staleCache;
        }

        error_log("ERNIE: Using hardcoded fallback for $label - all other sources unavailable");
        return $fallbackFn();
    }

    /**
     * Fetches data from ERNIE and caches it
     *
     * @param string $endpoint The relative API path
     * @param string $label Human-readable label for logging
     * @param string $cacheFile The destination cache file path
     * @return bool True if refresh was successful
     */
    private function refreshCacheFromApi(string $endpoint, string $label, string $cacheFile): bool
    {
        $data = $this->fetchFromErnie($endpoint, $label);
        if ($data !== null && !empty($data)) {
            return $this->writeCacheFile($cacheFile, $data);
        }
        return false;
    }

    // ──────────────────────────────────────────────────────────────
    //  Resource Types
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches resource types from ERNIE API
     * 
     * @return array<array{id: int, name: string, description: string|null}>|null Array of resource types or null on failure
     */
    public function fetchResourceTypes(): ?array
    {
        return $this->fetchFromErnie('/api/v1/resource-types/elmo', 'resource types');
    }

    /**
     * Gets resource types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (Dataset, Other) as last resort
     * 
     * @return array<array{id: int, name: string, description: string|null}> Resource types from cache or ERNIE
     */
    public function getResourceTypesWithCache(): array
    {
        return $this->getDataWithCache(
            '/api/v1/resource-types/elmo',
            'resource types',
            $this->getCacheFile(),
            [$this, 'getHardcodedResourceTypeFallback']
        );
    }

    /**
     * Returns hardcoded fallback resource types
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * Dataset and Other are the most common and stable DataCite resource types.
     * Without at least one resource type, ELMO cannot submit metadata.
     * 
     * @return array<array{id: int, name: string, description: string|null}> Minimal fallback resource types
     */
    private function getHardcodedResourceTypeFallback(): array
    {
        return [
            [
                'id' => 10,  // ERNIE ID for Dataset
                'name' => 'Dataset',
                'description' => 'Data encoded in a defined structure'
            ],
            [
                'id' => 21,  // ERNIE ID for Other
                'name' => 'Other',
                'description' => 'Other resource type not covered by the available options'
            ]
        ];
    }

    /**
     * Forces resource types cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshCache(): bool
    {
        return $this->refreshCacheFromApi(
            '/api/v1/resource-types/elmo',
            'resource types',
            $this->getCacheFile()
        );
    }

    /**
     * Gets resource types cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getCacheFile());
    }

    // ──────────────────────────────────────────────────────────────
    //  Title Types
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches title types from ERNIE API
     * 
     * @return array<array{id: int, name: string, slug: string}>|null Array of title types or null on failure
     */
    public function fetchTitleTypes(): ?array
    {
        return $this->fetchFromErnie('/api/v1/title-types/elmo', 'title types');
    }

    /**
     * Gets title types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (Main Title, Alternative Title, Translated Title) as last resort
     * 
     * @return array<array{id: int, name: string, slug: string}> Title types from cache or ERNIE
     */
    public function getTitleTypesWithCache(): array
    {
        return $this->getDataWithCache(
            '/api/v1/title-types/elmo',
            'title types',
            $this->getTitleTypesCacheFile(),
            [$this, 'getHardcodedTitleTypeFallback']
        );
    }

    /**
     * Returns hardcoded fallback title types
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * Main Title, Alternative Title, and Translated Title are the original ELMO title types.
     * 
     * @return array<array{id: int, name: string, slug: string}> Minimal fallback title types
     */
    private function getHardcodedTitleTypeFallback(): array
    {
        return [
            [
                'id' => 1,  // ERNIE ID for Main Title
                'name' => 'Main Title',
                'slug' => 'main-title'
            ],
            [
                'id' => 2,  // ERNIE ID for Alternative Title
                'name' => 'Alternative Title',
                'slug' => 'alternative-title'
            ],
            [
                'id' => 4,  // ERNIE ID for Translated Title
                'name' => 'Translated Title',
                'slug' => 'translated-title'
            ]
        ];
    }

    /**
     * Forces title types cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshTitleTypesCache(): bool
    {
        return $this->refreshCacheFromApi(
            '/api/v1/title-types/elmo',
            'title types',
            $this->getTitleTypesCacheFile()
        );
    }

    /**
     * Gets title types cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getTitleTypesCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getTitleTypesCacheFile());
    }

    // ──────────────────────────────────────────────────────────────
    //  Utilities
    // ──────────────────────────────────────────────────────────────

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
