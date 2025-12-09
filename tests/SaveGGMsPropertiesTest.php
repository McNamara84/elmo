<?php

use PHPUnit\Framework\TestCase;

class SaveGGMsPropertiesTest extends TestCase
{
    private $connection;
    private $resourceId;
    private $ggmPropertiesId;

    protected function setUp(): void
    {
        // Mock database connection
        $this->connection = $this->createMock(mysqli::class);
        $this->resourceId = 1;
        $this->ggmPropertiesId = 100;
    }

    /**
     * Test: getGGMPropertiesId returns correct ID when exactly one record exists
     */
    public function testGetGGMPropertiesIdReturnsIdWhenOneRecordExists(): void
    {
        $stmt = $this->createMock(mysqli_stmt::class);
        
        $stmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $this->resourceId);
        
        $stmt->expects($this->once())
            ->method('execute');
        
        $result = $this->createMock(mysqli_result::class);
        $result->expects($this->once())
            ->method('fetch_all')
            ->with(MYSQLI_ASSOC)
            ->willReturn([
                ['GGM_Properties_GGM_Properties_id' => $this->ggmPropertiesId]
            ]);
        
        $stmt->expects($this->once())
            ->method('get_result')
            ->willReturn($result);
        
        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn($stmt);

        $id = getGGMPropertiesId($this->connection, $this->resourceId);
        $this->assertEquals($this->ggmPropertiesId, $id);
    }

    /**
     * Test: getGGMPropertiesId returns null when no records found
     */
    public function testGetGGMPropertiesIdReturnsNullWhenNoRecordsFound(): void
    {
        $stmt = $this->createMock(mysqli_stmt::class);
        
        $result = $this->createMock(mysqli_result::class);
        $result->expects($this->once())
            ->method('fetch_all')
            ->with(MYSQLI_ASSOC)
            ->willReturn([]);
        
        $stmt->expects($this->once())
            ->method('get_result')
            ->willReturn($result);
        
        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn($stmt);

        $id = getGGMPropertiesId($this->connection, $this->resourceId);
        $this->assertNull($id);
    }

    /**
     * Test: getGGMPropertiesId throws exception when multiple records found
     */
    public function testGetGGMPropertiesIdThrowsExceptionWhenMultipleRecordsFound(): void
    {
        $stmt = $this->createMock(mysqli_stmt::class);
        
        $result = $this->createMock(mysqli_result::class);
        $result->expects($this->once())
            ->method('fetch_all')
            ->with(MYSQLI_ASSOC)
            ->willReturn([
                ['GGM_Properties_GGM_Properties_id' => 100],
                ['GGM_Properties_GGM_Properties_id' => 101]
            ]);
        
        $stmt->expects($this->once())
            ->method('get_result')
            ->willReturn($result);
        
        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn($stmt);

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Multiple GGM_Properties records found');
        
        getGGMPropertiesId($this->connection, $this->resourceId);
    }

    /**
     * Test: getGGMPropertiesId throws exception on prepare failure
     */
    public function testGetGGMPropertiesIdThrowsExceptionOnPrepareFail(): void
    {
        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn(false);
        
        $this->connection->error = 'Prepare failed';

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Failed to prepare query');
        
        getGGMPropertiesId($this->connection, $this->resourceId);
    }

    /**
     * Test: updateGGMProperties updates all fields correctly
     */
    public function testUpdateGGMPropertiesUpdatesAllFields(): void
    {
        $data = [
            'tide_system' => 'zero tide',
            'degree' => 360,
            'errors' => 'formal',
            'error_handling_approach' => 'Some approach description',
            'radius' => 6371.2,
            'earth_gravity_constant' => 3.986004415e14
        ];

        $stmt = $this->createMock(mysqli_stmt::class);
        
        $stmt->expects($this->once())
            ->method('bind_param')
            ->with(
                'sisisdi',
                $data['tide_system'],
                $data['degree'],
                $data['errors'],
                $data['error_handling_approach'],
                $data['radius'],
                $data['earth_gravity_constant'],
                $this->ggmPropertiesId
            );
        
        $stmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);
        
        $stmt->expects($this->once())
            ->method('close');
        
        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn($stmt);

        $result = updateGGMProperties($this->connection, $data, $this->ggmPropertiesId);
        $this->assertNull($result);
    }

    /**
     * Test: updateGGMProperties throws exception on execute failure
     */
    public function testUpdateGGMPropertiesThrowsExceptionOnExecuteFail(): void
    {
        $data = [
            'tide_system' => 'zero tide',
            'degree' => 360,
            'errors' => 'formal',
            'error_handling_approach' => null,
            'radius' => null,
            'earth_gravity_constant' => 3.986004415e14
        ];

        $stmt = $this->createMock(mysqli_stmt::class);
        
        $stmt->expects($this->once())
            ->method('execute')
            ->willReturn(false);
        
        $stmt->error = 'Execute failed';
        
        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn($stmt);

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Error updating GGM_Properties');
        
        updateGGMProperties($this->connection, $data, $this->ggmPropertiesId);
    }

    /**
     * Test: insertEllipsoidalParameters returns null when no semimajor axis provided
     */
    public function testInsertEllipsoidalParametersReturnsNullWhenNoData(): void
    {
        $data = ['semimajor_axis_a' => ''];

        $result = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);
        $this->assertNull($result);
    }

    /**
     * Test: insertEllipsoidalParameters inserts record with only semimajor axis
     */
    public function testInsertEllipsoidalParametersInsertsWithOnlyAxis(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => ''
        ];

        $insertStmt = $this->createMock(mysqli_stmt::class);
        $linkStmt = $this->createMock(mysqli_stmt::class);
        
        $insertStmt->expects($this->once())
            ->method('bind_param')
            ->with('d', $data['semimajor_axis_a']);
        
        $insertStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);
        
        $insertStmt->insert_id = 200;
        
        $insertStmt->expects($this->once())
            ->method('close');
        
        $linkStmt->expects($this->once())
            ->method('bind_param')
            ->with('ii', $this->resourceId, 200);
        
        $linkStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);
        
        $linkStmt->expects($this->once())
            ->method('close');

        $this->connection->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnOnConsecutiveCalls($insertStmt, $linkStmt);

        $result = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);
        $this->assertEquals(200, $result);
    }

    /**
     * Test: insertEllipsoidalParameters inserts record with axis and second variable
     */
    public function testInsertEllipsoidalParametersInsertsWithSecondVariable(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => 'flattening',
            'second_variable_value' => 0.00335281
        ];

        $insertStmt = $this->createMock(mysqli_stmt::class);
        $linkStmt = $this->createMock(mysqli_stmt::class);
        
        $insertStmt->expects($this->once())
            ->method('bind_param')
            ->with('dd', $data['semimajor_axis_a'], $data['second_variable_value']);
        
        $insertStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);
        
        $insertStmt->insert_id = 201;
        $insertStmt->expects($this->once())
            ->method('close');
        
        $linkStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);
        
        $linkStmt->expects($this->once())
            ->method('close');

        $this->connection->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnOnConsecutiveCalls($insertStmt, $linkStmt);

        $result = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);
        $this->assertEquals(201, $result);
    }

    /**
     * Test: insertEllipsoidalParameters throws exception on insert failure
     */
    public function testInsertEllipsoidalParametersThrowsExceptionOnInsertFail(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => ''
        ];

        $stmt = $this->createMock(mysqli_stmt::class);
        
        $stmt->expects($this->once())
            ->method('execute')
            ->willReturn(false);
        
        $stmt->error = 'Insert failed';
        
        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn($stmt);

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Error inserting Ellipsoidal_Parameters');
        
        insertEllipsoidalParameters($this->connection, $data, $this->resourceId);
    }

    /**
     * Test: saveGGMsProperties orchestrates all steps correctly
     */
    public function testSaveGGMsPropertiesCompleteFlow(): void
    {
        $postData = [
            'tide_system' => 'zero tide',
            'degree' => 360,
            'errors' => 'formal',
            'error_handling_approach' => 'Description',
            'radius' => 6371.2,
            'earth_gravity_constant' => 3.986004415e14,
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => ''
        ];

        // Mock getGGMPropertiesId
        $getStmt = $this->createMock(mysqli_stmt::class);
        $result = $this->createMock(mysqli_result::class);
        $result->expects($this->once())
            ->method('fetch_all')
            ->willReturn([['GGM_Properties_GGM_Properties_id' => $this->ggmPropertiesId]]);
        $getStmt->expects($this->once())->method('get_result')->willReturn($result);

        // Mock updateGGMProperties
        $updateStmt = $this->createMock(mysqli_stmt::class);
        $updateStmt->expects($this->once())->method('execute')->willReturn(true);

        // Mock insertEllipsoidalParameters
        $insertStmt = $this->createMock(mysqli_stmt::class);
        $insertStmt->expects($this->once())->method('execute')->willReturn(true);
        $insertStmt->insert_id = 200;

        $linkStmt = $this->createMock(mysqli_stmt::class);
        $linkStmt->expects($this->once())->method('execute')->willReturn(true);

        $this->connection->expects($this->exactly(4))
            ->method('prepare')
            ->willReturnOnConsecutiveCalls($getStmt, $updateStmt, $insertStmt, $linkStmt);

        $result = saveGGMsProperties($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);
    }

    /**
     * Test: saveGGMsProperties throws exception when no GGM_Properties found
     */
    public function testSaveGGMsPropertiesThrowsExceptionWhenNoGGMFound(): void
    {
        $stmt = $this->createMock(mysqli_stmt::class);
        $result = $this->createMock(mysqli_result::class);
        $result->expects($this->once())
            ->method('fetch_all')
            ->willReturn([]);
        $stmt->expects($this->once())->method('get_result')->willReturn($result);

        $this->connection->expects($this->once())
            ->method('prepare')
            ->willReturn($stmt);

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('No GGM_Properties record found');
        
        saveGGMsProperties($this->connection, [], $this->resourceId);
    }
}