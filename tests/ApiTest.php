<?php
namespace Tests;

use PHPUnit\Framework\TestCase;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class ApiTest extends TestCase
{
    private $client;
    private $baseUri;
    private $projectPath;
    private $connection;
    private const API_KEY = '1234-1234-1234-1234';

    protected function setUp(): void
    {
        // Datenbankverbindung herstellen
        require_once __DIR__ . '/../settings.php';
        global $connection;
        if (!$connection) {
            $connection = connectDb();
        }
        $this->connection = $connection;

        // Überprüfen, ob die Testdatenbank verfügbar ist
        $dbname = 'mde2-msl-test';
        if ($this->connection->select_db($dbname) === false) {
            // Testdatenbank erstellen
            $connection->query("CREATE DATABASE " . $dbname);
            $connection->select_db($dbname);
            // install.php ausführen
            require __DIR__ . '/../install.php';
        }

        // HTTP Client Setup
        $this->projectPath = basename(dirname(__DIR__));
        $this->baseUri = getenv('API_BASE_URL') ?: 'http://localhost:8000';
        echo "\nUsing base URI: " . $this->baseUri;

        $this->client = new Client([
            'base_uri' => $this->baseUri,
            'timeout' => 5.0,
            'verify' => false,
            'http_errors' => false,
            'headers' => [
                'X-API-Key' => self::API_KEY
            ]
        ]);
    }

    protected function tearDown(): void
    {
        // Datenbank-Cleanup ist hier nicht nötig, da die Lizenzen zu den Stammdaten gehören
        // und nicht zwischen den Tests geändert werden
    }

    private function getApiUrl($endpoint): string
    {
        if (getenv('API_BASE_URL')) {
            return '/api/v2/' . ltrim($endpoint, '/');
        }
        $path = trim($this->projectPath . '/api/v2/' . ltrim($endpoint, '/'), '/');
        return "/{$path}";
    }

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

            $data = json_decode($response->getBody(), true);
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

            $data = json_decode($response->getBody(), true);
            $this->assertIsArray($data, 'Response should be an array');
            $this->assertNotEmpty($data, 'Response should not be empty');

            // Prüfen der Struktur des ersten Elements
            $firstLicense = $data[0];
            $this->assertArrayHasKey('rightsIdentifier', $firstLicense);
            $this->assertArrayHasKey('text', $firstLicense);
        } catch (Exception $e) {
            echo "\nException occurred while testing " . $endpointUrl;
            throw $e;
        }
    }

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

            $data = json_decode($response->getBody(), true);
            $this->assertIsArray($data, 'Response should be an array');
            $this->assertNotEmpty($data, 'Response should not be empty');

            // Prüfen ob alle zurückgegebenen Lizenzen forSoftware=1 haben
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

    public function testUpdateMslVocabShouldHandleErrors(): void
    {
        $endpointUrl = $this->getApiUrl('update/vocabs/msl');
        echo "\nTesting endpoint: " . $this->baseUri . $endpointUrl;

        try {
            $response = $this->client->get($endpointUrl);
            echo "\nResponse Status: " . $response->getStatusCode();
            echo "\nResponse Body: " . $response->getBody();

            $data = json_decode($response->getBody(), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->fail('Failed to parse JSON response: ' . json_last_error_msg());
            }

            // Überprüfen ob die Antwort entweder ein erfolgreicher Update ist ODER eine valide Fehlermeldung
            if ($response->getStatusCode() === 200) {
                // Success case
                $this->assertArrayHasKey('message', $data, 'Response should contain a message');
                $this->assertArrayHasKey('version', $data, 'Response should contain a version');
                $this->assertArrayHasKey('timestamp', $data, 'Response should contain a timestamp');

                $this->assertStringContainsString(
                    'Successfully updated MSL vocabularies',
                    $data['message'],
                    'Message should indicate successful update'
                );

                $this->assertMatchesRegularExpression(
                    '/^\d+\.\d+$/',
                    $data['version'],
                    'Version should be in format X.Y'
                );

                $this->assertMatchesRegularExpression(
                    '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/',
                    $data['timestamp'],
                    'Timestamp should be in format YYYY-MM-DD HH:mm:ss'
                );

            } else if ($response->getStatusCode() === 500) {
                // Error case
                $this->assertArrayHasKey('error', $data, 'Error response should contain an error message');
                $this->assertNotEmpty($data['error'], 'Error message should not be empty');

                // Spezifische Fehlermeldung prüfen
                $expectedErrors = [
                    "No vocabulary version found",
                    "Failed to download vocabulary data"
                ];
                $this->assertTrue(
                    in_array($data['error'], $expectedErrors),
                    'Error message should be one of the expected errors'
                );
            } else {
                $this->fail('Unexpected response status code: ' . $response->getStatusCode());
            }

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
}