<?php

declare(strict_types=1);

namespace Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Exception;

/**
 * Test class for the API endpoints
 */
final class ApiTest extends DatabaseTestCase
{
    /**
     * @var Client HTTP client instance
     */
    private $client;

    /**
     * @var string Base URI for API requests
     */
    private $baseUri;

    /**
     * @var string Project directory name
     */
    private $projectPath;

    private const API_KEY = '1234-1234-1234-1234';

    /**
     * {@inheritdoc}
     *
     * Initializes the database (via DatabaseTestCase) and the HTTP client
     * for testing the API endpoints.
     *
     * @return void
     */
    protected function setUp(): void
    {
        // Database setup from DatabaseTestCase first
        parent::setUp();

        $this->baseUri = rtrim((string) (getenv('API_BASE_URL') ?: 'http://localhost:8080'), '/');

        $this->projectPath = '';

        $this->client = new Client([
            'base_uri' => $this->baseUri ?: '',
            'http_errors' => false,
            'cookies' => true,
            'headers' => [
                'Accept' => 'application/json',
                'X-API-KEY' => self::API_KEY,
            ],
        ]);
    }


    /**
     * Constructs the full API URL for a given endpoint
     *
     * @param string $endpoint The API endpoint path
     * @return string The complete API URL
     */
    private function getApiUrl($endpoint): string
    {
        if (getenv('API_BASE_URL')) {
            return '/api/v2/' . ltrim($endpoint, '/');
        }
        $path = trim($this->projectPath . '/api/v2/' . ltrim($endpoint, '/'), '/');
        return "/{$path}";
    }

    /**
     * Tests the health check endpoint
     *
     * @return void
     * @throws Exception
     */
    public function testHealthCheckShouldReturnAliveMessage(): void
    {
        $endpointUrl = $this->getApiUrl('general/alive');
        echo "\nTesting endpoint: " . $this->baseUri . $endpointUrl;

        try {
            $response = $this->client->get($endpointUrl);

            echo "\nResponse Status: " . $response->getStatusCode();
            echo "\nResponse Body: " . $response->getBody();

            $this->assertEquals(
                200,
                $response->getStatusCode(),
                'Expected status code 200. Response: ' . $response->getBody()
            );

            $data = json_decode((string) $response->getBody(), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->fail('Failed to parse JSON response: ' . json_last_error_msg());
            }

            $this->assertArrayHasKey('message', $data, 'Response body should contain a "message" key.');
            $this->assertEquals("I'm still alive...", $data['message'], 'Expected message does not match.');
        } catch (Exception $e) {
            echo "\nException: " . get_class($e);
            echo "\nMessage: " . $e->getMessage();
            if ($e instanceof \GuzzleHttp\Exception\RequestException && $e->hasResponse()) {
                $response = $e->getResponse();
                echo "\nResponse Status: " . $response->getStatusCode();
                echo "\nResponse Body: " . $response->getBody();
            }
            throw $e;
        }
    }

    /**
     * Tests the endpoint for retrieving all licenses
     *
     * @return void
     * @throws Exception
     */
    public function testGetAllLicensesShouldReturnLicenseList(): void
    {
        $endpointUrl = $this->getApiUrl('vocabs/licenses/all');
        echo "\nTesting endpoint: " . $this->baseUri . $endpointUrl;

        try {
            echo "\nSending GET request to: " . $endpointUrl;

            $response = $this->client->get($endpointUrl);

            echo "\nResponse Status: " . $response->getStatusCode();
            echo "\nResponse Headers: " . json_encode($response->getHeaders());
            echo "\nResponse Body: " . $response->getBody();

            $this->assertEquals(
                200,
                $response->getStatusCode(),
                'Expected status code 200. Full response: ' . $response->getBody() .
                "\nEndpoint: " . $endpointUrl
            );

            $data = json_decode((string) $response->getBody(), true);
            $this->assertIsArray($data, 'Response should be an array');
            $this->assertNotEmpty($data, 'Response should not be empty');

            $firstLicense = $data[0];
            $this->assertArrayHasKey('rightsIdentifier', $firstLicense);
            $this->assertArrayHasKey('text', $firstLicense);
        } catch (Exception $e) {
            echo "\nException occurred while testing " . $endpointUrl;
            throw $e;
        }
    }

