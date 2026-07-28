<?php

/**
 * Saves MASCON-specific metadata when MASCON is the mathematical representation.
 */
function saveGGMsMascons(mysqli $connection, array $postData, int $resourceId): void
{
    $representation = strtolower(trim((string) ($postData['mathematical_representation'] ?? '')));
    if ($representation !== 'mascon') {
        return;
    }

    $landMascon = $postData['land_mascon'] ?? null;
    $timeBound = $postData['time_bound'] ?? null;
    $dataEwh = $postData['data_ewh'] ?? null;
    $uncertainty = $postData['uncertainty'] ?? null;
    $scaleFactor = $postData['scale_factor'] ?? null;
    $gad = $postData['gad'] ?? null;
    $regularisationMethod = $postData['mascon_regularisation_method'] ?? null;
    $shape = $postData['mascon_shape'] ?? null;
    $spatialResolution = $postData['mascon_spatial_resolution'] ?? null;

    $stmt = $connection->prepare(
        'INSERT INTO `MASCON_Properties`
            (`land_mascon`, `time_bound`, `data_ewh`, `uncertainty`, `scale_factor`, `gad`,
             `regularisation_method`, `shape`, `spatial_resolution`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param(
        'sssssssss',
        $landMascon,
        $timeBound,
        $dataEwh,
        $uncertainty,
        $scaleFactor,
        $gad,
        $regularisationMethod,
        $shape,
        $spatialResolution
    );
    $stmt->execute();
    $masconId = $stmt->insert_id;
    $stmt->close();

    $stmt = $connection->prepare(
        'INSERT INTO `Resource_has_MASCON_Properties` (`resource_id`, `mascon_property_id`) VALUES (?, ?)'
    );
    $stmt->bind_param('ii', $resourceId, $masconId);
    $stmt->execute();
    $stmt->close();
}

