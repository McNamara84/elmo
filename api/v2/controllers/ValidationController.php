<?php
/**
 *
 * This controller handles validation-related API requests, such as retrieving patterns for identifier types.
 *
 */

// Include settings.php so that variables are available
require_once __DIR__ . '/../../../settings.php';

/**
 * Class ValidationController
 *
 * Handles validation-related requests for the API.
 */
class ValidationController
{
    /**
     * @var mysqli The database connection object.
     */
    private $connection;

    /**
     * ValidationController constructor.
     *
     * Initializes the database connection.
     */
    public function __construct()
    {
        global $connection;
        $this->connection = $connection;
    }

    /**
     * Retrieves the regex pattern for a specified identifier type.
     *
     * @param array<mixed> $vars An associative array containing request parameters.
     *
     * @return void
     */
    public function getPattern(array $vars)
    {
        $type = $vars['type'] ?? null;
        if (!$type) {
            http_response_code(400);
            echo json_encode(['error' => 'No identifier type specified']);
            return;
        }

        $stmt = $this->connection->prepare('SELECT pattern FROM Identifier_Type WHERE name = ?');
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to prepare statement: ' . $this->connection->error]);
            return;
        }

        $stmt->bind_param('s', $type);
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to execute statement: ' . $stmt->error]);
            return;
        }
        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $row = $result->fetch_assoc();
            echo json_encode(['pattern' => $row['pattern']]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'No pattern found for the specified identifier type']);
        }
        $stmt->close();
        exit();
    }

    /**
     * Retrieves all identifier types along with their patterns and descriptions.
     *
     * @return void
     */
    public function getIdentifierTypes()
    {
        $stmt = $this->connection->prepare('SELECT name, pattern, description FROM Identifier_Type');

        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to prepare statement: ' . $this->connection->error]);
            return;
        }

        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to execute statement: ' . $stmt->error]);
            return;
        }

        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $identifierTypes = [];
            while ($row = $result->fetch_assoc()) {
                $identifierTypes[] = [
                    'name' => $row['name'],
                    'pattern' => $row['pattern'],
                    'description' => $row['description']
                ];
            }
            echo json_encode(['identifierTypes' => $identifierTypes]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'No identifier types found']);
        }

        $stmt->close();
        exit();
    }

    /**
     * Retrieves all active identifier types, preferring ERNIE data with local DB fallback.
     *
     * When ERNIE is configured, fetches identifier types from ERNIE (with caching),
     * syncs to local DB (including patterns), and returns data.
     * Falls back to local database if ERNIE is unavailable.
     *
     * Each result contains:
     * - name        → the name of the identifier type
     * - pattern     → the associated validation pattern (regex)
     * - description → a description of the type
     * 
     * @return void
     */
    public function getActiveIdentifierTypes(): void
    {
        try {
            require_once __DIR__ . '/../services/ErnieService.php';
            $ernieService = new \ErnieService();

            if ($ernieService->isConfigured(logResult: true)) {
                $ernieTypes = $ernieService->getIdentifierTypesWithCache();

                if (!empty($ernieTypes)) {
                    // Sync to local DB (including patterns and isShown flag)
                    $this->syncIdentifierTypesToDb($ernieTypes);

                    // Return in the same format as before
                    $identifierTypes = array_map(fn($t) => [
                        'name' => $t['name'],
                        'pattern' => $t['pattern'] ?? '',
                        'description' => $t['description'] ?? '',
                    ], $ernieTypes);

                    error_log("Identifier Types: Serving " . count($identifierTypes) . " types from ERNIE (cache or fresh)");
                    http_response_code(200);
                    header('Content-Type: application/json');
                    echo json_encode(['identifierTypes' => $identifierTypes]);
                    return;
                }
            }

            // Fallback: Load from local database
            error_log("Identifier Types: Falling back to local database");
            $this->getActiveIdentifierTypesFromDb();

        } catch (Exception $e) {
            error_log("API Error in getActiveIdentifierTypes: " . $e->getMessage());
            // Fallback to local DB on any error
            error_log("Identifier Types: Falling back to local database due to error");
            $this->getActiveIdentifierTypesFromDb();
        }
    }

    /**
     * Fetches active identifier types directly from local database
     *
     * @return void Outputs JSON response directly
     */
    private function getActiveIdentifierTypesFromDb(): void
    {
        try {
            global $connection;
            $sql = 'SELECT name, pattern, description FROM Identifier_Type WHERE isShown = 1 ORDER BY name ASC';
            $result = $connection->query($sql);
            if ($result === false) {
                throw new Exception("Database query failed: " . $connection->error);
            }
            $identifierTypes = [];
            while ($row = $result->fetch_assoc()) {
                $identifierTypes[] = [
                    'name' => $row['name'],
                    'pattern' => $row['pattern'],
                    'description' => $row['description'],
                ];
            }
            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['identifierTypes' => $identifierTypes]);
        } catch (Exception $e) {
            error_log("API Error in getActiveIdentifierTypesFromDb: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'An error occurred while retrieving identifier types']);
        }
    }

    /**
     * Syncs ERNIE identifier types to the local database
     *
     * Uses INSERT ... ON DUPLICATE KEY UPDATE (upsert) to handle
     * new, existing by ernie_id, and existing by name records.
     * Also updates `pattern` and sets `isShown = 1` for ERNIE-provided types.
     *
     * @param array<int, array<string, mixed>> $ernieTypes Identifier types from ERNIE
     * @return void
     */
    private function syncIdentifierTypesToDb(array $ernieTypes): void
    {
        global $connection;

        $connection->begin_transaction();

        try {
            foreach ($ernieTypes as $type) {
                $ernieId = $type['id'] ?? null;
                $name = $type['name'] ?? null;
                if (!$ernieId || !$name) {
                    continue;
                }

                $desc = $type['description'] ?? null;
                $pattern = $type['pattern'] ?? null;

                $sql = "INSERT INTO `Identifier_Type` (`ernie_id`, `name`, `description`, `pattern`, `isShown`)
                        VALUES (?, ?, ?, ?, 1)
                        ON DUPLICATE KEY UPDATE
                        `name` = VALUES(`name`),
                        `description` = VALUES(`description`),
                        `pattern` = VALUES(`pattern`),
                        `isShown` = 1,
                        `ernie_id` = VALUES(`ernie_id`)";
                $stmt = $connection->prepare($sql);
                $stmt->bind_param('isss', $ernieId, $name, $desc, $pattern);
                $stmt->execute();
            }

            $connection->commit();
        } catch (\Exception $e) {
            $connection->rollback();
            error_log("ERNIE sync to Identifier_Type failed: " . $e->getMessage());
        }
    }

    /**
     * Retrieves all inactive identifier types (isShown = 0) 
     * from the Identifier_Type table and returns them as JSON.
     *
     * Each result contains:
     * - name        → the name of the identifier type
     * - pattern     → the associated validation pattern (regex)
     * - description → a description of the type
     * 
     * @return void
     */
    public function getInactiveIdentifierTypes(): void
    {
        try {
            global $connection;
            $sql = 'SELECT name, pattern, description FROM Identifier_Type WHERE isShown = 0 ORDER BY name ASC';
            $result = $connection->query($sql);
            if ($result === false) {
                throw new Exception("Database query failed: " . $connection->error);
            }
            $identifierTypes = [];
            while ($row = $result->fetch_assoc()) {
                $identifierTypes[] = [
                    'name' => $row['name'],
                    'pattern' => $row['pattern'],
                    'description' => $row['description'],
                ];
            }
            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['identifierTypes' => $identifierTypes]);
        } catch (Exception $e) {
            error_log("API Error in getInactiveIdentifierTypes: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'An error occurred while retrieving identifier types']);
        }
    }
}
