<?php
/**
 *
 * This controller provides endpoints for fetching vocabularies via the API.
 *
 */

// Set Max Execution Time to 300 seconds
ini_set('max_execution_time', 300);
// Include settings.php so that variables are available
if (!defined('UNIT_TESTING')) {
    require_once __DIR__ . '/../../../settings.php';
}

/**
 * Class VocabController
 *
 * Handles vocabulary-related API requests.
 */
class VocabController
{
    /**
     * @var string The URL for MSL Labs data.
     */
    private $url;

    /**
     * @var string The base URL for MSL vocabularies.
     */
    private $mslVocabsUrl;

    /**
     * @var \ErnieService|null Lazy-loaded ErnieService instance
     */
    private ?\ErnieService $ernieService = null;

    /**
     * VocabController constructor.
     *
     * Initializes URLs using global variables.
     */
    public function __construct()
    {
        global $mslLabsUrl;
        global $mslVocabsUrl;
        $this->url = $mslLabsUrl;
        $this->mslVocabsUrl = $mslVocabsUrl;
    }

    /**
     * Returns the shared ErnieService instance, creating it on first use
     *
     * @return \ErnieService
     */
    private function getErnieService(): \ErnieService
    {
        if ($this->ernieService === null) {
            require_once __DIR__ . '/../services/ErnieService.php';
            $this->ernieService = new \ErnieService();
        }
        return $this->ernieService;
    }

    /**
     * Adds a timestamp to the provided data structure
     * 
     * Creates a wrapper object that includes both the original data
     * and a timestamp of when the data was last updated.
     * 
     * @param mixed $data The original data to be wrapped
     * @return array<mixed> An array containing:
     *               - 'lastUpdated' (string) The timestamp in Y-m-d H:i:s format
     *               - 'data' (mixed) The original data structure
     * 
     */
    private function addTimestampToData($data): array
    {
        return [
            'lastUpdated' => date('Y-m-d H:i:s'),
            'data' => $data
        ];
    }

    /**
     * Validates the API key from the request header
     * 
     * @return bool True if API key is valid, false otherwise
     */
    private function validateApiKey(): bool
    {
        global $apiKeyElmo;

        // Get API key from header
        $providedKey = $_SERVER['HTTP_X_API_KEY'] ?? null;

        // Check if key exists and matches
        if (!$providedKey || $providedKey !== $apiKeyElmo) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Invalid or missing API key']);
            return false;
        }

