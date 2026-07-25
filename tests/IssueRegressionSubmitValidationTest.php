<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_spatialtemporalcoverage.php';

final class IssueRegressionSubmitValidationTest extends DatabaseTestCase
{
    public function testSubmitAllowsMissingDateCreatedForIssue929(): void
    {
        $GLOBALS['showLicense'] = false;

        $resourceId = saveResourceInformationAndRights($this->connection, [
            'action' => 'submit',
            'doi' => '10.5880/GFZ.TEST.ISSUE.929.NO.CREATED',
            'year' => 2026,
            'dateCreated' => '',
            'dateEmbargo' => '',
            'resourcetype' => 1,
            'version' => '',
            'language' => 1,
            'Rights' => 1,
            'title' => ['Issue 929 Date Created Optional'],
            'titleType' => [1],
        ]);

        $this->assertIsInt($resourceId, 'Submit should create a resource even when Date Created is empty.');

        $stmt = $this->connection->prepare('SELECT dateCreated FROM Resource WHERE resource_id = ?');
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        $this->assertNull($row['dateCreated']);
    }



    public function testElmoGemSubmitPersistsSpatialOnlyStcWithDescriptionForIssue1068(): void
    {
        $previous = $GLOBALS['showGGMsProperties'] ?? null;
        $GLOBALS['showGGMsProperties'] = true;

        try {
            $resourceId = $this->createResource('GFZ.TEST.ISSUE.1068.GEM', 'Issue 1068 GEM');
            $result = saveSpatialTemporalCoverage($this->connection, $this->spatialOnlyPostData(), $resourceId);

            $this->assertTrue($result, 'ELMO-GEM submit should accept spatial-only STC with a description.');
            $this->assertSame(1, $this->countStcRelations($resourceId));

            $stc = $this->fetchLinkedStc($resourceId);
            $this->assertSame(-90.0, (float) $stc['latitudeMin']);
            $this->assertSame(90.0, (float) $stc['latitudeMax']);
            $this->assertSame(-180.0, (float) $stc['longitudeMin']);
            $this->assertSame(180.0, (float) $stc['longitudeMax']);
            $this->assertSame('Global spatial coverage', $stc['description']);
            $this->assertNull($stc['dateStart']);
            $this->assertNull($stc['dateEnd']);
        } finally {
            $this->restoreGlobal('showGGMsProperties', $previous);
        }
    }

    public function testElmoGemSubmitRejectsTimedStcWithoutDatesForIssue1068(): void
    {
        $this->markTestSkipped('Temporarily skipped per request while STC timed-without-dates behavior is being revisited.');

        $previous = $GLOBALS['showGGMsProperties'] ?? null;
        $GLOBALS['showGGMsProperties'] = true;

        try {
            $resourceId = $this->createResource(
                'GFZ.TEST.ISSUE.1068.GEM.TIME.NO.DATES',
                'Issue 1068 GEM Time Without Dates'
            );
            $postData = $this->spatialOnlyPostData();
            $postData['tscTimeStart'] = ['08:00'];
            $postData['tscTimeEnd'] = ['09:00'];
            $postData['tscTimezone'] = ['UTC'];

            $result = saveSpatialTemporalCoverage($this->connection, $postData, $resourceId);

            $this->assertFalse($result, 'ELMO-GEM submit should reject time values without matching dates.');
            $this->assertSame(0, $this->countStcRelations($resourceId));
        } finally {
            $this->restoreGlobal('showGGMsProperties', $previous);
        }
    }

    public function testElmoGemSubmitAllowsSpatialOnlyStcWithoutDescriptionForIssue1068(): void
    {
        $previous = $GLOBALS['showGGMsProperties'] ?? null;
        $GLOBALS['showGGMsProperties'] = true;

        try {
            $resourceId = $this->createResource('GFZ.TEST.ISSUE.1068.GEM.NO.DESCRIPTION', 'Issue 1068 GEM No Description');
            $postData = $this->spatialOnlyPostData();
            $postData['tscDescription'] = [''];

            $result = saveSpatialTemporalCoverage($this->connection, $postData, $resourceId);

            $this->assertTrue($result, 'ELMO-GEM submit should allow spatial-only STC without description.');
            $this->assertSame(1, $this->countStcRelations($resourceId));

            $stc = $this->fetchLinkedStc($resourceId);
            $this->assertNull($stc['description']);
        } finally {
            $this->restoreGlobal('showGGMsProperties', $previous);
        }
    }

    /**
     * @return array<string, array<int, string>|string>
     */
    private function spatialOnlyPostData(): array
    {
        return [
            'action' => 'submit',
            'tscLatitudeMin' => ['-90'],
            'tscLatitudeMax' => ['90'],
            'tscLongitudeMin' => ['-180'],
            'tscLongitudeMax' => ['180'],
            'tscDescription' => ['Global spatial coverage'],
            'tscDateStart' => [''],
            'tscDateEnd' => [''],
            'tscTimeStart' => [''],
            'tscTimeEnd' => [''],
            'tscTimezone' => [''],
        ];
    }

    private function countStcRelations(int $resourceId): int
    {
        $stmt = $this->connection->prepare(
            'SELECT COUNT(*) AS count FROM Resource_has_Spatial_Temporal_Coverage WHERE Resource_resource_id = ?'
        );
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();

        return (int) $stmt->get_result()->fetch_assoc()['count'];
    }

    /**
     * @return array<string, string|null>
     */
    private function fetchLinkedStc(int $resourceId): array
    {
        $stmt = $this->connection->prepare(
            'SELECT stc.* FROM Spatial_Temporal_Coverage stc
             INNER JOIN Resource_has_Spatial_Temporal_Coverage rel
                ON rel.Spatial_Temporal_Coverage_spatial_temporal_coverage_id = stc.spatial_temporal_coverage_id
             WHERE rel.Resource_resource_id = ?'
        );
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();

        return $stmt->get_result()->fetch_assoc();
    }

    private function restoreGlobal(string $name, mixed $previous): void
    {
        if ($previous === null) {
            unset($GLOBALS[$name]);
            return;
        }

        $GLOBALS[$name] = $previous;
    }
}
