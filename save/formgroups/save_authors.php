<?php
require_once __DIR__ . '/save_affiliations.php';
require_once __DIR__ . '/../validation.php';

/**
 * Filters the input author data and returns only person authors that provide
 * at least one name part or an ORCID. Given (first) names are optional
 * to support mononymous person authors and ORCID-only records.
 *
 * This is used to exclude empty author entries before saving to the database.
 *
 * @param array $postData Input data containing arrays of author fields:
 *                        - familynames (array of strings)
 *                        - givennames (array of strings)
 *                        - orcids (optional array of strings)
 *                        - personAffiliation (optional array of strings)
 *                        - authorPersonRorIds (optional array of strings)
 * @return array Filtered author data arrays containing only non-empty entries.
 */
function filterValidPersonAuthors(array $postData): array
{
    // Initialize arrays to collect valid author data
    $validAuthors = [
        'familynames' => [],
        'givennames' => [],
        'orcids' => [],
        'personAffiliation' => [],
        'authorPersonRorIds' => []
    ];

    // If familynames is missing or empty, return empty validAuthors
    if (empty($postData['familynames'])) {
        return $validAuthors;
    }

    // Extract input arrays or default empty arrays for optional fields
    $familynames = $postData['familynames'];
    $givennames = $postData['givennames'] ?? [];
    $orcids = $postData['orcids'] ?? [];
    $affiliations = $postData['personAffiliation'] ?? [];
    $rorids = $postData['authorPersonRorIds'] ?? [];

    // Loop through all author entries by index
    foreach ($familynames as $i => $family) {
        // Get corresponding given name or empty string if not set
        $given = $givennames[$i] ?? '';
        $orcid = normalizeAuthorOrcid($orcids[$i] ?? '');

        // Keep person authors that provide at least a name part or an ORCID.
        if (trim($family) !== '' || trim($given) !== '' || $orcid !== '') {
            // Append trimmed valid fields to results arrays, safely handling optional data
            $validAuthors['familynames'][] = trim($family);
            $validAuthors['givennames'][] = trim($given);
            $validAuthors['orcids'][] = $orcid;
            $validAuthors['personAffiliation'][] = $affiliations[$i] ?? '';
            $validAuthors['authorPersonRorIds'][] = $rorids[$i] ?? '';
        }
    }

    // Return the filtered list containing only complete author data entries
    return $validAuthors;
}

/**
 * Validates the author data array for individuals.
 *
 * Expects the following keys in $postData:
 * - familynames (array)
 * - givennames (array)
 *
 * @param array $postData
 * @return bool true if valid, otherwise false
 */
function validatePersonAuthors(array $postData): bool
{
    if (empty($postData['familynames'])) {
        return false;
    }

    $familynames = $postData['familynames'];

    foreach ($familynames as $family) {
        if (trim($family) !== '') {
            return true;
        }
    }

    return false;
}

/**
 * Validates the author data array for institutions.
 *
 * Validation rule:
 * - At least one institutional author must exist
 * - Every institutional author must have a non-empty institution name
 *
 * @param array $postData
 * @return bool true if valid, otherwise false
 */
function validateInstitutionAuthors(array $postData): bool
{
    if (empty($postData['authorinstitutionName']) || !is_array($postData['authorinstitutionName'])) {
        return false;
    }

    foreach ($postData['authorinstitutionName'] as $name) {
        if (is_string($name) && trim($name) !== '') {
            return true; // At least one valid institution found
        }
    }

    return false; // No valid entries found
}

/**
 * Decodes the unified Authors payload from submitted form data.
 *
 * @param array<string, mixed> $postData Submitted form data.
 * @return list<mixed>|null Decoded payload or null when it is absent or invalid.
 */
function decodeAuthorsPayload(array $postData): ?array
{
    if (!array_key_exists('authorsPayload', $postData)) {
        return null;
    }

    if (is_array($postData['authorsPayload'])) {
        return $postData['authorsPayload'];
    }

    if (!is_string($postData['authorsPayload']) || trim($postData['authorsPayload']) === '') {
        return null;
    }

    $decoded = json_decode($postData['authorsPayload'], true);

    return is_array($decoded) ? $decoded : null;
}

/**
 * Normalizes HTML/JSON boolean representations used by Authors fields.
 *
 * @param mixed $value Boolean-like value.
 * @return bool Normalized boolean.
 */
function normalizeAuthorBoolean($value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_string($value)) {
        return in_array(strtolower($value), ['1', 'true', 'on', 'yes'], true);
    }

    return (bool) $value;
}

/**
 * Formats an ORCID identifier as four groups of four characters.
 *
 * @param string $value ORCID digits with optional separators.
 * @return string Formatted identifier or an empty string.
 */
