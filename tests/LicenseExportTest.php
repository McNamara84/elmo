<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;

require_once __DIR__ . '/DatabaseTestCase.php';
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
require_once __DIR__ . '/../api/v2/services/LicenseService.php';

#[CoversClass(\LicenseService::class)]
#[CoversClass(\DatasetController::class)]
final class LicenseExportTest extends DatabaseTestCase
{
    private function save(?array $license): int
    {
        return saveResourceInformationAndRights($this->connection, [
            'action' => 'save_and_download', 'year' => '2026', 'resourcetype' => '3', 'language' => '1',
            'title' => ['License roundtrip'], 'titleType' => ['1'], 'Rights' => '999999',
            'licensePayload' => json_encode(['version' => 1, 'license' => $license], JSON_THROW_ON_ERROR),
        ]);
    }

    public function testCustomMetadataSurvivesMappingAndBothDataciteExportsWithoutInventedSpdx(): void
    {
        $license = ['name' => 'Custom <terms> & conditions', 'identifier' => 'Custom-4.0',
            'uri' => null, 'scheme_uri' => 'urn:example:terms', 'scheme_name' => 'Local terms'];
        $id = $this->save($license);
        $controller = new \DatasetController();
        $source = $controller->getResourceAsXml($this->connection, $id);
        self::assertStringNotContainsString('mapping_key', $source);
        $sourceDocument = new \DOMDocument();
        $sourceDocument->loadXML($source);
        self::assertSame(0, (new \DOMXPath($sourceDocument))->query('/Resource/Rights/ernie_id')->length);
        self::assertStringNotContainsString('forSoftware', $source);
        foreach (['46', '47'] as $version) {
            $xml = new \DOMDocument();
            $xml->loadXML($source);
            $stylesheet = new \DOMDocument();
            $stylesheet->load(__DIR__ . '/../schemas/XSLT/MappingMapToDataCiteSchema' . $version . '.xslt');
            $processor = new \XSLTProcessor();
            $processor->importStylesheet($stylesheet);
            $output = $processor->transformToDoc($xml);
            $rights = (new \DOMXPath($output))->query('//*[local-name()="rights"]')->item(0);
            self::assertSame($license['name'], $rights->textContent);
            self::assertSame('Custom-4.0', $rights->getAttribute('rightsIdentifier'));
            self::assertFalse($rights->hasAttribute('rightsURI'));
            self::assertSame('urn:example:terms', $rights->getAttribute('schemeURI'));
            self::assertSame('Local terms', $rights->getAttribute('rightsIdentifierScheme'));
            $json = (new \DataCiteJsonLdService())->convertXmlStringToArray($output->saveXML());
            self::assertSame('Custom-4.0', $json['rightsList']['rights']['attrs']['rightsIdentifier']);
            self::assertArrayNotHasKey('rightsURI', $json['rightsList']['rights']['attrs']);
        }
        $iso = $controller->transformResourceXmlString($source, 'iso');
        self::assertStringContainsString('Custom &lt;terms&gt; &amp; conditions', $iso);
    }

    public function testEmptyDraftHasNoInventedRights(): void
    {
        $id = $this->save(null);
        $row = $this->connection->query('SELECT Rights_rights_id FROM Resource WHERE resource_id = ' . $id)->fetch_assoc();
        self::assertNull($row['Rights_rights_id']);
        $controller = new \DatasetController();
        $source = $controller->getResourceAsXml($this->connection, $id);
        self::assertStringNotContainsString('<Rights>', $source);
        self::assertStringNotContainsString('<rightsList>', $controller->transformResourceXmlString($source, 'datacite'));
    }

    public function testPayloadReconstructsAfterOldIdsDisappearAndKeepsIdentifierVersions(): void
    {
        $this->connection->query('DELETE FROM Rights');
        $license = ['identifier' => 'CC0-1.0', 'name' => 'Original CC0 terms', 'uri' => 'urn:example:original', 'scheme_uri' => null];
        $id = $this->save($license);
        $source = (new \DatasetController())->getResourceAsXml($this->connection, $id);
        self::assertStringContainsString('<rightsIdentifier>CC0-1.0</rightsIdentifier>', $source);
        self::assertStringContainsString('<rightsURI>urn:example:original</rightsURI>', $source);
        self::assertStringNotContainsString('SPDX', $source);
    }

    public function testInvalidPayloadDoesNotSilentlyUseLegacyId(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        \LicenseService::metadataFromPost($this->connection, ['Rights' => '1', 'licensePayload' => '{broken']);
    }
}
