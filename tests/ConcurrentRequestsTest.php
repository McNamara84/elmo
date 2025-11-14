<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/save_data.php';

/**
 * Tests concurrent full save operations to verify transaction isolation and data integrity.
 * Simulates two simultaneous complete form submissions from the front-end using separate database connections.
 */
class ConcurrentRequestsTest extends DatabaseTestCase
{
    private $connection2;
    private $postData1;
    private $postData2;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a REAL second database connection for concurrent operations
        // Using the same credentials as the test database
        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $username = getenv('DB_USER') ?: 'test_user';
        $password = getenv('DB_PASSWORD') ?: 'test_password';
        $database = 'mde2-msl-test';
        
        $this->connection2 = new \mysqli($host, $username, $password, $database);
        
        if ($this->connection2->connect_error) {
            $this->fail("Failed to create second database connection: " . $this->connection2->connect_error);
        }
        // Prepare complete POST data for first submission
        $this->postData1 = [
            // Resource Information
            "doi" => "10.5880/GFZ.TEST.CONCURRENT.FULL.001",
            "year" => 2024,
            "dateCreated" => "2024-01-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Concurrent Test Dataset 1", "Alternative Title 1"],
            "titleType" => [1, 2],
            "version" => 1.0,
            
            // Authors
            "familynames" => ["Smith", "Johnson"],
            "givennames" => ["Alice", "Bob"],
            "orcids" => ["0000-0001-1111-1111", "0000-0002-2222-2222"],
            "personAffiliation" => [
                '[{"value":"University A"}]',
                '[{"value":"University B"}]'
            ],
            "authorPersonRorIds" => [
                'https://ror.org/03yrm5c26',
                'https://ror.org/02nr0ka47'
            ],
            
            // Contact Person
            "contactfamilyname" => ["Williams"],
            "contactgivenname" => ["Carol"],
            "contactorcid" => ["0000-0003-3333-3333"],
            "contactposition" => ["1"],
            "contactemail" => ["carol.williams@example.com"],
            "contactAffiliation" => ['[{"value":"Contact University 1"}]'],
            "contactRorId" => ['https://ror.org/0168r3w48'],
            
