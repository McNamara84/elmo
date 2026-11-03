<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;

require_once __DIR__ . '/DatabaseTestCase.php';
if (!defined('ERNIE_SERVICE_TEST_MODE')) { define('ERNIE_SERVICE_TEST_MODE', true); }
require_once __DIR__ . '/../api/v2/services/ErnieService.php';
require_once __DIR__ . '/../api/v2/services/LicenseService.php';

class SubmissionErnieService extends \ErnieService
{
    public array $licenses = [];
    public string $availability = 'available';
    public array $scopes = [];

    public function getLicensesWithCache(?string $resourceTypeSlug = null): array
    {
        $this->scopes[] = $resourceTypeSlug;
        return ['licenses' => $this->licenses, 'availability' => $this->availability];
    }
}

#[CoversClass(\LicenseService::class)]
final class LicenseSubmissionTest extends DatabaseTestCase
{
    private SubmissionErnieService $ernie;
    private array $globals = [];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['showGGMsProperties', 'showMslMode', 'showThesauri', 'showFreeKeywords',
            'showSpatialTemporalCoverage', 'showRelatedWork', 'showUsedInstruments', 'showFundingReference', 'showLicense', 'defaultLicense'] as $key) {
            $this->globals[$key] = $GLOBALS[$key] ?? null;
            $GLOBALS[$key] = false;
        }
        $GLOBALS['defaultLicense'] = null;
        $GLOBALS['showLicense'] = true;
        require_once __DIR__ . '/../includes/save_to_db_helper.php';
        $this->ernie = new SubmissionErnieService();
        $this->ernie->licenses = \LicenseService::decodeLicenses(file_get_contents(__DIR__ . '/fixtures/ernie-licenses/dataset-elmo.json'));
    }

    protected function tearDown(): void
    {
        foreach ($this->globals as $key => $value) { $GLOBALS[$key] = $value; }
        parent::tearDown();
    }

    private function post(?array $license = null): array
    {
        $type = $this->connection->query("SELECT resource_name_id FROM Resource_Type WHERE resource_type_general = 'Dataset'")->fetch_assoc()['resource_name_id'];
        return [
            'action' => 'save_and_download', 'year' => '2026', 'resourcetype' => $type, 'language' => '1',
            'title' => ['Submission test'], 'titleType' => ['1'], 'familynames' => ['Tester'], 'givennames' => ['Example'],
            'licensePayload' => json_encode(['version' => 1, 'license' => $license ?? $this->ernie->licenses[0]], JSON_THROW_ON_ERROR),
            'Rights' => '99999', 'licenseAllowed' => true, 'licenseImported' => false,
        ];
    }

    public function testValidSubmissionUsesCanonicalMetadataAndLocalIds(): void
    {
        $license = $this->ernie->licenses[0];
        $license['name'] = 'Forged browser name';
        $license['id'] = 123456;
        $prepared = \LicenseService::prepareSubmission($this->connection, $this->post($license), $this->ernie, true);
        self::assertSame($this->ernie->licenses[0]['name'], json_decode($prepared['licensePayload'], true)['license']['name']);
        self::assertNotSame(99999, $prepared['Rights']);
        self::assertSame(['dataset'], $this->ernie->scopes);
    }

    public function testForgedActionCannotBypassRevocationOrSaveAnyResource(): void
    {
        $post = $this->post();
        $this->ernie->licenses = [];
        $this->ernie->availability = 'empty';
        try {
            saveALL($post, submission: true, ernie: $this->ernie);
            self::fail('Revoked license was accepted.');
        } catch (\LicenseValidationException $error) {
            self::assertSame(422, $error->httpStatus);
        }
        self::assertSame(0, (int) $this->connection->query('SELECT COUNT(*) AS n FROM Resource')->fetch_assoc()['n']);
    }

    public function testOutageIs503AndDoesNotWriteDatasetOrMapping(): void
    {
        $post = $this->post();
        $count = $this->connection->query('SELECT COUNT(*) AS n FROM Rights')->fetch_assoc()['n'];
        $this->ernie->availability = 'unavailable';
        try {
            saveALL($post, submission: true, ernie: $this->ernie);
            self::fail('Unavailable grants were accepted.');
        } catch (\LicenseValidationException $error) {
            self::assertSame(503, $error->httpStatus);
        }
        self::assertSame($count, $this->connection->query('SELECT COUNT(*) AS n FROM Rights')->fetch_assoc()['n']);
        self::assertSame(0, (int) $this->connection->query('SELECT COUNT(*) AS n FROM Resource')->fetch_assoc()['n']);
    }

    public function testOtherTypeProfileOrTamperedUriIsRejected(): void
    {
        $original = $this->post();
        foreach (['software-elmo.json', 'dataset-elmo-msl.json', 'dataset-elmo-after-revocation.json'] as $fixture) {
            $this->ernie->licenses = \LicenseService::decodeLicenses(file_get_contents(__DIR__ . '/fixtures/ernie-licenses/' . $fixture));
            try {
                \LicenseService::prepareSubmission($this->connection, $original, $this->ernie, true);
                self::fail('Wrong scope was accepted.');
            } catch (\LicenseValidationException $error) {
                self::assertSame(422, $error->httpStatus);
            }
        }
        $license = $this->ernie->licenses[0];
        $license['uri'] = 'https://attacker.example/terms';
        $this->expectException(\LicenseValidationException::class);
        \LicenseService::prepareSubmission($this->connection, $this->post($license), $this->ernie, true);
    }

    public function testMissingAndMalformedPayloadsDoNotFallBackToDefaultOrFirstRow(): void
    {
        foreach (['{"version":1,"license":null}', '{broken', '{"version":2,"license":{}}'] as $payload) {
            $post = $this->post();
            $post['licensePayload'] = $payload;
            $post['Rights'] = 1;
            try {
                \LicenseService::prepareSubmission($this->connection, $post, $this->ernie, true, 'CC-BY-4.0');
                self::fail('Invalid payload was accepted.');
            } catch (\LicenseValidationException $error) {
                self::assertSame(422, $error->httpStatus);
            }
        }
    }

    public function testOptionalAutomaticLicenseOnlyAppliesWhenExplicitlyAllowed(): void
    {
        $post = $this->post();
        $post['licensePayload'] = '{"version":1,"license":null}';
        $prepared = \LicenseService::prepareSubmission($this->connection, $post, $this->ernie, false, 'CC-BY-4.0');
        self::assertNotNull($prepared['Rights']);
        $this->ernie->licenses = [];
        self::assertNull(\LicenseService::prepareSubmission($this->connection, $post, $this->ernie, false, 'CC-BY-4.0')['Rights']);
        $this->ernie->availability = 'unavailable';
        self::assertNull(\LicenseService::prepareSubmission($this->connection, $post, $this->ernie, false, 'CC-BY-4.0')['Rights']);
    }

    public function testDraftMaySaveInactiveMetadataDespitePostedSubmitAction(): void
    {
        $post = $this->post(['identifier' => 'old', 'name' => 'Retained terms', 'uri' => null]);
        $post['action'] = 'submit';
        $id = saveALL($post, submission: false, ernie: $this->ernie);
        self::assertGreaterThan(0, $id);
        self::assertSame([], $this->ernie->scopes);
        $row = $this->connection->query('SELECT r.text FROM Rights r JOIN Resource d ON d.Rights_rights_id=r.rights_id WHERE d.resource_id=' . $id)->fetch_assoc();
        self::assertSame('Retained terms', $row['text']);
    }
}