    /**
     * Tests the endpoint for retrieving software licenses
     *
     * @return void
     * @throws Exception
     */
    public function testGetSoftwareLicensesShouldReturnSoftwareLicenseList(): void
    {
        $endpointUrl = $this->getApiUrl('vocabs/licenses/software');
        echo "\nTesting endpoint: " . $this->baseUri . $endpointUrl;

        try {
            $response = $this->client->get($endpointUrl);

            echo "\nResponse Status: " . $response->getStatusCode();
            echo "\nResponse Body: " . $response->getBody();

            $this->assertEquals(
                200,
                $response->getStatusCode(),
                'Expected status code 200. Response: ' . $response->getBody()
            );

            $data = json_decode((string) $response->getBody(), true);
            $this->assertIsArray($data, 'Response should be an array');
            $this->assertNotEmpty($data, 'Response should not be empty');

            foreach ($data as $license) {
                $this->assertArrayHasKey('forSoftware', $license);
                $this->assertEquals(
                    '1',
                    $license['forSoftware'],
                    'All returned licenses should have forSoftware=1'
                );
            }
        } catch (Exception $e) {
            throw $e;
        }
    }

    /**
     * Vocabulary slugs written by POST /admin/cache/refresh and reported by GET /admin/cache/status.
     *
     * @var list<string>
     */
    private const ERNIE_CACHE_KEYS = [
        'resourceTypes',
        'titleTypes',
        'descriptionTypes',
        'languages',
        'contributorPersonRoles',
        'contributorInstitutionRoles',
        'relationTypes',
        'identifierTypes',
        'pid4instInstruments',
        'mslLabs',
        'gcmdScienceKeywords',
        'gcmdPlatforms',
        'gcmdInstruments',
        'chronostratTimescale',
        'gemet',
        'thesauriAvailability',
    ];

    /**
     * Rejects cache admin calls that omit the key or send a different one.
     */
    public function testAdminCacheEndpointsRejectInvalidApiKey(): void
    {
        foreach (['GET' => 'admin/cache/status', 'POST' => 'admin/cache/refresh'] as $method => $endpoint) {
            foreach ([null, 'not-the-key'] as $apiKey) {
                $response = $this->request($method, $endpoint, $apiKey);
                $data = $this->decodeJson($response);

                $this->assertSame(
                    401,
                    $response->getStatusCode(),
                    $method . ' ' . $endpoint . ' should reject an invalid API key. Body: ' . $response->getBody()
                );
                $this->assertSame('Invalid or missing API key', $data['error'] ?? null);
            }
        }
    }

    /**
     * GET /admin/cache/status returns one entry per vocabulary, including MSL laboratories.
     */
    public function testGetAllCacheStatusReturnsVocabularyMap(): void
    {
        $response = $this->request('GET', 'admin/cache/status', self::API_KEY);
        $data = $this->decodeJson($response);
        $statusCode = $response->getStatusCode();

        if ($statusCode === 400) {
            $this->assertNotConfigured($data);
            return;
        }

        $this->assertSame(200, $statusCode, 'Unexpected status body: ' . $response->getBody());
        $this->assertTrue($data['success'] ?? false);
        $this->assertIsArray($data['status'] ?? null);

        foreach (self::ERNIE_CACHE_KEYS as $key) {
            $this->assertArrayHasKey($key, $data['status'], "Status map should include {$key}");
            $entry = $data['status'][$key];
            $this->assertArrayHasKey('exists', $entry);
            $this->assertArrayHasKey('valid', $entry);
            $this->assertArrayHasKey('itemCount', $entry);
            $this->assertIsBool($entry['exists']);
            $this->assertIsBool($entry['valid']);
            $this->assertIsInt($entry['itemCount']);
        }
    }

    /**
     * POST /admin/cache/refresh reports every vocabulary, including a partial failure.
     */
    public function testRefreshAllCacheReportsEachVocabulary(): void
    {
        $response = $this->request('POST', 'admin/cache/refresh', self::API_KEY);
        $data = $this->decodeJson($response);
        $statusCode = $response->getStatusCode();

        if ($statusCode === 400) {
            $this->assertNotConfigured($data);
            return;
        }

        $this->assertContains(
            $statusCode,
            [200, 502],
            'Unexpected refresh body: ' . $response->getBody()
        );
        $this->assertSame($statusCode === 200, $data['success'] ?? null);
        $this->assertIsString($data['message'] ?? null);
        $this->assertIsArray($data['results'] ?? null);

        foreach (self::ERNIE_CACHE_KEYS as $key) {
            $this->assertArrayHasKey($key, $data['results'], "Refresh results should include {$key}");
            $this->assertIsBool($data['results'][$key]);
        }

        if ($statusCode === 502) {
            $this->assertIsArray($data['failed'] ?? null);
            $this->assertNotEmpty($data['failed']);
            foreach ($data['failed'] as $failedKey) {
                $this->assertContains($failedKey, self::ERNIE_CACHE_KEYS);
                $this->assertFalse($data['results'][$failedKey]);
            }
        }
    }

