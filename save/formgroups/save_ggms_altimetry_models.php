<?php

/**
 * Saves the experimental ELMO-GEM metadata for altimetry-derived products.
 *
 * Only selected product panels submit enabled inputs, so this deliberately
 * creates no product record until a panel contributes metadata.
 */
function saveGGMsAltimetryModels(mysqli $connection, array $postData, int $resourceId): void
{
    $modelType = strtolower(trim((string) ($postData['model_type'] ?? '')));
    if ($modelType !== 'altimetry-derived') {
        return;
    }

    $referenceEllipsoid = trim((string) ($postData['reference_ellipsoid'] ?? ''));
    if ($referenceEllipsoid === 'Other') {
        $referenceEllipsoid = trim((string) ($postData['reference_ellipsoid_other'] ?? ''));
    }

    $tideSystem = $postData['tide_system'] ?? null;
    $gravityFieldMethod = $postData['gravity_field_method'] ?? null;
    $calculationMethod = $postData['calculation_method'] ?? null;

    $stmt = $connection->prepare(
        'INSERT INTO `Altimetry_Derived_Properties`
            (`reference_ellipsoid`, `tide_system`, `gravity_field_method`, `calculation_method`)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('ssss', $referenceEllipsoid, $tideSystem, $gravityFieldMethod, $calculationMethod);
    $stmt->execute();
    $altimetryId = $stmt->insert_id;
    $stmt->close();

    $stmt = $connection->prepare(
        'INSERT INTO `Resource_has_Altimetry_Derived_Properties`
            (`resource_id`, `altimetry_derived_property_id`) VALUES (?, ?)'
    );
    $stmt->bind_param('ii', $resourceId, $altimetryId);
    $stmt->execute();
    $stmt->close();

    $graFields = [
        'gra_file_name',
        'gra_spatial_resolution',
        'gra_spatial_coverage',
        'gra_calculation_method',
    ];
    $hasGravityOverOceans = array_filter(
        array_map(static fn(string $key): string => trim((string) ($postData[$key] ?? '')), $graFields),
        static fn(string $value): bool => $value !== ''
    );
    if (!$hasGravityOverOceans) {
        return;
    }

    $fileName = $postData['gra_file_name'] ?? null;
    $spatialResolution = $postData['gra_spatial_resolution'] ?? null;
    $spatialCoverage = $postData['gra_spatial_coverage'] ?? null;
    $graCalculationMethod = $postData['gra_calculation_method'] ?? null;

    $stmt = $connection->prepare(
        'INSERT INTO `Altimetry_Derived_Gravity_Over_Oceans_Properties`
            (`file_name`, `spatial_resolution`, `spatial_coverage`, `calculation_method`)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('ssss', $fileName, $spatialResolution, $spatialCoverage, $graCalculationMethod);
    $stmt->execute();
    $graId = $stmt->insert_id;
    $stmt->close();

    $stmt = $connection->prepare(
        'INSERT INTO `Resource_has_Altimetry_Derived_Gravity_Over_Oceans_Properties`
            (`resource_id`, `altimetry_derived_gravity_over_oceans_property_id`) VALUES (?, ?)'
    );
    $stmt->bind_param('ii', $resourceId, $graId);
    $stmt->execute();
    $stmt->close();
}

