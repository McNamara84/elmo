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
     * @var string Path to the languages cache file
     */
    private string $languagesCacheFile;

    /**
     * @var string Path to the PID4INST instruments cache file
     */
    private string $pid4instCacheFile;

    /**
     * @var string Path to the contributor person roles cache file
     */
    private string $contributorPersonRolesCacheFile;

    /**
     * @var string Path to the contributor institution roles cache file
     */
    private string $contributorInstitutionRolesCacheFile;

    /**
     * @var string Path to the thesauri availability cache file
     */
    private string $thesauriAvailabilityCacheFile;

    /**
     * @var string Path to the GCMD Science Keywords cache file
     */
    private string $scienceKeywordsCacheFile;

    /**
     * @var string Path to the GCMD Platforms cache file
     */
    private string $platformsCacheFile;

    /**
     * @var string Path to the GCMD Instruments cache file
     */
    private string $instrumentsCacheFile;

    /**
     * @var string Path to the Chronostratigraphy cache file
     */
    private string $chronostratCacheFile;

    /**
     * @var string Path to the GEMET cache file
     */
    private string $gemetCacheFile;

    /**
     * @var string Path to the description types cache file
     */
    private string $descriptionTypesCacheFile;

    /**
     * @var array<string, string> Mapping of thesaurus slugs to cache file paths
     */
    private array $thesaurusCacheFiles;

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
        $this->languagesCacheFile = __DIR__ . '/../../../storage/cache/ernie_languages.json';
        $this->pid4instCacheFile = __DIR__ . '/../../../storage/cache/ernie_pid4inst.json';
        $this->contributorPersonRolesCacheFile = __DIR__ . '/../../../storage/cache/ernie_contributor_person_roles.json';
        $this->contributorInstitutionRolesCacheFile = __DIR__ . '/../../../storage/cache/ernie_contributor_institution_roles.json';
        $this->thesauriAvailabilityCacheFile = __DIR__ . '/../../../storage/cache/ernie_thesauri_availability.json';
        $this->scienceKeywordsCacheFile = __DIR__ . '/../../../storage/cache/ernie_gcmd_science_keywords.json';
        $this->platformsCacheFile = __DIR__ . '/../../../storage/cache/ernie_gcmd_platforms.json';
        $this->instrumentsCacheFile = __DIR__ . '/../../../storage/cache/ernie_gcmd_instruments.json';
        $this->chronostratCacheFile = __DIR__ . '/../../../storage/cache/ernie_chronostrat_timescale.json';
        $this->gemetCacheFile = __DIR__ . '/../../../storage/cache/ernie_gemet.json';
        $this->descriptionTypesCacheFile = __DIR__ . '/../../../storage/cache/ernie_description_types.json';
        $this->thesaurusCacheFiles = [
            'gcmd-science-keywords' => $this->scienceKeywordsCacheFile,
            'gcmd-platforms' => $this->platformsCacheFile,
            'gcmd-instruments' => $this->instrumentsCacheFile,
            'chronostrat-timescale' => $this->chronostratCacheFile,
            'gemet' => $this->gemetCacheFile,
        ];
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
     * Gets the description types cache file path
     * 
     * @return string Path to the description types cache file
     */
    protected function getDescriptionTypesCacheFile(): string
    {
        return $this->descriptionTypesCacheFile;
    }

    /**
     * Gets the languages cache file path
     * 
     * @return string Path to the languages cache file
     */
    protected function getLanguagesCacheFile(): string
    {
        return $this->languagesCacheFile;
    }

    /**
     * Gets the contributor person roles cache file path
     * 
     * @return string Path to the contributor person roles cache file
     */
    protected function getContributorPersonRolesCacheFile(): string
    {
        return $this->contributorPersonRolesCacheFile;
    }

    /**
     * Gets the contributor institution roles cache file path
     * 
     * @return string Path to the contributor institution roles cache file
     */
    protected function getContributorInstitutionRolesCacheFile(): string
    {
        return $this->contributorInstitutionRolesCacheFile;
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
     * @param (callable(array<mixed>): void)|null $onFreshData Optional callback invoked only when fresh data is fetched from ERNIE (not on cache hit)
     * @return array<mixed> Data from cache, ERNIE, or fallback
     */
    private function getDataWithCache(
        string $endpoint,
        string $label,
        string $cacheFile,
        callable $fallbackFn,
        ?callable $onFreshData = null
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
            if ($onFreshData !== null) {
                $onFreshData($ernieData);
            }
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
    //  Description Types
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches description types from ERNIE API
     * 
     * @return array<mixed>|null Raw API response or null on failure
     */
    public function fetchDescriptionTypes(): ?array
    {
        return $this->fetchFromErnie('/api/v1/description-types/elmo', 'description types');
    }

    /**
     * Gets description types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (Abstract, Methods, TechnicalInfo, Other) as last resort
     * 
     * @return array<mixed> Description types from cache or ERNIE
     */
    public function getDescriptionTypesWithCache(): array
    {
        return $this->getDataWithCache(
            '/api/v1/description-types/elmo',
            'description types',
            $this->getDescriptionTypesCacheFile(),
            [$this, 'getHardcodedDescriptionTypeFallback']
        );
    }

    /**
     * Returns hardcoded fallback description types
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * Abstract, Methods, TechnicalInfo, and Other are the original ELMO description types.
     * 
     * @return array<array{id: int, name: string, slug: string}> Minimal fallback description types
     */
    private function getHardcodedDescriptionTypeFallback(): array
    {
        return [
            [
                'id' => 1,
                'name' => 'Abstract',
                'slug' => 'Abstract'
            ],
            [
                'id' => 2,
                'name' => 'Methods',
                'slug' => 'Methods'
            ],
            [
                'id' => 5,
                'name' => 'Technical Info',
                'slug' => 'TechnicalInfo'
            ],
            [
                'id' => 6,
                'name' => 'Other',
                'slug' => 'Other'
            ]
        ];
    }

    /**
     * Forces description types cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshDescriptionTypesCache(): bool
    {
        return $this->refreshCacheFromApi(
            '/api/v1/description-types/elmo',
            'description types',
            $this->getDescriptionTypesCacheFile()
        );
    }

    /**
     * Gets description types cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getDescriptionTypesCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getDescriptionTypesCacheFile());
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
    //  Languages
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches languages from ERNIE API
     * 
     * @return array<array{id: int, name: string, code: string}>|null Array of languages or null on failure
     */
    public function fetchLanguages(): ?array
    {
        return $this->fetchFromErnie('/api/v1/languages/elmo', 'languages');
    }

    /**
     * Gets languages with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (English, German) as last resort
     * 
     * @return array<array{id: int, name: string, code: string}> Languages from cache or ERNIE
     */
    public function getLanguagesWithCache(): array
    {
        return $this->getDataWithCache(
            '/api/v1/languages/elmo',
            'languages',
            $this->getLanguagesCacheFile(),
            [$this, 'getHardcodedLanguageFallback']
        );
    }

    /**
     * Returns hardcoded fallback languages
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * English and German are the two most common languages at GFZ.
     * 
     * @return array<array{id: int, name: string, code: string}> Minimal fallback languages
     */
    private function getHardcodedLanguageFallback(): array
    {
        return [
            [
                'id' => 1,
                'name' => 'English',
                'code' => 'en'
            ],
            [
                'id' => 2,
                'name' => 'German',
                'code' => 'de'
            ]
        ];
    }

    /**
     * Forces languages cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshLanguagesCache(): bool
    {
        return $this->refreshCacheFromApi(
            '/api/v1/languages/elmo',
            'languages',
            $this->getLanguagesCacheFile()
        );
    }

    /**
     * Gets languages cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getLanguagesCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getLanguagesCacheFile());
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

    // ──────────────────────────────────────────────────────────────
    //  PID4INST Instruments
    // ──────────────────────────────────────────────────────────────

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
     * Gets PID4INST instruments with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Empty array (no hardcoded fallback – instrument data is too specific)
     * 
     * @return array<mixed> Instruments data or empty array if unavailable
     */
    public function getPid4instInstrumentsWithCache(): array
    {
        return $this->getDataWithCache(
            '/api/v1/vocabularies/pid4inst-instruments',
            'PID4INST instruments',
            $this->getPid4instCacheFile(),
            fn() => []
        );
    }

    /**
     * Forces PID4INST cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshPid4instCache(): bool
    {
        return $this->refreshCacheFromApi(
            '/api/v1/vocabularies/pid4inst-instruments',
            'PID4INST instruments',
            $this->getPid4instCacheFile()
        );
    }

    /**
     * Gets PID4INST cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getPid4instCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getPid4instCacheFile());
    }

    // ──────────────────────────────────────────────────────────────
    //  Contributor Person Roles
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches contributor person roles from ERNIE API
     * 
     * @return array<array{id: int, name: string}>|null Array of roles or null on failure
     */
    public function fetchContributorPersonRoles(): ?array
    {
        return $this->fetchFromErnie('/api/v1/roles/contributor-persons/elmo', 'contributor person roles');
    }

    /**
     * Gets contributor person roles with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (triggers onFreshData callback for DB sync)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback as last resort
     * 
     * @param (callable(array<array{id: int, name: string}>): void)|null $onFreshData Optional callback invoked only when fresh data is fetched from ERNIE
     * @return array<array{id: int, name: string}> Contributor person roles from cache or ERNIE
     */
    public function getContributorPersonRolesWithCache(?callable $onFreshData = null): array
    {
        return $this->getDataWithCache(
            '/api/v1/roles/contributor-persons/elmo',
            'contributor person roles',
            $this->getContributorPersonRolesCacheFile(),
            [$this, 'getHardcodedContributorPersonRoleFallback'],
            $onFreshData
        );
    }

    /**
     * Returns hardcoded fallback contributor person roles
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * These are DataCite contributor person roles commonly used at GFZ.
     * 
     * @return array<array{id: int, name: string}> Minimal fallback contributor person roles
     */
    private function getHardcodedContributorPersonRoleFallback(): array
    {
        return [
            ['id' => 1, 'name' => 'Data Collector'],
            ['id' => 2, 'name' => 'Data Curator'],
            ['id' => 3, 'name' => 'Data Manager'],
            ['id' => 4, 'name' => 'Editor'],
            ['id' => 5, 'name' => 'Producer'],
            ['id' => 6, 'name' => 'Project Leader'],
            ['id' => 7, 'name' => 'Project Manager'],
            ['id' => 8, 'name' => 'Project Member'],
            ['id' => 9, 'name' => 'Related Person'],
            ['id' => 10, 'name' => 'Researcher'],
            ['id' => 11, 'name' => 'Rights Holder'],
            ['id' => 12, 'name' => 'Sponsor'],
            ['id' => 13, 'name' => 'Supervisor'],
            ['id' => 14, 'name' => 'Translator'],
            ['id' => 15, 'name' => 'Work Package Leader'],
            ['id' => 16, 'name' => 'Other'],
        ];
    }

    /**
     * Forces contributor person roles cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshContributorPersonRolesCache(): bool
    {
        return $this->refreshCacheFromApi(
            '/api/v1/roles/contributor-persons/elmo',
            'contributor person roles',
            $this->getContributorPersonRolesCacheFile()
        );
    }

    /**
     * Gets contributor person roles cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getContributorPersonRolesCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getContributorPersonRolesCacheFile());
    }

    // ──────────────────────────────────────────────────────────────
    //  Contributor Institution Roles
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches contributor institution roles from ERNIE API
     * 
     * @return array<array{id: int, name: string}>|null Array of roles or null on failure
     */
    public function fetchContributorInstitutionRoles(): ?array
    {
        return $this->fetchFromErnie('/api/v1/roles/contributor-institutions/elmo', 'contributor institution roles');
    }

    /**
     * Gets contributor institution roles with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (triggers onFreshData callback for DB sync)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback as last resort
     * 
     * @param (callable(array<array{id: int, name: string}>): void)|null $onFreshData Optional callback invoked only when fresh data is fetched from ERNIE
     * @return array<array{id: int, name: string}> Contributor institution roles from cache or ERNIE
     */
    public function getContributorInstitutionRolesWithCache(?callable $onFreshData = null): array
    {
        return $this->getDataWithCache(
            '/api/v1/roles/contributor-institutions/elmo',
            'contributor institution roles',
            $this->getContributorInstitutionRolesCacheFile(),
            [$this, 'getHardcodedContributorInstitutionRoleFallback'],
            $onFreshData
        );
    }

    /**
     * Returns hardcoded fallback contributor institution roles
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * These are DataCite contributor institution roles commonly used at GFZ.
     * 
     * @return array<array{id: int, name: string}> Minimal fallback contributor institution roles
     */
    private function getHardcodedContributorInstitutionRoleFallback(): array
    {
        return [
            ['id' => 1, 'name' => 'Data Collector'],
            ['id' => 2, 'name' => 'Data Manager'],
            ['id' => 3, 'name' => 'Distributor'],
            ['id' => 4, 'name' => 'Hosting Institution'],
            ['id' => 5, 'name' => 'Producer'],
            ['id' => 6, 'name' => 'Registration Agency'],
            ['id' => 7, 'name' => 'Registration Authority'],
            ['id' => 8, 'name' => 'Research Group'],
            ['id' => 9, 'name' => 'Rights Holder'],
            ['id' => 10, 'name' => 'Sponsor'],
            ['id' => 11, 'name' => 'Translator'],
            ['id' => 12, 'name' => 'Work Package Leader'],
            ['id' => 13, 'name' => 'Other'],
        ];
    }

    /**
     * Forces contributor institution roles cache refresh by fetching fresh data from ERNIE
     * 
     * @return bool True if refresh was successful
     */
    public function refreshContributorInstitutionRolesCache(): bool
    {
        return $this->refreshCacheFromApi(
            '/api/v1/roles/contributor-institutions/elmo',
            'contributor institution roles',
            $this->getContributorInstitutionRolesCacheFile()
        );
    }

    /**
     * Gets contributor institution roles cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getContributorInstitutionRolesCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getContributorInstitutionRolesCacheFile());
    }

    // ──────────────────────────────────────────────────────────────
    //  Thesauri Availability
    // ──────────────────────────────────────────────────────────────

    /**
     * Gets the thesauri availability cache file path
     * 
     * @return string Path to the thesauri availability cache file
     */
    protected function getThesauriAvailabilityCacheFile(): string
    {
        return $this->thesauriAvailabilityCacheFile;
    }

    /**
     * Fetches thesauri availability from ERNIE API
     * 
     * Tries the ELMO-specific endpoint first (requires API key),
     * falls back to the public endpoint if the ELMO-specific one fails.
     * 
     * @return array<string, array{available: bool, displayName: string}>|null Availability data or null on failure
     */
    public function fetchThesauriAvailability(): ?array
    {
        // Try ELMO-specific endpoint first (requires API key)
        $data = $this->fetchFromErnie('/api/v1/elmo/vocabularies/thesauri-availability', 'thesauri availability (ELMO)');
        if ($data !== null) {
            return $data;
        }

        // Fall back to public endpoint (no API key needed, but fetchFromErnie sends it anyway — harmless)
        return $this->fetchFromErnie('/api/v1/vocabularies/thesauri-availability', 'thesauri availability (public)');
    }

    /**
     * Gets thesauri availability with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (ELMO-specific, then public fallback)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (only 3 GCMD thesauri) as last resort
     * 
     * @return array<string, array{available: bool, displayName: string}> Availability data
     */
    public function getThesauriAvailabilityWithCache(): array
    {
        // Cannot use generic getDataWithCache() because fetchThesauriAvailability() has custom dual-endpoint logic
        $cacheFile = $this->getThesauriAvailabilityCacheFile();

        if ($this->isCacheFileValid($cacheFile)) {
            $cachedData = $this->readCacheFile($cacheFile);
            if (!empty($cachedData)) {
                return $cachedData;
            }
        }

        $ernieData = $this->fetchThesauriAvailability();
        if ($ernieData !== null && !empty($ernieData)) {
            $this->writeCacheFile($cacheFile, $ernieData);
            return $ernieData;
        }

        $staleCache = $this->readCacheFile($cacheFile, ignoreExpiry: true);
        if (!empty($staleCache)) {
            error_log("ERNIE: Using stale cache as fallback for thesauri availability");
            return $staleCache;
        }

        error_log("ERNIE: Using hardcoded fallback for thesauri availability - all other sources unavailable");
        return $this->getHardcodedThesauriAvailabilityFallback();
    }

    /**
     * Returns hardcoded fallback thesauri availability
     * 
     * Only the 3 GCMD thesauri are enabled as fallback, matching the original ELMO behavior
     * before Chronostratigraphy and GEMET were added.
     * 
     * @return array<string, array{available: bool, displayName: string}> Minimal fallback availability
     */
    private function getHardcodedThesauriAvailabilityFallback(): array
    {
        return [
            'science_keywords' => ['available' => true, 'displayName' => 'GCMD Science Keywords'],
            'platforms' => ['available' => true, 'displayName' => 'GCMD Platforms'],
            'instruments' => ['available' => true, 'displayName' => 'GCMD Instruments'],
            'chronostratigraphy' => ['available' => false, 'displayName' => 'ICS Chronostratigraphy'],
            'gemet' => ['available' => false, 'displayName' => 'GEMET Thesaurus'],
        ];
    }

    /**
     * Forces thesauri availability cache refresh
     * 
     * @return bool True if refresh was successful
     */
    public function refreshThesauriAvailabilityCache(): bool
    {
        $data = $this->fetchThesauriAvailability();
        if ($data !== null && !empty($data)) {
            return $this->writeCacheFile($this->getThesauriAvailabilityCacheFile(), $data);
        }
        return false;
    }

    /**
     * Gets thesauri availability cache status information
     * 
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getThesauriAvailabilityCacheStatus(): array
    {
        return $this->getCacheFileStatus($this->getThesauriAvailabilityCacheFile());
    }

    // ──────────────────────────────────────────────────────────────
    //  Thesaurus Vocabulary Data
    // ──────────────────────────────────────────────────────────────

    /**
     * Returns the cache file path for a given thesaurus slug
     * 
     * @param string $slug The thesaurus slug (e.g. 'gcmd-science-keywords')
     * @return string|null Cache file path or null if slug is unknown
     */
    protected function getThesaurusCacheFile(string $slug): ?string
    {
        return $this->thesaurusCacheFiles[$slug] ?? null;
    }

    /**
     * Returns the list of valid thesaurus slugs
     * 
     * @return array<string> Valid slug names
     */
    public function getValidThesaurusSlugs(): array
    {
        return array_keys($this->thesaurusCacheFiles);
    }

    /**
     * Gets thesaurus vocabulary data with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Empty array (no hardcoded fallback — thesaurus data is too large and specific)
     * 
     * @param string $slug The thesaurus slug (e.g. 'gcmd-science-keywords')
     * @return array<mixed> Vocabulary data or empty array if unavailable
     */
    public function getThesaurusVocabularyWithCache(string $slug): array
    {
        $cacheFile = $this->getThesaurusCacheFile($slug);
        if ($cacheFile === null) {
            error_log("ERNIE: Unknown thesaurus slug: $slug");
            return [];
        }

        return $this->getDataWithCache(
            "/api/v1/vocabularies/$slug",
            "thesaurus vocabulary ($slug)",
            $cacheFile,
            fn() => []
        );
    }

    /**
     * Forces thesaurus vocabulary cache refresh for a given slug
     * 
     * @param string $slug The thesaurus slug
     * @return bool True if refresh was successful
     */
    public function refreshThesaurusVocabularyCache(string $slug): bool
    {
        $cacheFile = $this->getThesaurusCacheFile($slug);
        if ($cacheFile === null) {
            error_log("ERNIE: Cannot refresh cache for unknown thesaurus slug: $slug");
            return false;
        }

        return $this->refreshCacheFromApi(
            "/api/v1/vocabularies/$slug",
            "thesaurus vocabulary ($slug)",
            $cacheFile
        );
    }

    /**
     * Gets thesaurus vocabulary cache status for a given slug
     * 
     * @param string $slug The thesaurus slug
     * @return array{exists: bool, valid: bool, lastUpdated: string|null, age: int|null, ageFormatted?: string|null, ttl?: int, itemCount: int, error?: string} Cache status
     */
    public function getThesaurusVocabularyCacheStatus(string $slug): array
    {
        $cacheFile = $this->getThesaurusCacheFile($slug);
        if ($cacheFile === null) {
            return [
                'exists' => false,
                'valid' => false,
                'lastUpdated' => null,
                'age' => null,
                'itemCount' => 0,
                'error' => "Unknown thesaurus slug: $slug"
            ];
        }

        return $this->getCacheFileStatus($cacheFile);
    }
}
