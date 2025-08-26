<?php
require_once __DIR__ . '/../validation.php';
require_once __DIR__ . '/save_affiliations.php';

/**
 * Saves the contributor persons into the database.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if saving was successful, otherwise false.
 */
function saveContributorPersons($connection, $postData, $resource_id)
{

    $valid_roles = getValidRoles($connection);

    if (
        !isset(
        $postData['cbPersonLastname'],
        $postData['cbPersonFirstname'],
        $postData['cbORCID'],
        $postData['cbAffiliation'],
        $postData['cbPersonRoles']
    ) ||
        !is_array($postData['cbPersonLastname']) || !is_array($postData['cbPersonFirstname']) ||
        !is_array($postData['cbORCID']) || !is_array($postData['cbAffiliation']) ||
        !is_array($postData['cbPersonRoles'])
    ) {
        return true; // No data provided is valid
    }

    $allSuccessful = true;
    $len = count($postData['cbPersonLastname']);

    for ($i = 0; $i < $len; $i++) {
        $entry = [
            'lastname' => $postData['cbPersonLastname'][$i] ?? '',
            'firstname' => $postData['cbPersonFirstname'][$i] ?? '',
            'orcid' => $postData['cbORCID'][$i] ?? '',
            'roles' => $postData['cbPersonRoles'][$i] ?? ''
        ];

        if (!validateContributorPersonDependencies($entry)) {
            $allSuccessful = false;
            continue;
        }
        // Skip if no data provided
        if (empty($entry['lastname']) && empty($entry['firstname']) && empty($entry['orcid']) && empty($entry['roles'])) {
            continue;
        }

        // Get or create contributor person
        $contributor_person_id = saveOrUpdateContributorPerson($connection, $entry['lastname'], $entry['firstname'], $entry['orcid']);

        // Link resource to contributor person
        if (!linkResourceToContributorPerson($connection, $resource_id, $contributor_person_id)) {
            $allSuccessful = false;
        }

        // Save affiliations
        if (!empty($postData['cbAffiliation'][$i])) {
            if (
                !saveAffiliations(
                    $connection,
                    $contributor_person_id,
                    $postData['cbAffiliation'][$i],
                    $postData['cbpRorIds'][$i] ?? null,
                    'Contributor_Person_has_Affiliation',
                    'Contributor_Person_contributor_person_id'
                )
            ) {
                $allSuccessful = false;
            }
        }

        // Save roles
        if (!saveContributorPersonRoles($connection, $contributor_person_id, $entry['roles'], $valid_roles)) {
            $allSuccessful = false;
        }
    }

    return $allSuccessful;
}



/**
 * Saves or updates a Contributor Institution in the database.
 *
 * @param mysqli $connection    The Database Connection.
 * @param string $name          The Name of the Contributor Institution.
 *
 * @return int                  The ID of the saved or updated Contributor Institution.
 */
function saveOrUpdateContributorPerson($connection, $lastname, $firstname, $orcid)
{

    $stmt = $connection->prepare("SELECT contributor_person_id FROM Contributor_Person WHERE familyname = ? AND givenname = ? AND orcid = ?");
    $stmt->bind_param("sss", $lastname, $firstname, $orcid);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $stmt->close();
        return $row['contributor_person_id'];
    }

    $stmt = $connection->prepare("INSERT INTO Contributor_Person (familyname, givenname, orcid) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $lastname, $firstname, $orcid);
    $stmt->execute();
    $id = $stmt->insert_id;
    $stmt->close();

    return $id;
}

/**
 * Links a resource with a contributor person.
 *
 * @param mysqli $connection            The database connection.
 * @param int    $resource_id           The ID of the resource.
 * @param int    $contributor_person_id The ID of the contributor person.
 *
 * @return void
 */
function linkResourceToContributorPerson($connection, $resource_id, $contributor_person_id)
{
    $stmt = $connection->prepare("INSERT IGNORE INTO Resource_has_Contributor_Person (Resource_resource_id, Contributor_Person_contributor_person_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $resource_id, $contributor_person_id);
    $stmt->execute();
    $stmt->close();
}

/**
 * Saves roles of a Contributor Person.
 *
 * @param mysqli $connection            The database connection.
 * @param int $contributor_person_id    The ID of the contributor person.
 * @param array|string $roles           The roles of the person.
 * @param array $valid_roles            Array with valid roles.
 *
 * @return void
 */
function saveContributorPersonRoles($connection, $contributor_person_id, $roles, $valid_roles)
{
    // Check whether $roles is a JSON string, and if so, decode it
    if (is_string($roles)) {
        $roles = json_decode($roles, true);
    }

    // Make sure that $roles is an array
    if (!is_array($roles)) {
        $roles = [$roles];
    }

    // Delete existing roles
    $stmt = $connection->prepare("DELETE FROM Contributor_Person_has_Role WHERE Contributor_Person_contributor_person_id = ?");
    $stmt->bind_param("i", $contributor_person_id);
    $stmt->execute();
    $stmt->close();

    // Save new roles
    foreach ($roles as $role) {
        $role_name = is_array($role) ? $role['value'] ?? null : $role; // Extract the role name
        if ($role_name && isset($valid_roles[$role_name])) {
            $role_id = $valid_roles[$role_name];
            error_log("Valid role found. Role ID: $role_id");
            $stmt = $connection->prepare("INSERT INTO Contributor_Person_has_Role (Contributor_Person_contributor_person_id, Role_role_id) VALUES (?, ?)");
            $stmt->bind_param("ii", $contributor_person_id, $role_id);
            $stmt->execute();
            $stmt->close();
        } else {
            error_log("Ungültiger Rollenname für Contributor $contributor_person_id: $role_name");
        }
    }
}
