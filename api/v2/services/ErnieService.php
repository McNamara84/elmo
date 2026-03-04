<?php

/**
 * Service for communicating with the ERNIE API
 * 
 * This service handles fetching resource types from the external ERNIE vocabulary service
 * with caching support to minimize API calls and provide fallback when ERNIE is unavailable.
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
     * @var string Path to the cache file
     */
    private string $cacheFile;

    /**
     * @var string Path to the PID4INST instruments cache file
     */
    private string $pid4instCacheFile;

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
        $this->pid4instCacheFile = __DIR__ . '/../../../storage/cache/ernie_pid4inst.json';
    }

    /**
     * Gets the cache file path
     * 
     * @return string Path to the cache file
     */
    protected function getCacheFile(): string
    {
        return $this->cacheFile;
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

    /**
     * Fetches resource types from ERNIE API
     * 
     * @return array<array{id: int, name: string, description: string|null}>|null Array of resource types or null on failure
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

        // Check HTTP status code - $http_response_header is set by file_get_contents
        // @phpstan-ignore-next-line - $http_response_header is a magic PHP variable
        $responseHeaders = $http_response_header ?? [];
        if (!empty($responseHeaders)) {
            $statusLine = $responseHeaders[0];
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
     * 4. Hardcoded fallback (Dataset, Other) as last resort
     * 
     * @return array<array{id: int, name: string, description: string|null}> Resource types from cache or ERNIE
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

        // Last resort: hardcoded fallback to ensure ELMO can always submit
        // Dataset and Other are stable DataCite values unlikely to change
        error_log("ERNIE: Using hardcoded fallback (Dataset, Other) - all other sources unavailable");
        return $this->getHardcodedFallback();
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
    private function getHardcodedFallback(): array
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
     * Checks if cache file exists and is not expired
     * 
     * @return bool True if cache is valid
     */
    private function isCacheValid(): bool
    {
        $cacheFile = $this->getCacheFile();
        if (!file_exists($cacheFile)) {
            return false;
        }

        $content = @file_get_contents($cacheFile);
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
     * @return array<array{id: int, name: string, description: string|null}> Cached data or empty array
     */
    private function readCache(bool $ignoreExpiry = false): array
    {
        $cacheFile = $this->getCacheFile();
        if (!file_exists($cacheFile)) {
            return [];
        }

        $content = @file_get_contents($cacheFile);
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
     * @param array<array{id: int, name: string, description: string|null}> $data Resource types to cache
     * @return bool True if cache was written successfully
     */
    private function writeCache(array $data): bool
    {
        $cacheFile = $this->getCacheFile();
        $cacheDir = dirname($cacheFile);

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
            $cacheFile,
            json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($result === false) {
            error_log("ERNIE: Failed to write cache file: $cacheFile");
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
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status including validity, age, and item count
     */
    public function getCacheStatus(): array
    {
        $cacheFile = $this->getCacheFile();
        if (!file_exists($cacheFile)) {
            return [
                'exists' => false,
                'valid' => false,
                'lastUpdated' => null,
                'age' => null,
                'itemCount' => 0
            ];
        }

        $content = @file_get_contents($cacheFile);
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

    // ==================== PID4INST Instruments ====================

    /**
     * Gets the PID4INST instruments cache file path
     * 
     * @return string Path to the PID4INST cache file
     */
    protected function getPid4instCacheFile(): string
    {
        return $this->pid4instCacheFile;
    }

    /**
     * Fetches PID4INST instruments from the ERNIE API
     * 
     * @return array{lastUpdated: string, total: int, data: array<array{id: string, pid: string, pidType: string, name: string, instrumentTypes: string[]}>}|null Instruments data or null on failure
     */
    public function fetchPid4instInstruments(): ?array
    {
        if (!$this->isConfigured()) {
            error_log("ERNIE: Missing URL or API key configuration for PID4INST");
            return null;
        }

        $url = $this->baseUrl . '/api/v1/vocabularies/pid4inst-instruments';

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => [
                    'X-API-KEY: ' . $this->apiKey,
                    'Accept: application/json'
                ],
                'timeout' => 30,
                'ignore_errors' => true
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true
            ]
        ]);

        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            error_log("ERNIE: Failed to fetch PID4INST instruments from $url");
            return null;
        }

        // Check HTTP status code
        // @phpstan-ignore-next-line - $http_response_header is a magic PHP variable
        $responseHeaders = $http_response_header ?? [];
        if (!empty($responseHeaders)) {
            $statusLine = $responseHeaders[0];
            if (preg_match('/HTTP\/\d\.\d\s+(\d+)/', $statusLine, $matches)) {
                $statusCode = (int) $matches[1];
                if ($statusCode !== 200) {
                    error_log("ERNIE: HTTP error $statusCode when fetching PID4INST instruments");
                    return null;
                }
            }
        }

        $data = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("ERNIE: Invalid JSON response for PID4INST - " . json_last_error_msg());
            return null;
        }

        // Validate response structure: must have 'data' array
        if (!is_array($data) || !isset($data['data']) || !is_array($data['data'])) {
            error_log("ERNIE: PID4INST response missing 'data' array");
            return null;
        }

        return $data;
    }

    /**
     * Gets PID4INST instruments with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. null (no hardcoded fallback – instrument data is too specific)
     * 
     * @return array{lastUpdated: string, total: int, data: array<mixed>}|null Instruments data or null if unavailable
     */
    public function getPid4instInstrumentsWithCache(): ?array
    {
        $cacheFile = $this->getPid4instCacheFile();

        // Check if cache is valid
        if ($this->isCacheValidForFile($cacheFile)) {
            $cachedData = $this->readCacheFile($cacheFile);
            if (!empty($cachedData)) {
                return $cachedData;
            }
        }

        // Try to fetch from ERNIE
        $ernieData = $this->fetchPid4instInstruments();

        if ($ernieData !== null && !empty($ernieData['data'])) {
            $this->writeCacheFile($cacheFile, $ernieData);
            return $ernieData;
        }

        // Fallback to stale cache if ERNIE unavailable
        $staleCache = $this->readCacheFile($cacheFile, ignoreExpiry: true);
        if (!empty($staleCache)) {
            error_log("ERNIE: Using stale PID4INST cache as fallback");
            return $staleCache;
        }

        // No fallback possible for instrument-specific data
        error_log("ERNIE: PID4INST instruments unavailable - no cache or API data");
        return null;
    }

    /**
     * Forces PID4INST cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshPid4instCache(): bool
    {
        $data = $this->fetchPid4instInstruments();

        if ($data !== null && !empty($data['data'])) {
            return $this->writeCacheFile($this->getPid4instCacheFile(), $data);
        }

        return false;
    }

    /**
     * Gets PID4INST cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getPid4instCacheStatus(): array
    {
        $cacheFile = $this->getPid4instCacheFile();
        if (!file_exists($cacheFile)) {
            return [
                'exists' => false,
                'valid' => false,
                'lastUpdated' => null,
                'age' => null,
                'itemCount' => 0
            ];
        }

        $content = @file_get_contents($cacheFile);
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
            'valid' => $this->isCacheValidForFile($cacheFile),
            'lastUpdated' => $cache['lastUpdated'] ?? null,
            'age' => $age,
            'ageFormatted' => $age ? $this->formatAge($age) : null,
            'ttl' => $this->cacheTtl,
            'itemCount' => isset($cache['data']) ? (is_array($cache['data']) ? count($cache['data']) : 0) : 0
        ];
    }

    // ==================== Generic Cache Helpers ====================

    /**
     * Checks if a specific cache file exists and is not expired
     * 
     * @param string $cacheFile Path to the cache file
     * @return bool True if cache is valid
     */
    private function isCacheValidForFile(string $cacheFile): bool
    {
        if (!file_exists($cacheFile)) {
            return false;
        }

        $content = @file_get_contents($cacheFile);
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
     * Reads a cache file and returns its contents
     * 
     * @param string $cacheFile Path to the cache file
     * @param bool $ignoreExpiry Whether to read cache even if expired
     * @return array<string, mixed> Cached data or empty array
     */
    private function readCacheFile(string $cacheFile, bool $ignoreExpiry = false): array
    {
        if (!file_exists($cacheFile)) {
            return [];
        }

        $content = @file_get_contents($cacheFile);
        if ($content === false) {
            return [];
        }

        $cache = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }

        // For PID4INST-style cache (full object with data array), return the whole object
        if (isset($cache['data']) && is_array($cache['data'])) {
            return $cache;
        }

        return $cache['data'] ?? [];
    }

    /**
     * Writes data to a specific cache file
     * 
     * @param string $cacheFile Path to the cache file
     * @param array<string, mixed> $data Data to cache
     * @return bool True if cache was written successfully
     */
    private function writeCacheFile(string $cacheFile, array $data): bool
    {
        $cacheDir = dirname($cacheFile);

        if (!is_dir($cacheDir)) {
            if (!mkdir($cacheDir, 0755, true)) {
                error_log("ERNIE: Failed to create cache directory: $cacheDir");
                return false;
            }
        }

        // If data already has the cache structure (lastUpdated, data), wrap it;
        // otherwise use the existing resource-types format
        if (isset($data['lastUpdated']) && isset($data['data'])) {
            $cache = [
                'lastUpdated' => date('c'),
                'ttl' => $this->cacheTtl,
                'source' => 'ernie',
                'originalLastUpdated' => $data['lastUpdated'],
                'total' => $data['total'] ?? count($data['data']),
                'data' => $data['data']
            ];
        } else {
            $cache = [
                'lastUpdated' => date('c'),
                'ttl' => $this->cacheTtl,
                'source' => 'ernie',
                'data' => $data
            ];
        }

        $result = file_put_contents(
            $cacheFile,
            json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($result === false) {
            error_log("ERNIE: Failed to write cache file: $cacheFile");
            return false;
        }

        return true;
    }
}
