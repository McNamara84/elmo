<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../save/formgroups/save_descriptions.php';
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';

/**
 * Test suite for saving description text sections.
 */
class SaveDescriptionsTest extends DatabaseTestCase
{
    /**
     * Saves all four description types and verifies persistence.
     *
     * @return void
     */
    public function testSaveAllDescriptions(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ALL.DESCRIPTIONS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test All Descriptions"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "descriptionAbstract" => "This is an abstract.",
            "descriptionMethods" => "These are the methods.",
            "descriptionTechnical" => "This is technical information.",
            "descriptionOther" => "This is other information."
        ];

        $result = saveDescriptions($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'saveDescriptions should return true when all descriptions are saved successfully.');

        // Verify that all four descriptions were saved
        $stmt = $this->connection->prepare("SELECT * FROM Description WHERE resource_id = ? ORDER BY type");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(4, $result->num_rows, 'Exactly four descriptions should be saved.');

        $expectedDescriptions = [
            ['type' => 'Abstract', 'description' => $postData['descriptionAbstract']],
            ['type' => 'Methods', 'description' => $postData['descriptionMethods']],
            ['type' => 'Other', 'description' => $postData['descriptionOther']],
            ['type' => 'Technical Information', 'description' => $postData['descriptionTechnical']]
        ];

        $index = 0;
        while ($description = $result->fetch_assoc()) {
            $this->assertEquals(
                $expectedDescriptions[$index]['type'],
                $description['type'],
                'The description type does not match.'
            );
            $this->assertEquals(
                $expectedDescriptions[$index]['description'],
                $description['description'],
                "The content of the {$description['type']} description does not match."
            );
            $index++;
        }
    }

    /**
     * Saves only the abstract description and ensures others are ignored.
     *
     * @return void
     */
    public function testSaveOnlyAbstract(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ONLY.ABSTRACT",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Only Abstract"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "descriptionAbstract" => "This is an abstract.",
            "descriptionMethods" => "",
            "descriptionTechnical" => "",
            "descriptionOther" => ""
        ];

        saveDescriptions($this->connection, $postData, $resource_id);

        // Verify that only the abstract was saved
        $stmt = $this->connection->prepare("SELECT * FROM Description WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(1, $result->num_rows, 'Exactly one description should be saved.');

        $description = $result->fetch_assoc();
        $this->assertEquals('Abstract', $description['type'], "The saved description type should be 'Abstract'.");
        $this->assertEquals($postData['descriptionAbstract'], $description['description'], 'The content of the abstract does not match.');
    }

    /**
     * Attempts to save only the methods description and expects failure.
     *
     * @return void
     */
    public function testSaveOnlyMethods(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ONLY.METHODS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Only Methods"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "descriptionAbstract" => "",
            "descriptionMethods" => "These are the methods.",
            "descriptionTechnical" => "",
            "descriptionOther" => ""
        ];

        $result = saveDescriptions($this->connection, $postData, $resource_id);

        $this->assertFalse($result, 'The function should return false when only Methods is provided.');

        // Verify that no descriptions were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Description WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'No descriptions should be saved.');
    }
}