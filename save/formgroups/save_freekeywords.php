<?php
/**
 * Saves the free keywords into the database.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return void
 */
function saveFreeKeywords($connection, $postData, $resource_id)
{
    $freekeywords = isset($postData['freekeywords']) && is_array($postData['freekeywords']) ? $postData['freekeywords'] : [];

    foreach ($freekeywords as $keywordJSON) {
        $keywordJSON = trim($keywordJSON);
        if ($keywordJSON === '') {
            continue;
        }
        $keywords = json_decode($keywordJSON, true);
        if (!is_array($keywords) || json_last_error() !== JSON_ERROR_NONE) {
            error_log("Invalid JSON input for free keyword: $keywordJSON");
            continue;
        }
        foreach ($keywords as $keywordObj) {
            if (!isset($keywordObj['value'])) {
                continue;
            }
            $keyword = $keywordObj['value'];
            $isCurated = 0;

            // Check if the keyword already exists
            $stmt = $connection->prepare("SELECT free_keywords_id, isCurated FROM Free_Keywords WHERE free_keyword = ?");
            $stmt->bind_param("s", $keyword);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $freekeyword_id = $row['free_keywords_id'];
                $isCurated = $row['isCurated'];
            } else {
                // If the keyword does not exist, insert a new keyword
                $stmt = $connection->prepare("INSERT INTO Free_Keywords (`free_keyword`, `isCurated`) VALUES (?, ?)");
                $stmt->bind_param("si", $keyword, $isCurated);
                $stmt->execute();
                $freekeyword_id = $stmt->insert_id;
            }
            $stmt->close();

            // Check if the linkage already exists
            $stmt = $connection->prepare("SELECT * FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ? AND Free_Keywords_free_keywords_id = ?");
            $stmt->bind_param("ii", $resource_id, $freekeyword_id);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows == 0) {
                // Insert linkage between Resource and Free_Keywords if it does not exist yet
                $stmt = $connection->prepare("INSERT INTO Resource_has_Free_Keywords (`Resource_resource_id`, `Free_Keywords_free_keywords_id`) VALUES (?, ?)");
                $stmt->bind_param("ii", $resource_id, $freekeyword_id);
                $stmt->execute();
            }
            $stmt->close();
        }
    }
}
