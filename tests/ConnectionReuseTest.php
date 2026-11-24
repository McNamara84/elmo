<?php

declare(strict_types=1);

namespace Tests;

/**
 * Every database test publishes its connection through getConnection().
 * This case checks that contract against the shared test database.
 */
final class ConnectionReuseTest extends DatabaseTestCase
{
    public function testDatabaseTestsReuseTheSharedConnection(): void
    {
        self::assertSame($this->connection, getConnection());
        self::assertSame($this->connection, $GLOBALS['connection']);
        self::assertSame('mde2-msl-test', $this->connection->query('SELECT DATABASE()')->fetch_row()[0]);
    }
}
