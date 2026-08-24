<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
require_once __DIR__ . '/../save/formgroups/save_contributorpersons.php';
require_once __DIR__ . '/../save/formgroups/save_contributorinstitutions.php';

final class Issue1142ContributorExportTest extends DatabaseTestCase
{
    private \DatasetController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new \DatasetController();
    }

    public function testRolelessDraftContributorsAreExportedAsOtherWithAllMetadata(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.ISSUE.1142.EXPORT', 'Roleless contributor export');

        $personSaved = saveContributorPersons(
            $this->connection,
            [
                'action' => 'save_and_download',
                'cbPersonLastname' => ['Roleless'],
                'cbPersonFirstname' => ['Person'],
                'cbORCID' => ['0000-0002-1825-0097'],
                'cbAffiliation' => ['[{"value":"Person University","rorId":"03yrm5c26"}]'],
                'cbpRorIds' => ['03yrm5c26'],
            ],
            $resourceId
        );
        $institutionSaved = saveContributorInstitutions(
            $this->connection,
            [
                'action' => 'save_and_download',
                'cbOrganisationName' => ['Roleless Institute'],
                'OrganisationAffiliation' => ['[{"value":"Institute Network","rorId":"04z8jg394"}]'],
                'hiddenOrganisationRorId' => ['04z8jg394'],
            ],
            $resourceId
        );

        $this->assertTrue($personSaved);
        $this->assertTrue($institutionSaved);

        $resourceXml = $this->controller->getResourceAsXml($this->connection, $resourceId);
        $resourceXPath = $this->xpath($resourceXml);

        $this->assertSame(
            'Other',
            trim((string) $resourceXPath->evaluate('string(/Resource/Contributors/Persons/Person/Roles/Role/name)'))
        );
        $this->assertSame(
            'Other',
            trim((string) $resourceXPath->evaluate('string(/Resource/Contributors/Institutions/Institution/Roles/Role/name)'))
        );

        $dataCiteXml = $this->controller->transformResourceXmlString($resourceXml, 'datacite');
        $dataCiteXPath = $this->dataCiteXPath($dataCiteXml);

        $personQuery = '//dc:contributors/dc:contributor'
            . '[@contributorType="Other" and dc:contributorName="Roleless, Person"]';
        $institutionQuery = '//dc:contributors/dc:contributor'
            . '[@contributorType="Other" and dc:contributorName="Roleless Institute"]';

        $this->assertSame(1, $dataCiteXPath->query($personQuery)->length);
        $this->assertSame(1, $dataCiteXPath->query($institutionQuery)->length);
        $this->assertSame(
            '0000-0002-1825-0097',
            trim((string) $dataCiteXPath->evaluate("string({$personQuery}/dc:nameIdentifier[@nameIdentifierScheme='ORCID'])"))
        );
        $this->assertSame(
            'Person University',
            trim((string) $dataCiteXPath->evaluate("string({$personQuery}/dc:affiliation)"))
        );
        $this->assertSame(
            'https://ror.org/03yrm5c26',
            trim((string) $dataCiteXPath->evaluate("string({$personQuery}/dc:affiliation/@affiliationIdentifier)"))
        );
        $this->assertSame(
            'Institute Network',
            trim((string) $dataCiteXPath->evaluate("string({$institutionQuery}/dc:affiliation)"))
        );
        $this->assertSame(
            'https://ror.org/04z8jg394',
            trim((string) $dataCiteXPath->evaluate("string({$institutionQuery}/dc:affiliation/@affiliationIdentifier)"))
        );
    }

    public function testExplicitContributorRolesAreExportedWithoutAdditionalFallback(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.ISSUE.1142.EXPLICIT', 'Explicit contributor roles');

        saveContributorPersons(
            $this->connection,
            [
                'action' => 'save_and_download',
                'cbPersonLastname' => ['Explicit'],
                'cbPersonFirstname' => ['Researcher'],
                'cbORCID' => [''],
                'cbAffiliation' => [''],
                'cbpRorIds' => [''],
                'cbPersonRoles' => [['Researcher']],
            ],
            $resourceId
        );
        saveContributorInstitutions(
            $this->connection,
            [
                'action' => 'save_and_download',
                'cbOrganisationName' => ['Explicit Institute'],
                'cbOrganisationRoles' => [['Hosting Institution']],
                'OrganisationAffiliation' => [''],
                'hiddenOrganisationRorId' => [''],
            ],
            $resourceId
        );

        $resourceXml = $this->controller->getResourceAsXml($this->connection, $resourceId);
        $dataCiteXml = $this->controller->transformResourceXmlString($resourceXml, 'datacite');
        $dataCiteXPath = $this->dataCiteXPath($dataCiteXml);

        $this->assertSame(
            1,
            $dataCiteXPath->query('//dc:contributor[@contributorType="Researcher" and dc:contributorName="Explicit, Researcher"]')->length
        );
        $this->assertSame(
            1,
            $dataCiteXPath->query('//dc:contributor[@contributorType="HostingInstitution" and dc:contributorName="Explicit Institute"]')->length
        );
        $this->assertSame(0, $dataCiteXPath->query('//dc:contributor[@contributorType="Other"]')->length);
    }

    private function xpath(string $xml): \DOMXPath
    {
        $dom = new \DOMDocument();
        $dom->loadXML($xml);

        return new \DOMXPath($dom);
    }

    private function dataCiteXPath(string $xml): \DOMXPath
    {
        $xpath = $this->xpath($xml);
        $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');

        return $xpath;
    }
}
