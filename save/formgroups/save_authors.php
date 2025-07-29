<?php
require_once 'save_affiliations.php';

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
 *                           - affiliation: array
 *                           - authorRorIds: array
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return void|false
 *
 * @throws mysqli_sql_exception If a database error occurs.
 */
function saveAuthors($connection, $postData, $resource_id)
{
    // Validate required fields
    $requiredArrayFields = ['familynames', 'givennames'];

    if (!validateRequiredFields($postData, [], $requiredArrayFields)) {
        return false;
    }

    // Person
    $familynames = $postData['familynames'] ?? [];
    $givennames = $postData['givennames'] ?? [];
    $orcids = $postData['orcids'] ?? [];
    $personAffiliations = $postData['personAffiliation'] ?? [];
    $personRorIds = $postData['authorPersonRorIds'] ?? [];

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

        if (empty($familyname)) continue;

        $rorIdArray = parseRorIds($rorId_data);
        $affiliationArray = parseAffiliationData($affiliation_data);
        if (!empty($rorIdArray) && empty($affiliationArray)) continue;

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

        if (empty($institutionname)) continue;

        $rorIdArray = parseRorIds($rorId_data);
        $affiliationArray = parseAffiliationData($affiliation_data);
        if (!empty($rorIdArray) && empty($affiliationArray)) continue;

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
        }
        else {
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
    }
    else {
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