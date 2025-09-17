<?php
/**
 *
 * This controller handles validation-related API requests, such as retrieving patterns for identifier types.
 *
 */

// Include helper_functions.php so that variables are available
require_once __DIR__ . '/../../../helper_functions.php';

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
     * @param array $vars An associative array containing request parameters.
     *
     * @return void
     */
    public function getPattern($vars)
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
     * Retrieves all active identifier types (isShown = 1) 
     * from the Identifier_Type table and returns them as JSON.
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
            error_log("API Error in getActiveIdentifierTypes: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'An error occurred while retrieving identifier types']);
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