function formatAuthorOrcidIdentifier(string $value): string
{
    $upperValue = strtoupper($value);
    $hasTrailingX = substr($upperValue, -1) === 'X';
    $digits = preg_replace('/\D/', '', $value) ?? '';

    if ($hasTrailingX && strlen($digits) >= 15) {
        $digits = substr($digits, 0, 15) . 'X';
    }

    $digits = substr($digits, 0, 16);

    if ($digits === '') {
        return '';
    }

    return trim(chunk_split($digits, 4, '-'), '-');
}

/**
 * Removes ORCID resolver URLs and normalizes recognized identifiers.
 *
 * @param mixed $orcid Submitted ORCID value.
 * @return string Normalized ORCID without a resolver URL prefix.
 */
function normalizeAuthorOrcid($orcid): string
{
    $orcid = trim((string) $orcid);

    if ($orcid === '') {
        return '';
    }

    if (preg_match('/(?:https?:\/\/)?orcid\.org\/(\d{4}-?\d{4}-?\d{4}-?(?:\d{4}|\d{3}X))(?:[\/?#].*)?$/i', $orcid, $matches) === 1) {
        return formatAuthorOrcidIdentifier($matches[1]);
    }

    $orcid = preg_replace('/^https?:\/\/orcid\.org\//i', '', $orcid) ?? $orcid;

    return rtrim(trim($orcid), '/');
}

/**
 * Converts structured Authors affiliations to the legacy storage fields.
 *
 * @param mixed $affiliations Structured affiliation entries.
 * @return array{affiliation_data: string, rorId_data: string}
 */
function normalizeAuthorAffiliations($affiliations): array
{
    if (!is_array($affiliations)) {
        return [
            'affiliation_data' => '',
            'rorId_data' => ''
        ];
    }

    $normalized = [];
    $rorIds = [];

    foreach ($affiliations as $affiliation) {
        if (!is_array($affiliation)) {
            continue;
        }

        $label = trim((string) ($affiliation['label'] ?? $affiliation['value'] ?? $affiliation['name'] ?? ''));
        $rorId = normalizeRorId($affiliation['rorId'] ?? $affiliation['id'] ?? null);

        if ($label === '' && $rorId === null) {
            continue;
        }

        $normalized[] = [
            'value' => $label,
            'label' => $label,
            'rorId' => $rorId ?? '',
            'id' => $rorId ?? ''
        ];
        $rorIds[] = $rorId ?? '';
    }

    return [
        'affiliation_data' => empty($normalized) ? '' : json_encode($normalized, JSON_UNESCAPED_SLASHES),
        'rorId_data' => implode(',', $rorIds)
    ];
}

/**
 * Validates and normalizes ordered person and institution payload entries.
 *
 * @param list<mixed> $payload Decoded Authors payload.
 * @return list<array<string, mixed>> Normalized author records in payload order.
 */
function normalizeAuthorsFromPayload(array $payload): array
{
    $authors = [];

    foreach ($payload as $author) {
        if (!is_array($author)) {
            continue;
        }

        $type = $author['type'] ?? '';
        $affiliationData = normalizeAuthorAffiliations($author['affiliations'] ?? []);

        if ($type === 'person') {
            $familyname = trim((string) ($author['familyname'] ?? $author['familyName'] ?? ''));
            $givenname = trim((string) ($author['givenname'] ?? $author['givenName'] ?? ''));
            $orcid = normalizeAuthorOrcid($author['orcid'] ?? '');

            if ($familyname === '' && $givenname === '' && $orcid === '') {
                continue;
            }

            $authors[] = [
                'type' => 'person',
                'familyname' => $familyname,
                'givenname' => $givenname,
                'orcid' => $orcid,
                'institutionname' => null,
                'isContact' => normalizeAuthorBoolean($author['isContact'] ?? false),
                'email' => trim((string) ($author['email'] ?? '')),
                'website' => trim((string) ($author['website'] ?? '')),
                'affiliation_data' => $affiliationData['affiliation_data'],
                'rorId_data' => $affiliationData['rorId_data']
            ];
        } elseif ($type === 'institution') {
            $institutionname = trim((string) ($author['institutionname'] ?? $author['institutionName'] ?? ''));

            if ($institutionname === '') {
                continue;
            }

            $authors[] = [
                'type' => 'institution',
                'familyname' => null,
                'givenname' => null,
                'orcid' => null,
                'institutionname' => $institutionname,
                'isContact' => false,
                'email' => '',
                'website' => '',
                'affiliation_data' => $affiliationData['affiliation_data'],
                'rorId_data' => $affiliationData['rorId_data']
            ];
        }
    }

    return $authors;
}

