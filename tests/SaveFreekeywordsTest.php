<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../save/formgroups/save_freekeywords.php';

/**
 * Test suite for saving free keywords.
 */
class SaveFreekeywordsTest extends DatabaseTestCase
{
    /**
     * Saves a new uncurated free keyword and verifies its storage.
     *
     * @return void
     */
    public function testSaveSingleUncuratedFreeKeyword(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SINGLE.UNCURATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Single Uncurated Free Keyword"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [json_encode([["value" => "NewKeyword"]])]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if the keyword was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Free_Keywords WHERE free_keyword = ?");
        $keyword = "NewKeyword";
        $stmt->bind_param("s", $keyword);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, 'The free keyword should be saved.');
        $this->assertEquals(0, $result['isCurated'], 'The keyword should be marked as uncurated.');

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ? AND Free_Keywords_free_keywords_id = ?");
        $stmt->bind_param("ii", $resource_id, $result['free_keywords_id']);
        $stmt->execute();
        $relationResult = $stmt->get_result();

        $this->assertEquals(1, $relationResult->num_rows, 'A relation between Resource and Free Keyword should exist.');
    }

    /**
     * Saves a free keyword that already exists but remains uncurated.
     *
     * @return void
     */
    public function testSaveExistingUncuratedFreeKeyword(): void
    {
        // First, insert an uncurated keyword
        $this->connection->query("INSERT INTO Free_Keywords (free_keyword, isCurated) VALUES ('ExistingUncurated', 0)");
        $existing_id = $this->connection->insert_id;

        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EXISTING.UNCURATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Existing Uncurated Free Keyword"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [json_encode([["value" => "ExistingUncurated"]])]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if no new keyword was created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords WHERE free_keyword = ?");
        $keyword = "ExistingUncurated";
        $stmt->bind_param("s", $keyword);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'No new keyword should have been created.');

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ? AND Free_Keywords_free_keywords_id = ?");
        $stmt->bind_param("ii", $resource_id, $existing_id);
        $stmt->execute();
        $relationResult = $stmt->get_result();

        $this->assertEquals(1, $relationResult->num_rows, 'A link between the resource and the existing free keyword should be created.');
    }

    /**
     * Saves a free keyword that already exists and is curated.
     *
     * @return void
     */
    public function testSaveExistingCuratedFreeKeyword(): void
    {
        // First, insert a curated keyword
        $this->connection->query("INSERT INTO Free_Keywords (free_keyword, isCurated) VALUES ('ExistingCurated', 1)");
        $existing_id = $this->connection->insert_id;

        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EXISTING.CURATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Existing Curated Free Keyword"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [json_encode([["value" => "ExistingCurated"]])]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if no new keyword was created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords WHERE free_keyword = ?");
        $keyword = "ExistingCurated";
        $stmt->bind_param("s", $keyword);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'No new keyword should have been created.');

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ? AND Free_Keywords_free_keywords_id = ?");
        $stmt->bind_param("ii", $resource_id, $existing_id);
        $stmt->execute();
        $relationResult = $stmt->get_result();

        $this->assertEquals(1, $relationResult->num_rows, 'A link between the resource and the existing curated free keyword should be created.');
    }

    /**
     * Saves multiple keywords including curated and uncurated ones.
     *
     * @return void
     */
    public function testSaveMultipleMixedFreeKeywords(): void
    {
        // Insert some existing keywords
        $this->connection->query("INSERT INTO Free_Keywords (free_keyword, isCurated) VALUES ('ExistingCurated1', 1), ('ExistingUncurated1', 0)");

        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MULTIPLE.MIXED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Multiple Mixed Free Keywords"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [
                json_encode([
                    ["value" => "ExistingCurated1"],
                    ["value" => "ExistingUncurated1"],
                    ["value" => "NewKeyword1"],
                    ["value" => "NewKeyword2"]
                ])
            ]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if the correct number of keywords exists
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(4, $count, 'There should be four keywords in the database.');

        // Check if all keywords are linked to the resource
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(4, $count, 'There should be four relations between the resource and the free keywords.');

        // Check the curation status of the keywords
        $stmt = $this->connection->prepare("SELECT free_keyword, isCurated FROM Free_Keywords");
        $stmt->execute();
        $result = $stmt->get_result();
        $keywords = $result->fetch_all(MYSQLI_ASSOC);

        $expectedStatus = [
            'ExistingCurated1' => 1,
            'ExistingUncurated1' => 0,
            'NewKeyword1' => 0,
            'NewKeyword2' => 0
        ];

        foreach ($keywords as $keyword) {
            $this->assertEquals(
                $expectedStatus[$keyword['free_keyword']],
                $keyword['isCurated'],
                "The curation status for '{$keyword['free_keyword']}' is incorrect."
            );
        }
    }

    /**
     * Verifies that saving without providing free keywords does not create entries.
     *
     * @return void
     */
    public function testSaveNoFreeKeywords(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.NO.FREE.KEYWORDS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test No Free Keywords"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => []
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if no keywords were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'No free keywords should be saved.');

        // Check if no relations were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'No relations between the resource and free keywords should exist.');
    }
}