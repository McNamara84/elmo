<?php
/**
 * Controller for DOI lookup via the DataCite REST API.
 *
 * Provides a server-side proxy to query DataCite for existing DOI metadata,
 * avoiding CORS issues and enabling future caching. Also exposes a contact
 * lookup endpoint that resolves email / website from the local Contact_Person
 * table (best-effort, since DataCite does not store these fields).
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

    /** @var mysqli|null Database connection for contact lookup */
    private ?mysqli $connection;

    public function __construct()
    {
        $this->dataciteApiUrl = 'https://api.datacite.org/dois/';
        $this->timeout = 10;

        global $connection;
        $this->connection = $connection ?? null;
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

        if ($doi === '' || !$this->isValidDoi($doi)) {
            $this->respond(400, ['error' => 'Invalid DOI format']);
            return;
        }

        $url = $this->dataciteApiUrl . rawurlencode($doi) . '?affiliation=true';

        $result = $this->fetchFromDataCite($url);

        if ($result === null) {
            $this->respond(502, ['error' => 'Failed to reach DataCite API']);
            return;
        }

        if ($result['httpCode'] === 404) {
            $this->respond(200, ['found' => false]);
            return;
        }

        if ($result['httpCode'] < 200 || $result['httpCode'] >= 300) {
            $this->respond(502, ['error' => 'DataCite API returned status ' . $result['httpCode']]);
            return;
        }

        $decoded = json_decode($result['body'], true);
        if (!is_array($decoded) || !isset($decoded['data']['attributes'])) {
            $this->respond(502, ['error' => 'Unexpected DataCite API response']);
            return;
        }

        $attributes = $decoded['data']['attributes'];

        $this->respond(200, [
            'found' => true,
            'attributes' => $this->filterAttributes($attributes),
        ]);
    }

    /**
     * Searches the local Contact_Person table for email/website by ORCID or name.
     *
     * GET /api/v2/doi/contacts?orcid=...&familyname=...&givenname=...
     *
     * Priority: exact ORCID match, then exact name match (case-insensitive).
     *
     * @param array<mixed> $vars Unused route variables.
     * @param array<mixed>|null $body Unused.
     * @return void Outputs JSON response.
     */
    public function contacts(array $vars = [], ?array $body = null): void
    {
        if (!$this->connection) {
            $this->respond(200, ['email' => null, 'website' => null]);
            return;
        }

        $orcid = trim($_GET['orcid'] ?? '');
        $familyname = trim($_GET['familyname'] ?? '');
        $givenname = trim($_GET['givenname'] ?? '');

        // Try ORCID first
        if ($orcid !== '') {
            $result = $this->findContactByOrcid($orcid);
            if ($result !== null) {
                $this->respond(200, $result);
                return;
            }
        }

        // Fallback to name match
        if ($familyname !== '' && $givenname !== '') {
            $result = $this->findContactByName($familyname, $givenname);
            if ($result !== null) {
                $this->respond(200, $result);
                return;
            }
        }

        $this->respond(200, ['email' => null, 'website' => null]);
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
        curl_close($ch);

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
     * Finds a contact person by ORCID.
     *
     * @return array{email: string|null, website: string|null}|null
     */
    private function findContactByOrcid(string $orcid): ?array
    {
        $stmt = $this->connection->prepare(
            'SELECT email, website FROM Contact_Person WHERE orcid = ? LIMIT 1'
        );
        if (!$stmt) {
            return null;
        }
        $stmt->bind_param('s', $orcid);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();

        if (!$row) {
            return null;
        }

        return [
            'email' => $row['email'] ?: null,
            'website' => $row['website'] ?: null,
        ];
    }

    /**
     * Finds a contact person by family name and given name (case-insensitive).
     *
     * @return array{email: string|null, website: string|null}|null
     */
    private function findContactByName(string $familyname, string $givenname): ?array
    {
        $stmt = $this->connection->prepare(
            'SELECT email, website FROM Contact_Person WHERE LOWER(familyname) = LOWER(?) AND LOWER(givenname) = LOWER(?) LIMIT 1'
        );
        if (!$stmt) {
            return null;
        }
        $stmt->bind_param('ss', $familyname, $givenname);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();

        if (!$row) {
            return null;
        }

        return [
            'email' => $row['email'] ?: null,
            'website' => $row['website'] ?: null,
        ];
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

        if ($payload === null) {
            return;
        }

        echo json_encode($payload);
    }
}
