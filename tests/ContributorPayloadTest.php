<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/contributor_payload_xml.php';

final class ContributorPayloadTest extends TestCase
{
    public function testNormalizesOrderAndInstitutionFlag(): void
    {
        $post = ['contributorsPayload' => json_encode([
            ['type' => 'institution', 'institutionname' => 'Institute', 'roles' => ['Contact Person', 'HostingInstitution']],
            ['type' => 'person', 'familyname' => 'Doe', 'roles' => [['value' => 'Contact Person']]],
        ])];
        $off = normalizeContributorsPayload($post, false);
        self::assertSame(['HostingInstitution'], $off[0]['roles']);
        self::assertSame([0, 1], array_column($off, 'order'));
        self::assertSame(['Contact Person'], $off[1]['roles']);
        self::assertSame('Contact Person', normalizeContributorsPayload($post, true)[0]['roles'][0]);
    }

    public function testXmlOverlayPreservesMixedOrderAndContacts(): void
    {
        $post = ['contributorsPayload' => json_encode([
            ['type' => 'institution', 'institutionname' => 'Institute', 'roles' => ['Contact Person'], 'email' => 'info@example.org'],
            ['type' => 'person', 'familyname' => 'Doe', 'givenname' => 'Jane', 'roles' => ['Contact Person'], 'email' => 'jane@example.org'],
        ])];
        $xml = applyContributorsPayloadToResourceXmlString('<Resource><ContactPersons/></Resource>', $post, true);
        $dom = new DOMDocument();
        self::assertTrue($dom->loadXML($xml));
        $xpath = new DOMXPath($dom);
        self::assertSame('Institute', $xpath->evaluate('string(/Resource/Contributors/Contributor[1]/institutionname)'));
        self::assertSame('Doe', $xpath->evaluate('string(/Resource/Contributors/Contributor[2]/familyname)'));
        self::assertSame(1, $xpath->query('/Resource/ContactPersons/ContactPerson')->length);
        self::assertSame(1, $xpath->query('/Resource/ContactInstitutions/ContactInstitution')->length);
    }

    public function testExplicitEmptyPayloadRemovesExistingContributors(): void
    {
        $xml = applyContributorsPayloadToResourceXmlString(
            '<Resource><Contributors><Persons><Person><familyname>Old</familyname></Person></Persons></Contributors></Resource>',
            ['contributorsPayload' => '[]']
        );
        self::assertStringNotContainsString('Old', $xml);
        self::assertStringContainsString('<Contributors/>', $xml);
    }

    public function testNewSectionsFollowFreestyleResourceOrder(): void
    {
        $xml = applyContributorsPayloadToResourceXmlString(
            '<Resource><Authors/><Descriptions/></Resource>',
            ['contributorsPayload' => json_encode([[
                'type' => 'person', 'familyname' => 'Doe', 'roles' => ['Contact Person'],
                'email' => 'doe@example.org',
            ]])]
        );
        $dom = new DOMDocument();
        self::assertTrue($dom->loadXML($xml));
        $names = [];
        foreach ($dom->documentElement->childNodes as $child) {
            if ($child instanceof DOMElement) $names[] = $child->localName;
        }
        self::assertSame(['Authors', 'ContactPersons', 'ContactInstitutions', 'Contributors', 'Descriptions'], $names);
    }
}
