<?php
/**
 * Controller for DOI lookup via the DataCite REST API.
 *
 * Provides a server-side proxy to query DataCite for existing DOI metadata,
 * avoiding CORS issues and enabling future caching.
 */

if (!defined('UNIT_TESTING')) {
    require_once __DIR__ . '/../../../settings.php';
}

class DoiController
{
    /** @var string Base URL of the DataCite REST API */
    private string $dataciteApiUrl;

    /** @var int cURL timeout in seconds */
    private int $timeout;

    public function __construct()
    {
        $this->dataciteApiUrl = 'https://api.datacite.org/dois/';
        $this->timeout = 10;
    }

    /**
     * Looks up DOI metadata from the DataCite REST API.
     *
     * GET /api/v2/doi/lookup/{doi}
     *
     * The {doi} route parameter contains the full DOI including the slash
     * (e.g. "10.14454/qdd3-ps68"). FastRoute captures it with the `.+` pattern.
     *
     * @param array<mixed> $vars Route variables (expects 'doi').
     * @param array<mixed>|null $body Unused.
     * @return void Outputs JSON response.
     */
    public function lookup(array $vars = [], ?array $body = null): void
    {
        $doi = trim($vars['doi'] ?? '');
        try {
            $this->respond(200, $this->lookupPublicDoi($doi));
        } catch (InvalidArgumentException $error) {
            $this->respond(400, ['error' => $error->getMessage()]);
        } catch (RuntimeException $error) {
            $this->respond(502, ['error' => $error->getMessage()]);
        }
    }

    /**
     * Fetch filtered public DataCite metadata for both the API and submission check.
     *
     * @throws InvalidArgumentException When the DOI format is invalid.
     * @throws RuntimeException When DataCite cannot return a usable response.
     * @return array{found: bool, attributes?: array<string, mixed>}
     */
    public function lookupPublicDoi(string $doi): array
    {
        $doi = trim($doi);
        if ($doi === '' || !$this->isValidDoi($doi)) {
            throw new InvalidArgumentException('Invalid DOI format');
        }
        $result = $this->fetchFromDataCite($this->dataciteApiUrl . rawurlencode($doi) . '?affiliation=true');
        if ($result === null) throw new RuntimeException('Failed to reach DataCite API');
        if ($result['httpCode'] === 404) return ['found' => false];
        if ($result['httpCode'] < 200 || $result['httpCode'] >= 300) {
            throw new RuntimeException('DataCite API returned status ' . $result['httpCode']);
        }
        $decoded = json_decode($result['body'], true);
        if (!is_array($decoded) || !isset($decoded['data']['attributes'])) {
            throw new RuntimeException('Unexpected DataCite API response');
        }
        return ['found' => true, 'attributes' => $this->filterAttributes($decoded['data']['attributes'])];
    }

    /**
     * Validates a DOI string against the standard pattern.
     */
    private function isValidDoi(string $doi): bool
    {
        return (bool) preg_match('/^10\.\d{4,9}\/.+$/', $doi);
    }

    /**
     * Performs the HTTP GET request to the DataCite API.
     *
     * @return array{httpCode: int, body: string}|null Null on network error.
     */
    protected function fetchFromDataCite(string $url): ?array
    {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
            ],
        ]);

        $responseBody = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        if ($responseBody === false || $error !== '') {
            return null;
        }

        return ['httpCode' => $httpCode, 'body' => $responseBody];
    }

    /**
     * Keeps only the attributes relevant for the ELMO form prefill.
     *
     * @param array<mixed> $attributes Raw DataCite attributes.
     * @return array<mixed> Filtered attributes.
     */
    private function filterAttributes(array $attributes): array
    {
        $keep = [
            'doi',
            'titles',
            'creators',
            'contributors',
            'publicationYear',
            'types',
            'language',
            'version',
            'descriptions',
            'dates',
            'geoLocations',
            'subjects',
            'fundingReferences',
            'relatedIdentifiers',
            'rightsList',
            'formats',
            'sizes',
        ];

        $filtered = [];
        foreach ($keep as $key) {
            if (array_key_exists($key, $attributes)) {
                $filtered[$key] = $attributes[$key];
            }
        }

        return $filtered;
    }

    /**
     * Sends a JSON response with the given HTTP status code.
     *
     * @param int $status HTTP status code.
     * @param array<string, mixed>|null $payload Data to encode as JSON.
     */
    private function respond(int $status, ?array $payload): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        if ($payload === null) {
            return;
        }

        echo json_encode($payload);
    }
}
