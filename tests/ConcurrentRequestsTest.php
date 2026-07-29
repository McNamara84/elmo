<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;

require_once __DIR__ . '/../api/security.php';
require_once __DIR__ . '/../includes/save_to_db_helper.php';

/**
 * Tests concurrent full save operations to verify transaction isolation and data integrity.
 * Simulates two simultaneous complete form submissions from the front-end using separate database connections.
 */
final class ConcurrentRequestsTest extends DatabaseTestCase
{
    private $connection2;
    private $postData1;
    private $postData2;

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testSaveDataReturnsForNonPostRequestsWithoutTerminatingPhpUnit(): void
    {
        $savedRequestMethod = $_SERVER['REQUEST_METHOD'] ?? null;

        try {
            $_SERVER['REQUEST_METHOD'] = 'GET';

            require __DIR__ . '/../save/save_data.php';

            $this->addToAssertionCount(1);
        } finally {
            if ($savedRequestMethod === null) {
                unset($_SERVER['REQUEST_METHOD']);
            } else {
                $_SERVER['REQUEST_METHOD'] = $savedRequestMethod;
            }
        }
    }

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
                        // Descriptions (note: saveDescriptions expects specific keys, not arrays)
            "descriptionAbstract" => "This is the abstract for the first concurrent test dataset. It provides a comprehensive overview of the research.",
            "descriptionMethods" => "Methods used include statistical analysis and data modeling.",
            "descriptionTechnical" => "Technical specifications: MySQL 8.0, PHP 8.1",
            "descriptionOther" => "Additional information about the dataset.",

            // Free Keywords
            "freekeywords" => [
                '[{"value":"resource_1_keyword_1"},{"value":"resource_1_keyword_2"}]',
                '[{"value":"resource_1_keyword_3"}]'
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
                        
            // Descriptions
            "descriptionAbstract" => "This is the abstract for the second concurrent test dataset. It describes different research objectives.",
            "descriptionMethods" => "Different methodology approach using experimental design.",

            // Free Keywords
            "freekeywords" => [
                '[{"value":"resource_2_keyword_1"},{"value":"resource_2_keyword_2"}]',
                '[{"value":"resource_2_keyword_3"},{"value":"resource_2_keyword_4"}]'
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
        $this->assertEquals("TechnicalInfo", $descriptions1[3]["type"]);
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
        $expectedKeywords1 = ["resource_1_keyword_1", "resource_1_keyword_2", "resource_1_keyword_3"];
        sort($expectedKeywords1);
        foreach ($keywords1 as $index => $row) {
            $this->assertEquals($expectedKeywords1[$index], $row["free_keyword"]);
        }

        // Verify free keywords for Resource 2
        $stmt->bind_param("i", $resource_id_2);
        $stmt->execute();
        $keywords2 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(4, $keywords2, "Resource 2 should have 4 free keywords");
        $expectedKeywords2 = ["resource_2_keyword_1", "resource_2_keyword_2", "resource_2_keyword_3", "resource_2_keyword_4"];
        sort($expectedKeywords2);
        foreach ($keywords2 as $index => $row) {
            $this->assertEquals($expectedKeywords2[$index], $row["free_keyword"]);
        }

        // Verify no cross-contamination of keywords
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count FROM (
                -- Keywords from Resource 2 incorrectly linked to Resource 1
                SELECT fk.free_keywords_id
                FROM Free_Keywords fk
                JOIN Resource_has_Free_Keywords rhfk ON fk.free_keywords_id = rhfk.Free_Keywords_free_keywords_id
                JOIN Resource reso ON rhfk.Resource_resource_id = reso.resource_id
                WHERE reso.DOI = '10.5880/GFZ.TEST.CONCURRENT.FULL.001'
                AND fk.free_keyword LIKE 'resource_2%' -- Assuming the keyword value starts with 'resource_2'

                UNION

                -- Keywords from Resource 1 incorrectly linked to Resource 2
                SELECT fk.free_keywords_id
                FROM Free_Keywords fk
                JOIN Resource_has_Free_Keywords rhfk ON fk.free_keywords_id = rhfk.Free_Keywords_free_keywords_id
                JOIN Resource reso ON rhfk.Resource_resource_id = reso.resource_id
                WHERE reso.DOI = '10.5880/GFZ.TEST.CONCURRENT.FULL.002'
                AND fk.free_keyword LIKE 'resource_1%' -- Assuming the keyword value starts with 'resource_1'
            ) AS WrongKeywords
        ");

        // Note: Prepared statements usually use placeholders (like ? or :name) for dynamic values.
        // Since your DOIs and keyword patterns are hardcoded test values, this is fine for now.

        $stmt->execute();
        $wrongKeywords = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $wrongKeywords, "Resource 1 and Resource 2's keywords should not be mixed");
    }
    /**
     * Helper: Simulates executing save_data.php as a POST request using a specific connection.
     * This allows testing the full save_data.php script flow without HTTP layer.
     *
     * @param array $postData The POST data to submit
     * @param \mysqli $connection The database connection to use for this request
     * @param bool $useTransactions Whether to use transactions (if false, data may corrupt)
     * @return int The resource_id that was created
     */
    private function simulateSaveDataRequest(array $postData, \mysqli $connection, bool $useTransactions = true): int
    {
        // Save original state
        $savedRequestMethod = $_SERVER['REQUEST_METHOD'] ?? null;
        $savedPost = $_POST;
        $savedConnection = $GLOBALS['connection'] ?? null;
        
        try {
            // Mock the HTTP POST request
            $_SERVER['REQUEST_METHOD'] = 'POST';
            $_POST = $postData;
            $_POST['skipXmlGeneration'] = true; // Skip XML generation for testing
            $_POST['csrf-token'] = generateCsrfToken();
            $_POST['please-fill-in-this-field'] = '';
            $_SESSION['interaction_start_time'] = microtime(true) - MIN_INTERACTION_SAVE_SECONDS - 1.0;
            $GLOBALS['connection'] = $connection;
            
            ob_start();
            require __DIR__ . '/../save/save_data.php';
            ob_end_clean();
                
            // Extract resource_id from the database
            $stmt = $connection->prepare("SELECT resource_id FROM Resource WHERE DOI = ? ORDER BY resource_id DESC LIMIT 1");
            $stmt->bind_param("s", $postData['doi']);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            
            return $result ? (int)$result['resource_id'] : 0;
        } finally {
            // Restore original state
            $_SERVER['REQUEST_METHOD'] = $savedRequestMethod;
            $_POST = $savedPost;
            if ($savedConnection !== null) {
                $GLOBALS['connection'] = $savedConnection;
            } else {
                unset($GLOBALS['connection']);
            }
        }
    }

