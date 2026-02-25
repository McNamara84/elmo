<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../save/formgroups/save_ggms_definition.php';

/**
 * Test suite for saving GGM Definition
 * 
 * Tests the GGM Definition save workflow:
 * - lookupForeignKeyId helper function
 * - validateGGMData validation
 * - saveGGMsDefinition complete flow
 */
final class SaveGGMsDefinitionTest extends DatabaseTestCase
{
    private $resourceId;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test resource
        $this->resourceId = $this->createResource('test.ggm.definition', 'Test GGM Definition');
        
        // Ensure lookup tables have required data
        $this->ensureLookupData();
    }

    /**
     * Ensure all required lookup data exists in database
     */
    private function ensureLookupData(): void
    {
        // Ensure Model_Type records exist
        $modelTypes = ['Static', 'Temporal', 'Topographic', 'Simulated'];
        foreach ($modelTypes as $type) {
            $sql = "INSERT IGNORE INTO `Model_Type` (`name`, `description`) VALUES (?, ?)";
            $stmt = $this->connection->prepare($sql);
            $desc = "{$type} gravity model type";
            $stmt->bind_param('ss', $type, $desc);
            $stmt->execute();
            $stmt->close();
        }

        // Ensure Mathematical_Representation records exist
        $mathReps = ['Spherical harmonics', 'Ellipsoidal harmonics'];
        foreach ($mathReps as $rep) {
            $sql = "INSERT IGNORE INTO `Mathematical_Representation` (`name`, `description`) VALUES (?, ?)";
            $stmt = $this->connection->prepare($sql);
            $desc = "{$rep} representation";
            $stmt->bind_param('ss', $rep, $desc);
            $stmt->execute();
            $stmt->close();
        }

        // Ensure File_Format records exist
        $formats = ['icgem1.0', 'icgem2.0'];
        foreach ($formats as $fmt) {
            $sql = "INSERT IGNORE INTO `File_Format` (`name`, `description`) VALUES (?, ?)";
            $stmt = $this->connection->prepare($sql);
            $desc = "{$fmt} file format";
            $stmt->bind_param('ss', $fmt, $desc);
            $stmt->execute();
            $stmt->close();
        }
    }

    // ============================================================================
    // LOOKUP FOREIGN KEY ID TESTS
    // ============================================================================

    /**
     * Test: lookupForeignKeyId returns correct ID when value exists
     */
    public function testLookupForeignKeyIdReturnsIdWhenFound(): void
    {
        $id = lookupForeignKeyId(
            $this->connection,
            'Model_Type',
            'Model_type_id',
            'name',
            'Static'
        );

        $this->assertIsInt($id);
        $this->assertGreaterThan(0, $id);
    }

    /**
     * Test: lookupForeignKeyId returns null when value not found
     */
    public function testLookupForeignKeyIdReturnsNullWhenNotFound(): void
    {
        $id = lookupForeignKeyId(
            $this->connection,
            'Model_Type',
            'Model_type_id',
            'name',
            'NonExistentType'
        );

        $this->assertNull($id);
    }

    // ============================================================================
    // VALIDATION TESTS
    // ============================================================================

    /**
     * Test: validateGGMData returns cleaned data with all valid fields
     */
    public function testValidateGGMDataWithAllValidFields(): void
    {
        $data = [
            'model_name' => 'TEST_MODEL_2024',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth',
            'product_type' => 'Gravity Field'
        ];

        $result = validateGGMData($data, $this->resourceId);

        $this->assertEquals('TEST_MODEL_2024', $result['model_name']);
        $this->assertEquals('Static', $result['model_type']);
        $this->assertEquals('Spherical harmonics', $result['mathematical_representation']);
        $this->assertEquals('icgem1.0', $result['file_format']);
        $this->assertEquals('Earth', $result['celestial_body']);
        $this->assertEquals('Gravity Field', $result['product_type']);
    }

    /**
     * Test: validateGGMData throws exception for invalid resource ID
     */
    public function testValidateGGMDataThrowsExceptionForInvalidResourceId(): void
    {
        $data = [
            'model_name' => 'TEST_MODEL',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth'
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Invalid resource ID');

        validateGGMData($data, 0);
    }

    /**
     * Test: validateGGMData throws exception for missing required field
     */
    public function testValidateGGMDataThrowsExceptionForMissingRequiredField(): void
    {
        $data = [
            'model_name' => 'TEST_MODEL',
            'model_type' => 'Static',
            // Missing: mathematical_representation, file_format, celestial_body
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Field mathematical_representation is required');

        validateGGMData($data, $this->resourceId);
    }

    /**
     * Test: validateGGMData throws exception for model name with spaces
     */
    public function testValidateGGMDataThrowsExceptionForModelNameWithSpaces(): void
    {
        $data = [
            'model_name' => 'TEST MODEL WITH SPACES',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth'
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Model name must not contain spaces');

        validateGGMData($data, $this->resourceId);
    }

    /**
     * Test: validateGGMData accepts any string for model_type (no validation against allowed values)
     */
    public function testValidateGGMDataAcceptsAnyModelType(): void
    {
        $data = [
            'model_name' => 'TEST_MODEL',
            'model_type' => 'AnyTypeValue',  // No validation against specific values
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth'
        ];

        // Should not throw - function doesn't validate model_type values
        $result = validateGGMData($data, $this->resourceId);
        $this->assertEquals('AnyTypeValue', $result['model_type']);
    }

    /**
     * Test: validateGGMData accepts any string for celestial_body (no validation against allowed values)
     */
    public function testValidateGGMDataAcceptsAnyCelestialBody(): void
    {
        $data = [
            'model_name' => 'TEST_MODEL',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Jupiter'  // No validation against specific values
        ];

        // Should not throw - function doesn't validate celestial_body values
        $result = validateGGMData($data, $this->resourceId);
        $this->assertEquals('Jupiter', $result['celestial_body']);
    }

    // ============================================================================
    // SAVE GGM DEFINITION TESTS
    // ============================================================================

    /**
     * Test: saveGGMsDefinition creates new GGM_Definition with all fields
     */
    public function testSaveGGMsDefinitionCreatesNewRecord(): void
    {
        $postData = [
            'model_name' => 'GRACE_FO_2024',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth',
            'product_type' => 'Gravity Field'
        ];

        $result = saveGGMsDefinition($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify GGM_Definition was created
        $sql = "SELECT * FROM `GGM_Definition` WHERE `Model_Name` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('s', $postData['model_name']);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($record);
        $this->assertEquals('GRACE_FO_2024', $record['Model_Name']);
        $this->assertEquals('Earth', $record['Celestial_Body']);
        $this->assertEquals('Gravity Field', $record['Product_Type']);
        $this->assertNotNull($record['Model_type_id']);
        $this->assertNotNull($record['Mathematical_representation_id']);
        $this->assertNotNull($record['File_format_id']);
    }

    /**
     * Test: saveGGMsDefinition creates link in Resource_has_GGM_Definition
     */
    public function testSaveGGMsDefinitionCreatesResourceLink(): void
    {
        $postData = [
            'model_name' => 'LINKED_MODEL_2024',
            'model_type' => 'Temporal',
            'mathematical_representation' => 'Ellipsoidal harmonics',
            'file_format' => 'icgem2.0',
            'celestial_body' => 'Mars',
            'product_type' => 'Gravity Field'
        ];

        saveGGMsDefinition($this->connection, $postData, $this->resourceId);

        // Verify link was created
        $sql = "SELECT gd.Model_Name 
                FROM `Resource_has_GGM_Definition` rhgd
                JOIN `GGM_Definition` gd ON rhgd.GGM_Definition_GGM_Definition_id = gd.GGM_Definition_id
                WHERE rhgd.Resource_resource_id = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($modelName);
        $stmt->fetch();
        $stmt->close();

        $this->assertEquals('LINKED_MODEL_2024', $modelName);
    }

    /**
     * Test: saveGGMsDefinition works without optional product_type
     */
    public function testSaveGGMsDefinitionWithoutOptionalFields(): void
    {
        $postData = [
            'model_name' => 'MINIMAL_MODEL',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth'
            // product_type is optional
        ];

        $result = saveGGMsDefinition($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify GGM_Definition was created
        $sql = "SELECT * FROM `GGM_Definition` WHERE `Model_Name` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('s', $postData['model_name']);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($record);
        $this->assertEquals('MINIMAL_MODEL', $record['Model_Name']);
    }

    /**
     * Test: saveGGMsDefinition creates multiple records for same resource (no update)
     */
    public function testSaveGGMsDefinitionCreatesMultipleRecords(): void
    {
        $postData1 = [
            'model_name' => 'FIRST_MODEL',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth'
        ];

        $postData2 = [
            'model_name' => 'SECOND_MODEL',
            'model_type' => 'Temporal',
            'mathematical_representation' => 'Ellipsoidal harmonics',
            'file_format' => 'icgem2.0',
            'celestial_body' => 'Mars'
        ];

        saveGGMsDefinition($this->connection, $postData1, $this->resourceId);
        saveGGMsDefinition($this->connection, $postData2, $this->resourceId);

        // Verify both links exist
        $sql = "SELECT COUNT(*) as count FROM `Resource_has_GGM_Definition` WHERE Resource_resource_id = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($count);
        $stmt->fetch();
        $stmt->close();

        $this->assertEquals(2, $count);
    }

    /**
     * Test: saveGGMsDefinition throws exception when foreign key lookup fails
     */
    public function testSaveGGMsDefinitionThrowsExceptionWhenForeignKeyLookupFails(): void
    {
        // Clear lookup tables to cause failure
        $this->connection->query("DELETE FROM `Model_Type`");

        $postData = [
            'model_name' => 'WILL_FAIL',
            'model_type' => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format' => 'icgem1.0',
            'celestial_body' => 'Earth'
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Failed to resolve foreign keys');

        saveGGMsDefinition($this->connection, $postData, $this->resourceId);
    }
}