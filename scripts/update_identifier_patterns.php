<?php

declare(strict_types=1);

require_once __DIR__ . '/../api/v2/services/IdentifierTypePatterns.php';

/** Repair patterns in place, preserving identifiers, activation and metadata. */
function updateIdentifierPatterns(mysqli $connection): int
{
    $connection->begin_transaction();
    try {
        $statement = $connection->prepare('UPDATE Identifier_Type SET pattern = ? WHERE name = ?');
        $changed = 0;
        foreach (IdentifierTypePatterns::supported() as $name => $pattern) {
            $statement->bind_param('ss', $pattern, $name);
            $statement->execute();
            $changed += $statement->affected_rows;
        }
        $statement->close();
        $connection->commit();
        return $changed;
    } catch (Throwable $error) {
        $connection->rollback();
        throw $error;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    if (PHP_SAPI !== 'cli') {
        http_response_code(404);
        exit();
    }
    require_once __DIR__ . '/../settings.php';
    if (!isset($connection) || !$connection instanceof mysqli) {
        throw new RuntimeException('Database connection is unavailable');
    }
    echo 'Updated identifier patterns: ' . updateIdentifierPatterns($connection) . PHP_EOL;
}
