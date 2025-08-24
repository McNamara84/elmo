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

        $this->assertTrue($result, "saveDescriptions sollte true zurückgeben, wenn alle Beschreibungen erfolgreich gespeichert wurden.");

        // Überprüfen, ob alle vier Descriptions gespeichert wurden
        $stmt = $this->connection->prepare("SELECT * FROM Description WHERE resource_id = ? ORDER BY type");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(4, $result->num_rows, "Es sollten genau vier Descriptions gespeichert worden sein.");

        $expectedDescriptions = [
            ['type' => 'Abstract', 'description' => $postData['descriptionAbstract']],
            ['type' => 'Methods', 'description' => $postData['descriptionMethods']],
            ['type' => 'Other', 'description' => $postData['descriptionOther']],
            ['type' => 'Technical Information', 'description' => $postData['descriptionTechnical']]
        ];

        $index = 0;
        while ($description = $result->fetch_assoc()) {
            $this->assertEquals($expectedDescriptions[$index]['type'], $description['type'], "Der Beschreibungstyp stimmt nicht überein.");
            $this->assertEquals($expectedDescriptions[$index]['description'], $description['description'], "Der Inhalt der {$description['type']} Beschreibung stimmt nicht überein.");
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

        // Überprüfen, ob nur Abstract gespeichert wurde
        $stmt = $this->connection->prepare("SELECT * FROM Description WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(1, $result->num_rows, "Es sollte genau eine Description gespeichert worden sein.");

        $description = $result->fetch_assoc();
        $this->assertEquals('Abstract', $description['type'], "Der gespeicherte Beschreibungstyp sollte 'Abstract' sein.");
        $this->assertEquals($postData['descriptionAbstract'], $description['description'], "Der Inhalt der Abstract Beschreibung stimmt nicht überein.");
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

        $this->assertFalse($result, "Die Funktion sollte false zurückgeben, wenn nur Methods ausgefüllt ist.");

        // Überprüfen, ob keine Descriptions gespeichert wurden
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Description WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Descriptions gespeichert worden sein.");
    }
}