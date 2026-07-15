<?php
require_once __DIR__ . '/save_authors.php';
require_once __DIR__ . '/save_affiliations.php';
require_once __DIR__ . '/../validation.php';

/**
 * Saves contact person information in the database.
 *
 * This function processes input data for contact persons, saves it in the database,
 * and creates corresponding entries for affiliations, avoiding duplicates.
 *
 * @param mysqli $connection The database connection.
 * @param array  $postData   The POST data from the form. Expected keys are:
 *                           - cpLastname: array (optional)
 *                           - cpFirstname: array (optional)
 *                           - cpPosition: array (optional)
 *                           - cpEmail: array (optional)
 *                           - cpOnlineResource: array (optional)
 *                           - cpAffiliation: array (optional)
 *                           - hiddenCPRorId: array (optional)
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return void
 *
 * @throws mysqli_sql_exception If a database error occurs.
 */
function saveContactPerson($connection, $postData, $resource_id)
{
    $action = $postData['action'] ?? 'save_and_download';
    if (hasNonemptyAuthorsPayload($postData)) {
        foreach (normalizeAuthorsFromPayload(decodeAuthorsPayload($postData)) as $author) {
            if (($author['type'] ?? '') !== 'person' || ($author['isContact'] ?? false) !== true) {
                continue;
            }

            saveContactPersonEntry($connection, $resource_id, $author, $action);
        }
        return;
    }

    $familynames = $postData['familynames'] ?? [];
    $givennames = $postData['givennames'] ?? [];
    $orcids = $postData['orcids'] ?? [];
    $emails = $postData['cpEmail'] ?? [];
    $websites = $postData['cpOnlineResource'] ?? [];
    $affiliations = $postData['personAffiliation'] ?? [];
    $rorIds = $postData['authorPersonRorIds'] ?? [];

    $maxLen = count($familynames);

    for ($i = 0; $i < $maxLen; $i++) {
        saveContactPersonEntry($connection, $resource_id, [
            'familyname' => $familynames[$i] ?? '',
            'givenname' => $givennames[$i] ?? '',
            'orcid' => $orcids[$i] ?? '',
            'email' => $emails[$i] ?? '',
            'website' => $websites[$i] ?? '',
            'affiliation_data' => $affiliations[$i] ?? '',
            'rorId_data' => $rorIds[$i] ?? ''
        ], $action);
    }
}

function saveContactPersonEntry($connection, int $resource_id, array $author, string $action): void
{
    $familyname = trim((string) ($author['familyname'] ?? ''));
    $givenname = trim((string) ($author['givenname'] ?? ''));
    $orcid = trim((string) ($author['orcid'] ?? ''));
    $orcid = str_replace(['https://orcid.org/', 'http://orcid.org/'], '', $orcid);

    if ($action === 'submit' && $orcid !== '' && !isValidOrcidChecksum($orcid)) {
        throw new Exception("Invalid ORCID checksum: {$orcid}");
    }

    $email = trim((string) ($author['email'] ?? ''));
    $website = isset($author['website']) ? trim(preg_replace('#^https?://#', '', trim((string) $author['website']))) : '';
    $orcid = $orcid !== '' ? $orcid : null;
    $website = $website !== '' ? $website : null;
    $affiliation_data = $author['affiliation_data'] ?? '';
    $rorId_data = $author['rorId_data'] ?? '';

    if (empty($email) && empty($familyname) && empty($givenname) && empty($orcid) && empty($website)) {
        return;
    }

    if (empty($email) || empty($familyname)) {
        return;
    }

    $stmt = $connection->prepare("
        SELECT contact_person_id FROM Contact_Person 
        WHERE familyName = ? AND givenname = ? AND orcid <=> ? AND email = ? AND website <=> ?
    ");
    $stmt->bind_param("sssss", $familyname, $givenname, $orcid, $email, $website);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $contact_person_id = $row['contact_person_id'];
        $stmt->close();
    } else {
        $stmt->close();
        $stmt = $connection->prepare("INSERT INTO Contact_Person (familyName, givenname, orcid, email, website) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssss", $familyname, $givenname, $orcid, $email, $website);
        $stmt->execute();
        $contact_person_id = $stmt->insert_id;
        $stmt->close();
    }

    $stmt = $connection->prepare("INSERT IGNORE INTO Resource_has_Contact_Person (Resource_resource_id, Contact_Person_contact_person_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $resource_id, $contact_person_id);
    $stmt->execute();
    $stmt->close();

    if (!empty($affiliation_data) || !empty($rorId_data)) {
        saveAffiliations($connection, $contact_person_id, $affiliation_data, $rorId_data, 'Contact_Person_has_Affiliation', 'Contact_Person_contact_person_id');
    }
}