            // Descriptions
            "descriptionText" => [
                "This is a test dataset for concurrent save operations.",
                "Additional description for testing purposes."
            ],
            "descriptionType" => [1, 2]
        ];

        // Prepare complete POST data for second submission
        $this->postData2 = [
            // Resource Information
            "doi" => "10.5880/GFZ.TEST.CONCURRENT.FULL.002",
            "year" => 2024,
            "dateCreated" => "2024-01-02",
            "resourcetype" => 2,
            "language" => 2,
            "Rights" => 1,
            "title" => ["Concurrent Test Dataset 2", "Alternative Title 2"],
            "titleType" => [1, 2],
            "version" => 2.0,
            
            // Authors
            "familynames" => ["Brown", "Davis"],
            "givennames" => ["Diana", "Edward"],
            "orcids" => ["0000-0004-4444-4444", "0000-0005-5555-5555"],
            "personAffiliation" => [
                '[{"value":"University C"}]',
                '[{"value":"University D"}]'
            ],
            "authorPersonRorIds" => [
                'https://ror.org/04m7fg108',
                'https://ror.org/05dxps055'
            ],
            
            // Contact Person
            "contactfamilyname" => ["Taylor"],
            "contactgivenname" => ["Frank"],
            "contactorcid" => ["0000-0006-6666-6666"],
            "contactposition" => ["2"],
            "contactemail" => ["frank.taylor@example.com"],
            "contactAffiliation" => ['[{"value":"Contact University 2"}]'],
            "contactRorId" => ['https://ror.org/006zn3t30'],
            
            // Descriptions
            "descriptionText" => [
                "This is another test dataset for concurrent save operations.",
                "Additional description for the second dataset."
            ],
            "descriptionType" => [1, 3]
        ];
    }

    protected function tearDown(): void
    {
        // Close only the second connection (not the shared test connection)
        if ($this->connection2 && $this->connection2 instanceof \mysqli) {
            $this->connection2->close();
        }
        parent::tearDown();
    }

    /**
     * Test two complete concurrent save operations.
     * Simulates two users submitting complete forms simultaneously.
     * Both should succeed without data corruption or conflicts.
     *
     * @return void
     */
    public function testTwoFullConcurrentSaves(): void
    {
        // Simulate full save operation for connection 1
        $resource_id_1 = saveResourceInformationAndRights($this->connection, $this->postData1);
        $this->assertIsInt($resource_id_1, "First resource should be created");
        
        // Simulate full save operation for connection 2
        $resource_id_2 = saveResourceInformationAndRights($this->connection2, $this->postData2);
        $this->assertIsInt($resource_id_2, "Second resource should be created");

        // Run save scripts for both connections mixxxxxxxxed - to simulate concurrency
        saveAuthors($this->connection, $this->postData1, $resource_id_1); // resource 1 
        
        saveAuthors($this->connection2, $this->postData2, $resource_id_2); // resource 2

        saveContactPerson($this->connection, $this->postData1, $resource_id_1); // resource 1 again
        saveDescriptions($this->connection, $this->postData1, $resource_id_1);

        saveContactPerson($this->connection2, $this->postData2, $resource_id_2); // resource 2 again
        saveDescriptions($this->connection2, $this->postData2, $resource_id_2);


        // Verify both resources exist
        $this->assertNotEquals($resource_id_1, $resource_id_2, "Resource IDs should be different");
        // Verify data consistency for both resources. - VERY EASY 
        $stmt = $this->connection->prepare("SELECT doi, year FROM Resource WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id_1);
        $stmt->execute();
        $resource1 = $stmt->get_result()->fetch_assoc();
        $this->assertEquals($this->postData1["doi"], $resource1["doi"]);
        $this->assertEquals($this->postData1["year"], $resource1["year"]);
        $stmt->bind_param("i", $resource_id_2);
        $stmt->execute();
        $resource2 = $stmt->get_result()->fetch_assoc();
        $this->assertEquals($this->postData2["doi"], $resource2["doi"]);
        $this->assertEquals($this->postData2["year"], $resource2["year"]);


        // Verify authors -- atomicity for Resource 1
        $stmt = $this->connection->prepare("
            SELECT ap.familyname, ap.givenname, ap.orcid 
            FROM Author_person ap
            JOIN Author a ON ap.author_person_id = a.Author_Person_author_person_id
            JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
            WHERE rha.Resource_resource_id = ?
            ORDER BY ap.familyname
        ");
        $stmt->bind_param("i", $resource_id_1);
        $stmt->execute();
        $authors1 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $this->assertCount(2, $authors1, "Resource 1 should have 2 authors");
        $this->assertEquals($this->postData1["familynames"][1], $authors1[0]["familyname"]);
        $this->assertEquals($this->postData1["givennames"][1], $authors1[0]["givenname"]);
        $this->assertEquals($this->postData1["orcids"][1], $authors1[0]["orcid"]);
        $this->assertEquals($this->postData1["familynames"][0], $authors1[1]["familyname"]);
        $this->assertEquals($this->postData1["givennames"][0], $authors1[1]["givenname"]);
        $this->assertEquals($this->postData1["orcids"][0], $authors1[1]["orcid"]);
        
        // Verify authors for Resource 2
        $stmt->bind_param("i", $resource_id_2);
        $stmt->execute();
        $authors2 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $this->assertCount(2, $authors2, "Resource 2 should have 2 authors");
        $this->assertEquals($this->postData2["familynames"][0], $authors2[0]["familyname"]);
        $this->assertEquals($this->postData2["givennames"][0], $authors2[0]["givenname"]);
        $this->assertEquals($this->postData2["orcids"][0], $authors2[0]["orcid"]);
        $this->assertEquals($this->postData2["familynames"][1], $authors2[1]["familyname"]);
        $this->assertEquals($this->postData2["givennames"][1], $authors2[1]["givenname"]);
        $this->assertEquals($this->postData2["orcids"][1], $authors2[1]["orcid"]);



        // Verify contact persons for Resource 1
        $stmt = $this->connection->prepare("
            SELECT familyname, givenname, email 
            FROM Contact_Person cp
            JOIN Resource_has_Contact_Person rhcp ON cp.contact_person_id = rhcp.Contact_Person_contact_person_id
            WHERE rhcp.Resource_resource_id = ?
        ");
        $stmt->bind_param("i", $resource_id_1);
        $stmt->execute();
        $contacts1 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(1, $contacts1, "Resource 1 should have 1 contact person");
        $this->assertEquals($this->postData1["contactfamilyname"][0], $contacts1[0]["familyname"]);
        $this->assertEquals($this->postData1["contactemail"][0], $contacts1[0]["email"]);

        // Verify contact persons for Resource 2
        $stmt->bind_param("i", $resource_id_2);
        $stmt->execute();
        $contacts2 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(1, $contacts2, "Resource 2 should have 1 contact person");
        $this->assertEquals($this->postData2["contactfamilyname"][0], $contacts2[0]["familyname"]);
        $this->assertEquals($this->postData2["contactemail"][0], $contacts2[0]["email"]);



        // Verify descriptions for Resource 1
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count FROM Description WHERE resource_id = ?
        ");
        $stmt->bind_param("i", $resource_id_1);
        $stmt->execute();
        $descCount1 = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(count($this->postData1["descriptionText"]), $descCount1, "Resource 1 should have correct number of descriptions");

        // Verify descriptions for Resource 2
        $stmt->bind_param("i", $resource_id_2);
        $stmt->execute();
        $descCount2 = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(count($this->postData2["descriptionText"]), $descCount2, "Resource 2 should have correct number of descriptions");

        // Verify no cross-contamination between resources
        // Check that Resource 1 authors are not linked to Resource 2
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count 
            FROM Author_person ap
            JOIN Author a ON ap.author_person_id = a.Author_Person_author_person_id
            JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
            WHERE rha.Resource_resource_id = ? AND ap.orcid IN (?, ?)
        ");
        $stmt->bind_param("iss", $resource_id_1, $this->postData2["orcids"][0], $this->postData2["orcids"][1]);
        $stmt->execute();
        $wrongAuthors = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $wrongAuthors, "Resource 1 should not have Resource 2's authors");

        // Check that Resource 2 authors are not linked to Resource 1
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count 
            FROM Author_person ap
            JOIN Author a ON ap.author_person_id = a.Author_Person_author_person_id
            JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
            WHERE rha.Resource_resource_id = ? AND ap.orcid IN (?, ?)
        ");
        $stmt->bind_param("iss", $resource_id_2, $this->postData1["orcids"][0], $this->postData1["orcids"][1]);
        $stmt->execute();
        $wrongAuthors2 = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $wrongAuthors2, "Resource 2 should not have Resource 1's authors");
    }
}