<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

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
        $stmt = $conn->prepare("INSERT INTO Resource (version, language, publicationYear, currentSchemaVersion) VALUES (1, 'en', 2024, '1.0')");
        $stmt->execute();
        $this->resourceId = (int) $conn->insert_id;
        $stmt->close();

        // Insert Title Type
        $conn->query("INSERT INTO Title_Type (title_type_id, name) VALUES (1, 'Main Title') ON DUPLICATE KEY UPDATE name=name");

        // Insert Title
        $stmt = $conn->prepare("INSERT INTO Title (text, Title_Type_fk, Resource_resource_id) VALUES ('Test Dataset Title', 1, ?)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Description
        $stmt = $conn->prepare("INSERT INTO Description (description_abstract, resource_id) VALUES ('Test abstract description', ?)");
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

        // Insert Contributor Person with Role
        $conn->query("INSERT INTO Contributor_Person (contributor_person_id, familyname, givenname, orcid) VALUES (1, 'Smith', 'Jane', '0000-0002-3456-7890')");
        $conn->query("INSERT INTO Role (role_id, name) VALUES (1, 'DataCollector') ON DUPLICATE KEY UPDATE name=name");
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
        $conn->query("INSERT INTO Spatial_Temporal_Coverage (spatial_temporal_coverage_id, latMin, latMax, lonMin, lonMax, dateStart, dateEnd) VALUES (1, 52.0, 53.0, 13.0, 14.0, '2024-01-01', '2024-12-31')");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Spatial_Temporal_Coverage (Resource_resource_id, Spatial_Temporal_Coverage_spatial_temporal_coverage_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Relation and Identifier Type for Related Work
        $conn->query("INSERT INTO Relation (relation_id, name) VALUES (1, 'IsCitedBy') ON DUPLICATE KEY UPDATE name=name");
        $conn->query("INSERT INTO Identifier_Type (identifier_type_id, name) VALUES (1, 'DOI') ON DUPLICATE KEY UPDATE name=name");

        // Insert Related Work
        $conn->query("INSERT INTO Related_Work (related_work_id, Identifier, relation_fk, identifier_type_fk) VALUES (1, '10.1234/test', 1, 1)");
        $stmt = $conn->prepare("INSERT INTO Resource_has_Related_Work (Resource_resource_id, Related_Work_related_work_id) VALUES (?, 1)");
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->close();

        // Insert Funding Reference
        $conn->query("INSERT INTO Funding_Reference (funding_reference_id, funder, funderIdentifier, funderIdentifierType, awardNumber, awardTitle, awardURI) VALUES (1, 'Test Funder', 'fund-123', 'Crossref', 'AWARD-001', 'Test Award', 'https://award.test')");
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
        $this->assertEquals('Test abstract description', $descriptions[0]['description_abstract']);
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
        $this->assertEquals('DataCollector', $roles[0]['name']);
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
        $this->assertEquals(52.0, $coverage[0]['latMin']);
        $this->assertEquals(53.0, $coverage[0]['latMax']);
        $this->assertEquals(13.0, $coverage[0]['lonMin']);
        $this->assertEquals(14.0, $coverage[0]['lonMax']);
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
        $this->assertEquals('AWARD-001', $funding[0]['awardNumber']);
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
        $stmt = $this->connection->prepare("INSERT INTO Resource (version, language, publicationYear) VALUES (1, 'en', 2024)");
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
        $stmt = $this->connection->prepare("INSERT INTO Resource (version, language, publicationYear) VALUES (1, 'en', 2024)");
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
