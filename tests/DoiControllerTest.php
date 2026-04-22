<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

if (!defined('UNIT_TESTING')) {
    define('UNIT_TESTING', true);
}
require_once __DIR__ . '/../api/v2/controllers/DoiController.php';

/**
 * Tests for DoiController — DOI lookup and contact person resolution.
 */
#[CoversClass(\DoiController::class)]
final class DoiControllerTest extends TestCase
{
    /**
     * Creates a DoiController stub with fetchFromDataCite overridden.
     *
     * @param array{httpCode: int, body: string}|null $fetchReturn
     */
    private function createControllerWithMockedFetch(?array $fetchReturn): \DoiController
    {
        $stub = $this->getMockBuilder(\DoiController::class)
            ->onlyMethods(['fetchFromDataCite'])
            ->getMock();

        $stub->method('fetchFromDataCite')
            ->willReturn($fetchReturn);

        return $stub;
    }

    /**
     * Returns a minimal valid DataCite response body JSON string.
     */
    private function sampleDataCiteResponse(): string
    {
        return json_encode([
            'data' => [
                'attributes' => [
                    'doi' => '10.14454/qdd3-ps68',
                    'titles' => [['title' => 'Sample Dataset']],
                    'creators' => [
                        [
                            'givenName' => 'Jane',
                            'familyName' => 'Doe',
                            'nameType' => 'Personal',
                            'nameIdentifiers' => [
                                ['nameIdentifier' => 'https://orcid.org/0000-0001-2345-6789', 'nameIdentifierScheme' => 'ORCID'],
                            ],
                            'affiliation' => [['name' => 'GFZ Potsdam']],
                        ],
                    ],
                    'contributors' => [],
                    'publicationYear' => 2024,
                    'types' => ['resourceTypeGeneral' => 'Dataset'],
                    'language' => 'en',
                    'version' => '1.0',
                    'descriptions' => [['descriptionType' => 'Abstract', 'description' => 'Test abstract']],
                    'dates' => [['dateType' => 'Created', 'date' => '2024-01-15']],
                    'geoLocations' => [],
                    'subjects' => [['subject' => 'Earth Science']],
                    'fundingReferences' => [],
                    'relatedIdentifiers' => [],
                    'rightsList' => [['rightsIdentifier' => 'CC-BY-4.0', 'rights' => 'Creative Commons Attribution 4.0']],
                    'formats' => ['CSV'],
                    'sizes' => ['5 MB'],
                    // Extra attribute that should be filtered out
                    'url' => 'https://doi.org/10.14454/qdd3-ps68',
                    'contentUrl' => ['https://example.org/data.csv'],
                ],
            ],
        ]);
    }

    /* ----- lookup() tests ----- */

    public function testLookupReturnsErrorForEmptyDoi(): void
    {
        $controller = $this->createControllerWithMockedFetch(null);
        ob_start();
        $controller->lookup(['doi' => '']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertSame('Invalid DOI format', $data['error']);
        $this->assertSame(400, http_response_code());
    }

    public function testLookupReturnsErrorForInvalidDoiFormat(): void
    {
        $controller = $this->createControllerWithMockedFetch(null);
        ob_start();
        $controller->lookup(['doi' => 'not-a-doi']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertSame('Invalid DOI format', $data['error']);
    }

    public function testLookupReturnsBadGatewayOnNetworkError(): void
    {
        $controller = $this->createControllerWithMockedFetch(null);
        ob_start();
        $controller->lookup(['doi' => '10.14454/qdd3-ps68']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertSame('Failed to reach DataCite API', $data['error']);
        $this->assertSame(502, http_response_code());
    }

    public function testLookupReturnsNotFoundForHttp404(): void
    {
        $controller = $this->createControllerWithMockedFetch([
            'httpCode' => 404,
            'body' => '{"errors":[{"status":"404"}]}',
        ]);

        ob_start();
        $controller->lookup(['doi' => '10.14454/nonexistent']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertFalse($data['found']);
        $this->assertSame(200, http_response_code());
    }

    public function testLookupReturnsBadGatewayOnServerError(): void
    {
        $controller = $this->createControllerWithMockedFetch([
            'httpCode' => 500,
            'body' => '{"error":"Internal"}',
        ]);

        ob_start();
        $controller->lookup(['doi' => '10.14454/qdd3-ps68']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertStringContainsString('500', $data['error']);
        $this->assertSame(502, http_response_code());
    }

    public function testLookupReturnsBadGatewayOnMalformedJson(): void
    {
        $controller = $this->createControllerWithMockedFetch([
            'httpCode' => 200,
            'body' => 'this is not json',
        ]);

        ob_start();
        $controller->lookup(['doi' => '10.14454/qdd3-ps68']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertStringContainsString('Unexpected', $data['error']);
    }

    public function testLookupReturnsBadGatewayWhenAttributesMissing(): void
    {
        $controller = $this->createControllerWithMockedFetch([
            'httpCode' => 200,
            'body' => json_encode(['data' => ['id' => '10.14454/qdd3-ps68']]),
        ]);

        ob_start();
        $controller->lookup(['doi' => '10.14454/qdd3-ps68']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertStringContainsString('Unexpected', $data['error']);
    }

    public function testLookupReturnsFilteredAttributesOnSuccess(): void
    {
        $controller = $this->createControllerWithMockedFetch([
            'httpCode' => 200,
            'body' => $this->sampleDataCiteResponse(),
        ]);

        ob_start();
        $controller->lookup(['doi' => '10.14454/qdd3-ps68']);
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertTrue($data['found']);
        $this->assertArrayHasKey('attributes', $data);

        $attrs = $data['attributes'];
        // Expected attributes are present
        $this->assertSame('10.14454/qdd3-ps68', $attrs['doi']);
        $this->assertSame('Sample Dataset', $attrs['titles'][0]['title']);
        $this->assertSame('Doe', $attrs['creators'][0]['familyName']);
        $this->assertSame(2024, $attrs['publicationYear']);
        $this->assertSame('en', $attrs['language']);
        $this->assertSame('1.0', $attrs['version']);

        // Filtered-out attributes are absent
        $this->assertArrayNotHasKey('url', $attrs);
        $this->assertArrayNotHasKey('contentUrl', $attrs);
    }

    public function testLookupPreservesAllExpectedKeys(): void
    {
        $controller = $this->createControllerWithMockedFetch([
            'httpCode' => 200,
            'body' => $this->sampleDataCiteResponse(),
        ]);

        ob_start();
        $controller->lookup(['doi' => '10.14454/qdd3-ps68']);
        $output = ob_get_clean();

        $attrs = json_decode($output, true)['attributes'];

        $expectedKeys = [
            'doi', 'titles', 'creators', 'contributors', 'publicationYear',
            'types', 'language', 'version', 'descriptions', 'dates',
            'geoLocations', 'subjects', 'fundingReferences', 'relatedIdentifiers',
            'rightsList', 'formats', 'sizes',
        ];

        foreach ($expectedKeys as $key) {
            $this->assertArrayHasKey($key, $attrs, "Missing key: $key");
        }
    }

    /* ----- contacts() tests ----- */

    public function testContactsReturnsNullsWithoutDatabase(): void
    {
        // DoiController with no DB connection (default in test env)
        $controller = new \DoiController();

        ob_start();
        $controller->contacts();
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertNull($data['email']);
        $this->assertNull($data['website']);
    }
}