    /**
     * Test: Two concurrent saves on the SAME connection WITHOUT transactions.
     * Demonstrates potential data corruption when transaction isolation is removed.
     * 
     * This test uses minimal required fields:
     * - Resource info (doi, year, dateCreated, resourcetype, language)
     * - Author (familyname, givenname)
     * - Contact person (email)
     * - Description (abstract)
     * 
     * Both requests share the same connection and execute without transaction boundaries.
     * This tests what happens if we remove transactions - showing why they're necessary.
     *
     * @return void
     */
    public function testTwoSavesOnSameConnectionWithoutTransactions(): void
    {
        // Dataset 3 (C) - with all required fields
        $postData3 = [
            // Resource Information (required)
            "doi" => "10.5880/GFZ.TEST.NO_TRANSACTION.003",
            "year" => 2024,
            "dateCreated" => "2024-03-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Dataset C - No Transaction Model"],
            "titleType" => [1],
            
            // Authors: First author + Contact person as second author
            "familynames" => ["AuthorC", "ContactC"],
            "givennames" => ["Charlie", "Cassandra"],
            "orcids" => ["0000-0003-3333-3333", "0000-0003-3333-9999"],
            "personAffiliation" => ['[]', '[]'],
            "authorPersonRorIds" => ['', ''],
            
            // Contact Person - maps to second author by index
            "cpEmail" => ["", "cassandra@example.com"],
            
            // Description (required - Abstract)
            "descriptionAbstract" => "Dataset C: Testing concurrent saves without transactions - Charlie & Cassandra",
        ];

        // Dataset 4 (D) - with all required fields
        $postData4 = [
            // Resource Information (required)
            "doi" => "10.5880/GFZ.TEST.NO_TRANSACTION.004",
            "year" => 2024,
            "dateCreated" => "2024-04-01",
            "resourcetype" => 2,
            "language" => 2,
            "Rights" => 1,
            "title" => ["Dataset D - No Transaction Model"],
            "titleType" => [1],
            
            // Authors: First author + Contact person as second author
            "familynames" => ["AuthorD", "ContactD"],
            "givennames" => ["Diana", "Derek"],
            "orcids" => ["0000-0004-4444-4444", "0000-0004-4444-9999"],
            "personAffiliation" => ['[]', '[]'],
            "authorPersonRorIds" => ['', ''],
            
            // Contact Person - maps to second author by index
            "cpEmail" => ["", "derek@example.com"],
            
            // Description (required - Abstract)
            "descriptionAbstract" => "Dataset D: Testing concurrent saves without transactions - Diana & Derek",
        ];