/**
 * Builds normalized author records from the legacy parallel form arrays.
 *
 * @param array<string, mixed> $postData Submitted legacy form fields.
 * @return list<array<string, mixed>> Normalized person records followed by institutions.
 */
function normalizeLegacyAuthors(array $postData): array
{
    $authors = [];
    $filteredPersons = (!empty($postData['familynames']) || !empty($postData['givennames']))
        ? filterValidPersonAuthors($postData)
        : [
            'familynames' => [],
            'givennames' => [],
            'orcids' => [],
            'personAffiliation' => [],
            'authorPersonRorIds' => []
        ];

    foreach ($filteredPersons['familynames'] as $i => $familyname) {
        $affiliationData = trim($filteredPersons['personAffiliation'][$i] ?? '');
        $rorIdData = trim($filteredPersons['authorPersonRorIds'][$i] ?? '');

        if (!empty(parseRorIds($rorIdData)) && empty(parseAffiliationData($affiliationData))) {
            continue;
        }

        $authors[] = [
            'type' => 'person',
            'familyname' => trim($familyname),
            'givenname' => trim($filteredPersons['givennames'][$i] ?? ''),
            'orcid' => normalizeAuthorOrcid($filteredPersons['orcids'][$i] ?? ''),
            'institutionname' => null,
            'isContact' => false,
            'email' => '',
            'website' => '',
            'affiliation_data' => $affiliationData,
            'rorId_data' => $rorIdData
        ];
    }

    $institutionnames = $postData['authorinstitutionName'] ?? [];
    $institutionAffiliations = $postData['institutionAffiliation'] ?? [];
    $institutionRorIds = $postData['authorInstitutionRorIds'] ?? [];

    foreach ($institutionnames as $i => $institutionname) {
        $institutionname = trim((string) $institutionname);

        if ($institutionname === '') {
            continue;
        }

        $affiliationData = trim($institutionAffiliations[$i] ?? '');
        $rorIdData = trim($institutionRorIds[$i] ?? '');

        if (!empty(parseRorIds($rorIdData)) && empty(parseAffiliationData($affiliationData))) {
            continue;
        }

        $authors[] = [
            'type' => 'institution',
            'familyname' => null,
            'givenname' => null,
            'orcid' => null,
            'institutionname' => $institutionname,
            'isContact' => false,
            'email' => '',
            'website' => '',
            'affiliation_data' => $affiliationData,
            'rorId_data' => $rorIdData
        ];
    }

    return $authors;
}

/**
 * Reports whether form data contains an explicitly non-empty Authors payload.
 *
 * @param array<string, mixed> $postData Submitted form data.
 * @return bool True when at least one raw payload entry is present.
 */
function hasNonemptyAuthorsPayload(array $postData): bool
{
    $payload = decodeAuthorsPayload($postData);

    return is_array($payload) && count($payload) > 0;
}

/**
 * Resolves the preferred unified payload with a legacy-field fallback.
 *
 * @param array<string, mixed> $postData Submitted form data.
 * @return list<array<string, mixed>> Normalized ordered authors.
 */
function normalizeAuthorsPayload(array $postData): array
{
    $payload = decodeAuthorsPayload($postData);

    if (is_array($payload) && count($payload) > 0) {
        return normalizeAuthorsFromPayload($payload);
    }

    return normalizeLegacyAuthors($postData);
}

/**
 * Saves author information in the database.
 *
 * This function processes input data for authors, saves it in the database,
 * and creates corresponding entries for affiliations.
 *
 * @param mysqli $connection The database connection.
 * @param array  $postData   The POST data from the form. Expected keys are:
 *                           - familynames: array
 *                           - givennames: array
 *                           - orcids: array
 *                           - personAffiliation: array
 *                           - authorPersonRorIds: array
 *                           - authorinstitutionName: array
 *                           - institutionAffiliation: array
 *                           - authorInstitutionRorIds: array
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return void|false
 *
 * @throws mysqli_sql_exception If a database error occurs.
 */
