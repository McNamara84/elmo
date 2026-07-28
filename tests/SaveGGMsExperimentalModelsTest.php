<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_ggms_altimetry_models.php';
require_once __DIR__ . '/../save/formgroups/save_ggms_mascons.php';

final class SaveGGMsExperimentalModelsTest extends DatabaseTestCase
{
    private int $resourceId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resourceId = $this->createResource('experimental.ggm', 'Experimental GGM');
    }

    public function testSavesGravityOverOceansMetadataForAltimetryDerivedModel(): void
    {
        saveGGMsAltimetryModels($this->connection, [
            'model_type' => 'Altimetry-derived',
            'reference_ellipsoid' => 'WGS84',
            'tide_system' => 'mean tide',
            'gravity_field_method' => 'Least squares collocation',
            'calculation_method' => 'Remove-restore',
            'gra_file_name' => 'DTU17.nc',
            'gra_spatial_resolution' => '1 arc-minute',
            'gra_spatial_coverage' => 'global',
            'gra_calculation_method' => 'Remove-restore',
        ], $this->resourceId);

        $result = $this->connection->query(
            "SELECT gra.file_name, gra.spatial_resolution, gra.spatial_coverage, gra.calculation_method
             FROM `Altimetry_Derived_Gravity_Over_Oceans_Properties` gra
             JOIN `Resource_has_Altimetry_Derived_Gravity_Over_Oceans_Properties` link
               ON link.altimetry_derived_gravity_over_oceans_property_id =
                  gra.altimetry_derived_gravity_over_oceans_property_id
             WHERE link.resource_id = {$this->resourceId}"
        );
        $record = $result->fetch_assoc();

        $this->assertSame('DTU17.nc', $record['file_name']);
        $this->assertSame('1 arc-minute', $record['spatial_resolution']);
        $this->assertSame('global', $record['spatial_coverage']);
        $this->assertSame('Remove-restore', $record['calculation_method']);
    }

    public function testSavesNewMasconMetadataWhenMasconIsMathematicalRepresentation(): void
    {
        saveGGMsMascons($this->connection, [
            'mathematical_representation' => 'MASCON',
            'land_mascon' => 'Included',
            'time_bound' => 'Monthly',
            'data_ewh' => 'Equivalent water height',
            'uncertainty' => 'Provided',
            'scale_factor' => 'Provided',
            'gad' => 'Applied',
            'mascon_regularisation_method' => 'Tikhonov',
            'mascon_shape' => 'Spherical cap',
            'mascon_spatial_resolution' => '3 degrees',
        ], $this->resourceId);

        $result = $this->connection->query(
            "SELECT regularisation_method, shape, spatial_resolution
             FROM `MASCON_Properties` properties
             JOIN `Resource_has_MASCON_Properties` link
               ON link.mascon_property_id = properties.mascon_property_id
             WHERE link.resource_id = {$this->resourceId}"
        );
        $record = $result->fetch_assoc();

        $this->assertSame('Tikhonov', $record['regularisation_method']);
        $this->assertSame('Spherical cap', $record['shape']);
        $this->assertSame('3 degrees', $record['spatial_resolution']);
    }
}

