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
        
        // Create a REAL second database connection using the same logic as DatabaseTestCase
        $isCI = getenv('CI') !== false || getenv('GITHUB_ACTIONS') !== false;
        $dbname = 'mde2-msl-test';
        
        if ($isCI) {
            // GitHub Actions / GitLab CI: use test_user credentials
            $host = '127.0.0.1';
            $username = 'test_user';
            $password = 'test_password';
            
            $this->connection2 = new \mysqli($host, $username, $password, $dbname);
        } else {
            // Local Docker development: use elmo user
            $host = getenv('DB_HOST') ?: 'db';
            $username = getenv('DB_USER') ?: 'elmo';
            $password = getenv('DB_PASSWORD') ?: 'elmo';
            
            $this->connection2 = new \mysqli($host, $username, $password, $dbname);
        }
        
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
            
            // Descriptions
            "descriptionAbstract" => "This is the abstract for the second concurrent test dataset. It describes different research objectives.",
            "descriptionMethods" => "Different methodology approach using experimental design.",

            // Free Keywords
            "freekeywords" => [
                '[{"value":"parallel processing"},{"value":"isolation levels"}]',
                '[{"value":"ACID compliance"},{"value":"MySQL transactions"}]'
            ]
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
            
            // Descriptions (note: saveDescriptions expects specific keys, not arrays)
            "descriptionAbstract" => "This is the abstract for the first concurrent test dataset. It provides a comprehensive overview of the research.",
            "descriptionMethods" => "Methods used include statistical analysis and data modeling.",
            "descriptionTechnical" => "Technical specifications: MySQL 8.0, PHP 8.1",
            "descriptionOther" => "Additional information about the dataset.",

            // Free Keywords
            "freekeywords" => [
                '[{"value":"concurrent testing"},{"value":"database transactions"}]',
                '[{"value":"data integrity"}]'
            ]
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

    
    try {
        // Resource 1
        $resource_id_1 = saveResourceInformationAndRights($this->connection, $this->postData1);
        usleep(1000);
        
        // Resource 2
        $resource_id_2 = saveResourceInformationAndRights($this->connection2, $this->postData2);
        usleep(1000);
        
        // Interleaved authors
        saveAuthors($this->connection, $this->postData1, $resource_id_1);
        usleep(500);
        saveAuthors($this->connection2, $this->postData2, $resource_id_2);
        usleep(500);

        saveFreeKeywords($this->connection, $this->postData1, $resource_id_1);
        saveDescriptions($this->connection, $this->postData1, $resource_id_1);

        saveFreeKeywords($this->connection2, $this->postData2, $resource_id_2);
        saveDescriptions($this->connection2, $this->postData2, $resource_id_2);
                
        
        
    } catch (Exception $e) {

        throw $e;
    }

        // Assertions

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
        /*
        Check all the authors:
        SELECT 
            r.resource_id,
            r.doi,
            ap.familyname,
            ap.givenname,
            ap.orcid,
            GROUP_CONCAT(aff.name SEPARATOR '; ') as affiliations
        FROM Resource r
        JOIN Resource_has_Author rha ON r.resource_id = rha.Resource_resource_id
        JOIN Author a ON rha.Author_author_id = a.author_id
        JOIN Author_person ap ON a.Author_Person_author_person_id = ap.author_person_id
        LEFT JOIN Author_has_Affiliation aha ON a.author_id = aha.Author_author_id
        LEFT JOIN Affiliation aff ON aha.Affiliation_affiliation_id = aff.affiliation_id
        WHERE r.doi LIKE '%CONCURRENT.FULL%'
        GROUP BY r.resource_id, r.doi, ap.author_person_id, ap.familyname, ap.givenname, ap.orcid
        ORDER BY r.resource_id, ap.familyname;
        */


        // Verify descriptions for Resource 1 - detailed check
        $stmt = $this->connection->prepare("
            SELECT type, description FROM Description WHERE resource_id = ? ORDER BY type
        ");
        $stmt->bind_param("i", $resource_id_1);
        $stmt->execute();
        $descriptions1 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(4, $descriptions1, "Resource 1 should have 4 descriptions");
        $this->assertEquals("Abstract", $descriptions1[0]["type"]);
        $this->assertEquals($this->postData1["descriptionAbstract"], $descriptions1[0]["description"]);
        $this->assertEquals("Methods", $descriptions1[1]["type"]);
        $this->assertEquals($this->postData1["descriptionMethods"], $descriptions1[1]["description"]);
        $this->assertEquals("Other", $descriptions1[2]["type"]);
        $this->assertEquals($this->postData1["descriptionOther"], $descriptions1[2]["description"]);
        $this->assertEquals("Technical Information", $descriptions1[3]["type"]);
        $this->assertEquals($this->postData1["descriptionTechnical"], $descriptions1[3]["description"]);

        // Verify descriptions for Resource 2
        $stmt->bind_param("i", $resource_id_2);
        $stmt->execute();
        $descriptions2 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(2, $descriptions2, "Resource 2 should have 2 descriptions");
        $this->assertEquals("Abstract", $descriptions2[0]["type"]);
        $this->assertEquals($this->postData2["descriptionAbstract"], $descriptions2[0]["description"]);
        $this->assertEquals("Methods", $descriptions2[1]["type"]);
        $this->assertEquals($this->postData2["descriptionMethods"], $descriptions2[1]["description"]);

        // Verify free keywords for Resource 1
        $stmt = $this->connection->prepare("
            SELECT fk.free_keyword
            FROM Free_Keywords fk
            JOIN Resource_has_Free_Keywords rhfk ON fk.free_keywords_id = rhfk.Free_Keywords_free_keywords_id
            WHERE rhfk.Resource_resource_id = ?
            ORDER BY fk.free_keyword
        ");
        $stmt->bind_param("i", $resource_id_1);
        $stmt->execute();
        $keywords1 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(3, $keywords1, "Resource 1 should have 3 free keywords");
        $expectedKeywords1 = ["concurrent testing", "data integrity", "database transactions"];
        sort($expectedKeywords1);
        foreach ($keywords1 as $index => $row) {
            $this->assertEquals($expectedKeywords1[$index], $row["free_keyword"]);
        }

        // Verify free keywords for Resource 2
        $stmt->bind_param("i", $resource_id_2);
        $stmt->execute();
        $keywords2 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(4, $keywords2, "Resource 2 should have 4 free keywords");
        $expectedKeywords2 = ["ACID compliance", "isolation levels", "MySQL transactions", "parallel processing"];
        sort($expectedKeywords2);
        foreach ($keywords2 as $index => $row) {
            $this->assertEquals($expectedKeywords2[$index], $row["free_keyword"]);
        }

        // Verify no cross-contamination of keywords
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count
            FROM Free_Keywords fk
            JOIN Resource_has_Free_Keywords rhfk ON fk.free_keywords_id = rhfk.Free_Keywords_free_keywords_id
            WHERE rhfk.Resource_resource_id = ? AND fk.free_keyword IN (?, ?, ?, ?)
        ");
        $stmt->bind_param("issss", $resource_id_1, 
            "parallel processing", "isolation levels", "ACID compliance", "MySQL transactions");
        $stmt->execute();
        $wrongKeywords = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $wrongKeywords, "Resource 1 should not have Resource 2's keywords");

        $stmt->bind_param("issss", $resource_id_2,
            "concurrent testing", "database transactions", "data integrity", "");
        $stmt->execute();
        $wrongKeywords2 = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $wrongKeywords2, "Resource 2 should not have Resource 1's keywords");
    }
}