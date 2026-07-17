<?php
/**
 * Validates that all required fields are present and not empty
 *
 * @param array $postData The POST data to validate
 * @param array $requiredFields Array of field names that must be present and filled
 * @param array $requiredArrayFields Array of field names that must be present as non-empty arrays
 * @return bool True if all required fields are present and filled, false otherwise
 */
function validateRequiredFields($postData, $requiredFields = [], $requiredArrayFields = [])
{
    // Check regular fields
    foreach ($requiredFields as $field) {
        if (!isset($postData[$field]) || $postData[$field] === '' || $postData[$field] === null) {
            error_log("[SAVE] Validation failed: Required field '$field' is missing or empty.");
            return false;
        }
    }

    // Check array fields
    foreach ($requiredArrayFields as $field) {
        if (!isset($postData[$field]) || !is_array($postData[$field]) || empty($postData[$field])) {
            error_log("[SAVE] Validation failed: Required array field '$field' is missing, not an array, or empty.");
            return false;
        }
    }

    return true;
}

/**
 * Validates that dependent array fields have matching entries.
 * Each primary array element must have a corresponding dependent element.
 *
 * @param array $data The data to validate
 * @param array $dependencies Array of ['primary' => 'field1', 'dependent' => 'field2']
 * @return bool True if all dependencies are satisfied
 */
function validateArrayDependencies($data, $dependencies)
{
    foreach ($dependencies as $dep) {
        $primaryField = $dep['primary'];
        $dependentField = $dep['dependent'];

        // Check if primary field exists and is array
        if (!isset($data[$primaryField]) || !is_array($data[$primaryField])) {
            error_log("[SAVE] Validation failed: Primary field '$primaryField' for array dependency check is missing or not an array.");
            return false;
        }

        // Check each primary value for corresponding dependent value
        foreach ($data[$primaryField] as $i => $primaryValue) {
            // Skip empty primary values
            if (empty($primaryValue)) {
                continue;
            }

            // Decode JSON if needed and check value
            if (is_string($primaryValue) && json_decode($primaryValue)) {
                $decoded = json_decode($primaryValue, true);
                if (empty($decoded[0]['value'])) {
                    continue;
                }
            }

            // Check if corresponding dependent value exists
            if (!isset($data[$dependentField][$i]) || empty($data[$dependentField][$i])) {
                error_log("[SAVE] Validation failed: Dependent field '$dependentField' at index $i is missing or empty for primary field '$primaryField'.");
                return false;
            }
        }
    }

    return true;
}

/**
 * Validates contributor person dependencies.
 * 
 * @param array $entry Array containing the fields for one contributor person entry
 * @return bool True if the entry is valid
 */
function validateContributorPersonDependencies($entry)
{
    // If all relevant fields are empty, entry is valid (no data provided)
    if (
        empty($entry['lastname']) && empty($entry['firstname']) &&
        empty($entry['orcid']) && empty($entry['roles'])
    ) {
        return true;
    }

    // Ensure 'roles' is properly decoded from JSON if it's a string
    if (is_string($entry['roles'])) {
        $entry['roles'] = json_decode($entry['roles'], true);
    }

    // If any field is filled, ensure lastname and roles are also filled
    if (!empty($entry['firstname']) || !empty($entry['lastname']) || !empty($entry['roles'])) {
        if (empty($entry['lastname']) || empty($entry['roles']) || !is_array($entry['roles']) || count($entry['roles']) == 0) {
            error_log("[SAVE] Contributor person validation failed: lastname and roles are required if any personal information is provided. Entry: " . json_encode($entry));
            return false;
        }
    }

    return true;
}


/**
 * Validates contributor institution dependencies.
 * 
 * @param array $entry Array containing the fields for one contributor institution entry
 * @return bool True if the entry is valid
 */
function validateContributorInstitutionDependencies($entry)
{
    // If all fields are empty, entry is valid (no data provided)
    if (empty($entry['name']) && empty($entry['roles'])) {
        return true;
    }

    // Both name and roles are required if any is filled
    if (empty($entry['name']) || empty($entry['roles'])) {
        error_log("[SAVE] Contributor institution validation failed: name and roles are required if one is provided. Entry: " . json_encode($entry));
        return false;
    }

    return true;
}

/**
 * Validates the checksum of an ORCID identifier using ISO 7064 Mod 11-2.
 *
 * @param string $orcid The ORCID identifier (with hyphens, e.g. "0000-0002-1825-0097")
 * @return bool True if the checksum is valid, false otherwise
 */
function isValidOrcidChecksum(string $orcid): bool
{
    $digits = str_replace('-', '', $orcid);
    if (strlen($digits) !== 16 || !preg_match('/^\d{15}[\dX]$/', $digits)) {
        error_log("[SAVE] ORCID validation failed: Invalid format or length for ORCID '$orcid'.");
        return false;
    }

    $total = 0;
    for ($i = 0; $i < 15; $i++) {
        $total = ($total + intval($digits[$i])) * 2;
    }
    $remainder = $total % 11;
    $checkDigit = (12 - $remainder) % 11;
    $expectedChar = $checkDigit === 10 ? 'X' : strval($checkDigit);

    if ($digits[15] !== $expectedChar) {
        error_log("[SAVE] ORCID validation failed: Invalid checksum for ORCID '$orcid'.");
        return false;
    }

    return true;
}

