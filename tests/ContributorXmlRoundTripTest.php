<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/contributor_payload_xml.php';
require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

final class ContributorXmlRoundTripTest extends TestCase
{
    private const RESOURCE = '<Resource><doi>10.5880/GFZ.CONTRIBUTORS.TEST</doi><year>2026</year><dateCreated>2026-09-23</dateCreated><ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType><Language><code>en</code></Language><Titles><Title><text>Contributor test</text><type>Main Title</type></Title></Titles><Descriptions><Description><description>Test</description><type>Abstract</type></Description></Descriptions><Authors><Author><familyname>Tester</familyname><givenname>Case</givenname></Author></Authors><ContactPersons/></Resource>';

    public function testMixedOrderAndContactRolesSurviveDataCiteExport(): void
    {
        $post = ['contributorsPayload' => json_encode([
            ['type' => 'institution', 'institutionname' => 'Institute', 'roles' => ['Contact Person', 'HostingInstitution'], 'email' => 'info@example.org'],
            ['type' => 'person', 'familyname' => 'Doe', 'givenname' => 'Jane', 'roles' => ['DataCollector', 'Contact Person'], 'email' => 'jane@example.org'],
        ])];
        $resource = applyContributorsPayloadToResourceXmlString(self::RESOURCE, $post, true);
        $controller = (new ReflectionClass(DatasetController::class))->newInstanceWithoutConstructor();
        $xml = $controller->transformResourceXmlString($resource, 'datacite');
        $dom = new DOMDocument();
        self::assertTrue($dom->loadXML($xml));
        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');
        $names = [];
        $roles = [];
        foreach ($xpath->query('//dc:contributors/dc:contributor') as $node) {
            $names[] = trim($xpath->evaluate('string(dc:contributorName)', $node));
            $roles[] = $node->getAttribute('contributorType');
        }
        self::assertSame(['Institute', 'Institute', 'Doe, Jane', 'Doe, Jane'], $names);
        self::assertSame(['ContactPerson', 'HostingInstitution', 'DataCollector', 'ContactPerson'], $roles);
        self::assertTrue($dom->schemaValidate(__DIR__ . '/../schemas/DataCite/DataCiteSchema47.xsd'));
    }

    public function testIsoExportsInstitutionContactDetails(): void
    {
        $post = ['contributorsPayload' => json_encode([[
            'type' => 'institution', 'institutionname' => 'Institute', 'roles' => ['Contact Person'],
            'email' => 'info@example.org', 'website' => 'https://example.org',
        ]])];
        $resource = applyContributorsPayloadToResourceXmlString(self::RESOURCE, $post, true);
        $controller = (new ReflectionClass(DatasetController::class))->newInstanceWithoutConstructor();
        $xml = $controller->transformResourceXmlString($resource, 'iso');
        self::assertStringContainsString('info@example.org', $xml);
        self::assertStringContainsString('https://example.org', $xml);
        self::assertStringContainsString('Institute', $xml);
    }

    public function testContributorPersonContactAppearsOnceWithoutAffiliation(): void
    {
        $post = ['contributorsPayload' => json_encode([[
            'type' => 'person', 'familyname' => 'Doe', 'givenname' => 'Jane',
            'roles' => ['Contact Person'], 'email' => 'jane@example.org',
        ]])];
        $resource = applyContributorsPayloadToResourceXmlString(self::RESOURCE, $post);
        $controller = (new ReflectionClass(DatasetController::class))->newInstanceWithoutConstructor();
        $iso = $controller->transformResourceXmlString($resource, 'iso');
        $dataCite = $controller->transformResourceXmlString($resource, 'datacite');
        self::assertSame(1, substr_count($iso, 'jane@example.org'));
        self::assertSame(1, substr_count($dataCite, 'contributorType="ContactPerson"'));
    }
}