        // Execute both saves on the SAME connection WITHOUT transaction boundaries
        echo "\n=== Testing TWO SAVES on SAME CONNECTION WITHOUT transactions ===\n";
        
        $resourceId3 = $this->simulateSaveDataRequest($postData3, $this->connection, false);
        echo "✓ Created resource 3 (C): $resourceId3\n";
        
        
        $resourceId4 = $this->simulateSaveDataRequest($postData4, $this->connection, false);
        echo "✓ Created resource 4 (D): $resourceId4\n";

        // ===== BASIC CHECKS =====
        $this->assertGreaterThan(0, $resourceId3, "Resource 3 should be created");
        $this->assertGreaterThan(0, $resourceId4, "Resource 4 should be created");
        $this->assertNotEquals($resourceId3, $resourceId4, "Resource IDs should be different");

        echo "\n--- Verifying Resource Basic Info ---\n";
        
        // Check for data consistency
        $stmt = $this->connection->prepare("SELECT doi, year, dateCreated FROM Resource WHERE resource_id = ?");
        $stmt->bind_param("i", $resourceId3);
        $stmt->execute();
        $result3 = $stmt->get_result()->fetch_assoc();
        
        $stmt->bind_param("i", $resourceId4);
        $stmt->execute();
        $result4 = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEquals($postData3['doi'], $result3['doi'], "Resource 3 DOI mismatch");
        $this->assertEquals($postData4['doi'], $result4['doi'], "Resource 4 DOI mismatch");
        $this->assertEquals($postData3['year'], $result3['year'], "Resource 3 year mismatch");
        $this->assertEquals($postData4['year'], $result4['year'], "Resource 4 year mismatch");
        
        echo "✓ Resource DOIs and years are correct\n";

        // ===== AUTHOR ATOMICITY CHECK =====
        echo "\n--- Verifying Author Atomicity ---\n";
        