        return true;
    }

    /**
     * Retrieves relation types, preferring ERNIE data with local DB fallback
     *
     * When ERNIE is configured, fetches relation types from ERNIE (with caching),
     * syncs to local DB, and returns data with local IDs.
     * Falls back to local database if ERNIE is unavailable.
     *
     * @return void
     */
    public function getRelations(): void
    {
        try {
            $ernieService = $this->getErnieService();

            if ($ernieService->isConfigured(logResult: true)) {
                $ernieTypes = $ernieService->getRelationTypesWithCache();

                if (!empty($ernieTypes)) {
                    // Sync to local DB for storage purposes
                    $syncItems = array_map(fn($t) => [
                        'ernie_id' => $t['id'],
                        'name' => $t['name'],
                        'description' => $t['description'] ?? null
                    ], $ernieTypes);
                    $this->syncErnieToDb('Relation', $syncItems, [
                        'ernie_id_col' => 'ernie_id',
                        'name_col' => 'name',
                        'description_col' => 'description'
                    ]);

                    // Return ERNIE data with local IDs
                    $relations = $this->mapErnieToLocalIds(
                        'Relation', $ernieTypes, 'relation_id', 'ernie_id',
                        ['name' => 'name', 'description' => 'description']
                    );
                    error_log("Relations: Serving " . count($relations) . " types from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode(['relations' => $relations]);
                    return;
                }
            }

            // Fallback: Load from local database
            error_log("Relations: Falling back to local database");
            $this->getRelationsFromDb();

        } catch (Exception $e) {
            error_log("API Error in getRelations: " . $e->getMessage());
            // Fallback to local DB on any error
            error_log("Relations: Falling back to local database due to error");
            $this->getRelationsFromDb();
        }
    }

    /**
     * Fetches relations directly from local database
     *
     * @return void Outputs JSON response directly
     */
    private function getRelationsFromDb(): void
    {
        global $connection;
        $stmt = $connection->prepare('SELECT relation_id, name, description FROM Relation ORDER BY name ASC');

        if (!$stmt || !$stmt->execute()) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to query relations']);
            return;
        }

        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $relations = [];
            while ($row = $result->fetch_assoc()) {
                $relations[] = [
                    'id' => $row['relation_id'],
                    'name' => $row['name'],
                    'description' => $row['description']
                ];
            }
            header('Content-Type: application/json');
            echo json_encode(['relations' => $relations]);
        } else {
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'No relations found']);
        }

        $stmt->close();
    }

    /**
     * Fetches MSL Labs data from a remote URL, processes it, and returns the necessary fields.
     *
     * @return array<mixed> Processed MSL Labs data.
     * @throws Exception If fetching or decoding the data fails.
     */
    public function fetchAndProcessMslLabs(): array
    {
        $opts = [
            'http' => [
                'method' => 'GET',
                'header' => [
                    'User-Agent: PHP Script',
                    'Accept: application/json',
                    'Accept-Charset: UTF-8'
                ]
            ]
        ];
        $context = stream_context_create($opts);

        $jsonData = file_get_contents($this->url, false, $context);

        if ($jsonData === false) {
            throw new Exception('Error fetching data from GitHub: ' . error_get_last()['message']);
        }

        // Decode JSON data
        $labs = json_decode($jsonData, true);

        if ($labs === null) {
            throw new Exception('Error decoding JSON data: ' . json_last_error_msg());
        }

        // Process data and retain only necessary fields
        $processedLabs = array_map(function ($lab) {
            return [
                'id' => $lab['identifier'],
                'name' => $lab['name'],
                'affiliation' => $lab['affiliation_name'],
                'rorid' => $lab['affiliation_ror']
            ];
        }, $labs);

        return $processedLabs;
    }

    /**
     * Gets the latest version number for the combined vocabulary file.
     *
     * @param string $baseUrl The base URL for vocabularies.
     * @return string|false The latest version string or false if not found.
     */
    private function getLatestVersion($baseUrl)
    {
        // Direkt Version 1.3 prüfen, da wir wissen dass diese existiert
        $url = "{$baseUrl}1.3/editor_1-3.json";

        $headers = @get_headers($url);
        if ($headers && strpos($headers[0], '200') !== false) {
            return "1.3";
        }

        // Falls 1.3 nicht gefunden wurde, systematisch suchen
        $versions = [];
        for ($i = 1; $i <= 10; $i++) {
            $url = "{$baseUrl}1.{$i}/editor_1-{$i}.json";

            $headers = @get_headers($url);
            if ($headers && strpos($headers[0], '200') !== false) {
                $versions[] = "1.{$i}";
            }
        }

        $latestVersion = end($versions);

        return $latestVersion;
    }

    /**
     * Processes vocabulary items recursively and transform synonyms to description.
     *
     * @param array<mixed> $item The item to process
     * @return array<mixed> The processed item
     */
    private function processItem(array $item): array
    {

        // Synonyms as description
        $description = '';
        if (isset($item['synonyms']) && is_array($item['synonyms']) && !empty($item['synonyms'])) {
            $description = implode(', ', $item['synonyms']);
        }

        $newItem = [
            'id' => $item['extra']['uri'] ?? '',
            'text' => $item['text'] ?? '',
            'language' => 'en',
            'scheme' => $item['extra']['vocab_uri'] ?? '',
            'schemeURI' => $item['extra']['vocab_uri'] ?? '',
            'description' => $description,
            'children' => []
        ];

        if (isset($item['children']) && !empty($item['children'])) {
            foreach ($item['children'] as $child) {
                $newItem['children'][] = $this->processItem($child);
            }
        }

        return $newItem;
    }

    /**
     * Retrieves and updates MSL vocabulary data.
     *
     * @param array<mixed> $vars An associative array of parameters (not used anymore)
     * @return void
     */
    public function getMslVocab(array $vars = [])
    {
        // Validate API key before processing request
        if (!$this->validateApiKey()) {
            return;
        }
        try {
            $jsonDir = __DIR__ . '/../../../json/thesauri/';
            $outputFile = $jsonDir . 'msl-vocabularies.json';

            if (!file_exists($jsonDir)) {
                mkdir($jsonDir, 0755, true);
            }

            // Get latest version
            $latestVersion = $this->getLatestVersion($this->mslVocabsUrl);
            if (!$latestVersion) {
                throw new Exception("No vocabulary version found");
            }

            // Construct URL for the latest version
            $url = "{$this->mslVocabsUrl}{$latestVersion}/editor_" . str_replace('.', '-', $latestVersion) . ".json";

            // Download content
            $jsonContent = $this->downloadContent($url);
            if ($jsonContent === false) {
                throw new Exception("Failed to download vocabulary data from URL: " . $url);
            }

            // Decode JSON
            $data = json_decode($jsonContent, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception("Failed to parse vocabulary data: " . json_last_error_msg());
            }

            // Process each root item
            $processedData = [];
            foreach ($data as $item) {
                $processedData[] = $this->processItem($item);
            }

            $dataWithTimestamp = $this->addTimestampToData($processedData);

            // Save processed data
            if (file_put_contents($outputFile, json_encode($dataWithTimestamp, JSON_PRETTY_PRINT)) === false) {
                throw new Exception("Failed to save processed vocabulary data");
            }

            // Return success response
            header('Content-Type: application/json');
            echo json_encode([
                'message' => "Successfully updated MSL vocabularies to version {$latestVersion}",
                'version' => $latestVersion,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => $e->getMessage()
            ]);
        }
    }


    /**
     * Downloads content from a given URL.
     *
     * @param string $url The URL to download content from.
     * @return string|false The content if successful, or false on failure.
     */
    private function downloadContent($url)
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Für Entwicklungszwecke

        $content = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        curl_close($ch);

        return ($httpCode == 200) ? $content : false;
    }

    /**
     * Retrieves GCMD Science Keywords from a local JSON file and returns them as JSON.
     *
     * @return void
     */
    public function getGcmdScienceKeywords()
    {
        try {
            $jsonPath = __DIR__ . '/../../../json/thesauri/gcmdScienceKeywords.json';
            if (!file_exists($jsonPath)) {
                throw new Exception("Science Keywords file not found");
            }
            $json = file_get_contents($jsonPath);
            if ($json === false) {
                throw new Exception("Error reading Science Keywords file");
            }
            header('Content-Type: application/json');
            echo $json;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Updates the MSL Labs vocabulary by fetching and processing data, then saving it as JSON.
     *
     * @return void
     */
    public function updateMslLabs()
    {
        if (!$this->validateApiKey()) {
            return;
        }

        try {
            $mslLabs = $this->fetchAndProcessMslLabs();

            $jsonString = json_encode(
                $mslLabs,
                JSON_PRETTY_PRINT |
                JSON_UNESCAPED_UNICODE |
                JSON_UNESCAPED_SLASHES
            );

            if ($jsonString === false) {
                throw new Exception('Error encoding data to JSON: ' . json_last_error_msg());
            }

            $result = file_put_contents(
                __DIR__ . '/../../../json/msl-labs.json',
                $jsonString,
                LOCK_EX
            );

            if ($result === false) {
                throw new Exception('Error saving JSON file: ' . error_get_last()['message']);
            }

            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['message' => 'MSL Labs vocabulary successfully updated']);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves roles, preferring ERNIE data with local DB fallback
     *
     * When ERNIE is configured, returns roles from cache (or fresh ERNIE data).
     * DB sync only occurs when fresh data is fetched from ERNIE (cache miss),
     * not on every read request. Falls back to local database if ERNIE is
     * unavailable or not configured.
     *
     * @param array<mixed> $vars An associative array of parameters.
     * @return void
     */
    public function getRoles(array $vars)
    {
        $type = $vars['type'] ?? $_GET['type'] ?? 'all';

        if (!in_array($type, ['all', 'person', 'institution', 'both'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid roles type specified']);
            return;
        }

        try {
            $ernieService = $this->getErnieService();

            if ($ernieService->isConfigured(logResult: true)) {
                $allRoles = [];

                // Fetch person roles from ERNIE if requested
                if (in_array($type, ['all', 'person'], true)) {
                    $personRoles = $ernieService->getContributorPersonRolesWithCache(
                        fn(array $freshData) => $this->syncRolesToDb($freshData, 0)
                    );
                    if (!empty($personRoles)) {
                        $allRoles = array_merge($allRoles, $this->formatErnieRoles($personRoles, 0));
                    }
                }

                // Fetch institution roles from ERNIE if requested
                if (in_array($type, ['all', 'institution'], true)) {
                    $institutionRoles = $ernieService->getContributorInstitutionRolesWithCache(
                        fn(array $freshData) => $this->syncRolesToDb($freshData, 1)
                    );
                    if (!empty($institutionRoles)) {
                        $allRoles = array_merge($allRoles, $this->formatErnieRoles($institutionRoles, 1));
                    }
                }

                // Fetch roles that apply to both from ERNIE (intersection of person + institution)
                if ($type === 'both') {
                    $personRoles = $ernieService->getContributorPersonRolesWithCache(
                        fn(array $freshData) => $this->syncRolesToDb($freshData, 0)
                    );
                    $institutionRoles = $ernieService->getContributorInstitutionRolesWithCache(
                        fn(array $freshData) => $this->syncRolesToDb($freshData, 1)
                    );

                    if (!empty($personRoles) && !empty($institutionRoles)) {
                        $personNames = array_column($personRoles, 'name');
                        $institutionNames = array_column($institutionRoles, 'name');
                        $bothNames = array_intersect($personNames, $institutionNames);

                        $bothRoles = array_filter($personRoles, fn($r) => in_array($r['name'], $bothNames, true));
                        if (!empty($bothRoles)) {
                            $allRoles = $this->formatErnieRoles(array_values($bothRoles), 2);
                        }
                    }
                }

                if (!empty($allRoles)) {
                    // Deduplicate by name
                    $uniqueRoles = [];
                    foreach ($allRoles as $role) {
                        $uniqueRoles[$role['name']] = $role;
                    }
                    $allRoles = array_values($uniqueRoles);

                    error_log("Roles ($type): Serving " . count($allRoles) . " roles from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode($allRoles);
                    return;
                }
            }

            // Fallback to local database
            error_log("Roles: Falling back to local database");
            $this->getRolesFromDb($type);

        } catch (Exception $e) {
            error_log("API Error in getRoles: " . $e->getMessage());
            error_log("Roles: Falling back to local database due to error");
            $this->getRolesFromDb($type);
        }
    }

    /**
     * Fetches roles directly from local database
     *
     * @param string $type The role type filter ('all', 'person', 'institution', 'both')
     * @return void Outputs JSON response directly
     */
    private function getRolesFromDb(string $type): void
    {
        global $connection;

        if ($type === 'all') {
            $sql = 'SELECT * FROM Role';
        } elseif ($type === 'person') {
            $sql = 'SELECT * FROM Role WHERE forInstitutions = 0';
        } elseif ($type === 'institution') {
            $sql = 'SELECT * FROM Role WHERE forInstitutions = 1';
        } else {
            $sql = 'SELECT * FROM Role WHERE forInstitutions = 2';
        }

        if ($stmt = $connection->prepare($sql)) {
            $stmt->execute();
            $result = $stmt->get_result();
            $rolesList = $result->fetch_all(MYSQLI_ASSOC);
            $stmt->close();

            if ($rolesList) {
                header('Content-Type: application/json');
                echo json_encode($rolesList);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'No roles found']);
            }
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $connection->error]);
        }
    }

    /**
     * Syncs ERNIE role data to the local Role table
     *
     * Uses INSERT ... ON DUPLICATE KEY UPDATE to upsert roles.
     * Sets the forInstitutions value based on the source endpoint.
     *
     * @param array<array{id: int, name: string, description?: string|null}> $ernieRoles Roles from ERNIE
     * @param int $forInstitutions The forInstitutions value (0=person, 1=institution, 2=both)
     * @return void
     */
    private function syncRolesToDb(array $ernieRoles, int $forInstitutions): void
    {
        global $connection;
        $connection->begin_transaction();

        try {
            foreach ($ernieRoles as $role) {
                $ernieId = $role['id'];
                $name = $role['name'];
                $description = $role['description'] ?? null;

                if (!$ernieId || !$name) {
                    continue;
                }

                $sql = "INSERT INTO `Role` (`ernie_id`, `name`, `description`, `forInstitutions`) VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        `name` = VALUES(`name`),
                        `description` = VALUES(`description`),
                        `forInstitutions` = VALUES(`forInstitutions`),
                        `ernie_id` = VALUES(`ernie_id`)";
                $stmt = $connection->prepare($sql);
                $stmt->bind_param('issi', $ernieId, $name, $description, $forInstitutions);
                $stmt->execute();
            }

            $connection->commit();
        } catch (\Exception $e) {
            $connection->rollback();
            error_log("ERNIE role sync failed: " . $e->getMessage());
        }
    }

    /**
     * Formats ERNIE role data for the API response
     *
     * Transforms ERNIE role format into a consistent response format
     * without requiring database lookups. The frontend only uses the
     * 'name' field for Tagify whitelists.
     *
     * @param array<array{id: int, name: string, description?: string|null}> $ernieRoles Roles from ERNIE
     * @param int $forInstitutions The forInstitutions value (0=person, 1=institution, 2=both)
     * @return array<array{name: string, forInstitutions: int}> Formatted roles
     */
    private function formatErnieRoles(array $ernieRoles, int $forInstitutions): array
    {
        return array_map(fn($role) => [
            'name' => $role['name'],
            'forInstitutions' => $forInstitutions,
        ], $ernieRoles);
    }

    /**
     * Updates timezone data by fetching it from an external API and saving it as JSON.
     *
     * @return void
     */
    public function updateTimezones()
    {
        global $apiKeyTimezone;
        // Validate API key before processing request
        if (!$this->validateApiKey()) {
            return;
        }
        try {
            // The TimeZoneDB API URL to fetch timezone data
            $apiUrl = 'http://api.timezonedb.com/v2.1/list-time-zone?key=' . urlencode($apiKeyTimezone) . '&format=json';

            // Fetch data from the external API
            $response = file_get_contents($apiUrl);
            if ($response === FALSE) {
                throw new Exception('Error fetching data from TimeZoneDB API.');
            }

            // Decode response into an array
            $data = json_decode($response, true);
            if ($data['status'] != 'OK') {
                throw new Exception('Error occurred: ' . $data['message']);
            }

            // Format timezones as UTC+X (Zone)
            $formattedTimezones = [];
            foreach ($data['zones'] as $zone) {
                $offsetHours = floor($zone['gmtOffset'] / 3600);
                $offsetMinutes = abs($zone['gmtOffset'] % 3600 / 60);
                $offset = sprintf('%+03d:%02d', $offsetHours, $offsetMinutes);
                $formattedTimezones[] = [
                    'value' => $zone['zoneName'],
                    'label' => sprintf('UTC%s (%s)', $offset, $zone['zoneName'])
                ];
            }

            // Cache data as a JSON string on the server
            $jsonDir = __DIR__ . '/../../../json/';
            if (!file_exists($jsonDir)) {
                mkdir($jsonDir, 0755, true);
            }
            $result = file_put_contents($jsonDir . 'timezones.json', json_encode($formattedTimezones, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            if ($result === false) {
                throw new Exception('Error saving JSON file: ' . error_get_last()['message']);
            }

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Timezones successfully updated',
                'timezones' => $formattedTimezones
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves licenses from the database, filtered by type, and returns them as JSON.
     *
     * @param bool $forSoftwareOnly If true, retrieves licenses only for software; otherwise, retrieves all licenses.
     * @return void
     */
    private function getLicensesByType($forSoftwareOnly = false)
    {
        try {
            $sql = $forSoftwareOnly
                ? 'SELECT * FROM Rights WHERE forSoftware = 1'
                : 'SELECT * FROM Rights';

            $result = $GLOBALS['connection']->query($sql);

            if (!$result) {
                throw new Exception("Database query failed");
            }

            $licenses = [];
            while ($row = $result->fetch_assoc()) {
                $licenses[] = $row;
            }

            if (empty($licenses)) {
                http_response_code(404);
                echo json_encode([
                    'error' => $forSoftwareOnly
                        ? 'No software licenses found'
                        : 'No licenses found'
                ]);
                return;
            }

            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($licenses);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves all licenses and returns them as JSON.
     *
     * @return void
     */
    public function getAllLicenses()
    {
        try {
            $this->getLicensesByType(false);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves software licenses and returns them as JSON.
     *
     * @return void
     */
    public function getSoftwareLicenses()
    {
        try {

            $this->getLicensesByType(true);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Get all free keywords from the database
     * 
     * @return void Outputs JSON response directly
     */
    public function getAllFreeKeywords(): void
    {
        try {
            global $connection;

            $sql = 'SELECT free_keyword FROM Free_Keywords ORDER BY free_keyword ASC';
            $result = $connection->query($sql);

            if ($result === false) {
                throw new Exception("Database query failed: " . $connection->error);
            }

            $keywords = [];
            while ($row = $result->fetch_assoc()) {
                $keywords[] = ['free_keyword' => $row['free_keyword']];
            }

            if (empty($keywords)) {
                http_response_code(404);
                echo json_encode(['error' => 'No keywords found']);
                return;
            }

            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode($keywords);

        } catch (Exception $e) {
            error_log("API Error in getAllFreeKeywords: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'An error occurred while retrieving keywords']);
        }
    }

    /**
     * Get only curated free keywords from the database
     * 
     * @return void Outputs JSON response directly
     */
    public function getCuratedFreeKeywords(): void
    {
        try {
            global $connection;

            $sql = 'SELECT free_keyword FROM Free_Keywords WHERE isCurated = 1 ORDER BY free_keyword ASC';
            $result = $connection->query($sql);

            if ($result === false) {
                throw new Exception("Database query failed: " . $connection->error);
            }

            $keywords = [];
            while ($row = $result->fetch_assoc()) {
                $keywords[] = ['free_keyword' => $row['free_keyword']];
            }

            // Immer Status 200 zurückgeben, auch bei leerer Liste
            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode($keywords);  // Gibt leeres Array zurück wenn keine Keywords existieren

        } catch (Exception $e) {
            error_log("API Error in getCuratedFreeKeywords: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'An error occurred while retrieving curated keywords']);
        }
    }

    /**
     * Get only uncurated free keywords from the database
     * 
     * @return void Outputs JSON response directly
     */
    public function getUncuratedFreeKeywords(): void
    {
        try {
            global $connection;

            $sql = 'SELECT free_keyword FROM Free_Keywords WHERE isCurated = 0 ORDER BY free_keyword ASC';
            $result = $connection->query($sql);

            if ($result === false) {
                throw new Exception("Database query failed: " . $connection->error);
            }

            $keywords = [];
            while ($row = $result->fetch_assoc()) {
                $keywords[] = ['free_keyword' => $row['free_keyword']];
            }

            if (empty($keywords)) {
                http_response_code(404);
                echo json_encode(['error' => 'No uncurated keywords found']);
                return;
            }

            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode($keywords);

        } catch (Exception $e) {
            error_log("API Error in getUncuratedFreeKeywords: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'An error occurred while retrieving uncurated keywords']);
        }
    }

    /**
     * Updates ROR affiliations by downloading and processing the latest ROR data dump
     * 
     * This function:
     * 1. Fetches metadata about the latest ROR data dump from Zenodo
     * 2. Downloads and extracts the ZIP file
     * 3. Processes the CSV file to extract organization IDs and names
     * 4. Saves the data as JSON
     * 5. Cleans up temporary files
     * 
     * @return void Outputs JSON response directly
     * @throws Exception If file operations or API requests fail
     */
    public function getRorAffiliations(): void
    {
        // Validate API key before processing request
        if (!$this->validateApiKey()) {
            return;
        }
        try {
            [$latestDataDumpUrl, $zipFileName] = $this->fetchLatestRorMetadata();
            $csvFileName = $this->downloadAndExtractRorDump($latestDataDumpUrl, $zipFileName);
            $affiliations = $this->parseRorCsv($csvFileName);
            $this->saveAffiliationsJson($affiliations);
            $this->cleanupFiles($zipFileName, $csvFileName);
            $this->respondWithAffiliations($affiliations);
        } catch (Exception $e) {
            error_log("API Error in getRorAffiliations: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Fetches metadata about the latest ROR data dump from Zenodo
     *
     * @return array<mixed> An array containing:
     *               - [0] The download URL of the data dump
     *               - [1] The filename of the ZIP archive
     * @throws Exception If metadata cannot be retrieved or is invalid
     */
    private function fetchLatestRorMetadata(): array
    {
        $rorDataDumpUrl = 'https://zenodo.org/api/communities/ror-data/records?q=&sort=newest';
        $metadataJson = @file_get_contents($rorDataDumpUrl);

        if ($metadataJson === false) {
            throw new Exception('Failed to fetch ROR data dump metadata from Zenodo');
        }

        $metadata = json_decode($metadataJson, true);
        if (!isset($metadata['hits']['hits'][0]['files'][0])) {
            throw new Exception('Invalid metadata structure from Zenodo');
        }

        return [
            $metadata['hits']['hits'][0]['files'][0]['links']['self'],
            $metadata['hits']['hits'][0]['files'][0]['key']
        ];
    }

    /**
     * Downloads and extracts the ROR data dump
     *
     * @param string $latestDataDumpUrl The download URL of the data dump
     * @param string $zipFileName The filename to save the ZIP as
     * @return string The name of the extracted CSV file
     * @throws Exception If the ZIP cannot be downloaded or processed
     */
    private function downloadAndExtractRorDump(string $latestDataDumpUrl, string $zipFileName): string
    {
        if (@file_put_contents($zipFileName, @file_get_contents($latestDataDumpUrl)) === false) {
            throw new Exception('Failed to download ROR data dump');
        }

        $zip = new ZipArchive();
        if ($zip->open($zipFileName) !== true) {
            throw new Exception('Failed to open ZIP file');
        }

        $zip->extractTo('./');
        $zip->close();

        $csvFiles = glob('*-ror-data.csv');
        if (empty($csvFiles)) {
            throw new Exception('CSV file not found in ZIP archive');
        }

        return $csvFiles[0];
    }

    /**
     * Processes the ROR CSV file and returns the affiliations array
     *
     * @param string $csvFileName Name of the extracted CSV file
     * @return array<mixed> Parsed affiliations data
     * @throws Exception If the CSV file cannot be read
     */
    private function parseRorCsv(string $csvFileName): array
    {
        $csvFile = @fopen($csvFileName, 'r');
        if ($csvFile === false) {
            throw new Exception('Failed to open CSV file');
        }

        $affiliations = [];
        $header = fgetcsv($csvFile);
        $indices = array_flip($header);

        while (($row = fgetcsv($csvFile)) !== false) {
            $aliases = [];
            if (isset($indices['aliases']) && !empty($row[$indices['aliases']])) {
                $aliases = array_map('trim', preg_split('/[|;]/', $row[$indices['aliases']]));
            }

            $labels = [];
            if (isset($indices['labels']) && !empty($row[$indices['labels']])) {
                $rawLabels = preg_split('/[|;]/', $row[$indices['labels']]);
                $labels = array_map(function ($label) {
                    $label = trim($label);
                    $label = preg_replace('/^[a-z]{2}:\s*/i', '', $label);
                    $label = preg_replace('/\s*\([a-z]{2}\)$/i', '', $label);
                    return $label;
                }, $rawLabels);
            }

            $acronyms = [];
            if (isset($indices['acronyms']) && !empty($row[$indices['acronyms']])) {
                $acronyms = array_map('trim', preg_split('/[|;]/', $row[$indices['acronyms']]));
            }

            $otherNames = array_values(array_filter(array_unique(array_merge($aliases, $labels, $acronyms))));

            $affiliations[] = [
                'id' => $row[$indices['id']] ?? '',
                'name' => $row[$indices['name']] ?? '',
                'other' => $otherNames
            ];
        }
        fclose($csvFile);

        return $affiliations;
    }

    /**
     * Saves the affiliations array as a JSON file
     *
     * @param array<mixed> $affiliations The affiliations data
     * @return void
     * @throws Exception If the JSON cannot be saved
     */
    private function saveAffiliationsJson(array $affiliations): void
    {
        if (!is_dir('json')) {
            if (!mkdir('json', 0755, true)) {
                throw new Exception('Failed to create json directory');
            }
        }

        if (
            file_put_contents(
                '../json/affiliations.json',
                json_encode($affiliations, JSON_PRETTY_PRINT)
            ) === false
        ) {
            throw new Exception('Failed to save affiliations.json');
        }
    }

    /**
     * Sends a success response after affiliations are updated
     *
     * @param array<mixed> $affiliations The processed affiliations
     * @return void
     */
    private function respondWithAffiliations(array $affiliations): void
    {
        http_response_code(200);
        header('Content-Type: application/json');
        echo json_encode([
            'message' => 'ROR affiliations successfully updated',
            'count' => count($affiliations),
            'timestamp' => date('c')
        ]);
    }

    /**
     * Cleans up temporary files created during ROR data processing
     * 
     * @param string $zipFileName Name of the downloaded ZIP file
     * @param string $csvFileName Name of the extracted CSV file
     * @return void
     */
    private function cleanupFiles(string $zipFileName, string $csvFileName): void
    {
        $filesToDelete = [
            $zipFileName,
            $csvFileName,
            str_replace('-ror-data.csv', '-ror-data_schema_v2.csv', $csvFileName),
            str_replace('-ror-data.csv', '-ror-data_schema_v2.json', $csvFileName),
            str_replace('-ror-data.csv', '-ror-data.json', $csvFileName)
        ];

        foreach ($filesToDelete as $file) {
            if (file_exists($file)) {
                @unlink($file);
            }
        }
    }

    /**
     * Updates the funders list from CrossRef API
     * 
     * This function:
     * 1. Fetches all funders from the CrossRef API using pagination
     * 2. Handles rate limiting with retries
     * 3. Saves the processed data to funders.json
     * 
     * @return void Outputs JSON response directly
     * @throws Exception If API requests fail or file operations fail
     */
    public function getCrossref(): void
    {
        // Validate API key before processing request
        if (!$this->validateApiKey()) {
            return;
        }
        try {
            $allFunders = [];
            $offset = 0;
            $limit = 1000; // Maximum results per request
            $retryDelay = 5; // Seconds to wait before retry
            $maxRetries = 3; // Maximum number of retry attempts
            $totalResults = PHP_INT_MAX; // Initial value, will be updated with actual total

            do {
                $retry = 0;
                $response = null;

                // Retry loop for handling rate limits
                do {
                    $url = "https://api.crossref.org/funders?offset=$offset&rows=$limit";
                    $context = stream_context_create([
                        'http' => [
                            'ignore_errors' => true,
                            'user_agent' => 'ELMO (https://env.rz-vm182.gfz.de/elmo/; mailto:ehrmann@gfz.de)'
                        ]
                    ]);

                    $response = @file_get_contents($url, false, $context);

                    if ($response === false) {
                        $httpStatus = $http_response_header[0] ?? 'Unknown error';

                        if (strpos($httpStatus, '429') !== false) {
                            // Rate limit hit - wait and retry
                            sleep($retryDelay);
                            $retry++;
                        } else {
                            throw new Exception("Failed to fetch CrossRef API: $httpStatus");
                        }
                    } else {
                        break; // Successful response received
                    }
                } while ($retry < $maxRetries);

                if ($retry >= $maxRetries) {
                    throw new Exception("Maximum retry attempts reached");
                }

                $data = json_decode($response, true);
                if (!isset($data['message']['items'])) {
                    throw new Exception("Invalid response format from CrossRef API");
                }

                // Update total results count on first iteration
                if ($offset === 0) {
                    $totalResults = $data['message']['total-results'];
                }

                // Process funders
                foreach ($data['message']['items'] as $funder) {
                    $allFunders[] = [
                        'crossRefId' => $funder['id'],
                        'name' => $funder['name']
                    ];
                }

                $offset += $limit;
                sleep(1); // Delay between requests

            } while (count($allFunders) < $totalResults);

            // Save to file
            if (
                file_put_contents(
                    '../json/funders.json',
                    json_encode($allFunders, JSON_PRETTY_PRINT)
                ) === false
            ) {
                throw new Exception('Failed to save funders.json');
            }

            // Send success response
            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'CrossRef funders successfully updated',
                'count' => count($allFunders),
                'timestamp' => date('c')
            ]);

        } catch (Exception $e) {
            error_log("API Error in getCrossref: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves all file formats from the database
     *
     * @return void Outputs JSON response directly
     */
    public function getICGEMFileFormats(): void
    {
        try {
            global $connection;
            $stmt = $connection->prepare('SELECT File_format_id as id, name, description FROM File_Format ORDER BY File_format_id ASC');

            if (!$stmt) {
                throw new Exception("Failed to prepare statement: " . $connection->error);
            }
            
            $stmt->execute();
            $result = $stmt->get_result();
            
            $formats = [];
            while ($row = $result->fetch_assoc()) {
                $formats[] = $row;
            }
            
            header('Content-Type: application/json');
            echo json_encode($formats);
            
        } catch (Exception $e) {
            error_log("API Error in getFileFormats: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves all model types from the database
     *
     * @return void Outputs JSON response directly
     */
    public function getICGEMModelTypes(): void
    {
        try {
            global $connection;
            $stmt = $connection->prepare('SELECT Model_type_id as id, name, description FROM Model_Type ORDER BY Model_type_id ASC');

            if (!$stmt) {
                throw new Exception("Failed to prepare statement: " . $connection->error);
            }
            
            $stmt->execute();
            $result = $stmt->get_result();
            
            $types = [];
            while ($row = $result->fetch_assoc()) {
                $types[] = $row;
            }
            
            header('Content-Type: application/json');
            echo json_encode($types);
            
        } catch (Exception $e) {
            error_log("API Error in getModelTypes: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves all mathematical representations from the database
     *
     * @return void Outputs JSON response directly
     */
    public function getMathRepresentations(): void
    {
        try {
            global $connection;
            $stmt = $connection->prepare('SELECT Mathematical_representation_id as id, name, description FROM Mathematical_Representation ORDER BY Mathematical_representation_id ASC');

            if (!$stmt) {
                throw new Exception("Failed to prepare statement: " . $connection->error);
            }
            
            $stmt->execute();
            $result = $stmt->get_result();
            
            $representations = [];
            while ($row = $result->fetch_assoc()) {
                $representations[] = $row;
            }
            
            header('Content-Type: application/json');
            echo json_encode($representations);

        } catch (Exception $e) {
            error_log("API Error in getMathRepresentations: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves resource types - first tries ERNIE with cache, then falls back to local DB
     *
     * @return void Outputs JSON response directly
     */
    public function getResourceTypes(): void
    {
        try {
            $ernieService = $this->getErnieService();

            // Only try ERNIE if it's configured (log configuration status)
            if ($ernieService->isConfigured(logResult: true)) {
                $ernieTypes = $ernieService->getResourceTypesWithCache();

                if (!empty($ernieTypes)) {
                    // Sync to local DB for storage purposes
                    $syncItems = array_map(fn($t) => [
                        'ernie_id' => $t['id'],
                        'name' => $t['name'],
                        'description' => $t['description'] ?? null
                    ], $ernieTypes);
                    $this->syncErnieToDb('Resource_Type', $syncItems, [
                        'ernie_id_col' => 'ernie_id',
                        'name_col' => 'resource_type_general',
                        'description_col' => 'description'
                    ]);

                    // Return ERNIE data with local IDs
                    $types = $this->mapErnieToLocalIds(
                        'Resource_Type', $ernieTypes, 'resource_name_id', 'ernie_id',
                        ['name' => 'resource_type_general', 'description' => 'description']
                    );
                    error_log("Resource Types: Serving " . count($types) . " types from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode($types);
                    return;
                }
            }

            // Fallback: Load from local database
            error_log("Resource Types: Falling back to local database");
            $this->getResourceTypesFromDb();

        } catch (Exception $e) {
            error_log("API Error in getResourceTypes: " . $e->getMessage());
            // Fallback to local DB on any error
            error_log("Resource Types: Falling back to local database due to error");
            $this->getResourceTypesFromDb();
        }
    }

    /**
     * Fetches resource types directly from local database
     *
     * @return void Outputs JSON response directly
     */
    private function getResourceTypesFromDb(): void
    {
        global $connection;

        $stmt = $connection->prepare(
            'SELECT resource_name_id as id, resource_type_general, description 
             FROM Resource_Type 
             ORDER BY resource_type_general'
        );

        if (!$stmt) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to prepare statement: ' . $connection->error]);
            return;
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $types = [];
        while ($row = $result->fetch_assoc()) {
            $types[] = $row;
        }

        header('Content-Type: application/json');
        echo json_encode($types);
    }

    /**
     * Updates the given database table with items retrieved from ERNIE
     *
     * Uses INSERT ... ON DUPLICATE KEY UPDATE (upsert) for efficient syncing.
     * Both the ernie_id and name columns have UNIQUE constraints, so this
     * handles three cases atomically:
     * - New item: INSERT
     * - Existing by ernie_id: UPDATE name (and description if applicable)
     * - Existing by name without ernie_id: UPDATE to link ernie_id (migration)
     *
     * @param string $dbTable The target database table name
     * @param array<int, array{ernie_id: int, name: string, description?: string|null}> $items Normalised items to sync
     * @param array{ernie_id_col: string, name_col: string, description_col?: string|null} $tableStructure Mapping of DB columns
     * @return bool True if all records were successfully upserted
     */
    private function syncErnieToDb(string $dbTable, array $items, array $tableStructure): bool
    {
        global $connection;

        $ernieIdCol = $tableStructure['ernie_id_col'];
        $nameCol = $tableStructure['name_col'];
        $descCol = $tableStructure['description_col'] ?? null;

        $connection->begin_transaction();

        try {
            foreach ($items as $item) {
                $ernieId = $item['ernie_id'];
                $name = $item['name'];

                if (!$ernieId || !$name) {
                    continue;
                }

                if ($descCol !== null) {
                    $desc = $item['description'] ?? null;
                    $sql = "INSERT INTO `$dbTable` (`$ernieIdCol`, `$nameCol`, `$descCol`) VALUES (?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                            `$nameCol` = VALUES(`$nameCol`),
                            `$descCol` = VALUES(`$descCol`),
                            `$ernieIdCol` = VALUES(`$ernieIdCol`)";
                    $stmt = $connection->prepare($sql);
                    $stmt->bind_param('iss', $ernieId, $name, $desc);
                } else {
                    $sql = "INSERT INTO `$dbTable` (`$ernieIdCol`, `$nameCol`) VALUES (?, ?)
                            ON DUPLICATE KEY UPDATE
                            `$nameCol` = VALUES(`$nameCol`),
                            `$ernieIdCol` = VALUES(`$ernieIdCol`)";
                    $stmt = $connection->prepare($sql);
                    $stmt->bind_param('is', $ernieId, $name);
                }

                $stmt->execute();
            }

            $connection->commit();
            error_log("ERNIE sync to $dbTable completed: " . count($items) . " items synced");
            return true;

        } catch (\Exception $e) {
            $connection->rollback();
            error_log("ERNIE sync to $dbTable failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Maps ERNIE item data to local database IDs
     *
     * Transforms ERNIE response format to the format expected by the frontend,
     * using local database IDs for storage compatibility.
     *
     * Important: Must be called after syncErnieToDb() to ensure all ERNIE items
     * have corresponding local database records with mapped ernie_id values.
     *
     * @param string $dbTable The database table name
     * @param array<int, array<string, mixed>> $ernieItems Raw items from ERNIE (each with 'id' key)
     * @param string $localIdCol Primary key column name in the DB table
     * @param string $ernieIdCol ERNIE ID column name in the DB table
     * @param array<string, string> $outputFieldMap Maps ERNIE response keys to output keys (e.g., ['name' => 'resource_type_general'])
     * @return array<int, array<string, mixed>> Items with local database IDs and mapped field names
     */
    private function mapErnieToLocalIds(
        string $dbTable,
        array $ernieItems,
        string $localIdCol,
        string $ernieIdCol,
        array $outputFieldMap
    ): array {
        global $connection;

        $result = [];

        foreach ($ernieItems as $item) {
            $ernieId = $item['id'];

            $stmt = $connection->prepare(
                "SELECT `$localIdCol` FROM `$dbTable` WHERE `$ernieIdCol` = ?"
            );
            $stmt->bind_param('i', $ernieId);
            $stmt->execute();
            $dbResult = $stmt->get_result();

            $localId = null;
            if ($row = $dbResult->fetch_assoc()) {
                $localId = (int) $row[$localIdCol];
            }

            $mapped = ['id' => $localId];
            foreach ($outputFieldMap as $ernieKey => $outputKey) {
                $mapped[$outputKey] = $item[$ernieKey] ?? '';
            }
            $result[] = $mapped;
        }

        return $result;
    }

    /**
     * Manually refreshes the ERNIE resource types cache
     * 
     * Requires API key authentication.
     *
     * @return void Outputs JSON response directly
     */
    public function refreshResourceTypesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshCache',
            'getCacheStatus',
            'Resource types',
            function ($ernieService) {
                $ernieTypes = $ernieService->getResourceTypesWithCache();
                if (!empty($ernieTypes)) {
                    $syncItems = array_map(fn($t) => [
                        'ernie_id' => $t['id'],
                        'name' => $t['name'],
                        'description' => $t['description'] ?? null
                    ], $ernieTypes);
                    $this->syncErnieToDb('Resource_Type', $syncItems, [
                        'ernie_id_col' => 'ernie_id',
                        'name_col' => 'resource_type_general',
                        'description_col' => 'description'
                    ]);
                }
            }
        );
    }

    /**
     * Gets the status of the ERNIE resource types cache
     *
     * @return void Outputs JSON response directly
     */
    public function getResourceTypesCacheStatus(): void
    {
        $this->handleCacheStatus('getCacheStatus', 'resource types');
    }

    /**
     * Retrieves all languages, preferring ERNIE data with local DB fallback
     *
     * When ERNIE is configured, fetches languages from ERNIE (with caching),
     * syncs to local DB, and returns data with local IDs.
     * Falls back to local database if ERNIE is unavailable.
     *
     * @return void Outputs JSON response directly
     */
    public function getLanguages(): void
    {
        try {
            $ernieService = $this->getErnieService();

            if ($ernieService->isConfigured(logResult: true)) {
                $ernieLanguages = $ernieService->getLanguagesWithCache();

                if (!empty($ernieLanguages)) {
                    // Sync to local DB via code matching
                    $this->syncLanguagesToDb($ernieLanguages);

                    // Return with local IDs (mapped via code)
                    $languages = $this->mapLanguagesByCode($ernieLanguages);
                    error_log("Languages: Serving " . count($languages) . " languages from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode($languages);
                    return;
                }
            }

            // Fallback to local database
            error_log("Languages: Falling back to local database");
            $this->getLanguagesFromDb();

        } catch (Exception $e) {
            error_log("API Error in getLanguages: " . $e->getMessage());
            $this->getLanguagesFromDb();
        }
    }

    /**
     * Fetches languages directly from local database
     *
     * @return void Outputs JSON response directly
     */
    private function getLanguagesFromDb(): void
    {
        global $connection;

        $stmt = $connection->prepare('SELECT language_id as id, code, name FROM Language ORDER BY name');

        if (!$stmt) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to prepare statement: ' . $connection->error]);
            return;
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $languages = [];
        while ($row = $result->fetch_assoc()) {
            $languages[] = $row;
        }

        header('Content-Type: application/json');
        echo json_encode($languages);
    }

    /**
     * Syncs ERNIE language data to the local Language table via code column
     *
     * Uses INSERT ... ON DUPLICATE KEY UPDATE on the unique `code` column
     * to insert new languages or update existing ones.
     *
     * @param array<array{id: int, name: string, code: string}> $ernieLanguages Languages from ERNIE
     * @return void
     */
    private function syncLanguagesToDb(array $ernieLanguages): void
    {
        global $connection;
        $connection->begin_transaction();

        try {
            foreach ($ernieLanguages as $lang) {
                $code = $lang['code'];
                $name = $lang['name'];

                if (!$code || !$name) {
                    continue;
                }

                $sql = "INSERT INTO `Language` (`code`, `name`) VALUES (?, ?)
                        ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)";
                $stmt = $connection->prepare($sql);
                $stmt->bind_param('ss', $code, $name);
                $stmt->execute();
            }

            $connection->commit();
        } catch (\Exception $e) {
            $connection->rollback();
            error_log("ERNIE language sync failed: " . $e->getMessage());
        }
    }

    /**
     * Maps ERNIE language data to local database IDs via the code column
     *
     * Looks up the local language_id for each ERNIE language by its unique code,
     * returning data in the format expected by the frontend.
     *
     * @param array<array{id: int, name: string, code: string}> $ernieLanguages Languages from ERNIE
     * @return array<array{id: int|null, name: string, code: string}> Languages with local IDs
     */
    private function mapLanguagesByCode(array $ernieLanguages): array
    {
        global $connection;

        $result = [];

        foreach ($ernieLanguages as $lang) {
            $code = $lang['code'];

            $stmt = $connection->prepare("SELECT language_id FROM Language WHERE code = ?");
            $stmt->bind_param('s', $code);
            $stmt->execute();
            $dbResult = $stmt->get_result();

            $localId = null;
            if ($row = $dbResult->fetch_assoc()) {
                $localId = (int) $row['language_id'];
            }

            $result[] = [
                'id' => $localId,
                'name' => $lang['name'],
                'code' => $code
            ];
        }

        return $result;
    }

    /**
     * Retrieves description types enabled for ELMO from ERNIE
     *
     * When ERNIE is configured, fetches description types from ERNIE (with caching).
     * The ERNIE response contains { "value": [...] } - the "value" array is extracted.
     * Falls back to hardcoded types (Abstract, Methods, TechnicalInfo, Other) if unavailable.
     * No DB sync needed since description types are not stored in a local table.
     *
     * @return void Outputs JSON response directly
     */
    public function getDescriptionTypes(): void
    {
        try {
            $ernieService = $this->getErnieService();

            if ($ernieService->isConfigured(logResult: true)) {
                $ernieData = $ernieService->getDescriptionTypesWithCache();

                if (!empty($ernieData)) {
                    // ERNIE API returns { "value": [...] } - extract the array
                    $types = isset($ernieData['value']) ? $ernieData['value'] : $ernieData;
                    error_log("Description Types: Serving " . count($types) . " types from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode($types);
                    return;
                }
            }

            // Fallback: hardcoded types
            error_log("Description Types: Using hardcoded fallback");
            header('Content-Type: application/json');
            echo json_encode([
                ['id' => 1, 'name' => 'Abstract', 'slug' => 'Abstract'],
                ['id' => 2, 'name' => 'Methods', 'slug' => 'Methods'],
                ['id' => 5, 'name' => 'Technical Info', 'slug' => 'TechnicalInfo'],
                ['id' => 6, 'name' => 'Other', 'slug' => 'Other'],
            ]);

        } catch (Exception $e) {
            error_log("API Error in getDescriptionTypes: " . $e->getMessage());
            error_log("Description Types: Falling back to hardcoded types due to error");
            header('Content-Type: application/json');
            echo json_encode([
                ['id' => 1, 'name' => 'Abstract', 'slug' => 'Abstract'],
                ['id' => 2, 'name' => 'Methods', 'slug' => 'Methods'],
                ['id' => 5, 'name' => 'Technical Info', 'slug' => 'TechnicalInfo'],
                ['id' => 6, 'name' => 'Other', 'slug' => 'Other'],
            ]);
        }
    }

    /**
     * Manually refreshes the ERNIE description types cache
     * 
     * Requires API key authentication.
     *
     * @return void Outputs JSON response directly
     */
    public function refreshDescriptionTypesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshDescriptionTypesCache',
            'getDescriptionTypesCacheStatus',
            'Description types'
        );
    }

    /**
     * Gets the status of the ERNIE description types cache
     *
     * @return void Outputs JSON response directly
     */
    public function getDescriptionTypesCacheStatus(): void
    {
        $this->handleCacheStatus('getDescriptionTypesCacheStatus', 'description types');
    }

    /**
     * Retrieves all title types, preferring ERNIE data with local DB fallback
     *
     * When ERNIE is configured, fetches title types from ERNIE (with caching),
     * syncs to local DB, and returns data with local IDs.
     * Falls back to local database if ERNIE is unavailable.
     *
     * @return void Outputs JSON response directly
     */
    public function getTitleTypes(): void
    {
        try {
            $ernieService = $this->getErnieService();

            // Only try ERNIE if it's configured (log configuration status)
            if ($ernieService->isConfigured(logResult: true)) {
                $ernieTypes = $ernieService->getTitleTypesWithCache();

                if (!empty($ernieTypes)) {
                    // Sync to local DB for storage purposes
                    $syncItems = array_map(fn($t) => [
                        'ernie_id' => $t['id'],
                        'name' => $t['name']
                    ], $ernieTypes);
                    $this->syncErnieToDb('Title_Type', $syncItems, [
                        'ernie_id_col' => 'ernie_id',
                        'name_col' => 'name'
                    ]);

                    // Return ERNIE data with local IDs
                    $types = $this->mapErnieToLocalIds(
                        'Title_Type', $ernieTypes, 'title_type_id', 'ernie_id',
                        ['name' => 'name']
                    );
                    error_log("Title Types: Serving " . count($types) . " types from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode($types);
                    return;
                }
            }

            // Fallback: Load from local database
            error_log("Title Types: Falling back to local database");
            $this->getTitleTypesFromDb();

        } catch (Exception $e) {
            error_log("API Error in getTitleTypes: " . $e->getMessage());
            // Fallback to local DB on any error
            error_log("Title Types: Falling back to local database due to error");
            $this->getTitleTypesFromDb();
        }
    }

    /**
     * Fetches title types directly from local database
     *
     * @return void Outputs JSON response directly
     */
    private function getTitleTypesFromDb(): void
    {
        global $connection;

        $stmt = $connection->prepare(
            'SELECT title_type_id as id, name FROM Title_Type ORDER BY name'
        );

        if (!$stmt) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to prepare statement: ' . $connection->error]);
            return;
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $types = [];
        while ($row = $result->fetch_assoc()) {
            $types[] = $row;
        }

        header('Content-Type: application/json');
        echo json_encode($types);
    }

    /**
     * Manually refreshes the ERNIE title types cache
     * 
     * Requires API key authentication.
     *
     * @return void Outputs JSON response directly
     */
    public function refreshTitleTypesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshTitleTypesCache',
            'getTitleTypesCacheStatus',
            'Title types',
            function ($ernieService) {
                $ernieTypes = $ernieService->getTitleTypesWithCache();
                if (!empty($ernieTypes)) {
                    $syncItems = array_map(fn($t) => [
                        'ernie_id' => $t['id'],
                        'name' => $t['name']
                    ], $ernieTypes);
                    $this->syncErnieToDb('Title_Type', $syncItems, [
                        'ernie_id_col' => 'ernie_id',
                        'name_col' => 'name'
                    ]);
                }
            }
        );
    }

    /**
     * Gets the status of the ERNIE title types cache
     *
     * @return void Outputs JSON response directly
     */
    public function getTitleTypesCacheStatus(): void
    {
        $this->handleCacheStatus('getTitleTypesCacheStatus', 'title types');
    }

    // ==================== Generic ERNIE cache handlers ====================

    /**
     * Generic handler for ERNIE cache status endpoints
     *
     * @param string $cacheStatusMethod The ErnieService method to call
     * @param string $label Human-readable label for error logging
     * @return void Outputs JSON response directly
     */
    private function handleCacheStatus(string $cacheStatusMethod, string $label): void
    {
        try {
            $ernieService = $this->getErnieService();

            header('Content-Type: application/json');
            echo json_encode([
                'configured' => $ernieService->isConfigured(),
                'cache' => $ernieService->$cacheStatusMethod()
            ]);
        } catch (Exception $e) {
            error_log("Error getting $label cache status: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Generic handler for ERNIE cache refresh endpoints
     *
     * @param string $refreshMethod ErnieService method to refresh the cache
     * @param string $statusMethod ErnieService method to get cache status after refresh
     * @param string $label Human-readable label for messages
     * @param callable|null $afterRefresh Optional callback executed after successful refresh (e.g. DB sync)
     * @return void Outputs JSON response directly
     */
    private function handleCacheRefresh(
        string $refreshMethod,
        string $statusMethod,
        string $label,
        ?callable $afterRefresh = null
    ): void {
        if (!$this->validateApiKey()) {
            return;
        }

        try {
            $ernieService = $this->getErnieService();

            if (!$ernieService->isConfigured()) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'message' => 'ERNIE service is not configured'
                ]);
                return;
            }

            $success = $ernieService->$refreshMethod();

            header('Content-Type: application/json');

            if ($success) {
                if ($afterRefresh !== null) {
                    $afterRefresh($ernieService);
                }

                $status = $ernieService->$statusMethod();
                echo json_encode([
                    'success' => true,
                    'message' => "$label cache refreshed successfully",
                    'itemCount' => $status['itemCount'],
                    'lastUpdated' => $status['lastUpdated']
                ]);
            } else {
                http_response_code(502);
                echo json_encode([
                    'success' => false,
                    'message' => "Failed to fetch $label data from ERNIE"
                ]);
            }
        } catch (Exception $e) {
            error_log("Error refreshing $label cache: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ==================== Languages cache endpoints ====================

    /**
     * Manually refreshes the ERNIE languages cache
     *
     * @return void Outputs JSON response directly
     */
    public function refreshLanguagesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshLanguagesCache',
            'getLanguagesCacheStatus',
            'Languages',
            function ($ernieService) {
                $ernieLanguages = $ernieService->getLanguagesWithCache();
                if (!empty($ernieLanguages)) {
                    $this->syncLanguagesToDb($ernieLanguages);
                }
            }
        );
    }

    /**
     * Gets the status of the ERNIE languages cache
     *
     * @return void Outputs JSON response directly
     */
    public function getLanguagesCacheStatus(): void
    {
        $this->handleCacheStatus('getLanguagesCacheStatus', 'languages');
    }

    // ==================== PID4INST Instruments ====================

    /**
     * Retrieves PID4INST instruments from ERNIE with caching
     *
     * Returns a slim representation for frontend autocomplete:
     * [{pid, pidType, name, instrumentTypes}]
     *
     * @return void Outputs JSON response directly
     */
    public function getPid4instInstruments(): void
    {
        try {
            $ernieService = $this->getErnieService();

            if ($ernieService->isConfigured(logResult: true)) {
                $result = $ernieService->getPid4instInstrumentsWithCache();

                if (!empty($result['data'])) {
                    // Transform to slim format for frontend
                    $instruments = array_map(function ($item) {
                        return [
                            'pid' => $item['pid'] ?? '',
                            'pidType' => $item['pidType'] ?? 'Handle',
                            'name' => $item['name'] ?? '',
                            'instrumentTypes' => $item['instrumentTypes'] ?? []
                        ];
                    }, $result['data']);

                    error_log("PID4INST: Serving " . count($instruments) . " instruments from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode($instruments);
                    return;
                }
            }

            // No data available
            error_log("PID4INST: No instruments available");
            http_response_code(503);
            header('Content-Type: application/json');
            echo json_encode([
                'error' => 'PID4INST instruments currently unavailable',
                'instruments' => []
            ]);

        } catch (Exception $e) {
            error_log("API Error in getPid4instInstruments: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Manually refreshes the PID4INST instruments cache
     *
     * @return void Outputs JSON response directly
     */
    public function refreshPid4instCache(): void
    {
        $this->handleCacheRefresh(
            'refreshPid4instCache',
            'getPid4instCacheStatus',
            'PID4INST instruments'
        );
    }

    /**
     * Gets the status of the PID4INST instruments cache
     *
     * @return void Outputs JSON response directly
     */
    public function getPid4instCacheStatus(): void
    {
        $this->handleCacheStatus('getPid4instCacheStatus', 'PID4INST');
    }

    // ==================== Contributor Roles cache endpoints ====================

    /**
     * Manually refreshes the ERNIE contributor person roles cache
     *
     * @return void Outputs JSON response directly
     */
    public function refreshContributorPersonRolesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshContributorPersonRolesCache',
            'getContributorPersonRolesCacheStatus',
            'Contributor person roles',
            function ($ernieService) {
                $ernieRoles = $ernieService->getContributorPersonRolesWithCache();
                if (!empty($ernieRoles)) {
                    $this->syncRolesToDb($ernieRoles, 0);
                }
            }
        );
    }

    /**
     * Gets the status of the ERNIE contributor person roles cache
     *
     * @return void Outputs JSON response directly
     */
    public function getContributorPersonRolesCacheStatus(): void
    {
        $this->handleCacheStatus('getContributorPersonRolesCacheStatus', 'contributor person roles');
    }

    /**
     * Manually refreshes the ERNIE contributor institution roles cache
     *
     * @return void Outputs JSON response directly
     */
    public function refreshContributorInstitutionRolesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshContributorInstitutionRolesCache',
            'getContributorInstitutionRolesCacheStatus',
            'Contributor institution roles',
            function ($ernieService) {
                $ernieRoles = $ernieService->getContributorInstitutionRolesWithCache();
                if (!empty($ernieRoles)) {
                    $this->syncRolesToDb($ernieRoles, 1);
                }
            }
        );
    }

    /**
     * Gets the status of the ERNIE contributor institution roles cache
     *
     * @return void Outputs JSON response directly
     */
    public function getContributorInstitutionRolesCacheStatus(): void
    {
        $this->handleCacheStatus('getContributorInstitutionRolesCacheStatus', 'contributor institution roles');
    }

    // ==================== Thesauri (ERNIE proxy) endpoints ====================

    /**
     * Returns thesauri availability from ERNIE (with caching)
     * 
     * Tells the frontend which thesauri are currently enabled.
     *
     * @return void Outputs JSON response directly
     */
    public function getThesauriAvailability(): void
    {
        try {
            $ernieService = $this->getErnieService();

            if ($ernieService->isConfigured()) {
                $availability = $ernieService->getThesauriAvailabilityWithCache();
                if (!empty($availability)) {
                    header('Content-Type: application/json');
                    echo json_encode($availability);
                    return;
                }
            }

            http_response_code(503);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Thesauri availability currently unavailable']);
        } catch (Exception $e) {
            error_log("API Error in getThesauriAvailability: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Returns vocabulary data for a specific thesaurus from ERNIE (with caching)
     *
     * @param string $slug The thesaurus slug (e.g. 'gcmd-science-keywords')
     * @return void Outputs JSON response directly
     */
    private function getThesaurusVocabulary(string $slug): void
    {
        try {
            $ernieService = $this->getErnieService();

            if ($ernieService->isConfigured()) {
                $data = $ernieService->getThesaurusVocabularyWithCache($slug);
                if (!empty($data)) {
                    error_log("Thesaurus ($slug): Serving " . count($data) . " items from ERNIE (cache or fresh)");
                    header('Content-Type: application/json');
                    echo json_encode($data);
                    return;
                }
            }

            http_response_code(503);
            header('Content-Type: application/json');
            echo json_encode(['error' => "Thesaurus vocabulary '$slug' currently unavailable"]);
        } catch (Exception $e) {
            error_log("API Error in getThesaurusVocabulary($slug): " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Returns GCMD Science Keywords vocabulary data
     *
     * @return void
     */
    public function getGcmdScienceKeywordsFromErnie(): void
    {
        $this->getThesaurusVocabulary('gcmd-science-keywords');
    }

    /**
     * Returns GCMD Platforms vocabulary data
     *
     * @return void
     */
    public function getGcmdPlatformsFromErnie(): void
    {
        $this->getThesaurusVocabulary('gcmd-platforms');
    }

    /**
     * Returns GCMD Instruments vocabulary data
     *
     * @return void
     */
    public function getGcmdInstrumentsFromErnie(): void
    {
        $this->getThesaurusVocabulary('gcmd-instruments');
    }

    /**
     * Returns ICS Chronostratigraphy vocabulary data
     *
     * @return void
     */
    public function getChronostratTimescale(): void
    {
        $this->getThesaurusVocabulary('chronostrat-timescale');
    }

    /**
     * Returns GEMET Thesaurus vocabulary data
     *
     * @return void
     */
    public function getGemet(): void
    {
        $this->getThesaurusVocabulary('gemet');
    }

    /**
     * Manually refreshes the thesauri availability cache
     *
     * @return void Outputs JSON response directly
     */
    public function refreshThesauriAvailabilityCache(): void
    {
        $this->handleCacheRefresh(
            'refreshThesauriAvailabilityCache',
            'getThesauriAvailabilityCacheStatus',
            'Thesauri availability'
        );
    }

    /**
     * Gets the status of the thesauri availability cache
     *
     * @return void Outputs JSON response directly
     */
    public function getThesauriAvailabilityCacheStatus(): void
    {
        $this->handleCacheStatus('getThesauriAvailabilityCacheStatus', 'thesauri availability');
    }

    // ==================== Relation Types (ERNIE) cache management ====================

    /**
     * Manually refreshes the relation types cache from ERNIE
     * and syncs the fresh data to the local database.
     *
     * @return void Outputs JSON response directly
     */
    public function refreshRelationTypesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshRelationTypesCache',
            'getRelationTypesCacheStatus',
            'Relation types',
            $this->syncRelationTypesAfterRefresh(...)
        );
    }

    /**
     * Syncs relation types to local DB after a cache refresh
     *
     * @param \ErnieService $ernieService The ERNIE service instance
     * @return void
     */
    private function syncRelationTypesAfterRefresh(\ErnieService $ernieService): void
    {
        $ernieTypes = $ernieService->getRelationTypesWithCache();
        if (!empty($ernieTypes)) {
            $syncItems = array_map(fn($t) => [
                'ernie_id' => $t['id'],
                'name' => $t['name'],
                'description' => $t['description'] ?? null
            ], $ernieTypes);
            $this->syncErnieToDb('Relation', $syncItems, [
                'ernie_id_col' => 'ernie_id',
                'name_col' => 'name',
                'description_col' => 'description'
            ]);
        }
    }

    /**
     * Gets the status of the ERNIE relation types cache
     *
     * @return void Outputs JSON response directly
     */
    public function getRelationTypesCacheStatus(): void
    {
        $this->handleCacheStatus('getRelationTypesCacheStatus', 'relation types');
    }

    // ==================== Identifier Types (ERNIE) cache management ====================

    /**
     * Manually refreshes the identifier types cache from ERNIE
     * and syncs the fresh data to the local database.
     *
     * @return void Outputs JSON response directly
     */
    public function refreshIdentifierTypesCache(): void
    {
        $this->handleCacheRefresh(
            'refreshIdentifierTypesCache',
            'getIdentifierTypesCacheStatus',
            'Identifier types',
            $this->syncIdentifierTypesAfterRefresh(...)
        );
    }

    /**
     * Syncs identifier types to local DB after a cache refresh
     *
     * @param \ErnieService $ernieService The ERNIE service instance
     * @return void
     */
    private function syncIdentifierTypesAfterRefresh(\ErnieService $ernieService): void
    {
        $ernieTypes = $ernieService->getIdentifierTypesWithCache();
        if (!empty($ernieTypes)) {
            $this->syncIdentifierTypesToDb($ernieTypes);
        }
    }

    /**
     * Gets the status of the ERNIE identifier types cache
     *
     * @return void Outputs JSON response directly
     */
    public function getIdentifierTypesCacheStatus(): void
    {
        $this->handleCacheStatus('getIdentifierTypesCacheStatus', 'identifier types');
    }

    /**
     * Syncs ERNIE identifier types to the local database
     *
     * First deactivates all types (isShown=0), then upserts current ERNIE
     * data with isShown=1. This ensures types not provided by ERNIE
     * (including legacy install.php data) are no longer shown.
     *
     * Uses INSERT ... ON DUPLICATE KEY UPDATE (upsert) to handle
     * new, existing by ernie_id, and existing by name records.
     * Also updates `pattern` and sets `isShown = 1` for ERNIE-provided types.
     *
     * @param array<int, array<string, mixed>> $ernieTypes Identifier types from ERNIE
     * @return void
     */
    public function syncIdentifierTypesToDb(array $ernieTypes): void
    {
        global $connection;

        $connection->begin_transaction();

        try {
            // Deactivate all types first; upsert below re-activates current ones
            $connection->query("UPDATE `Identifier_Type` SET `isShown` = 0");

            foreach ($ernieTypes as $type) {
                $ernieId = $type['id'] ?? null;
                $name = $type['name'] ?? null;
                if (!$ernieId || !$name) {
                    continue;
                }

                $desc = $type['description'] ?? null;
                $pattern = $type['pattern'] ?? null;

                $sql = "INSERT INTO `Identifier_Type` (`ernie_id`, `name`, `description`, `pattern`, `isShown`)
                        VALUES (?, ?, ?, ?, 1)
                        ON DUPLICATE KEY UPDATE
                        `name` = VALUES(`name`),
                        `description` = VALUES(`description`),
                        `pattern` = VALUES(`pattern`),
                        `isShown` = 1,
                        `ernie_id` = VALUES(`ernie_id`)";
                $stmt = $connection->prepare($sql);
                $stmt->bind_param('isss', $ernieId, $name, $desc, $pattern);
                $stmt->execute();
            }

            $connection->commit();
            error_log("ERNIE sync to Identifier_Type completed: " . count($ernieTypes) . " types synced");
        } catch (\Exception $e) {
            $connection->rollback();
            error_log("ERNIE sync to Identifier_Type failed: " . $e->getMessage());
        }
    }
}
