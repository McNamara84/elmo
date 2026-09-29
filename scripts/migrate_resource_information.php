<?php
/** Idempotent deployment migration for Resource Information version and title order. */

function resourceInformationColumnExists(mysqli $connection, string $table, string $column): bool
{
    $statement = $connection->prepare(
        'SELECT COUNT(*) AS count FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $statement->bind_param('ss', $table, $column);
    $statement->execute();
    return (int) $statement->get_result()->fetch_assoc()['count'] > 0;
}

function migrateResourceInformation(mysqli $connection): void
{
    if (!resourceInformationColumnExists($connection, 'Resource', 'version')) {
        throw new RuntimeException('Resource.version is missing. Run the base installer first.');
    }

    $typeStatement = $connection->query(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
    . "AND TABLE_NAME = 'Resource' AND COLUMN_NAME = 'version'"
);
    $versionType = strtolower((string) $typeStatement->fetch_assoc()['DATA_TYPE']);
    if ($versionType !== 'varchar') {
        $connection->query('ALTER TABLE Resource MODIFY COLUMN version VARCHAR(32) NULL');
        $connection->query("UPDATE Resource SET version = CONCAT(version, '.0') WHERE version REGEXP '^[0-9]+$'");
    }

    if (!resourceInformationColumnExists($connection, 'Title', 'sort_order')) {
        $connection->query('ALTER TABLE Title ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
        $connection->query(
        'UPDATE Title AS title JOIN ('
        . 'SELECT title_id, ROW_NUMBER() OVER (PARTITION BY Resource_resource_id ORDER BY title_id) - 1 AS position '
        . 'FROM Title) AS positions ON positions.title_id = title.title_id '
        . 'SET title.sort_order = positions.position'
        );
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    if (PHP_SAPI !== 'cli') {
        http_response_code(404);
        exit;
    }
    require_once dirname(__DIR__) . '/settings.php';
    if (!isset($connection) || !$connection instanceof mysqli) {
        throw new RuntimeException('Database connection is unavailable.');
    }
    migrateResourceInformation($connection);
    echo "Resource Information schema is up to date.\n";
}
