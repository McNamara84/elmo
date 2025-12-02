<?php
/**
 * This file loads two JSON files: one with funder data and one with a Crossref-to-ROR mapping.
 * It adds the corresponding ROR ID to each funder entry if a matching Crossref ID exists.
 * 
 */

$funders = json_decode(file_get_contents('../json/funders.json'), true);
$mapping = json_decode(file_get_contents('../json/ror_funder_registry_mapping.json'), true);

$mappedCount = 0;

// Enrich data
foreach ($funders as &$funder) {


    $crossRefId = $funder['crossRefId'] ?? null;

    // If crossRefId missing or empty → rorId = null
    if ($crossRefId === null || $crossRefId === '') {
        $funder['rorId'] = null;
        continue;
    }

    // Ensure crossRefId is treated as a string (mapping keys are strings)
    $crossRefId = (string)$crossRefId;

    // Assign ROR if mapping exists, otherwise null
    if (isset($mapping[$crossRefId])) {
        $funder['rorId'] = $mapping[$crossRefId];
        $mappedCount++;
    } else {
        $funder['rorId'] = null;
    }
}

// Prevent PHP reference side effects
unset($funder);

// Save updated funders
file_put_contents('../json/funders.json', json_encode($funders, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

echo "ROR IDs assigned: $mappedCount\n";

?>