        $stmt = $this->connection->prepare("
            SELECT ap.familyname, ap.givenname, ap.orcid 
            FROM Author_person ap
            JOIN Author a ON ap.author_person_id = a.Author_Person_author_person_id
            JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
            WHERE rha.Resource_resource_id = ?
            ORDER BY ap.familyname
        ");
        
        // Check Resource 3 authors
        $stmt->bind_param("i", $resourceId3);
        $stmt->execute();
        $authors3 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $this->assertCount(2, $authors3, "Resource 3 should have exactly 2 authors");
        
        echo "Resource 3 Authors:\n";
        foreach ($authors3 as $author) {
            echo "  - {$author['givenname']} {$author['familyname']} ({$author['orcid']})\n";
        }
        
        // Verify specific authors for Resource 3
        $familyNames3 = array_column($authors3, 'familyname');
        $this->assertContains('AuthorC', $familyNames3, "Resource 3 should have AuthorC");
        $this->assertContains('ContactC', $familyNames3, "Resource 3 should have ContactC");
        
        // Check Resource 4 authors
        $stmt->bind_param("i", $resourceId4);
        $stmt->execute();
        $authors4 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $this->assertCount(2, $authors4, "Resource 4 should have exactly 2 authors");
        
        echo "Resource 4 Authors:\n";
        foreach ($authors4 as $author) {
            echo "  - {$author['givenname']} {$author['familyname']} ({$author['orcid']})\n";
        }
        
        // Verify specific authors for Resource 4
        $familyNames4 = array_column($authors4, 'familyname');
        $this->assertContains('AuthorD', $familyNames4, "Resource 4 should have AuthorD");
        $this->assertContains('ContactD', $familyNames4, "Resource 4 should have ContactD");
        
        echo "✓ All authors are correct\n";

        // ===== CONTACT PERSON ATOMICITY CHECK =====
        echo "\n--- Verifying Contact Person Atomicity ---\n";
        
        $stmt = $this->connection->prepare("
            SELECT cp.familyName, cp.givenname, cp.email 
            FROM Contact_Person cp
            JOIN Resource_has_Contact_Person rhcp ON cp.contact_person_id = rhcp.Contact_Person_contact_person_id
            WHERE rhcp.Resource_resource_id = ?
            ORDER BY cp.familyName
        ");
        
        // Check Resource 3 contact persons
        $stmt->bind_param("i", $resourceId3);
        $stmt->execute();
        $contacts3 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $this->assertCount(1, $contacts3, "Resource 3 should have exactly 1 contact person");
        $this->assertEquals('ContactC', $contacts3[0]['familyName'], "Resource 3 contact should be ContactC");
        $this->assertEquals('cassandra@example.com', $contacts3[0]['email'], "Resource 3 contact email mismatch");
        
        echo "Resource 3 Contact Person:\n";
        foreach ($contacts3 as $cp) {
            echo "  - {$cp['givenname']} {$cp['familyName']} ({$cp['email']})\n";
        }
        
        // Check Resource 4 contact persons
        $stmt->bind_param("i", $resourceId4);
        $stmt->execute();
        $contacts4 = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $this->assertCount(1, $contacts4, "Resource 4 should have exactly 1 contact person");
        $this->assertEquals('ContactD', $contacts4[0]['familyName'], "Resource 4 contact should be ContactD");
        $this->assertEquals('derek@example.com', $contacts4[0]['email'], "Resource 4 contact email mismatch");
        
        echo "Resource 4 Contact Person:\n";
        foreach ($contacts4 as $cp) {
            echo "  - {$cp['givenname']} {$cp['familyName']} ({$cp['email']})\n";
        }
        
        echo "✓ All contact persons are correct\n";

        // ===== CROSS-CONTAMINATION CHECK =====
        echo "\n--- Checking for Cross-Contamination ---\n";
        
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count FROM (
                -- Resource 3 authors incorrectly linked to Resource 4
                SELECT a.author_id
                FROM Author a
                JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
                JOIN Author_person ap ON a.Author_Person_author_person_id = ap.author_person_id
                WHERE rha.Resource_resource_id = ?
                AND ap.familyname IN ('AuthorD', 'ContactD')
                
                UNION
                
                -- Resource 4 authors incorrectly linked to Resource 3
                SELECT a.author_id
                FROM Author a
                JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
                JOIN Author_person ap ON a.Author_Person_author_person_id = ap.author_person_id
                WHERE rha.Resource_resource_id = ?
                AND ap.familyname IN ('AuthorC', 'ContactC')
            ) AS CrossContaminationAuthors
        ");
        
        $stmt->bind_param("ii", $resourceId3, $resourceId4);
        $stmt->execute();
        $crossAuthors = $stmt->get_result()->fetch_assoc()['count'];
        
        $this->assertEquals(0, $crossAuthors, "Authors should NOT be cross-contaminated between resources");
        echo "✓ No author cross-contamination detected\n";
        
        // Cross-contamination check for contact persons
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count FROM (
                -- Resource 3 contacts incorrectly linked to Resource 4
                SELECT cp.contact_person_id
                FROM Contact_Person cp
                JOIN Resource_has_Contact_Person rhcp ON cp.contact_person_id = rhcp.Contact_Person_contact_person_id
                WHERE rhcp.Resource_resource_id = ?
                AND cp.familyName IN ('ContactD')
                
                UNION
                
                -- Resource 4 contacts incorrectly linked to Resource 3
                SELECT cp.contact_person_id
                FROM Contact_Person cp
                JOIN Resource_has_Contact_Person rhcp ON cp.contact_person_id = rhcp.Contact_Person_contact_person_id
                WHERE rhcp.Resource_resource_id = ?
                AND cp.familyName IN ('ContactC')
            ) AS CrossContaminationContacts
        ");
        
        $stmt->bind_param("ii", $resourceId3, $resourceId4);
        $stmt->execute();
        $crossContacts = $stmt->get_result()->fetch_assoc()['count'];
        
        $this->assertEquals(0, $crossContacts, "Contact persons should NOT be cross-contaminated between resources");
        echo "✓ No contact person cross-contamination detected\n";

        // ===== DESCRIPTION ATOMICITY CHECK =====
        echo "\n--- Verifying Description Atomicity ---\n";
        
        $stmt = $this->connection->prepare("
            SELECT description FROM Description 
            WHERE resource_id = ? AND type = 'Abstract'
        ");
        
        $stmt->bind_param("i", $resourceId3);
        $stmt->execute();
        $desc3 = $stmt->get_result()->fetch_assoc();
        $this->assertEquals($postData3['descriptionAbstract'], $desc3['description'], "Resource 3 description mismatch");
        echo "Resource 3 Abstract: {$desc3['description']}\n";
        
        $stmt->bind_param("i", $resourceId4);
        $stmt->execute();
        $desc4 = $stmt->get_result()->fetch_assoc();
        $this->assertEquals($postData4['descriptionAbstract'], $desc4['description'], "Resource 4 description mismatch");
        echo "Resource 4 Abstract: {$desc4['description']}\n";
        
        $stmt->close();
        echo "✓ All descriptions are correct\n";

        echo "\n=== Test Complete: No data corruption detected ===\n";
    }
}
