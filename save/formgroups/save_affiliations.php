<?php

/**
 * Saves affiliations to the database and links them to a specified entity.
 *
 * This function processes the provided affiliation and ROR ID data, saving them to the database
 * if they do not already exist, and links them to the specified entity (e.g., Author, Contact Person).
 *
 * @param mysqli  $connection       The database connection.
 * @param int     $entity_id        The ID of the entity to link the affiliations to (e.g., Author or Contact Person).
 * @param string  $affiliation_data The raw affiliation data (e.g., a string of comma-separated names).
 * @param string  $rorId_data       The raw ROR ID data (e.g., a string of comma-separated ROR IDs).
 * @param string  $link_table       The name of the table linking the entity to the affiliations.
 *                                  Expected format: `<Entity>_has_Affiliation`.
 * @param string  $entity_column    The name of the column in the linking table that refers to the entity ID.
 *                                  Expected format: `<Entity>_<entity_column>`.
 *
 * @return void
 *
 */
function saveAffiliations($connection, $entity_id, $affiliation_data, $rorId_data, $link_table, $entity_column)
{
    $affiliations = parseAffiliationEntries($affiliation_data, $rorId_data);

    foreach ($affiliations as $affiliation) {
        $affiliationName = $affiliation['label'];
        if (empty($affiliationName)) {
            continue; // Skip empty affiliations
        }

        $rorId = $affiliation['rorId'];
        $affiliation_id = null;

        if ($rorId !== null) {
            $stmt = $connection->prepare("SELECT affiliation_id FROM Affiliation WHERE rorId = ? ORDER BY affiliation_id ASC LIMIT 1");
            $stmt->bind_param("s", $rorId);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();

            if ($row) {
                $affiliation_id = (int) $row['affiliation_id'];
                $updateStmt = $connection->prepare("UPDATE Affiliation SET name = ? WHERE affiliation_id = ?");
                $updateStmt->bind_param("si", $affiliationName, $affiliation_id);
                $updateStmt->execute();
                $updateStmt->close();
            }
        }

        if ($affiliation_id === null) {
            // Check if affiliation already exists
            $stmt = $connection->prepare("SELECT affiliation_id FROM Affiliation WHERE name = ?");
            $stmt->bind_param("s", $affiliationName);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();

            if ($row) {
                // Update existing affiliation
                $affiliation_id = (int) $row['affiliation_id'];

                if ($rorId !== null) {
                    $updateStmt = $connection->prepare("UPDATE Affiliation SET rorId = ? WHERE affiliation_id = ?");
                    $updateStmt->bind_param("si", $rorId, $affiliation_id);
                    $updateStmt->execute();
                    $updateStmt->close();
                }
            } else {
                // Create new affiliation
                $stmt = $connection->prepare("INSERT INTO Affiliation (name, rorId) VALUES (?, ?)");
                $stmt->bind_param("ss", $affiliationName, $rorId);
                $stmt->execute();
                $affiliation_id = $stmt->insert_id;
            }
            $stmt->close();
        }

        // Check if link already exists in the link table
        $checkLinkStmt = $connection->prepare("SELECT 1 FROM $link_table WHERE $entity_column = ? AND Affiliation_affiliation_id = ?");
        $checkLinkStmt->bind_param("ii", $entity_id, $affiliation_id);
        $checkLinkStmt->execute();
        $linkResult = $checkLinkStmt->get_result();

        if ($linkResult->num_rows === 0) {
            // Insert link only if it doesn't already exist
            $stmt = $connection->prepare("INSERT INTO $link_table ($entity_column, Affiliation_affiliation_id) VALUES (?, ?)");
            $stmt->bind_param("ii", $entity_id, $affiliation_id);
            $stmt->execute();
            $stmt->close();
        }
    }
}

/**
 * Parses structured affiliation data together with the legacy ROR ID CSV.
 *
 * @param string|null $affiliation_data JSON string containing affiliation data.
 * @param string|null $rorId_data Comma-separated legacy ROR IDs.
 * @return array<int, array{label: string, rorId: string|null}>
 */
function parseAffiliationEntries($affiliation_data, $rorId_data): array
{
    if (empty($affiliation_data)) {
        return [];
    }

    $affiliations = json_decode($affiliation_data, true);
    if (!is_array($affiliations)) {
        return [];
    }

    $legacyRorIds = parseRorIds($rorId_data);
    $entries = [];

    foreach ($affiliations as $index => $affiliation) {
        if (!is_array($affiliation)) {
            continue;
        }

        $label = trim((string) ($affiliation['label'] ?? $affiliation['value'] ?? $affiliation['name'] ?? ''));
        $rorId = normalizeRorId($affiliation['rorId'] ?? $affiliation['id'] ?? $legacyRorIds[$index] ?? null);

        $entries[] = [
            'label' => $label,
            'rorId' => $rorId
        ];
    }

    return $entries;
}

/**
 * Parses affiliation data from JSON string into an array of affiliation names
 * 
 * @param string|null $affiliation_data JSON string containing affiliation data in format [{"value": "affiliation name"}, ...]
 * @return array Array of affiliation names, empty array if input is invalid or empty
 */
function parseAffiliationData($affiliation_data)
{
    if (empty($affiliation_data)) {
        return [];
    }

    $affiliations = json_decode($affiliation_data, true);
    if (!$affiliations) {
        return [];
    }

    return array_map(function ($aff) {
        return $aff['value'] ?? $aff['label'] ?? $aff['name'] ?? '';
    }, $affiliations);
}

function normalizeRorId($rorId): ?string
{
    if ($rorId === null) {
        return null;
    }

    $rorId = trim((string) $rorId);
    if ($rorId !== '' && ($rorId[0] === '[' || $rorId[0] === '{')) {
        $decoded = json_decode($rorId, true);
        if (is_array($decoded)) {
            $candidate = isset($decoded[0]) && is_array($decoded[0]) ? $decoded[0] : $decoded;
            $rorId = trim((string) ($candidate['rorId'] ?? $candidate['id'] ?? $candidate['value'] ?? ''));
        }
    }

    $rorId = preg_replace('#^https?://ror\.org/#', '', $rorId);

    return $rorId !== '' ? $rorId : null;
}

/**
 * Parses ROR IDs from a comma-separated string into an array
 * Extracts the ID part from full ROR URLs if present
 * 
 * @param string|null $rorId_data Comma-separated string of ROR IDs (can be full URLs or just IDs)
 * @return array Array of ROR IDs (without URL prefix), null values for empty entries
 */
function parseRorIds($rorId_data)
{
    if (empty($rorId_data)) {
        return [];
    }

    $rorId_data = trim((string) $rorId_data);
    if ($rorId_data !== '' && ($rorId_data[0] === '[' || $rorId_data[0] === '{')) {
        $decoded = json_decode($rorId_data, true);
        if (is_array($decoded)) {
            $items = array_is_list($decoded) ? $decoded : [$decoded];

            return array_map(function ($item) {
                if (is_array($item)) {
                    return normalizeRorId($item['rorId'] ?? $item['id'] ?? $item['value'] ?? null);
                }

                return normalizeRorId($item);
            }, $items);
        }
    }

    $rorIds = explode(',', $rorId_data);
    return array_map(function ($rorId) {
        return normalizeRorId($rorId);
    }, $rorIds);
}
