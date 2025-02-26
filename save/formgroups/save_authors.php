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
    $familynames = $postData['familynames'] ?? [];
    $givennames = $postData['givennames'] ?? [];
    $orcids = $postData['orcids'] ?? [];
    $affiliations = $postData['affiliation'] ?? [];
    $rorIds = $postData['authorRorIds'] ?? [];

    $len = count($familynames);

    for ($i = 0; $i < $len; $i++) {
        $familyname = trim($familynames[$i]);
        $givenname = trim($givennames[$i]);
        $orcid = trim($orcids[$i]);
        $affiliation_data = isset($affiliations[$i]) ? $affiliations[$i] : '';
        $rorId_data = isset($rorIds[$i]) ? $rorIds[$i] : '';

        // Skip authors without family names
        if (empty($familyname)) {
            continue;
        }

        // Check if there is a ROR ID without an affiliation
        $rorIdArray = parseRorIds($rorId_data);
        $affiliationArray = parseAffiliationData($affiliation_data);
        if (!empty($rorIdArray) && empty($affiliationArray)) {
            continue; // Skip this author
        }

        $author_id = null;

        // Check if the author already exists (only if ORCID is provided)
        if (!empty($orcid)) {
            $stmt = $connection->prepare("SELECT author_id FROM Author WHERE orcid = ?");
            $stmt->bind_param("s", $orcid);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows > 0) {
                // Author already exists, get the ID
                $row = $result->fetch_assoc();
                $author_id = $row['author_id'];

                // Update the author's data
                $stmt = $connection->prepare("UPDATE Author SET familyname = ?, givenname = ? WHERE author_id = ?");
                $stmt->bind_param("ssi", $familyname, $givenname, $author_id);
                $stmt->execute();
            }
            $stmt->close();
        }

        // Insert new author if not found (ORCID is empty or not matched)
        if (!$author_id) {
            $stmt = $connection->prepare("INSERT INTO Author (familyname, givenname, orcid) VALUES (?, ?, ?)");
            $stmt->bind_param("sss", $familyname, $givenname, $orcid);
            $stmt->execute();
            $author_id = $stmt->insert_id;
            $stmt->close();
        }

        // Insert into Resource_has_Author
        $stmt = $connection->prepare("INSERT IGNORE INTO Resource_has_Author (Resource_resource_id, Author_author_id) VALUES (?, ?)");
        $stmt->bind_param("ii", $resource_id, $author_id);
        $stmt->execute();
        $stmt->close();

        // Always save affiliations, regardless of whether the author is new or already exists
        if (!empty($affiliation_data)) {
            saveAffiliations($connection, $author_id, $affiliation_data, $rorId_data, 'Author_has_Affiliation', 'Author_author_id');
        }
    }
}