/**
 * Validates that all required fields are present in JSON-structured keyword entries.
 *
 * @param array $keywordData The decoded JSON data to validate
 * @param array $requiredFields Array of field names that must be present in each entry
 * @return bool True if all entries contain all required fields with non-empty values
 */
function validateKeywordEntries($keywordData, $requiredFields = ['value'])
{
    if (!is_array($keywordData)) {
        error_log("[SAVE] Keyword validation failed: Input data is not an array.");
        return false;
    }

    foreach ($keywordData as $index => $entry) {
        if (!is_array($entry)) {
            error_log("[SAVE] Keyword validation failed: Entry at index $index is not an array.");
            return false;
        }
        foreach ($requiredFields as $field) {
            if (!isset($entry[$field]) || empty($entry[$field])) {
                error_log("[SAVE] Keyword validation failed: Required field '$field' is missing or empty in entry at index $index.");
                return false;
            }
        }
    }

    return true;
}

/**
 * Normalizes a time string for safe lexical comparison.
 *
 * Accepted formats are HH:MM and HH:MM:SS.
 *
 * @param string $timeValue Raw time string.
 * @return string|null Normalized HH:MM:SS time or null for invalid input.
 */
function normalizeTimeForComparison($timeValue)
{
    if (!is_string($timeValue) || trim($timeValue) === '') {
        return null;
    }

    $timeValue = trim($timeValue);
    if (!preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $timeValue)) {
        error_log("[SAVE] Time normalization failed: Invalid time format for '$timeValue'.");
        return null;
    }

    $parts = explode(':', $timeValue);
    if (count($parts) === 2) {
        $parts[] = '0';
    }

    $hours = (int) $parts[0];
    $minutes = (int) $parts[1];
    $seconds = (int) $parts[2];

    if ($hours < 0 || $hours > 23 || $minutes < 0 || $minutes > 59 || $seconds < 0 || $seconds > 59) {
        error_log("[SAVE] Time normalization failed: Time components out of range for '$timeValue'.");
        return null;
    }

    return sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds);
}

/**
 * Validates dependencies for Spatial Temporal Coverage entries.
 * 
 * @param array $entry The STC entry data
 * @return bool Returns true if dependencies are valid
 */
function validateSTCDependencies($entry)
{
    $latMin  = trim((string)($entry['latitudeMin'] ?? ''));
    $latMax  = trim((string)($entry['latitudeMax'] ?? ''));
    $longMin = trim((string)($entry['longitudeMin'] ?? ''));
    $longMax = trim((string)($entry['longitudeMax'] ?? ''));

    $hasLatMin  = $latMin !== '';
    $hasLatMax  = $latMax !== '';
    $hasLongMin = $longMin !== '';
    $hasLongMax = $longMax !== '';

    if (!$hasLatMin && !$hasLatMax && !$hasLongMin && !$hasLongMax) {
        return true;
    }

    if ($hasLatMax || $hasLongMax) {
        return $hasLatMin && $hasLatMax && $hasLongMin && $hasLongMax;
    }

    if ($hasLatMin && !$hasLongMin) {
        return false;
    }

    if ($hasLongMin && !$hasLatMin) {
        return false;
    }

    return true;
}


/**
 * Validates related work entries.
 * If any field in a row is filled, all fields in that row must be filled.
 *
 * @param array $entry Array containing the fields for one related work entry
 * @return bool True if the entry is valid
 */
function validateRelatedWorkDependencies($entry)
{
    // If all fields are empty, the entry is valid (no data provided)
    if (empty($entry['identifier']) && empty($entry['relation']) && empty($entry['identifierType'])) {
        return true;
    }

    // If any field is filled, all fields must be filled
    if (empty($entry['identifier']) || empty($entry['relation']) || empty($entry['identifierType'])) {
        error_log("[SAVE] Related work validation failed: identifier, relation, and identifierType are all required if any one is provided. Entry: " . json_encode($entry));
        return false;
    }

    return true;
}

/**
 * Validates funding reference dependencies.
 * If any of FunderID, GrantNumber, or GrantName is filled, Funder must also be filled.
 *
 * @param array $entry Array containing the fields for one funding reference entry
 * @return bool True if the entry is valid
 */
function validateFundingReferenceDependencies($entry)
{
    // If all fields are empty, the entry is valid (no data provided)
    if (
        empty($entry['funder']) && empty($entry['funderId']) &&
        empty($entry['grantNumber']) && empty($entry['grantName']) &&
        empty($entry['awardUri'])
    ) {
        return true;
    }

    // If any dependent field is filled, funder must be filled
    if (
        !empty($entry['funderId']) || !empty($entry['grantNumber']) ||
        !empty($entry['grantName']) || !empty($entry['awardUri'])
    ) {
        if (empty($entry['funder'])) {
            error_log("[SAVE] Funding reference validation failed: Funder is required if any other funding information is provided. Entry: " . json_encode($entry));
            return false;
        }
    }

    // If only funder is filled, that's valid
    return true;
}

/**
 * Retrieves valid roles from the database.
 *
 * @param mysqli $connection The database connection.
 * @return array An array with role names as keys and role IDs as values.
 */
function getValidRoles($connection)
{
    $valid_roles = [];
    $stmt = $connection->prepare("SELECT role_id, name FROM Role");
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $valid_roles[$row['name']] = $row['role_id'];
    }
    $stmt->close();
    return $valid_roles;
}