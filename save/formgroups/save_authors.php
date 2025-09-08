<?php
require_once __DIR__ . '/save_affiliations.php';

/**
 * Filters the input author data and returns only those authors 
 * who have both non-empty family (last) names and given (first) names.
 *
 * This is used to exclude incomplete author entries before saving to the database.
 *
 * @param array $postData Input data containing arrays of author fields:
 *                        - familynames (array of strings)
 *                        - givennames (array of strings)
 *                        - orcids (optional array of strings)
 *                        - personAffiliation (optional array of strings)
 *                        - authorPersonRorIds (optional array of strings)
 * @return array Filtered author data arrays containing only complete entries.
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

    // If either familynames or givennames is missing or empty, return empty validAuthors
    if (empty($postData['familynames']) || empty($postData['givennames'])) {
        return $validAuthors;
    }

    // Extract input arrays or default empty arrays for optional fields
    $familynames = $postData['familynames'];
    $givennames = $postData['givennames'];
    $orcids = $postData['orcids'] ?? [];
    $affiliations = $postData['personAffiliation'] ?? [];
    $rorids = $postData['authorPersonRorIds'] ?? [];

    // Loop through all author entries by index
    foreach ($familynames as $i => $family) {
        // Get corresponding given name or empty string if not set
        $given = $givennames[$i] ?? '';

        // Check if both family and given names are non-empty after trimming whitespace
        if (trim($family) !== '' && trim($given) !== '') {
            // Append trimmed valid fields to results arrays, safely handling optional data
            $validAuthors['familynames'][] = trim($family);
            $validAuthors['givennames'][] = trim($given);
            $validAuthors['orcids'][] = $orcids[$i] ?? '';
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
    if (empty($postData['familynames']) || empty($postData['givennames'])) {
        return false;
    }

    $familynames = $postData['familynames'];
    $givennames = $postData['givennames'];

    foreach ($familynames as $i => $family) {
        $given = $givennames[$i] ?? '';

        if (trim($family) !== '' && trim($given) !== '') {
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
    $hasPersonData = !empty($postData['familynames']) || !empty($postData['givennames']);
    $hasInstitutionData = !empty($postData['authorinstitutionName']);

    // Validation: at least one group must be valid
    $validPerson = $hasPersonData ? validatePersonAuthors($postData) : false;
    $validInstitution = $hasInstitutionData ? validateInstitutionAuthors($postData) : false;

    if (!$validPerson && !$validInstitution) {
        // No valid author data
        return false;
    }

    // Filtering of person authors: only complete pure
    $filteredPersons = $hasPersonData ? filterValidPersonAuthors($postData) : [
        'familynames' => [],
        'givennames' => [],
        'orcids' => [],
        'personAffiliation' => [],
        'authorPersonRorIds' => []
    ];

    // Personal data
    $familynames = $filteredPersons['familynames'];
    $givennames = $filteredPersons['givennames'];
    $orcids = $filteredPersons['orcids'];
    $personAffiliations = $filteredPersons['personAffiliation'];
    $personRorIds = $filteredPersons['authorPersonRorIds'];

    // Institution
    $institutionnames = $postData['authorinstitutionName'] ?? [];
    $institutionAffiliations = $postData['institutionAffiliation'] ?? [];
    $institutionRorIds = $postData['authorInstitutionRorIds'] ?? [];

    // Processing of personal authors
    $personCount = count($familynames);
    for ($i = 0; $i < $personCount; $i++) {
        $familyname = trim($familynames[$i] ?? '');
        $givenname = trim($givennames[$i] ?? '');
        $orcid = trim($orcids[$i] ?? '');
        $affiliation_data = trim($personAffiliations[$i] ?? '');
        $rorId_data = trim($personRorIds[$i] ?? '');


        $rorIdArray = parseRorIds($rorId_data);
        $affiliationArray = parseAffiliationData($affiliation_data);
        if (!empty($rorIdArray) && empty($affiliationArray))
            continue;

        processAuthor($connection, $resource_id, [
            'familyname' => $familyname,
            'givenname' => $givenname,
            'orcid' => $orcid,
            'institutionname' => null,
            'affiliation_data' => $affiliation_data,
            'rorId_data' => $rorId_data
        ]);
    }

    // Processing of institutional authors
    $institutionCount = count($institutionnames);
    for ($i = 0; $i < $institutionCount; $i++) {
        $institutionname = trim($institutionnames[$i] ?? '');
        $affiliation_data = trim($institutionAffiliations[$i] ?? '');
        $rorId_data = trim($institutionRorIds[$i] ?? '');

        if (empty($institutionname))
            continue;

        $rorIdArray = parseRorIds($rorId_data);
        $affiliationArray = parseAffiliationData($affiliation_data);
        if (!empty($rorIdArray) && empty($affiliationArray))
            continue;

        processAuthor($connection, $resource_id, [
            'familyname' => null,
            'givenname' => null,
            'orcid' => null,
            'institutionname' => $institutionname,
            'affiliation_data' => $affiliation_data,
            'rorId_data' => $rorId_data
        ]);
    }
}

/**
 * Processes a single author's data including creation/update and affiliations.
 *
 * @param mysqli $connection The database connection
 * @param int $resource_id The resource ID
 * @param array $authorData Array containing author data:
 *                         - familyname: string
 *                         - givenname: string
 *                         - orcid: string
 *                         - affiliation_data: string
 *                         - rorId_data: string
 *
 * @throws mysqli_sql_exception If a database error occurs
 */
function processAuthor($connection, $resource_id, $authorData)
{
    $author_person_id = null;
    $author_institution_id = null;

    if (!empty($authorData['familyname']) && !empty($authorData['givenname'])) {
        // 1. Save or find PERSON
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

    // 4. Resource_has_Author link
    $stmt = $connection->prepare("INSERT IGNORE INTO Resource_has_Author (Resource_resource_id, Author_author_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $resource_id, $author_id);
    $stmt->execute();
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
}