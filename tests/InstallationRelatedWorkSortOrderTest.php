<?php

declare(strict_types=1);

namespace Tests;

/**
 * Covers the Related Work ordering schema and complete-install fixture data.
 */
final class InstallationRelatedWorkSortOrderTest extends DatabaseTestCase
{
    public function testFreshSchemaContainsRelatedWorkSortOrderColumn(): void
    {
        $result = $this->connection->query(
            "SHOW COLUMNS FROM `Resource_has_Related_Work` LIKE 'sort_order'"
        );
        $column = $result->fetch_assoc();

        self::assertNotNull($column);
        self::assertSame('int(11)', strtolower($column['Type']));
        self::assertSame('NO', $column['Null']);
        self::assertSame('0', $column['Default']);
    }

    public function testCompleteInstallationSeedsRelatedWorkOrderPerResource(): void
    {
        insertTestResourceData($this->connection);

        $rows = $this->connection->query(
            'SELECT Resource_resource_id, sort_order '
            . 'FROM Resource_has_Related_Work '
            . 'WHERE Resource_resource_id IN (4, 5) '
            . 'ORDER BY Resource_resource_id ASC, sort_order ASC'
        )->fetch_all(MYSQLI_ASSOC);

        self::assertSame(
            [[4, 0], [4, 1], [4, 2], [5, 0], [5, 1]],
            array_map(
                static fn(array $row): array => [
                    (int) $row['Resource_resource_id'],
                    (int) $row['sort_order'],
                ],
                $rows
            )
        );
    }
}