function saveAuthors($connection, $postData, $resource_id)
{
    $action = $postData['action'] ?? 'save_and_download';
    $authors = normalizeAuthorsPayload($postData);

    if ($action === 'submit' && empty($authors)) {
        // No valid author data. only fails when BOTH are invalid, which is the correct behavior.
        throw new Exception("No valid author data provided");
    }

    try {
        foreach ($authors as $sortOrder => $author) {
            $orcid = normalizeAuthorOrcid($author['orcid'] ?? '');

            if ($action === 'submit' && $orcid !== '' && !isValidOrcidChecksum($orcid)) {
                throw new Exception("Invalid ORCID checksum: {$orcid}");
            }

            $author['orcid'] = $orcid;
            $author_id = processAuthor($connection, $author);
            linkResourceAuthor($connection, $resource_id, $author_id, $sortOrder);
        }
    } catch (Exception $e) {
        error_log("Error processing authors: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Processes a single author's data including creation/update and affiliations.
 *
 * @param mysqli $connection The database connection
 * @param array $authorData Array containing author data:
 *                         - familyname: string
 *                         - givenname: string
 *                         - orcid: string
 *                         - affiliation_data: string
 *                         - rorId_data: string
 *
 * @throws mysqli_sql_exception If a database error occurs
 */
function processAuthor($connection, $authorData): int
{
    $author_person_id = null;
    $author_institution_id = null;

    $hasPersonData = ($authorData['type'] ?? '') === 'person'
        && (trim((string) ($authorData['familyname'] ?? '')) !== ''
            || trim((string) ($authorData['givenname'] ?? '')) !== ''
            || trim((string) ($authorData['orcid'] ?? '')) !== '');

    if ($hasPersonData) {
        // 1. Save or find PERSON
        // Author_person.orcid is NOT NULL, so empty strings are stored as-is and = suffices
        $stmt = $connection->prepare("SELECT author_person_id FROM Author_person WHERE familyname = ? AND givenname = ? AND orcid = ?");
        $stmt->bind_param("sss", $authorData['familyname'], $authorData['givenname'], $authorData['orcid']);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        if ($row) {
            $author_person_id = $row['author_person_id'];
        } else {
            $stmtInsert = $connection->prepare("INSERT INTO Author_person (familyname, givenname, orcid) VALUES (?, ?, ?)");
            $stmtInsert->bind_param("sss", $authorData['familyname'], $authorData['givenname'], $authorData['orcid']);
            $stmtInsert->execute();
            $author_person_id = $stmtInsert->insert_id;
            $stmtInsert->close();
        }
        $stmt->close();
    }

    if (!empty($authorData['institutionname'])) {
        // 2. Save or find INSTITUTION
        $stmt = $connection->prepare("SELECT author_institution_id FROM Author_institution WHERE institutionname = ?");
        $stmt->bind_param("s", $authorData['institutionname']);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        if ($row) {
            $author_institution_id = $row['author_institution_id'];
        } else {
            $stmtInsert = $connection->prepare("INSERT INTO Author_institution (institutionname) VALUES (?)");
            $stmtInsert->bind_param("s", $authorData['institutionname']);
            $stmtInsert->execute();
            $author_institution_id = $stmtInsert->insert_id;
            $stmtInsert->close();
        }
        $stmt->close();
    }

    // 3. Insert Author Table (linkage)
    $stmt = $connection->prepare("SELECT author_id FROM Author WHERE Author_Person_author_person_id <=> ? AND Author_Institution_author_institution_id <=> ?");
    // Using <=> (NULL-safe equal) to correctly compare NULL values in MySQL
    $stmt->bind_param("ii", $author_person_id, $author_institution_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    if ($row) {
        $author_id = $row['author_id'];
    } else {
        // Insert new Author linkage
        $stmtInsert = $connection->prepare("INSERT INTO Author (Author_Person_author_person_id, Author_Institution_author_institution_id) VALUES (?, ?)");
        $stmtInsert->bind_param("ii", $author_person_id, $author_institution_id);
        $stmtInsert->execute();
        $author_id = $stmtInsert->insert_id;
        $stmtInsert->close();
    }
    $stmt->close();

    // Save affiliations if present
    if (!empty($authorData['affiliation_data'])) {
        saveAffiliations(
            $connection,
            $author_id,
            $authorData['affiliation_data'],
            $authorData['rorId_data'],
            'Author_has_Affiliation',
            'Author_author_id'
        );
    }

    return (int) $author_id;
}

function linkResourceAuthor($connection, int $resource_id, int $author_id, int $sortOrder): void
{
    $stmt = $connection->prepare("SELECT Resource_has_Author_id FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ? ORDER BY Resource_has_Author_id ASC LIMIT 1");
    $stmt->bind_param("ii", $resource_id, $author_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row) {
        $linkId = (int) $row['Resource_has_Author_id'];
        $stmt = $connection->prepare("UPDATE Resource_has_Author SET sort_order = ? WHERE Resource_has_Author_id = ?");
        $stmt->bind_param("ii", $sortOrder, $linkId);
        $stmt->execute();
        $stmt->close();
        return;
    }

    $stmt = $connection->prepare("INSERT INTO Resource_has_Author (Resource_resource_id, Author_author_id, sort_order) VALUES (?, ?, ?)");
    $stmt->bind_param("iii", $resource_id, $author_id, $sortOrder);
    $stmt->execute();
    $stmt->close();
}
