<?php
namespace Tests;

use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../save/formgroups/save_ggmsproperties.php';

class SaveGGMsProperties extends DatabaseTestCase
{
     /**
     * Test saving a GGM Properties entry with all fields populated.
     */
    public function testSaveFullGGMsProperties()
    {
        $resource_id = $this->createResource('GGM.FULL', 'Test GGM Full');

        $postData = [
            "rModelType" => [1],
            "rMathematicalRepresentation" => [1],
            "celestial_body" => "Mars",
            "rFileFormat" => [2],
            "model_name" => "MARS_GGM_2024",
            "product_type" => "gravity_field"
        ];

        saveGGMsProperties($this->connection, $postData, $resource_id);

        // Fetch from DB and assert
        $stmt = $this->connection->prepare("SELECT * FROM GGM_Properties WHERE Model_Name = ?");
        $stmt->bind_param("s", $postData["model_name"]);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, "GGM Properties entry should be saved.");
        $this->assertEquals($postData["model_name"], $result["Model_Name"]);
        $this->assertEquals($postData["celestial_body"], $result["Celestial_Body"]);
        $this->assertEquals($postData["product_type"], $result["Product_Type"]);
    }

    /**
     * Test saving GGM Properties with only required fields.
     */
    public function testSaveRequiredGGMsProperties()
    {
        $resource_id = $this->createResource('GGM.REQUIRED', 'Test GGM Required');

        $postData = [
            "rModelType" => [1],
            "rMathematicalRepresentation" => [1],
            "model_name" => "REQUIRED_ONLY_GGM"
        ];

        saveGGMsProperties($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare("SELECT * FROM GGM_Properties WHERE Model_Name = ?");
        $stmt->bind_param("s", $postData["model_name"]);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, "GGM Properties entry with required fields should be saved.");
        $this->assertEquals($postData["model_name"], $result["Model_Name"]);
    }

    /**
     * Test saving GGM Properties with missing required fields (should not save).
     */
    public function testSaveGGMsPropertiesMissingRequired()
    {
        $resource_id = $this->createResource('GGM.MISSING', 'Test GGM Missing');

        $postData = [
            // Missing required fields like model_name
            "rModelType" => [1]
        ];

        $result = saveGGMsProperties($this->connection, $postData, $resource_id);

        $this->assertFalse($result, "Saving GGM Properties with missing required fields should fail.");

        // Ensure nothing was saved
        $stmt = $this->connection->prepare("SELECT * FROM GGM_Properties WHERE Model_Name IS NULL OR Model_Name = ''");
        $stmt->execute();
        $this->assertEquals(0, $stmt->get_result()->num_rows, "No GGM Properties entry should be saved with missing required fields.");
    }
}