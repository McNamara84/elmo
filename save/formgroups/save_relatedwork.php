<?php
require_once __DIR__ . '/../validation.php';

/**
 * Decodes the structured Related Works payload.
 *
 * A missing field returns null so callers can use the legacy array fields.
 * An explicitly empty JSON array remains an empty array and is authoritative.
 *
 * @param array<string, mixed> $postData Submitted form data.
 * @return list<mixed>|null Decoded payload, or null when the field is absent.
 *
 * @throws InvalidArgumentException When the supplied payload is not a JSON/list array.
 */
function decodeRelatedWorksPayload(array $postData): ?array
{
    if (!array_key_exists('relatedWorksPayload', $postData)) {
        return null;
    }

    $rawPayload = $postData['relatedWorksPayload'];

    if (is_array($rawPayload)) {
        if (!array_is_list($rawPayload)) {
            throw new InvalidArgumentException('Related Works payload must be a list.');
        }

        return $rawPayload;
    }

    if (!is_string($rawPayload)) {
        throw new InvalidArgumentException('Related Works payload must be a JSON array.');
    }

    try {
        $decoded = json_decode($rawPayload, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new InvalidArgumentException('Related Works payload contains invalid JSON.', 0, $exception);
    }

    if (!is_array($decoded) || !array_is_list($decoded)) {
        throw new InvalidArgumentException('Related Works payload must decode to a list.');
    }

    return $decoded;
}

/**
 * Normalizes a scalar form value to a trimmed string.
 *
 * @param mixed $value Submitted value.
 */
function normalizeRelatedWorkValue($value): string
{
    return is_scalar($value) ? trim((string) $value) : '';
}

/**
 * Returns the canonical identifier value for its declared identifier type.
 *
 * DOI validation accepts resolver URLs and the doi: prefix for convenient
 * input, while DataCite examples represent DOI related identifiers as bare
 * DOI names. Other identifier types are only trimmed because their prefixes
 * can be significant.
 */
function normalizeRelatedWorkIdentifier(string $identifier, string $identifierType): string
{
    $identifier = trim($identifier);

    if (strcasecmp(trim($identifierType), 'DOI') !== 0) {
        return $identifier;
    }

    $normalized = preg_replace(
        '~^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)~i',
        '',
        $identifier
    );

    return trim($normalized ?? $identifier);
}

/**
 * Normalizes entries from the structured Related Works payload.
 *
 * Empty cards are discarded. The order supplied by the list is authoritative;
 * client-provided order values are deliberately ignored and recalculated.
 *
 * @param list<mixed> $payload Decoded payload.
 * @return list<array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}>
 *
 * @throws InvalidArgumentException When an entry is not an object/associative array.
 */
function normalizeRelatedWorksFromPayload(array $payload): array
{
    $entries = [];

    foreach ($payload as $index => $rawEntry) {
        if (!is_array($rawEntry)) {
            throw new InvalidArgumentException("Related Works payload entry {$index} must be an object.");
        }

        $entry = [
            'entryKey' => normalizeRelatedWorkValue($rawEntry['entryKey'] ?? ''),
            'order' => count($entries),
            'identifier' => normalizeRelatedWorkValue($rawEntry['identifier'] ?? ''),
            'relation' => normalizeRelatedWorkValue($rawEntry['relation'] ?? ''),
            'relationId' => normalizeRelatedWorkValue($rawEntry['relationId'] ?? ''),
            'identifierType' => normalizeRelatedWorkValue($rawEntry['identifierType'] ?? ''),
        ];
        $entry['identifier'] = normalizeRelatedWorkIdentifier(
            $entry['identifier'],
            $entry['identifierType']
        );

        if (
            $entry['identifier'] === ''
            && $entry['relation'] === ''
            && $entry['relationId'] === ''
            && $entry['identifierType'] === ''
        ) {
            continue;
        }

        $entry['order'] = count($entries);
        $entries[] = $entry;
    }

    return $entries;
}

/**
 * Converts the existing parallel form arrays into the structured entry shape.
 *
 * @param array<string, mixed> $postData Submitted legacy form data.
 * @return list<array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}>
 */
function normalizeLegacyRelatedWorks(array $postData): array
{
    $identifiers = isset($postData['rIdentifier']) && is_array($postData['rIdentifier'])
        ? $postData['rIdentifier']
        : [];
    $relations = isset($postData['relation']) && is_array($postData['relation'])
        ? $postData['relation']
        : [];
    $identifierTypes = isset($postData['rIdentifierType']) && is_array($postData['rIdentifierType'])
        ? $postData['rIdentifierType']
        : [];
    $entryCount = max(count($identifiers), count($relations), count($identifierTypes));
    $entries = [];

    for ($index = 0; $index < $entryCount; $index++) {
        $relation = normalizeRelatedWorkValue($relations[$index] ?? '');
        $entry = [
            'entryKey' => "related-work-legacy-{$index}",
            'order' => count($entries),
            'identifier' => normalizeRelatedWorkValue($identifiers[$index] ?? ''),
            'relation' => $relation,
            'relationId' => is_numeric($relation) ? $relation : '',
            'identifierType' => normalizeRelatedWorkValue($identifierTypes[$index] ?? ''),
        ];
        $entry['identifier'] = normalizeRelatedWorkIdentifier(
            $entry['identifier'],
            $entry['identifierType']
        );

        if (
            $entry['identifier'] === ''
            && $entry['relation'] === ''
            && $entry['identifierType'] === ''
        ) {
            continue;
        }

        $entry['order'] = count($entries);
        $entries[] = $entry;
    }

    return $entries;
}

/**
 * Resolves the authoritative Related Works input.
 *
 * When relatedWorksPayload is present, including an explicit empty array, it
 * takes precedence over legacy fields. Legacy arrays are used only when the
 * structured payload field is absent.
 *
 * @param array<string, mixed> $postData Submitted form data.
 * @return list<array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}>
 */
function normalizeRelatedWorksPayload(array $postData): array
{
    $payload = decodeRelatedWorksPayload($postData);

    if ($payload !== null) {
        return normalizeRelatedWorksFromPayload($payload);
    }

    return normalizeLegacyRelatedWorks($postData);
}

/**
 * Returns the relation reference preferred for persistence and validation.
 *
 * @param array{relation?: mixed, relationId?: mixed} $entry Normalized entry.
 */
function getRelatedWorkRelationReference(array $entry): string
{
    $relationId = normalizeRelatedWorkValue($entry['relationId'] ?? '');

    return $relationId !== ''
        ? $relationId
        : normalizeRelatedWorkValue($entry['relation'] ?? '');
}

/**
 * Resolves a relation ID, preferring the submitted ID and falling back to its
 * canonical name when both are available.
 *
 * @param mysqli $connection Active database connection.
 * @param array{relation?: mixed, relationId?: mixed} $entry Normalized entry.
 * @return int|null Resolved relation ID, or null when neither reference exists.
 */
function resolveRelatedWorkRelationId(mysqli $connection, array $entry): ?int
{
    $relationId = normalizeRelatedWorkValue($entry['relationId'] ?? '');
    $relationName = normalizeRelatedWorkValue($entry['relation'] ?? '');

    if ($relationId !== '') {
        $resolvedId = getRelationId($connection, $relationId);
        if ($resolvedId !== null) {
            return $resolvedId;
        }
    }

    return $relationName !== '' ? getRelationId($connection, $relationName) : null;
}

/**
 * Saves the related work information into the database.
 *
 * This function processes the input data for related work, saving entries
 * where all fields in a row are filled. It saves the data into the database
 * and creates the linkage to the resource.
 *
 * @param mysqli $connection  The database connection.
 * @param array<string, mixed> $postData The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if saving was successful, false otherwise.
 *
 * @throws mysqli_sql_exception If a database error occurs.
 */
function saveRelatedWork($connection, $postData, $resource_id)
{
    $action = $postData['action'] ?? 'save_and_download';
    $entries = normalizeRelatedWorksPayload($postData);
    $allSuccessful = true;

    foreach ($entries as $entry) {
        $relationReference = getRelatedWorkRelationReference($entry);
        $validationEntry = [
            'identifier' => $entry['identifier'],
            'relation' => $relationReference,
            'identifierType' => $entry['identifierType'],
        ];

        if ($action === 'submit') {
            if (!validateRelatedWorkDependencies($validationEntry)) {
                error_log('Related Work entry validation failed: ' . json_encode($validationEntry));
                $allSuccessful = false;
                continue;
            }

            $relation_id = resolveRelatedWorkRelationId($connection, $entry);
            $identifier_type_id = getIdentifierTypeId($connection, $entry['identifierType']);

            if ($relation_id === null || $identifier_type_id === null) {
                error_log('Failed to retrieve IDs for Related Work entry : ' . json_encode($entry));
                $allSuccessful = false;
                continue;
            }

        } else {
            // Preserve the existing draft/save behavior: incomplete entries are
            // ignored unless identifier and relation are both available.
            if ($entry['identifier'] === '' || $relationReference === '') {
                continue;
            }

            $relation_id = resolveRelatedWorkRelationId($connection, $entry);

            if ($entry['identifierType'] === '') {
                $identifier_type_id = null;
            } else {
                $identifier_type_id = getIdentifierTypeId($connection, $entry['identifierType']);
            }

        }

        $related_work_id = insertRelatedWork(
            $connection,
            $entry['identifier'],
            $relation_id,
            $identifier_type_id
        );

        if ($related_work_id) {
            $linked = linkResourceToRelatedWork(
                $connection,
                $resource_id,
                $related_work_id,
                (int) $entry['order']
            );

            if (!$linked && $action === 'submit') {
                $allSuccessful = false;
            }
        } else {
            error_log('Failed to link resource to Related Work for entry: ' . json_encode($entry));
            if ($action === 'submit') {
                $allSuccessful = false;
            }
        }
    }

    return $allSuccessful;
}

/**
 * Retrieves the relation id based on name or numeric ID.
 * @param mysqli $connection The database connection.
 * @param string|int $relationNameOrId The relation name or ID to search for.
 *
 * @return int|null The found relation ID or null if not found.
 */
function getRelationId(mysqli $connection, string|int $relationNameOrId): ?int
{
    // If numeric, verify the ID exists
    if (is_numeric($relationNameOrId)) {
        $stmt = $connection->prepare("SELECT `relation_id` FROM `Relation` WHERE `relation_id` = ?");
        if (!$stmt) {
            error_log("Failed to prepare statement for getRelationId: " . $connection->error);
            return null;
        }
        $id = (int)$relationNameOrId;
        $stmt->bind_param("i", $id);
    } else {
        // Search by name
        $stmt = $connection->prepare("SELECT `relation_id` FROM `Relation` WHERE `name` = ?");
        if (!$stmt) {
            error_log("Failed to prepare statement for getRelationId: " . $connection->error);
            return null;
        }
        $stmt->bind_param("s", $relationNameOrId);
    }
    
    if (!$stmt->execute()) {
        error_log("Failed to execute statement for getRelationId: " . $stmt->error);
        $stmt->close();
        return null;
    }
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ? (int)$row['relation_id'] : null;
}

/**
 * Retrieves the identifier type ID based on the given name.
 *
 * @param mysqli $connection           The database connection.
 * @param string $identifier_type_name The name of the identifier type.
 *
 * @return int|null The found identifier type ID or null if not found.
 */
function getIdentifierTypeId(mysqli $connection,string $identifier_type_name): ?int
{
    $stmt = $connection->prepare("SELECT `identifier_type_id` FROM `Identifier_Type` WHERE `name` = ?");
    if (!$stmt) {
        error_log("Failed to prepare statement for getIdentifierTypeId: " . $connection->error);
        return null;
    }
    $stmt->bind_param("s", $identifier_type_name);
    if (!$stmt->execute()) {
        error_log("Failed to execute statement for getIdentifierTypeId: " . $stmt->error);
        $stmt->close();
        return null;
    }
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    $result = $row ? (int)$row['identifier_type_id'] : null;
    error_log("I found the id for the idType. it is " . $result);
    return $result;
}

/**
 * Inserts a related work entry into the database.
 *
 * @param mysqli $connection         The database connection.
 * @param string $identifier         The identifier of the related work.
 * @param int    $relation_id        The relation ID.
 * @param int|null $identifier_type_id The identifier type ID, or null for draft entries.
 *
 * @return int|false The ID of the inserted related work entry or false on failure.
 */
function insertRelatedWork($connection, $identifier, $relation_id, $identifier_type_id)
{
    $stmt = $connection->prepare("INSERT INTO Related_Work (`Identifier`, `relation_fk`, `identifier_type_fk`) VALUES (?, ?, ?)");
    if (!$stmt) {
        error_log("Error preparing statement for insertRelatedWork: " . $connection->error);
        return false;
    }
    $stmt->bind_param("sii", $identifier, $relation_id, $identifier_type_id);
    if ($stmt->execute()) {
        $related_work_id = $stmt->insert_id;
        $stmt->close();
        return $related_work_id;
    } else {
        error_log("Error inserting Related Work: " . $stmt->error);
        $stmt->close();
        return false;
    }
}

/**
 * Links a resource to a related work entry.
 *
 * @param mysqli $connection      The database connection.
 * @param int    $resource_id     The ID of the resource.
 * @param int    $related_work_id The ID of the related work.
 * @param int|null $sort_order    Explicit order, or null to append.
 *
 * @return bool True when the link was saved.
 */
function linkResourceToRelatedWork($connection, $resource_id, $related_work_id, ?int $sort_order = null): bool
{
    if ($sort_order === null) {
        $sort_order = getNextRelatedWorkSortOrder($connection, (int) $resource_id);
        if ($sort_order === null) {
            return false;
        }
    }

    $sort_order = max(0, $sort_order);
    $stmt = $connection->prepare(
        "INSERT INTO Resource_has_Related_Work "
        . "(`Resource_resource_id`, `Related_Work_related_work_id`, `sort_order`) "
        . "VALUES (?, ?, ?)"
    );
    if (!$stmt) {
        error_log("Error preparing statement for linkResourceToRelatedWork: " . $connection->error);
        return false;
    }
    $stmt->bind_param("iii", $resource_id, $related_work_id, $sort_order);
    if (!$stmt->execute()) {
        error_log("Error executing statement for linkResourceToRelatedWork: " . $stmt->error);
        $stmt->close();
        return false;
    }
    $stmt->close();
    return true;
}

/**
 * Returns the next append position for a resource's Related Works.
 *
 * This keeps legacy callers such as Used Instruments and GGM data sources
 * ordered after links that were already saved for the resource.
 *
 * @param mysqli $connection Active database connection.
 * @param int $resource_id Resource whose next Related Work position is requested.
 * @return int|null Next zero-based sort position, or null on a database error.
 */
function getNextRelatedWorkSortOrder(mysqli $connection, int $resource_id): ?int
{
    $stmt = $connection->prepare(
        'SELECT COALESCE(MAX(`sort_order`), -1) + 1 AS `next_sort_order` '
        . 'FROM `Resource_has_Related_Work` WHERE `Resource_resource_id` = ?'
    );

    if (!$stmt) {
        error_log('Error preparing statement for getNextRelatedWorkSortOrder: ' . $connection->error);
        return null;
    }

    $stmt->bind_param('i', $resource_id);
    if (!$stmt->execute()) {
        error_log('Error executing statement for getNextRelatedWorkSortOrder: ' . $stmt->error);
        $stmt->close();
        return null;
    }

    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return isset($row['next_sort_order']) ? (int) $row['next_sort_order'] : 0;
}
