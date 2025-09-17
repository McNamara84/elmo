<?php
use EasyRdf\Graph;
/**
 *
 * This controller provides endpoints for fetching vocabularies via the API.
 *
 */

// Set Max Execution Time to 300 seconds
ini_set('max_execution_time', 300);
// Include helper_functions.php so that variables are available
require_once __DIR__ . '/../../../helper_functions.php';

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
     * Adds a timestamp to the provided data structure
     * 
     * Creates a wrapper object that includes both the original data
     * and a timestamp of when the data was last updated.
     * 
     * @param mixed $data The original data to be wrapped
     * @return array An array containing:
     *               - 'lastUpdated' (string) The timestamp in Y-m-d H:i:s format
     *               - 'data' (mixed) The original data structure
     * 
     */
    private function addTimestampToData($data)
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
     * Retrieves relation data from the database and returns it as JSON.
     *
     * @return void
     */
    public function getRelations()
    {
        global $connection;
        $stmt = $connection->prepare('SELECT relation_id, name, description FROM Relation');

        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to prepare statement: ' . $connection->error]);
            return;
        }

        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to execute statement: ' . $stmt->error]);
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
            echo json_encode(['relations' => $relations]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'No relations found']);
        }

        $stmt->close();
        exit();
    }

    /**
     * Fetches MSL Labs data from a remote URL, processes it, and returns the necessary fields.
     *
     * @return array Processed MSL Labs data.
     * @throws Exception If fetching or decoding the data fails.
     */
    public function fetchAndProcessMslLabs()
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
     * Fetches the CGI Simple Lithology vocabulary from the official RDF source
     * and returns a hierarchical array formatted for jsTree.
     *
     * @return array Parsed CGI keywords tree
     * @throws Exception If fetching or parsing the RDF data fails
     */
    public function fetchAndProcessCGIKeywords()
    {
        // Source URL of the CGI Simple Lithology vocabulary
        $url = 'https://geosciml.org/resource/vocabulary/cgi/2016/simplelithology.rdf';

        // Register RDF namespaces
        RdfNamespace::set('skos', 'http://www.w3.org/2004/02/skos/core#');
        RdfNamespace::set('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');

        // Load RDF data
        $graph = new Graph($url);
        $graph->load();

        $keywordMap = [];

        // Iterate through all SKOS concepts
        foreach ($graph->allOfType('skos:Concept') as $concept) {
            $id = $concept->getUri();
            $prefLabel = (string) $concept->get('skos:prefLabel');
            $definition = (string) $concept->get('skos:definition');

            $keywordMap[$id] = [
                'id' => $id,
                'text' => $prefLabel,
                'language' => 'en',
                'scheme' => 'CGI Simple Lithology',
                'schemeURI' => 'https://geosciml.org/resource/vocabulary/cgi/2016/simplelithology',
                'description' => $definition,
                'children' => []
            ];
        }

        // Build hierarchy with compound_material as the root node
        $rootId = 'http://resource.geosciml.org/classifier/cgi/lithology/compound_material';
        foreach ($graph->allOfType('skos:Concept') as $concept) {
            $id = $concept->getUri();
            if ($id === $rootId) {
                continue; // Skip the root element
            }
            $broader = $concept->all('skos:broader');
            if (empty($broader)) {
                // Concepts without a broader term become children of the root
                $keywordMap[$rootId]['children'][] = &$keywordMap[$id];
            } else {
                foreach ($broader as $parent) {
                    $parentId = $parent->getUri();
                    if (isset($keywordMap[$parentId])) {
                        $keywordMap[$parentId]['children'][] = &$keywordMap[$id];
                        break;
                    }
                }
            }
        }

        // Return only the root element
        return [$keywordMap[$rootId]];
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
     * @param array $item The item to process
     * @return array The processed item
     */
    private function processItem($item)
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
     * @param array $vars An associative array of parameters (not used anymore)
     * @return void
     */
    public function getMslVocab($vars = [])
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
     * Retrieves CGI Simple Lithology keywords from a local JSON file and returns them as JSON.
     *
     * @return void
     */
    public function getCGIKeywords()
    {
        try {
            $jsonPath = __DIR__ . '/../../../json/thesauri/cgi.json';
            if (!file_exists($jsonPath)) {
                throw new Exception('CGI keywords file not found');
            }
            $json = file_get_contents($jsonPath);
            if ($json === false) {
                throw new Exception('Error reading CGI keywords file');
            }
            header('Content-Type: application/json');
            echo $json;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Updates the CGI Simple Lithology keywords by fetching the latest RDF and
     * storing it as JSON for use by the frontend.
     *
     * @return void
     */
    public function updateCGIKeywords()
    {
        // Validate API key before processing request
        if (!$this->validateApiKey()) {
            return;
        }

        try {
            $keywords = $this->fetchAndProcessCGIKeywords();

            $jsonDir = __DIR__ . '/../../../json/thesauri/';
            if (!file_exists($jsonDir)) {
                mkdir($jsonDir, 0755, true);
            }

            $result = file_put_contents(
                $jsonDir . 'cgi.json',
                json_encode($keywords, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

            if ($result === false) {
                throw new Exception('Error saving JSON file: ' . error_get_last()['message']);
            }

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'CGI keywords successfully updated',
                'timestamp' => date('c')
            ]);

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
     * Retrieves roles from the database based on the specified type and returns them as JSON.
     *
     * @param array $vars An associative array of parameters.
     * @return void
     */
    public function getRoles($vars)
    {
        global $connection;
        $type = $vars['type'] ?? $_GET['type'] ?? 'all';

        // SQL query based on the type
        if ($type == 'all') {
            $sql = 'SELECT * FROM Role';
        } elseif ($type == 'person') {
            $sql = 'SELECT * FROM Role WHERE forInstitutions = 0';
        } elseif ($type == 'institution') {
            $sql = 'SELECT * FROM Role WHERE forInstitutions = 1';
        } elseif ($type == 'both') {
            $sql = 'SELECT * FROM Role WHERE forInstitutions = 2';
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid roles type specified']);
            return;
        }

        if ($stmt = $connection->prepare($sql)) {
            $stmt->execute();
            $result = $stmt->get_result();
            $rolesList = $result->fetch_all(MYSQLI_ASSOC);

            if ($rolesList) {
                header('Content-Type: application/json');
                echo json_encode($rolesList);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'No roles found']);
            }

            $stmt->close();
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $connection->error]);
        }
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
     * Fetches RDF data from NASA GCMD API with pagination support
     *
     * @param string $conceptScheme The concept scheme to fetch (instruments, sciencekeywords, platforms)
     * @param int $pageNum The page number for pagination
     * @param int $pageSize The number of items per page
     * @return string The raw RDF data response
     * @throws Exception If the HTTP request fails
     */
    private function fetchRdfData($conceptScheme, $pageNum, $pageSize)
    {
        $url = "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/{$conceptScheme}?format=rdf&page_num={$pageNum}&page_size={$pageSize}";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("Error fetching thesaurus keywords. HTTP status code: {$httpCode}");
        }

        return $response;
    }

    /**
     * Recursively sorts children nodes alphabetically by their text property
     *
     * @param array &$nodes Reference to the array of nodes to sort
     * @return void
     */
    private function sortChildrenRecursively(&$nodes)
    {
        foreach ($nodes as &$node) {
            if (!empty($node['children'])) {
                usort($node['children'], function ($a, $b) {
                    return strcasecmp($a['text'], $b['text']);
                });
                $this->sortChildrenRecursively($node['children']);
            }
        }
    }

    /**
     * Builds a hierarchical structure from RDF graph data
     * Filters out "NOT APPLICABLE" entries and includes alternative labels
     *
     * @param Graph $graph The RDF graph object containing concept data
     * @param string $conceptScheme The concept scheme identifier
     * @param string $schemeName The human-readable name of the scheme
     * @return array The hierarchical structure of concepts
     */
    private function buildHierarchy($graph, $conceptScheme, $schemeName)
    {
        $hierarchy = [];
        $concepts = $graph->allOfType('skos:Concept');
        $conceptMap = [];

        $schemeURI = "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/{$conceptScheme}";

        // Create concept map without "NOT APPLICABLE" entries
        foreach ($concepts as $concept) {
            $uri = $concept->getUri();
            $label = $concept->getLiteral('skos:prefLabel') ? $concept->getLiteral('skos:prefLabel')->getValue() : '';

            // Skip concepts with "NOT APPLICABLE" label
            if ($label === 'NOT APPLICABLE') {
                continue;
            }

            $lang = $concept->getLiteral('skos:prefLabel') ? $concept->getLiteral('skos:prefLabel')->getLang() : '';
            $description = $concept->getLiteral('skos:definition', 'en') ?
                $concept->getLiteral('skos:definition', 'en')->getValue() : '';

            // Add optional alternative labels
            $altLabels = [];
            foreach ($concept->allResources('skos:altLabel') as $altLabel) {
                $altLabels[] = $altLabel->getValue();
            }

            // Append alternative labels to description if present
            if (!empty($altLabels)) {
                $description .= "\nAlternative labels: " . implode(', ', $altLabels);
            }

            $conceptMap[$uri] = [
                'id' => $uri,
                'text' => $label,
                'language' => $lang,
                'scheme' => $schemeName,
                'schemeURI' => $schemeURI,
                'description' => $description,
                'children' => []
            ];
        }

        // Build hierarchy
        foreach ($concepts as $concept) {
            $uri = $concept->getUri();

            // Skip if concept is not in map (was "NOT APPLICABLE")
            if (!isset($conceptMap[$uri])) {
                continue;
            }

            $broader = $concept->getResource('skos:broader');
            if ($broader) {
                $broaderUri = $broader->getUri();
                // Check if parent concept exists
                if (isset($conceptMap[$broaderUri])) {
                    $conceptMap[$broaderUri]['children'][] = &$conceptMap[$uri];
                } else {
                    // If parent concept was "NOT APPLICABLE",
                    // add this concept to root level
                    $hierarchy[] = &$conceptMap[$uri];
                }
            } else {
                $hierarchy[] = &$conceptMap[$uri];
            }
        }

        // Sort concepts alphabetically
        usort($hierarchy, function ($a, $b) {
            return strcasecmp($a['text'], $b['text']);
        });

        // Sort children recursively
        $this->sortChildrenRecursively($hierarchy);

        return $hierarchy;
    }

    /**
     * Processes GCMD keywords for a specific concept scheme
     * Fetches data paginated, builds hierarchy, and saves to JSON file
     *
     * @param string $conceptScheme The concept scheme to process
     * @param string $schemeName The name of the scheme
     * @param string $outputFile The path to the output JSON file
     * @return bool True if successful, false otherwise
     * @throws Exception If data fetching or processing fails
     */
    private function processGcmdKeywords($conceptScheme, $schemeName, $outputFile)
    {
        $pageNum = 1;
        $pageSize = 2000;
        $graph = new Graph();

        while (true) {
            try {
                $data = $this->fetchRdfData($conceptScheme, $pageNum, $pageSize);
                $tempGraph = new Graph();
                $tempGraph->parse($data, 'rdf');

                foreach ($tempGraph->resources() as $resource) {
                    foreach ($tempGraph->properties($resource) as $property) {
                        foreach ($tempGraph->all($resource, $property) as $value) {
                            $graph->add($resource, $property, $value);
                        }
                    }
                }

                if (strpos($data, '<skos:Concept') === false) {
                    break;
                }
                $pageNum++;
            } catch (Exception $e) {
                if ($pageNum == 1) {
                    throw $e;
                }
                break;
            }
        }

        $hierarchicalData = $this->buildHierarchy($graph, $conceptScheme, $schemeName);
        $dataWithTimestamp = $this->addTimestampToData($hierarchicalData);
        file_put_contents($outputFile, json_encode($dataWithTimestamp, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return true;
    }

    /**
     * Updates all GCMD vocabularies (Science Keywords, Instruments, and Platforms)
     * Downloads latest versions from NASA's GCMD repository and saves them as JSON files
     *
     * @return void
     * @throws Exception If the update process fails
     */
    public function updateGcmdVocabs()
    {
        // Validate API key before processing request
        if (!$this->validateApiKey()) {
            return;
        }
        // Temporarily adjust error reporting
        $originalErrorReporting = error_reporting();
        error_reporting(E_ALL & ~E_DEPRECATED);

        try {
            $jsonDir = __DIR__ . '/../../../json/thesauri/';
            if (!file_exists($jsonDir)) {
                mkdir($jsonDir, 0755, true);
            }

            $conceptSchemes = [
                [
                    'scheme' => 'instruments',
                    'name' => 'NASA/GCMD Instruments',
                    'output' => $jsonDir . 'gcmdInstrumentsKeywords.json'
                ],
                [
                    'scheme' => 'sciencekeywords',
                    'name' => 'NASA/GCMD Earth Science Keywords',
                    'output' => $jsonDir . 'gcmdScienceKeywords.json'
                ],
                [
                    'scheme' => 'platforms',
                    'name' => 'NASA/GCMD Earth Platforms Keywords',
                    'output' => $jsonDir . 'gcmdPlatformsKeywords.json'
                ]
            ];

            $results = [];
            foreach ($conceptSchemes as $scheme) {
                try {
                    $success = $this->processGcmdKeywords(
                        $scheme['scheme'],
                        $scheme['name'],
                        $scheme['output']
                    );
                    $results[$scheme['scheme']] = $success ? 'Updated successfully' : 'Update failed';
                } catch (Exception $e) {
                    $results[$scheme['scheme']] = 'Error: ' . $e->getMessage();
                }
            }

            // Reset error reporting
            error_reporting($originalErrorReporting);

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'GCMD vocabularies update completed',
                'results' => $results,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

        } catch (Exception $e) {
            // Reset error reporting
            error_reporting($originalErrorReporting);

            http_response_code(500);
            echo json_encode([
                'error' => $e->getMessage()
            ]);
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
     * @return array An array containing:
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
     * @return array Parsed affiliations data
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
     * @param array $affiliations The affiliations data
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
     * @param array $affiliations The processed affiliations
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
                throw new Exception("Failed to prepare statement: " . connection->error);
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
                throw new Exception("Failed to prepare statement: " . connection->error);
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
     * Retrieves all resource types from the database
     *
     * @return void Outputs JSON response directly
     */
    public function getResourceTypes(): void
    {
        try {
            global $connection;
            $stmt = $connection->prepare('SELECT resource_name_id as id, resource_type_general, description FROM Resource_Type ORDER BY resource_type_general');

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
            error_log("API Error in getResourceTypes: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves all languages from the database
     *
     * @return void Outputs JSON response directly
     */
    public function getLanguages(): void
    {
        try {
            global $connection;
            $stmt = $connection->prepare('SELECT language_id as id, code, name FROM Language ORDER BY name');

            if (!$stmt) {
                throw new Exception("Failed to prepare statement: " . $connection->error);
            }

            $stmt->execute();
            $result = $stmt->get_result();

            $languages = [];
            while ($row = $result->fetch_assoc()) {
                $languages[] = $row;
            }

            header('Content-Type: application/json');
            echo json_encode($languages);

        } catch (Exception $e) {
            error_log("API Error in getLanguages: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Retrieves all title types from the database
     *
     * @return void Outputs JSON response directly
     */
    public function getTitleTypes(): void
    {
        try {
            global $connection;
            $stmt = $connection->prepare('SELECT title_type_id as id, name FROM Title_Type ORDER BY name');

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
            error_log("API Error in getTitleTypes: " . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
