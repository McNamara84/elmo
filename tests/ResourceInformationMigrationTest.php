<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../scripts/migrate_resource_information.php';

final class ResourceInformationMigrationTest extends DatabaseTestCase
{
    public function testMigratesLegacyVersionsAndTitleOrderIdempotently(): void
    {
        $this->connection->query('ALTER TABLE Resource MODIFY COLUMN version FLOAT NULL');
        $this->connection->query('ALTER TABLE Title DROP COLUMN sort_order');
        $this->connection->query("INSERT INTO Resource (version) VALUES (2.0)");
        $resourceId = $this->connection->insert_id;
        $this->connection->query("INSERT INTO Title (text, Resource_resource_id) VALUES ('First', {$resourceId}), ('Second', {$resourceId})");

        \migrateResourceInformation($this->connection);
        \migrateResourceInformation($this->connection);

        $version = $this->connection->query("SELECT version FROM Resource WHERE resource_id = {$resourceId}")->fetch_assoc()['version'];
        self::assertSame('2.0', $version);
        $titles = $this->connection->query("SELECT text, sort_order FROM Title WHERE Resource_resource_id = {$resourceId} ORDER BY sort_order")->fetch_all(MYSQLI_ASSOC);
        self::assertSame([
            ['text' => 'First', 'sort_order' => 0],
            ['text' => 'Second', 'sort_order' => 1],
        ], array_map(static fn (array $row) => ['text' => $row['text'], 'sort_order' => (int) $row['sort_order']], $titles));
    }
}
