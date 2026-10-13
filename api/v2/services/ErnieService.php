<?php


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
     * Cache file path and ERNIE endpoint for each vocabulary ELMO refreshes.
     *
     * @var array<string, array{cacheFile: string, ernieEndpoint: string}>
     */
    protected array $memory;

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

        $this->memory = [
        'resourceTypes' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_resource_types.json',
            'ernieEndpoint' => '/api/v1/resource-types/elmo',
        ],
        'titleTypes' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_title_types.json',
            'ernieEndpoint' => '/api/v1/title-types/elmo',
        ],
        'descriptionTypes' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_description_types.json',
            'ernieEndpoint' => '/api/v1/description-types/elmo',
        ],
        'languages' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_languages.json',
            'ernieEndpoint' => '/api/v1/languages/elmo',
        ],
        'contributorPersonRoles' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_contributor_person_roles.json',
            'ernieEndpoint' => '/api/v1/roles/contributor-persons/elmo',
        ],
        'contributorInstitutionRoles' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_contributor_institution_roles.json',
            'ernieEndpoint' => '/api/v1/roles/contributor-institutions/elmo',
        ],
        'relationTypes' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_relation_types.json',
            'ernieEndpoint' => '/api/v1/relation-types/elmo',
        ],
        'identifierTypes' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_identifier_types.json',
            'ernieEndpoint' => '/api/v1/identifier-types/elmo',
        ],
        'pid4instInstruments' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_pid4inst.json',
            'ernieEndpoint' => '/api/v1/vocabularies/pid4inst-instruments',
        ],
        'mslLabs' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_msl_labs.json',
            'ernieEndpoint' => '/api/v1/vocabularies/msl-laboratories',
        ],
        'gcmdScienceKeywords' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_gcmd_science_keywords.json',
            'ernieEndpoint' => '/api/v1/vocabularies/gcmd-science-keywords',
        ],
        'gcmdPlatforms' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_gcmd_platforms.json',
            'ernieEndpoint' => '/api/v1/vocabularies/gcmd-platforms',
        ],
        'gcmdInstruments' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_gcmd_instruments.json',
            'ernieEndpoint' => '/api/v1/vocabularies/gcmd-instruments',
        ],
        'chronostratTimescale' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_chronostrat_timescale.json',
            'ernieEndpoint' => '/api/v1/vocabularies/chronostrat-timescale',
        ],
        'gemet' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_gemet.json',
            'ernieEndpoint' => '/api/v1/vocabularies/gemet',
        ],
        'thesauriAvailability' => [
            'cacheFile' => __DIR__ . '/../../../storage/cache/ernie_thesauri_availability.json',
            'ernieEndpoint' => '/api/v1/elmo/vocabularies/thesauri-availability',
        ],
    ];
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
     * The cache directory is created in the image, not at runtime. Writes to a
     * temp file and replaces the destination so an expired cache can be
     * refreshed even if the existing file itself is not writable.
     *
     * @param string $cacheFilePath Path to the cache file
     * @param array<mixed> $data Data to cache
     * @return bool True if cache was written successfully
     */
    protected function writeCacheFile(string $cacheFilePath, array $data): bool
    {
        $cacheDir = dirname($cacheFilePath);

        if (!is_dir($cacheDir) || !is_writable($cacheDir)) {
            error_log("ERNIE: Cache directory is missing or not writable: $cacheDir");
            return false;
        }

        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => $this->cacheTtl,
            'source' => 'ernie',
            'data' => $data
        ];

        $payload = json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $tempFile = $cacheFilePath . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(4));

        $result = @file_put_contents($tempFile, $payload, LOCK_EX);
        if ($result === false) {
            $reason = error_get_last()['message'] ?? 'unknown error';
            error_log("ERNIE: Failed to write cache file: $cacheFilePath ($reason)");
            return false;
        }

        @chmod($tempFile, 0664);

        if (!@rename($tempFile, $cacheFilePath)) {
            @unlink($cacheFilePath);
            if (!@rename($tempFile, $cacheFilePath)) {
                @unlink($tempFile);
                $reason = error_get_last()['message'] ?? 'unknown error';
                error_log("ERNIE: Failed to write cache file: $cacheFilePath ($reason)");
                return false;
            }
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


    /**
     * Fetches every vocabulary in the memory map and writes its cache file.
     *
     * Callers must authenticate before invoking this. The method does not
     * read the HTTP request.
     *
     * @return array<string, bool> Whether each cache file was written
     */
    public function refreshAllCache(): array
    {
        $results = [];
        foreach ($this->memory as $key => $entry) {
            error_log("[ERNIE service] refreshAllCache: {$key} from {$entry['ernieEndpoint']}");
            $results[$key] = $this->refreshCacheFromApi(
                $entry['ernieEndpoint'],
                $key,
                $entry['cacheFile']
            );
        }

        return $results;
    }

    /**
     * @return array<string, array<string, mixed>> Cache status keyed by vocabulary slug
     */
    public function getAllCacheStatus(): array
    {
        $returnArray = [];
        foreach ($this->memory as $key => $entry) {
            $status = $this->getCacheFileStatus($entry['cacheFile']);
            if ($key === 'mslLabs') {
                $vocabulary = $this->readCacheFile($entry['cacheFile'], true);
                if (isset($vocabulary['data']) && is_array($vocabulary['data'])) {
                    $status['itemCount'] = count($vocabulary['data']);
                }
            }
            $returnArray[$key] = $status;
        }

        return $returnArray;
    }


    // ──────────────────────────────────────────────────────────────
    //  Generic cache workflow helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Test seam: records the memory key a cache getter is about to use.
     */
    protected function recordMemoryLabel(string $label): void
    {
    }

    /**
     * Gets data from ERNIE with full cache fallback chain.
     *
     * Priority:
     * 1. Valid cache file (not expired) — return it, do not call ERNIE
     * 2. Fresh data from ERNIE — write the cache file, then run $onFreshData
     * 3. Stale cache (ERNIE unavailable) — return expired file, no $onFreshData
     * 4. Hardcoded fallback — last resort, no $onFreshData
     *
     * $onFreshData is the hook for side effects such as syncing MariaDB.
     * ErnieService never talks to the database; the caller (usually VocabController)
     * passes a closure that runs only on path 2. A cache hit therefore does not
     * rewrite the DB. Omit the argument (null) when no side effect is needed.
     *
     * This runs on the HTTP request that needs the vocab (e.g. GET /vocabs/relations),
     * not at container start.
     *
     * @param string $label Human-readable label for logging, matching the key in the memory array
     * @param callable(): array<mixed> $fallbackFn Function returning fallback data
     * @param (callable(array<mixed>): void)|null $onFreshData Invoked only after a successful live ERNIE fetch and cache write. Not called on cache hit, stale cache, or hardcoded fallback.
     * @return array<mixed> Data from cache, ERNIE, or fallback
     */
    private function getDataWithCache(
        string $label,
        callable $fallbackFn,
        ?callable $onFreshData = null
    ): array {
        $this->recordMemoryLabel($label);

        if (!isset($this->memory[$label])) {
            error_log("ERNIE: Unknown cache label: $label");
            return $fallbackFn();
        }

        $endpoint = $this->memory[$label]['ernieEndpoint'];
        $cacheFile = $this->memory[$label]['cacheFile'];
        if ($this->isCacheFileValid($cacheFile)) {
            $cachedData = $this->readCacheFile($cacheFile);
            if (!empty($cachedData)) {
                return $cachedData;
            }
        }
        // If cache is not valid or empty, proceed to fetch fresh data from ERNIE
        $ernieData = $this->fetchFromErnie($endpoint, $label);
        if ($ernieData !== null && !empty($ernieData)) {
            $this->writeCacheFile($cacheFile, $ernieData);
            if ($onFreshData !== null) {
                // trigger the onFreshData callback with the newly fetched data
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
     * Gets resource types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (then $onFreshData, if provided)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (Dataset, Other) as last resort
     *
     * @param (callable(array<mixed>): void)|null $onFreshData Side-effect hook (typically DB sync). Runs only after a live ERNIE fetch and cache write, never on cache hit. See getDataWithCache().
     * @return array<array{id: int, name: string, description: string|null}> Resource types from cache or ERNIE
     */
    public function getResourceTypesWithCache(?callable $onFreshData = null): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['resourceTypes']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Resource types] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Resource types] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Resource types] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'resourceTypes',
            [$this, 'getHardcodedResourceTypeFallback'],
            $onFreshData
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
                'id' => 2,  // ERNIE ID for Award
                'name' => 'Award',
                'description' => 'A grant, prize, or other financial or honorary acknowledgment'
            ],
            [
                'id' => 10,  // ERNIE ID for Dataset
                'name' => 'Dataset',
                'description' => 'Data encoded in a defined structure'
            ],
            [
                'id' => 22,  // ERNIE ID for Poster
                'name' => 'Poster',
                'description' => 'A visual presentation of information, data, or findings'
            ],
            [
                'id' => 24,  // ERNIE ID for Presentation
                'name' => 'Presentation',
                'description' => 'Slides or other presentation material shared as a research output'
            ],
            [
                'id' => 21,  // ERNIE ID for Other
                'name' => 'Other',
                'description' => 'Other resource type not covered by the available options'
            ],
            [
                'id' => 23,  // ERNIE ID for Project
                'name' => 'Project',
                'description' => 'An organized research activity with defined goals and resources'
            ]
        ];
    }


    // ──────────────────────────────────────────────────────────────
    //  Description Types
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets description types with caching logic
     *
     * File cache only — description types are not persisted to MariaDB, so this
     * getter does not accept onFreshData.
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
        $fileStatus = $this->getCacheFileStatus($this->memory['descriptionTypes']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Description types] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Description types] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Description types] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'descriptionTypes',
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


    // ──────────────────────────────────────────────────────────────
    //  Title Types
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets title types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (then $onFreshData, if provided)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (Main Title, Alternative Title, Translated Title) as last resort
     *
     * @param (callable(array<mixed>): void)|null $onFreshData Side-effect hook (typically DB sync). Runs only after a live ERNIE fetch and cache write, never on cache hit. See getDataWithCache().
     * @return array<array{id: int, name: string, slug: string}> Title types from cache or ERNIE
     */
    public function getTitleTypesWithCache(?callable $onFreshData = null): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['titleTypes']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Title types] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Title types] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Title types] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'titleTypes',
            [$this, 'getHardcodedTitleTypeFallback'],
            $onFreshData
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


    // ──────────────────────────────────────────────────────────────
    //  Languages
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets languages with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (then $onFreshData, if provided)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback (English, German) as last resort
     *
     * @param (callable(array<mixed>): void)|null $onFreshData Side-effect hook (typically DB sync). Runs only after a live ERNIE fetch and cache write, never on cache hit. See getDataWithCache().
     * @return array<array{id: int, name: string, code: string}> Languages from cache or ERNIE
     */
    public function getLanguagesWithCache(?callable $onFreshData = null): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['languages']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Languages] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Languages] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Languages] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'languages',
            [$this, 'getHardcodedLanguageFallback'],
            $onFreshData
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
        $fileStatus = $this->getCacheFileStatus($this->memory['pid4instInstruments']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | PID4INST instruments] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | PID4INST instruments] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | PID4INST instruments] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'pid4instInstruments',
            fn() => []
        );
    }


    // ──────────────────────────────────────────────────────────────
    //  MSL Laboratories
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets the MSL laboratories with caching logic.
     *
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE
     * 3. Stale cache if ERNIE is unavailable
     * 4. Empty array as last resort
     *
     * The returned structure is the ERNIE response:
     * {
     *   version: string,
     *   lastUpdated: string,
     *   total: int,
     *   data: array
     * }
     *
     * @return array<string, mixed> MSL laboratories
     */
    public function getMslLabsWithCache(): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['mslLabs']['cacheFile']);

        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | MSL laboratories] cache file is not available. Fetching new from ERNIE');
        } elseif (!$fileStatus['valid']) {
            error_log('[ERNIE service | MSL laboratories] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | MSL laboratories] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'mslLabs',
            static fn(): array => []
        );
    }


    // ──────────────────────────────────────────────────────────────
    //  Contributor Person Roles
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets contributor person roles with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (triggers onFreshData callback for DB sync)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback as last resort
     * 
     * @param (callable(array<array{id: int, name: string}>): void)|null $onFreshData Side-effect hook (typically DB sync). Runs only after a live ERNIE fetch and cache write, never on cache hit. See getDataWithCache().
     * @return array<array{id: int, name: string}> Contributor person roles from cache or ERNIE
     */
    public function getContributorPersonRolesWithCache(?callable $onFreshData = null): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['contributorPersonRoles']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Contributor person roles] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Contributor person roles] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Contributor person roles] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'contributorPersonRoles',
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


    // ──────────────────────────────────────────────────────────────
    //  Contributor Institution Roles
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets contributor institution roles with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (triggers onFreshData callback for DB sync)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback as last resort
     * 
     * @param (callable(array<array{id: int, name: string}>): void)|null $onFreshData Side-effect hook (typically DB sync). Runs only after a live ERNIE fetch and cache write, never on cache hit. See getDataWithCache().
     * @return array<array{id: int, name: string}> Contributor institution roles from cache or ERNIE
     */
    public function getContributorInstitutionRolesWithCache(?callable $onFreshData = null): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['contributorInstitutionRoles']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Contributor institution roles] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Contributor institution roles] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Contributor institution roles] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'contributorInstitutionRoles',
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


    // ──────────────────────────────────────────────────────────────
    //  Thesauri Availability
    // ──────────────────────────────────────────────────────────────

    /**
     * Fetches thesauri availability from ERNIE API
     * 
     * Tries the ELMO-specific endpoint first (requires API key),
     * falls back to the public endpoint if the ELMO-specific one fails.
     * 
     * @return array<string, array{available: bool, displayName: string}>|null Availability data or null on failure
     */
    private function fetchThesauriAvailability(): ?array
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
     * File cache only — availability is not persisted to MariaDB, so this
     * getter does not accept onFreshData. Cannot use generic getDataWithCache()
     * because fetchThesauriAvailability() has custom dual-endpoint logic.
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
        $cacheFile = $this->memory['thesauriAvailability']['cacheFile'];

        $fileStatus = $this->getCacheFileStatus($this->memory['thesauriAvailability']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Thesauri availability] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Thesauri availability] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Thesauri availability] cache file is present and up-to-date. Using cached data');
        }

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


    // ──────────────────────────────────────────────────────────────
    //  Thesaurus Vocabulary Data
    // ──────────────────────────────────────────────────────────────

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
        $label = null;
        foreach ($this->memory as $key => $entry) {
            if ($entry['ernieEndpoint'] === '/api/v1/vocabularies/' . $slug) {
                $label = $key;
                break;
            }
        }
        if ($label === null) {
            error_log("ERNIE: Unknown thesaurus slug: $slug");
            return [];
        }

        $fileStatus = $this->getCacheFileStatus($this->memory[$label]['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log("[ERNIE service | Thesaurus vocabulary ($slug)] cache file is not available. Fetching new from ERNIE");
        } else if (!$fileStatus['valid']) {
            error_log("[ERNIE service | Thesaurus vocabulary ($slug)] cache file is outdated. Fetching new from ERNIE");
        } else {
            error_log("[ERNIE service | Thesaurus vocabulary ($slug)] cache file is present and up-to-date. Using cached data");
        }

        return $this->getDataWithCache(
            $label,
            fn() => []
        );
    }


    // ──────────────────────────────────────────────────────────────
    //  Relation Types
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets relation types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (then $onFreshData, if provided)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback as last resort
     *
     * @param (callable(array<mixed>): void)|null $onFreshData Side-effect hook (typically DB sync). Runs only after a live ERNIE fetch and cache write, never on cache hit. See getDataWithCache().
     * @return array<array{id: int, name: string, description: string|null}> Relation types from cache or ERNIE
     */
    public function getRelationTypesWithCache(?callable $onFreshData = null): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['relationTypes']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Relation types] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Relation types] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Relation types] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'relationTypes',
            [$this, 'getHardcodedRelationTypeFallback'],
            $onFreshData
        );
    }

    /**
     * Returns hardcoded fallback relation types
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * 
     * @return array<array{id: int, name: string, description: string|null}> Minimal fallback relation types
     */
    private function getHardcodedRelationTypeFallback(): array
    {
        return [
            ['id' => 1, 'name' => 'IsCitedBy', 'description' => 'indicates that B includes A in a citation'],
            ['id' => 2, 'name' => 'Cites', 'description' => 'indicates that A includes B in a citation'],
            ['id' => 3, 'name' => 'IsSupplementTo', 'description' => 'indicates that A is a supplement to B'],
            ['id' => 4, 'name' => 'IsSupplementedBy', 'description' => 'indicates that B is a supplement to A'],
            ['id' => 39, 'name' => 'Other', 'description' => 'indicates another relationship type that requires additional context'],
        ];
    }


    // ──────────────────────────────────────────────────────────────
    //  Identifier Types
    // ──────────────────────────────────────────────────────────────


    /**
     * Gets identifier types with caching logic
     * 
     * Priority:
     * 1. Valid cache (not expired)
     * 2. Fresh data from ERNIE (then $onFreshData, if provided)
     * 3. Stale cache (if ERNIE unavailable)
     * 4. Hardcoded fallback as last resort
     *
     * @param (callable(array<mixed>): void)|null $onFreshData Side-effect hook (typically DB sync). Runs only after a live ERNIE fetch and cache write, never on cache hit. See getDataWithCache().
     * @return array<array{id: int, name: string, description: string|null, pattern: string|null}> Identifier types from cache or ERNIE
     */
    public function getIdentifierTypesWithCache(?callable $onFreshData = null): array
    {
        $fileStatus = $this->getCacheFileStatus($this->memory['identifierTypes']['cacheFile']);
        if (!$fileStatus['exists']) {
            error_log('[ERNIE service | Identifier types] cache file is not available. Fetching new from ERNIE');
        } else if (!$fileStatus['valid']) {
            error_log('[ERNIE service | Identifier types] cache file is outdated. Fetching new from ERNIE');
        } else {
            error_log('[ERNIE service | Identifier types] cache file is present and up-to-date. Using cached data');
        }

        return $this->getDataWithCache(
            'identifierTypes',
            [$this, 'getHardcodedIdentifierTypeFallback'],
            $onFreshData
        );
    }

    /**
     * Returns hardcoded fallback identifier types
     * 
     * This is the absolute last resort when ERNIE, cache, and stale cache are all unavailable.
     * 
     * @return array<array{id: int, name: string, description: string|null, pattern: string|null}> Minimal fallback identifier types
     */
    private function getHardcodedIdentifierTypeFallback(): array
    {
        return [
            ['id' => 1, 'name' => 'DOI', 'description' => 'A character string used to uniquely identify an object. A DOI name is divided into two parts, a prefix and a suffix, separated by a slash.', 'pattern' => '^(?:https?:\/\/(?:dx\\.)?doi\.org\/|doi:)?10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$'],
            ['id' => 2, 'name' => 'URL', 'description' => 'A specific character string that constitutes a reference to a resource.', 'pattern' => '^https?:\\/\\/\\S+$'],
            ['id' => 3, 'name' => 'Handle', 'description' => 'An ID in the Handle system operated by the Corporation for National Research Initiatives (CNRI).', 'pattern' => '^(hdl:)?\d+(\.\d+)*(\/[^\s]+)?$'],
            ['id' => 4, 'name' => 'URN', 'description' => 'A unique and persistent identifier of an electronic document.', 'pattern' => '^urn:nbn:[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+$'],
            ['id' => 19, 'name' => 'RAiD', 'description' => 'A Research Activity Identifier used to identify and link research projects or activities.', 'pattern' => '^(?:https?:\/\/raid\.org\/)?10\.\d{4,9}\/raid\.[A-Za-z0-9._-]+$'],
            ['id' => 22, 'name' => 'SWHID', 'description' => 'A persistent Software Heritage identifier for source code artifacts and revisions.', 'pattern' => '^swh:1:[a-z]{3}:[0-9a-f]{40}(;origin=.*)?$'],
        ];
    }

}
