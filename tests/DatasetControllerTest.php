<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_authors.php';
require_once __DIR__ . '/../includes/author_payload_xml.php';

/**
 * Test class for DatasetController
 * 
 * Tests the controller methods for retrieving dataset information
 * including authors, contributors, titles, descriptions, etc.
 */
final class DatasetControllerTest extends DatabaseTestCase
{
    private \DatasetController $controller;
    private int $resourceId;

    protected function setUp(): void
    {
        parent::setUp();
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
        $this->controller = new \DatasetController();
        
        // Create a test resource with all related data
        $this->createTestDataset();
    }

    /**
     * Creates a complete test dataset with all related entities
     */
    private function createTestDataset(): void
    {
        $conn = $this->connection;

        // Insert Resource
        $stmt = $conn->prepare("INSERT INTO Resource (version, Language_language_id, year) VALUES (1, 1, 2024)");
        $stmt->execute();
        $this->resourceId = (int) $conn->insert_id;
        $stmt->close();

        // Insert Title
        $mainTitleTypeId = $this->getTitleTypeId('Main Title');
        $stmt = $conn->prepare("INSERT INTO Title (text, Title_Type_fk, Resource_resource_id) VALUES ('Test Dataset Title', ?, ?)");
        $stmt->bind_param('ii', $mainTitleTypeId, $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Description
        $stmt = $conn->prepare("INSERT INTO Description (type, description, resource_id) VALUES ('Abstract', 'Test abstract description', ?)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Author Person
        $conn->query("INSERT INTO Author_person (author_person_id, familyname, givenname, orcid) VALUES (1, 'Doe', 'John', '0000-0001-2345-6789')");
        $conn->query("INSERT INTO Author (author_id, Author_Person_author_person_id) VALUES (1, 1)");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Author (Resource_resource_id, Author_author_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Affiliation for Author
        $conn->query("INSERT INTO Affiliation (affiliation_id, name, rorId) VALUES (1, 'Test University', 'https://ror.org/12345')");
        $conn->query("INSERT INTO Author_has_Affiliation (Author_author_id, Affiliation_affiliation_id) VALUES (1, 1)");

        // Insert Free Keywords
        $conn->query("INSERT INTO Free_Keywords (free_keywords_id, free_keyword, isCurated) VALUES (1, 'climate', 1), (2, 'temperature', 0)");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Free_Keywords (Resource_resource_id, Free_Keywords_free_keywords_id) VALUES (?, 1), (?, 2)");
        $stmt->bind_param('ii', $this->resourceId, $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Contributor Person with Role (Role id 1 = 'Data Collector' from install.php seed data)
        $conn->query("INSERT INTO Contributor_Person (contributor_person_id, familyname, givenname, orcid) VALUES (1, 'Smith', 'Jane', '0000-0002-3456-7890')");
        $conn->query("INSERT INTO Contributor_Person_has_Role (Contributor_Person_contributor_person_id, Role_role_id) VALUES (1, 1)");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Contributor_Person (Resource_resource_id, Contributor_Person_contributor_person_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Contact Person
        $conn->query("INSERT INTO Contact_Person (contact_person_id, familyname, givenname, email, website, orcid) VALUES (1, 'Brown', 'Alice', 'alice@test.com', 'https://alice.test', '0000-0003-4567-8901')");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Contact_Person (Resource_resource_id, Contact_Person_contact_person_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Spatial Temporal Coverage
        $conn->query("INSERT INTO Spatial_Temporal_Coverage (spatial_temporal_coverage_id, latitudeMin, latitudeMax, longitudeMin, longitudeMax, dateStart, dateEnd) VALUES (1, 52.0, 53.0, 13.0, 14.0, '2024-01-01', '2024-12-31')");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Spatial_Temporal_Coverage (Resource_resource_id, Spatial_Temporal_Coverage_spatial_temporal_coverage_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Related Work (Relation id 1 = 'IsCitedBy', Identifier_Type id 4 = 'DOI' from install.php seed data)
        $conn->query("INSERT INTO Related_Work (related_work_id, Identifier, relation_fk, identifier_type_fk) VALUES (1, '10.1234/test', 1, 4)");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Related_Work (Resource_resource_id, Related_Work_related_work_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Funding Reference
        $conn->query("INSERT INTO Funding_Reference (funding_reference_id, funder, funderid, funderidtyp, grantnumber, grantname, awarduri) VALUES (1, 'Test Funder', 'fund-123', 'Crossref', 'AWARD-001', 'Test Award', 'https://award.test')");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Funding_Reference (Resource_resource_id, Funding_Reference_funding_reference_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Thesaurus Keywords
        $conn->query("INSERT INTO Thesaurus_Keywords (thesaurus_keywords_id, keyword, scheme, schemeURI, valueURI, language) VALUES (1, 'Earth Science', 'NASA/GCMD', 'https://gcmd.nasa.gov', 'https://gcmd.nasa.gov/earth', 'en')");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Thesaurus_Keywords (Resource_resource_id, Thesaurus_Keywords_thesaurus_keywords_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Originating Laboratory
        $conn->query("INSERT INTO Originating_Laboratory (originating_laboratory_id, laboratoryname, labId) VALUES (1, 'Test Lab', 'LAB-001')");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Originating_Laboratory (Resource_resource_id, Originating_Laboratory_originating_laboratory_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();
    }

    private function getTitleTypeId(string $name): int
    {
        $stmt = $this->connection->prepare('SELECT title_type_id FROM Title_Type WHERE name = ? LIMIT 1');
        $stmt->bind_param('s', $name);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            throw new \RuntimeException("Title type '{$name}' is missing from test lookup data.");
        }

        return (int) $row['title_type_id'];
    }
    public function testGetTitlesReturnsCorrectStructure(): void
    {
        $titles = $this->controller->getTitles($this->connection, $this->resourceId);

        $this->assertIsArray($titles);
        $this->assertNotEmpty($titles);
        $this->assertEquals('Test Dataset Title', $titles[0]['text']);
        $this->assertEquals('Main Title', $titles[0]['title_type_name']);
    }

    public function testGetDescriptionsReturnsCorrectData(): void
    {
        $descriptions = $this->controller->getDescriptions($this->connection, $this->resourceId);

        $this->assertIsArray($descriptions);
        $this->assertNotEmpty($descriptions);
        $this->assertEquals('Test abstract description', $descriptions[0]['description']);
    }

    public function testGetAuthorsReturnsPersonAuthors(): void
    {
        $authors = $this->controller->getAuthors($this->connection, $this->resourceId);

        $this->assertIsArray($authors);
        $this->assertNotEmpty($authors);
        $this->assertEquals('person', $authors[0]['type']);
        $this->assertEquals('Doe', $authors[0]['familyname']);
        $this->assertEquals('John', $authors[0]['givenname']);
        $this->assertEquals('0000-0001-2345-6789', $authors[0]['orcid']);
    }

    public function testSaveAuthorsKeepsOrcidOnlyPersonAuthor(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.EXPORT.ORCID.ONLY.AUTHOR', 'Test Export ORCID Only Author');

        $authorData = [
            'authorsPayload' => json_encode([
                [
                    'type' => 'person',
                    'familyname' => '',
                    'givenname' => '',
                    'orcid' => 'https://orcid.org/0009-0007-2910-0469',
                    'isContact' => false,
                    'affiliations' => []
                ]
            ]),
            'familynames' => [''],
            'givennames' => [''],
            'orcids' => ['https://orcid.org/0009-0007-2910-0469'],
            'personAffiliation' => [''],
            'authorPersonRorIds' => [''],
            'authorinstitutionName' => [],
            'institutionAffiliation' => [],
            'authorInstitutionRorIds' => []
        ];

        saveAuthors($this->connection, $authorData, $resourceId);

        $xmlString = $this->controller->getResourceAsXml($this->connection, $resourceId);
        $xml = new \SimpleXMLElement($xmlString);

        $this->assertSame('', (string) $xml->Authors->AuthorPerson->familyname);
        $this->assertSame('', (string) $xml->Authors->AuthorPerson->givenname);
        $this->assertSame('0009-0007-2910-0469', (string) $xml->Authors->AuthorPerson->orcid);
    }

    public function testResourceXmlPreservesMixedAuthorsPayloadOrder(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.EXPORT.MIXED.AUTHORS', 'Test Export Mixed Authors');

        $authorData = [
            'authorsPayload' => json_encode([
                [
                    'type' => 'person',
                    'familyname' => 'XmlFirst',
                    'givenname' => 'Person',
                    'orcid' => '',
                    'isContact' => true,
                    'affiliations' => []
                ],
                [
                    'type' => 'institution',
                    'institutionname' => 'Xml Institute',
                    'affiliations' => []
                ],
                [
                    'type' => 'person',
                    'familyname' => 'XmlLast',
                    'givenname' => 'Person',
                    'orcid' => '',
                    'isContact' => false,
                    'affiliations' => []
                ]
            ]),
            'familynames' => ['XmlFirst', 'XmlLast'],
            'givennames' => ['Person', 'Person'],
            'orcids' => ['', ''],
            'personAffiliation' => ['', ''],
            'authorPersonRorIds' => ['', ''],
            'authorinstitutionName' => ['Xml Institute'],
            'institutionAffiliation' => [''],
            'authorInstitutionRorIds' => ['']
        ];

        saveAuthors($this->connection, $authorData, $resourceId);

        $xmlString = $this->controller->getResourceAsXml($this->connection, $resourceId);
        $xml = new \SimpleXMLElement($xmlString);
        $authorKeys = [];

        foreach ($xml->Authors->children() as $authorNode) {
            $authorKeys[] = $authorNode->getName() === 'AuthorPerson'
                ? 'person:' . (string) $authorNode->familyname
                : 'institution:' . (string) $authorNode->institutionname;
        }

        $this->assertSame(
            ['person:XmlFirst', 'institution:Xml Institute', 'person:XmlLast'],
            $authorKeys,
            'The internal Resource XML should preserve the mixed authorsPayload order.'
        );
    }

        public function testAuthorPayloadReplacesResourceXmlAuthorsAndContactPersons(): void
        {
                $resourceXml = <<<'XML'
<?xml version="1.0"?>
<Resource>
    <doi>10.5880/GFZ.TEST.AUTHOR.PAYLOAD.XML</doi>
    <Authors>
        <AuthorPerson><familyname>OldDb</familyname><givenname>Author</givenname></AuthorPerson>
    </Authors>
    <ContactPersons>
        <ContactPerson><familyname>OldDb</familyname><givenname>Contact</givenname></ContactPerson>
    </ContactPersons>
</Resource>
XML;

                $postData = [
                        'authorsPayload' => json_encode([
                                [
                                        'type' => 'person',
                                        'familyname' => 'DirectFirst',
                                        'givenname' => 'Person',
                                        'orcid' => '',
                                        'isContact' => true,
                                        'email' => 'direct-first@example.com',
                                        'website' => 'https://direct-first.example.com',
                                        'affiliations' => [
                                                ['label' => 'Payload University', 'rorId' => '04z8jg394']
                                        ]
                                ],
                                [
                                        'type' => 'institution',
                                        'institutionname' => 'Direct Institute',
                                        'affiliations' => []
                                ],
                                [
                                        'type' => 'person',
                                        'familyname' => 'DirectLast',
                                        'givenname' => 'Person',
                                        'orcid' => '',
                                        'isContact' => false,
                                        'affiliations' => []
                                ]
                        ])
                ];

                $updatedXml = applyAuthorsPayloadToResourceXmlString($resourceXml, $postData);
                $xml = new \SimpleXMLElement($updatedXml);
                $authorKeys = [];

                foreach ($xml->Authors->Author as $authorNode) {
                        $authorKeys[] = isset($authorNode->institutionname)
                                ? 'institution:' . (string) $authorNode->institutionname
                                : 'person:' . (string) $authorNode->familyname;
                }

                $this->assertSame(
                        ['person:DirectFirst', 'institution:Direct Institute', 'person:DirectLast'],
                        $authorKeys
                );
                $this->assertSame('DirectFirst', (string) $xml->ContactPersons->ContactPerson->familyname);
                $this->assertStringNotContainsString('OldDb', $updatedXml);
        }

        public function testAuthorPayloadXmlSupportsAuthorWithoutGivenname(): void
        {
                $resourceXml = <<<'XML'
<?xml version="1.0"?>
<Resource>
    <doi>10.5880/GFZ.TEST.AUTHOR.MONONYM.PAYLOAD.XML</doi>
    <Authors/>
    <ContactPersons/>
</Resource>
XML;

                $postData = [
                        'authorsPayload' => json_encode([
                                [
                                        'type' => 'person',
                                        'familyname' => 'Sukarno',
                                        'givenname' => '',
                                        'orcid' => '',
                                        'isContact' => true,
                                        'email' => 'sukarno@example.com',
                                        'website' => '',
                                        'affiliations' => []
                                ]
                        ])
                ];

                $updatedXml = applyAuthorsPayloadToResourceXmlString($resourceXml, $postData);
                $xml = new \SimpleXMLElement($updatedXml);

                $this->assertSame('Sukarno', (string) $xml->Authors->Author->familyname);
                $this->assertSame('', (string) $xml->Authors->Author->givenname);
                $this->assertSame('Sukarno', (string) $xml->ContactPersons->ContactPerson->familyname);
                $this->assertSame('', (string) $xml->ContactPersons->ContactPerson->givenname);
        }

        public function testAuthorPayloadXmlSupportsOrcidOnlyAuthor(): void
        {
                $resourceXml = <<<'XML'
<?xml version="1.0"?>
<Resource>
    <doi>10.5880/GFZ.TEST.AUTHOR.ORCID.ONLY.PAYLOAD.XML</doi>
    <Authors/>
    <ContactPersons/>
</Resource>
XML;

                $postData = [
                        'authorsPayload' => json_encode([
                                [
                                        'type' => 'person',
                                        'familyname' => '',
                                        'givenname' => '',
                                        'orcid' => 'https://orcid.org/0009-0007-2910-0469',
                                        'isContact' => false,
                                        'affiliations' => []
                                ]
                        ])
                ];

                $updatedXml = applyAuthorsPayloadToResourceXmlString($resourceXml, $postData);
                $xml = new \SimpleXMLElement($updatedXml);

                $this->assertSame('', (string) $xml->Authors->Author->familyname);
                $this->assertSame('', (string) $xml->Authors->Author->givenname);
                $this->assertSame('0009-0007-2910-0469', (string) $xml->Authors->Author->orcid);
                $this->assertSame('0009-0007-2910-0469', (string) $xml->Authors->AuthorPerson->orcid);
                $this->assertSame(0, $xml->ContactPersons->ContactPerson->count());
        }

        public function testDataCiteTransformUsesUnifiedAuthorsInPayloadOrder(): void
        {
                $sourceXml = $this->directAuthorSourceXml();
                $dataciteXml = $this->controller->transformResourceXmlString($sourceXml, 'datacite');
                $dom = new \DOMDocument();
                $dom->loadXML($dataciteXml);
                $xpath = new \DOMXPath($dom);
                $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');

                $creatorNames = [];
                foreach ($xpath->query('//dc:creators/dc:creator/dc:creatorName') as $creatorName) {
                        $creatorNames[] = trim($creatorName->textContent);
                }

                $contactContributors = $xpath->query('//dc:contributors/dc:contributor[@contributorType="ContactPerson"]/dc:contributorName');

                $this->assertSame(
                        ['DirectFirst, Person', 'Direct Institute', 'DirectLast, Person'],
                        $creatorNames
                );
                $this->assertSame('DirectFirst, Person', trim($contactContributors->item(0)->textContent));
        }

        public function testDataCiteTransformSupportsAuthorWithoutGivenname(): void
        {
                $sourceXml = $this->mononymAuthorSourceXml();
                $dataciteXml = $this->controller->transformResourceXmlString($sourceXml, 'datacite');
                $dom = new \DOMDocument();
                $dom->loadXML($dataciteXml);
                $xpath = new \DOMXPath($dom);
                $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');

                $this->assertSame('Sukarno', trim($xpath->evaluate('string(//dc:creators/dc:creator/dc:creatorName)')));
                $this->assertSame(0, $xpath->query('//dc:creators/dc:creator/dc:givenName')->length);
                $this->assertSame('Sukarno', trim($xpath->evaluate('string(//dc:contributors/dc:contributor[@contributorType="ContactPerson"]/dc:contributorName)')));
        }

        public function testDataCiteTransformSupportsOrcidOnlyAuthor(): void
        {
                $sourceXml = $this->orcidOnlyAuthorSourceXml();
                $dataciteXml = $this->controller->transformResourceXmlString($sourceXml, 'datacite');
                $dom = new \DOMDocument();
                $dom->loadXML($dataciteXml);
                $xpath = new \DOMXPath($dom);
                $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');

                $this->assertSame('0009-0007-2910-0469', trim($xpath->evaluate('string(//dc:creators/dc:creator/dc:creatorName)')));
                $this->assertSame('0009-0007-2910-0469', trim($xpath->evaluate('string(//dc:creators/dc:creator/dc:nameIdentifier[@nameIdentifierScheme="ORCID"])')));
                $this->assertSame(0, $xpath->query('//dc:creators/dc:creator/dc:familyName')->length);
        }

        public function testIsoTransformReadsUnifiedAuthorsInPayloadOrder(): void
        {
                $sourceXml = $this->directAuthorSourceXml();
                $isoXml = $this->controller->transformResourceXmlString($sourceXml, 'iso');
                $this->assertSame(
                        [
                                ['individual' => 'DirectFirst, Person', 'organisation' => 'Payload University'],
                                ['individual' => '', 'organisation' => 'Direct Institute'],
                                ['individual' => 'DirectLast, Person', 'organisation' => ''],
                        ],
                        $this->isoAuthorParties($isoXml)
                );
        }

        public function testIsoTransformSupportsAuthorWithoutGivenname(): void
        {
                $sourceXml = $this->mononymAuthorSourceXml();
                $isoXml = $this->controller->transformResourceXmlString($sourceXml, 'iso');

                $this->assertSame(
                        [
                                ['individual' => 'Sukarno', 'organisation' => 'Payload University'],
                        ],
                        $this->isoAuthorParties($isoXml)
                );
                $this->assertStringContainsString('<gco:CharacterString>Sukarno</gco:CharacterString>', $isoXml);
                $this->assertStringNotContainsString('Sukarno,', $isoXml);
        }

        public function testIsoTransformSupportsOrcidOnlyAuthor(): void
        {
                $sourceXml = $this->orcidOnlyAuthorSourceXml();
                $isoXml = $this->controller->transformResourceXmlString($sourceXml, 'iso');

                $this->assertSame(
                        [
                                ['individual' => '0009-0007-2910-0469', 'organisation' => ''],
                        ],
                        $this->isoAuthorParties($isoXml)
                );
                $this->assertStringContainsString('xlink:href="http://orcid.org/0009-0007-2910-0469"', $isoXml);
        }

        public function testIsoTransformFallsBackToLegacyAuthorsInXmlOrder(): void
        {
                $sourceXml = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.LEGACY.AUTHOR.ISO</doi>
    <year>2026</year>
    <dateCreated>2026-05-28</dateCreated>
    <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
    <Language><code>en</code></Language>
    <Titles><Title><text>Legacy Author ISO Test</text><type>Main Title</type></Title></Titles>
    <Descriptions><Description><description>Legacy author test abstract</description><type>Abstract</type></Description></Descriptions>
    <Authors>
        <AuthorPerson>
            <familyname>LegacyFirst</familyname>
            <givenname>Person</givenname>
            <Affiliations><Affiliation><name>Legacy University</name></Affiliation></Affiliations>
        </AuthorPerson>
        <AuthorInstitution><institutionname>Legacy Institute</institutionname></AuthorInstitution>
        <AuthorPerson><familyname>LegacyLast</familyname><givenname>Person</givenname></AuthorPerson>
    </Authors>
</Resource>
XML;

                $isoXml = $this->controller->transformResourceXmlString($sourceXml, 'iso');

                $this->assertSame(
                        [
                                ['individual' => 'LegacyFirst, Person', 'organisation' => 'Legacy University'],
                                ['individual' => '', 'organisation' => 'Legacy Institute'],
                                ['individual' => 'LegacyLast, Person', 'organisation' => ''],
                        ],
                        $this->isoAuthorParties($isoXml)
                );
        }

        private function isoAuthorParties(string $isoXml): array
        {
                $dom = new \DOMDocument();
                $dom->loadXML($isoXml);
                $xpath = new \DOMXPath($dom);
                $xpath->registerNamespace('gmd', 'http://www.isotc211.org/2005/gmd');
                $xpath->registerNamespace('gco', 'http://www.isotc211.org/2005/gco');

                $parties = [];
                foreach ($xpath->query('//gmd:citedResponsibleParty/gmd:CI_ResponsibleParty[gmd:role/gmd:CI_RoleCode[@codeListValue="author"]]') as $party) {
                        $parties[] = [
                                'individual' => trim($xpath->evaluate('string(gmd:individualName/gco:CharacterString)', $party)),
                                'organisation' => trim($xpath->evaluate('string(gmd:organisationName/gco:CharacterString)', $party)),
                        ];
                }

                return $parties;
        }

        private function directAuthorSourceXml(): string
        {
                return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.DIRECT.AUTHOR.XSLT</doi>
    <year>2026</year>
    <dateCreated>2026-05-28</dateCreated>
    <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
    <Language><code>en</code></Language>
    <Titles><Title><text>Direct Author XSLT Test</text><type>Main Title</type></Title></Titles>
    <Descriptions><Description><description>Direct author test abstract</description><type>Abstract</type></Description></Descriptions>
    <Authors>
        <Author>
            <familyname>DirectFirst</familyname>
            <givenname>Person</givenname>
            <Affiliations><Affiliation><name>Payload University</name><rorId>04z8jg394</rorId></Affiliation></Affiliations>
        </Author>
        <Author>
            <institutionname>Direct Institute</institutionname>
        </Author>
        <Author>
            <familyname>DirectLast</familyname>
            <givenname>Person</givenname>
        </Author>
        <AuthorPerson><familyname>LegacyGrouped</familyname><givenname>ShouldNotBeUsed</givenname></AuthorPerson>
        <AuthorInstitution><institutionname>Legacy Institution Should Not Be Used</institutionname></AuthorInstitution>
    </Authors>
    <ContactPersons>
        <ContactPerson><familyname>DirectFirst</familyname><givenname>Person</givenname><email>direct-first@example.com</email></ContactPerson>
    </ContactPersons>
</Resource>
XML;
        }

        private function mononymAuthorSourceXml(): string
        {
                return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.MONONYM.AUTHOR.XSLT</doi>
    <year>2026</year>
    <dateCreated>2026-06-16</dateCreated>
    <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
    <Language><code>en</code></Language>
    <Titles><Title><text>Mononym Author XSLT Test</text><type>Main Title</type></Title></Titles>
    <Descriptions><Description><description>Mononym author test abstract</description><type>Abstract</type></Description></Descriptions>
    <Authors>
        <Author>
            <familyname>Sukarno</familyname>
            <givenname></givenname>
            <Affiliations><Affiliation><name>Payload University</name><rorId>04z8jg394</rorId></Affiliation></Affiliations>
        </Author>
    </Authors>
    <ContactPersons>
        <ContactPerson><familyname>Sukarno</familyname><givenname></givenname><email>sukarno@example.com</email></ContactPerson>
    </ContactPersons>
</Resource>
XML;
        }

        private function orcidOnlyAuthorSourceXml(): string
        {
                return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.ORCID.ONLY.AUTHOR.XSLT</doi>
    <year>2026</year>
    <dateCreated>2026-06-24</dateCreated>
    <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
    <Language><code>en</code></Language>
    <Titles><Title><text>ORCID Only Author XSLT Test</text><type>Main Title</type></Title></Titles>
    <Descriptions><Description><description>ORCID-only author test abstract</description><type>Abstract</type></Description></Descriptions>
    <Authors>
        <Author>
            <familyname></familyname>
            <givenname></givenname>
            <orcid>0009-0007-2910-0469</orcid>
        </Author>
    </Authors>
    <ContactPersons/>
</Resource>
XML;
        }

    public function testGetAuthorAffiliationsReturnsCorrectData(): void
    {
        $affiliations = $this->controller->getAuthorAffiliations($this->connection, 1);

        $this->assertIsArray($affiliations);
        $this->assertNotEmpty($affiliations);
        $this->assertEquals('Test University', $affiliations[0]['name']);
        $this->assertEquals('https://ror.org/12345', $affiliations[0]['rorId']);
    }

    public function testGetFreeKeywordsReturnsCorrectData(): void
    {
        $keywords = $this->controller->getFreeKeywords($this->connection, $this->resourceId);

        $this->assertIsArray($keywords);
        $this->assertCount(2, $keywords);
        
        $keywordValues = array_column($keywords, 'free_keyword');
        $this->assertContains('climate', $keywordValues);
        $this->assertContains('temperature', $keywordValues);
    }

    public function testGetContributorsReturnsPersons(): void
    {
        $contributors = $this->controller->getContributors($this->connection, $this->resourceId);

        $this->assertIsArray($contributors);
        $this->assertArrayHasKey('persons', $contributors);
        $this->assertNotEmpty($contributors['persons']);
        $this->assertEquals('Smith', $contributors['persons'][0]['familyname']);
        $this->assertEquals('Jane', $contributors['persons'][0]['givenname']);
    }

    public function testGetContributorPersonRolesReturnsCorrectData(): void
    {
        $roles = $this->controller->getContributorPersonRoles($this->connection, 1);

        $this->assertIsArray($roles);
        $this->assertNotEmpty($roles);
        $this->assertEquals('Data Collector', $roles[0]['name']);
    }

    public function testGetContactPersonsReturnsCorrectData(): void
    {
        $contactPersons = $this->controller->getContactPersons($this->connection, $this->resourceId);

        $this->assertIsArray($contactPersons);
        $this->assertNotEmpty($contactPersons);
        $this->assertEquals('Brown', $contactPersons[0]['familyname']);
        $this->assertEquals('Alice', $contactPersons[0]['givenname']);
        $this->assertEquals('alice@test.com', $contactPersons[0]['email']);
        $this->assertEquals('https://alice.test', $contactPersons[0]['website']);
    }

    public function testGetSpatialTemporalCoverageReturnsCorrectData(): void
    {
        $coverage = $this->controller->getSpatialTemporalCoverage($this->connection, $this->resourceId);

        $this->assertIsArray($coverage);
        $this->assertNotEmpty($coverage);
        $this->assertEquals(52.0, $coverage[0]['latitudeMin']);
        $this->assertEquals(53.0, $coverage[0]['latitudeMax']);
        $this->assertEquals(13.0, $coverage[0]['longitudeMin']);
        $this->assertEquals(14.0, $coverage[0]['longitudeMax']);
    }

    public function testGetRelatedWorksReturnsCorrectStructure(): void
    {
        $relatedWorks = $this->controller->getRelatedWorks($this->connection, $this->resourceId);

        $this->assertIsArray($relatedWorks);
        $this->assertNotEmpty($relatedWorks);
        $this->assertEquals('10.1234/test', $relatedWorks[0]['Identifier']);
        $this->assertEquals('IsCitedBy', $relatedWorks[0]['Relation']['name']);
        $this->assertEquals('DOI', $relatedWorks[0]['IdentifierType']['name']);
    }

    public function testGetFundingReferencesReturnsCorrectData(): void
    {
        $funding = $this->controller->getFundingReferences($this->connection, $this->resourceId);

        $this->assertIsArray($funding);
        $this->assertNotEmpty($funding);
        $this->assertEquals('Test Funder', $funding[0]['funder']);
        $this->assertEquals('AWARD-001', $funding[0]['grantnumber']);
    }

    public function testGetThesaurusKeywordsReturnsCorrectData(): void
    {
        $keywords = $this->controller->getThesaurusKeywords($this->connection, $this->resourceId);

        $this->assertIsArray($keywords);
        $this->assertNotEmpty($keywords);
        $this->assertEquals('Earth Science', $keywords[0]['keyword']);
        $this->assertEquals('NASA/GCMD', $keywords[0]['scheme']);
    }

    public function testGetOriginatingLaboratoriesReturnsCorrectData(): void
    {
        $labs = $this->controller->getOriginatingLaboratories($this->connection, $this->resourceId);

        $this->assertIsArray($labs);
        $this->assertNotEmpty($labs);
        $this->assertEquals('Test Lab', $labs[0]['laboratoryname']);
        $this->assertEquals('LAB-001', $labs[0]['labId']);
    }

    public function testGetRelatedDataReturnsEmptyArrayForNonexistentId(): void
    {
        $result = $this->controller->getRelatedData($this->connection, 'Resource', 'resource_id', 99999);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function testGetRelatedDataMultipleReturnsEmptyArrayForNonexistentId(): void
    {
        $result = $this->controller->getRelatedDataMultiple($this->connection, 'Title', 'Resource_resource_id', 99999);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function testGetAuthorsWithNoAuthorsReturnsEmptyArray(): void
    {
        // Create a resource without authors
        $stmt = $this->connection->prepare("INSERT INTO Resource (version, Language_language_id, year) VALUES (1, 1, 2024)");
        $stmt->execute();
        $emptyResourceId = (int) $this->connection->insert_id;
        $stmt->close();

        $authors = $this->controller->getAuthors($this->connection, $emptyResourceId);

        $this->assertIsArray($authors);
        $this->assertEmpty($authors);
    }

    public function testGetContributorsWithNoContributorsReturnsEmptyStructure(): void
    {
        // Create a resource without contributors
        $stmt = $this->connection->prepare("INSERT INTO Resource (version, Language_language_id, year) VALUES (1, 1, 2024)");
        $stmt->execute();
        $emptyResourceId = (int) $this->connection->insert_id;
        $stmt->close();

        $contributors = $this->controller->getContributors($this->connection, $emptyResourceId);

        $this->assertIsArray($contributors);
        $this->assertArrayHasKey('persons', $contributors);
        $this->assertArrayHasKey('institutions', $contributors);
        $this->assertEmpty($contributors['persons']);
        $this->assertEmpty($contributors['institutions']);
    }
}