    /**
     * @param array<string, mixed> $data
     */
    private function assertNotConfigured(array $data): void
    {
        $this->assertFalse($data['success'] ?? true);
        $this->assertSame('ERNIE service is not configured', $data['message'] ?? null);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJson(\Psr\Http\Message\ResponseInterface $response): array
    {
        $data = json_decode((string) $response->getBody(), true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
            $this->fail('Failed to parse JSON response: ' . $response->getBody());
        }

        return $data;
    }

    private function request(string $method, string $endpoint, ?string $apiKey): \Psr\Http\Message\ResponseInterface
    {
        $headers = ['Accept' => 'application/json'];
        if ($apiKey !== null) {
            $headers['X-API-KEY'] = $apiKey;
        }

        $client = new Client([
            'base_uri' => $this->baseUri,
            'http_errors' => false,
            'headers' => $headers,
        ]);

        return $client->request($method, $this->getApiUrl($endpoint));
    }

    /**
     * Tests the full draft API lifecycle over HTTP with one session.
     *
     * @return void
     * @throws Exception
     */
    public function testDraftLifecycleEndpoints(): void
    {
        $createUrl = $this->getApiUrl('drafts');
        $createPayload = [
            'payload' => [
                'values' => [
                    'title' => 'Draft via API test'
                ],
                'timestamp' => '2026-03-12T10:00:00Z'
            ]
        ];

        $createResponse = $this->client->post($createUrl, [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode($createPayload)
        ]);

        $this->assertEquals(
            201,
            $createResponse->getStatusCode(),
            'Expected draft creation to return 201. Response: ' . $createResponse->getBody()
        );

        $created = json_decode((string) $createResponse->getBody(), true);
        $this->assertIsArray($created);
        $this->assertArrayHasKey('id', $created);
        $this->assertNotEmpty($created['id']);
        $this->assertArrayHasKey('updatedAt', $created);
        $this->assertArrayHasKey('checksum', $created);

        $draftId = $created['id'];

        $latestUrl = $this->getApiUrl('drafts/session/latest');
        $latestResponse = $this->client->get($latestUrl);
        $this->assertEquals(
            200,
            $latestResponse->getStatusCode(),
            'Expected latest draft endpoint to return 200. Response: ' . $latestResponse->getBody()
        );

        $latest = json_decode((string) $latestResponse->getBody(), true);
        $this->assertIsArray($latest);
        $this->assertSame($draftId, $latest['id']);
        $this->assertSame('Draft via API test', $latest['payload']['values']['title']);

        $getUrl = $this->getApiUrl('drafts/' . $draftId);
        $getResponse = $this->client->get($getUrl);
        $this->assertEquals(
            200,
            $getResponse->getStatusCode(),
            'Expected draft get endpoint to return 200. Response: ' . $getResponse->getBody()
        );

        $fetched = json_decode((string) $getResponse->getBody(), true);
        $this->assertIsArray($fetched);
        $this->assertSame($draftId, $fetched['id']);
        $this->assertSame('Draft via API test', $fetched['payload']['values']['title']);

        $updateUrl = $this->getApiUrl('drafts/' . $draftId);
        $updatePayload = [
            'payload' => [
                'values' => [
                    'title' => 'Updated draft via API test'
                ],
                'timestamp' => '2026-03-12T10:05:00Z'
            ]
        ];

        $updateResponse = $this->client->put($updateUrl, [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode($updatePayload)
        ]);

        $this->assertEquals(
            200,
            $updateResponse->getStatusCode(),
            'Expected draft update endpoint to return 200. Response: ' . $updateResponse->getBody()
        );

        $updated = json_decode((string) $updateResponse->getBody(), true);
        $this->assertIsArray($updated);
        $this->assertSame($draftId, $updated['id']);
        $this->assertArrayHasKey('updatedAt', $updated);

        $getUpdatedResponse = $this->client->get($getUrl);
        $this->assertEquals(200, $getUpdatedResponse->getStatusCode());
        $fetchedUpdated = json_decode((string) $getUpdatedResponse->getBody(), true);
        $this->assertSame('Updated draft via API test', $fetchedUpdated['payload']['values']['title']);

        $deleteUrl = $this->getApiUrl('drafts/' . $draftId);
        $deleteResponse = $this->client->delete($deleteUrl);
        $this->assertEquals(204, $deleteResponse->getStatusCode());

        $getDeletedResponse = $this->client->get($getUrl);
        $this->assertEquals(
            204,
            $getDeletedResponse->getStatusCode(),
            'Expected deleted draft to return 204. Response: ' . $getDeletedResponse->getBody()
        );
    }
}
