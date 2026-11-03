<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;

require_once __DIR__ . '/DatabaseTestCase.php';
if (!defined('UNIT_TESTING')) { define('UNIT_TESTING', true); }
if (!defined('ERNIE_SERVICE_TEST_MODE')) { define('ERNIE_SERVICE_TEST_MODE', true); }
require_once __DIR__ . '/../api/v2/services/ErnieService.php';
require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

class LicenseApiErnieService extends \ErnieService
{
    public array $snapshot = [];
    public ?string $requestedScope = null;

    public function getLicensesWithCache(?string $resourceTypeSlug = null): array
    {
        $this->requestedScope = $resourceTypeSlug;
        return $this->snapshot;
    }
}

#[CoversClass(\VocabController::class)]
final class LicenseApiTest extends DatabaseTestCase
{
    private LicenseApiErnieService $service;
    private \VocabController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['mslVocabsUrl'] = '';
        $this->service = new LicenseApiErnieService();
        $this->controller = new \VocabController();
        (new \ReflectionProperty($this->controller, 'ernieService'))->setValue($this->controller, $this->service);
        $this->service->snapshot = ['licenses' => \LicenseService::decodeLicenses(
            file_get_contents(__DIR__ . '/fixtures/ernie-licenses/dataset-elmo.json')),
            'availability' => 'available', 'source' => 'cache', 'lastUpdated' => '2026-10-27T08:00:00Z'];
        http_response_code(200);
    }

    private function request(string $method, array $vars = []): array
    {
        ob_start();
        try {
            $this->controller->{$method}($vars);
            return json_decode(ob_get_contents(), true, 512, JSON_THROW_ON_ERROR);
        } finally {
            ob_end_clean();
        }
    }

    public function testResourceTypeIdResolvesOnServerAndMetadataGetsLocalIds(): void
    {
        $id = $this->connection->query("SELECT resource_name_id FROM Resource_Type WHERE resource_type_general = 'Dataset'")->fetch_assoc()['resource_name_id'];
        $body = $this->request('getResourceTypeLicenses', ['resourceTypeId' => $id]);
        self::assertSame(200, http_response_code());
        self::assertSame('dataset', $this->service->requestedScope);
        self::assertSame('available', $body['availability']);
        self::assertNotSame($body['licenses'][0]['ernie_id'], $body['licenses'][0]['rights_id']);
        self::assertArrayHasKey('schemeURI', $body['licenses'][0]);
        self::assertArrayNotHasKey('mapping_key', $body['licenses'][0]);
    }

    public function testLegacyAdaptersUseErnieInsteadOfSeedRows(): void
    {
        $all = $this->request('getAllLicenses');
        self::assertCount(2, $all);
        self::assertNull($this->service->requestedScope);
        self::assertSame($all, $this->request('getSoftwareLicenses'));
        self::assertSame('software', $this->service->requestedScope);
    }

    public function testEmptyGrantIs200AndUnavailableIs503WithoutDatabaseFallback(): void
    {
        $this->service->snapshot['licenses'] = [];
        $this->service->snapshot['availability'] = 'empty';
        self::assertSame([], $this->request('getAllLicenses'));
        self::assertSame(200, http_response_code());
        $this->service->snapshot['availability'] = 'unavailable';
        $body = $this->request('getAllLicenses');
        self::assertSame(503, http_response_code());
        self::assertSame([], $body['licenses']);
    }

    public function testMalformedAndUnknownLocalIdsAreRejected(): void
    {
        foreach (['dataset', '../1', '0', '1x'] as $id) {
            $this->request('getResourceTypeLicenses', ['resourceTypeId' => $id]);
            self::assertSame(400, http_response_code());
        }
        $this->request('getResourceTypeLicenses', ['resourceTypeId' => '999999']);
        self::assertSame(404, http_response_code());
    }
}
