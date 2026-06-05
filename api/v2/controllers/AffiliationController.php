<?php
/**
 * Controller for affiliation search functionality.
 * 
 * Provides server-side search for affiliations to avoid loading the full
 * 23MB affiliations.json file on the client side. This significantly improves
 * initial page load time.
 */
class AffiliationController
{
    /**
     * Cached affiliations data
     * 
     * @var array<int, array{name: string, ror?: string, other?: array<int, string>}>|null
     */
    private ?array $affiliationsData = null;

    /**
     * @var string Path to the affiliations JSON file
     */
    private string $cacheFile;

    /**
     * AffiliationController constructor.
     */
    public function __construct()
    {
        $this->cacheFile = __DIR__ . '/../../../json/affiliations.json';
    }

    /**
     * Loads affiliations data from JSON file.
     * Data is cached in memory for the duration of the request.
     *
     * @return array<int, array{name: string, ror?: string, other?: array<int, string>}>
     */
    private function loadData(): array
    {
        if ($this->affiliationsData === null) {
            if (!file_exists($this->cacheFile)) {
                $this->affiliationsData = [];
                return $this->affiliationsData;
            }

            $json = file_get_contents($this->cacheFile);
            if ($json === false) {
                $this->affiliationsData = [];
                return $this->affiliationsData;
            }

            $this->affiliationsData = json_decode($json, true) ?? [];
        }
        return $this->affiliationsData;
    }

    /**
     * Search affiliations by name or alternative names.
     * 
     * GET /api/v2/affiliations/search?q=searchterm&limit=20
     * 
     * Query Parameters:
     * - q (string): Search query (minimum 2 characters)
     * - limit (int): Maximum number of results (1-100, default: 20)
     * 
     * Results are prioritized:
     * 1. Exact matches
     * 2. Names starting with the query
     * 3. Names containing the query
     * 4. Alternative names containing the query
     *
     * @return void Outputs JSON response
     */
    public function search(): void
    {
        header('Content-Type: application/json');

        // Get and validate query parameter
        $query = trim($_GET['q'] ?? '');
        $limit = min(max((int)($_GET['limit'] ?? 20), 1), 100);

        // Require minimum query length
        if (mb_strlen($query) < 2) {
            echo json_encode([]);
            return;
        }

        $data = $this->loadData();
        
        if (empty($data)) {
            echo json_encode([]);
            return;
        }

        $queryLower = mb_strtolower($query);
        
        // Arrays to hold matches by priority
        $exactMatches = [];
        $startsWithMatches = [];
        $containsMatches = [];
        $altNameMatches = [];

        foreach ($data as $item) {
            // Skip items without a name (defensive check for malformed data)
            if (empty($item['name'])) {
                continue;
            }

            $nameLower = mb_strtolower($item['name']);

            // Check main name with priority ordering
            if ($nameLower === $queryLower) {
                // Exact match - highest priority
                $exactMatches[] = $item;
            } elseif (str_starts_with($nameLower, $queryLower)) {
                // Starts with - second priority
                $startsWithMatches[] = $item;
            } elseif (str_contains($nameLower, $queryLower)) {
                // Contains - third priority
                $containsMatches[] = $item;
            } else {
                // Check alternative names - lowest priority
                $others = $item['other'] ?? [];
                foreach ($others as $altName) {
                    $altLower = mb_strtolower($altName);
                    if (str_contains($altLower, $queryLower)) {
                        $altNameMatches[] = $item;
                        break; // Don't add same item multiple times
                    }
                }
            }

            // Early exit if we have more than enough results
            $totalFound = count($exactMatches) + count($startsWithMatches) 
                        + count($containsMatches) + count($altNameMatches);
            if ($totalFound >= $limit * 3) {
                break;
            }
        }

        // Merge results with priority ordering
        $results = array_merge(
            $exactMatches,
            $startsWithMatches,
            $containsMatches,
            $altNameMatches
        );

        // Limit results
        $results = array_slice($results, 0, $limit);

        echo json_encode($results);
    }
}
