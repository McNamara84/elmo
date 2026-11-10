<?php

declare(strict_types=1);

namespace Tests;

use InvalidArgumentException;
use mysqli;
use PHPUnit\Framework\Attributes\CoversNothing;
use RuntimeException;

require_once dirname(__DIR__) . '/scripts/container_database.php';

#[CoversNothing]
final class ContainerDatabaseTest extends DatabaseTestCase
{
    private string|false $previousDatabaseName = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousDatabaseName = getenv('DB_NAME');
        // These tests coordinate only the existing isolated PHPUnit database.
        putenv('DB_NAME=mde2-msl-test');
    }

    protected function tearDown(): void
    {
        releaseContainerDatabaseLock($this->connection);
        putenv($this->previousDatabaseName === false ? 'DB_NAME' : 'DB_NAME=' . $this->previousDatabaseName);
        parent::tearDown();
    }

    private function competingConnection(): mysqli
    {
        $ci = getenv('CI') !== false || getenv('GITHUB_ACTIONS') !== false;
        return new mysqli(
            $ci ? '127.0.0.1' : (getenv('DB_HOST') ?: 'db'),
            $ci ? 'test_user' : (getenv('DB_USER') ?: 'elmo'),
            $ci ? 'test_password' : (getenv('DB_PASSWORD') ?: 'elmo'),
            'mde2-msl-test'
        );
    }

    public function testBasicInstallationResetsAnAlreadyPopulatedDatabase(): void
    {
        insertTestResourceData($this->connection);
        self::assertSame(5, (int) $this->connection->query('SELECT COUNT(*) FROM Resource')->fetch_row()[0]);

        lockReadyContainerDatabase($this->connection, 1, false);
        $result = processInstallation($this->connection, 'basic');

        self::assertSame('success', $result['status']);
        self::assertSame(0, (int) $this->connection->query('SELECT COUNT(*) FROM Resource')->fetch_row()[0]);
        self::assertTrue(containerDatabaseSchemaReady($this->connection));
        self::assertGreaterThan(0, (int) $this->connection->query('SELECT COUNT(*) FROM Language')->fetch_row()[0]);
    }

    public function testStartupLockExcludesOtherConnectionsAcrossSchemaChanges(): void
    {
        $other = $this->competingConnection();
        try {
            self::assertTrue(containerDatabaseLock($this->connection, 0));
            $this->connection->query('CREATE TABLE container_startup_probe (id INT)');
            self::assertFalse(containerDatabaseLock($other, 0));
            $this->connection->query('DROP TABLE container_startup_probe');
            self::assertFalse(containerDatabaseLock($other, 0));
            releaseContainerDatabaseLock($this->connection);
            self::assertTrue(containerDatabaseLock($other, 0));
        } finally {
            $this->connection->query('DROP TABLE IF EXISTS container_startup_probe');
            $other->close();
        }
    }

    public function testLockTimeoutCannotResetOrChangeExistingData(): void
    {
        insertTestResourceData($this->connection);
        $other = $this->competingConnection();
        try {
            self::assertTrue(containerDatabaseLock($this->connection, 0));
            try {
                lockReadyContainerDatabase($other, 1, false);
                self::fail('A second initializer must not run without the lock.');
            } catch (RuntimeException $exception) {
                self::assertStringContainsString('startup lock', $exception->getMessage());
            }
            self::assertSame(5, (int) $this->connection->query('SELECT COUNT(*) FROM Resource')->fetch_row()[0]);
        } finally {
            $other->close();
        }
    }

    public function testSkipWaitsForTheSchemaAndReleasesItsLockOnTimeout(): void
    {
        $this->connection->query('SET FOREIGN_KEY_CHECKS=0');
        try {
            $this->connection->query('DROP TABLE Title_Type');
        } finally {
            $this->connection->query('SET FOREIGN_KEY_CHECKS=1');
        }

        try {
            lockReadyContainerDatabase($this->connection, 1, true);
            self::fail('skip must wait for a successful initializer.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('initialized database schema', $exception->getMessage());
        }
        self::assertFalse(containerDatabaseSchemaReady($this->connection));
        $other = $this->competingConnection();
        try {
            self::assertTrue(containerDatabaseLock($other, 0));
        } finally {
            $other->close();
        }
    }

    public function testClosingTheInitializerConnectionReleasesTheStartupLock(): void
    {
        $other = $this->competingConnection();
        try {
            self::assertTrue(containerDatabaseLock($other, 0));
            self::assertFalse(containerDatabaseLock($this->connection, 0));
        } finally {
            $other->close();
        }
        self::assertTrue(containerDatabaseLock($this->connection, 0));
    }

    public function testUnknownActionCannotSilentlyDisableReset(): void
    {
        $this->expectException(InvalidArgumentException::class);
        containerInstallAction('keep_data');
    }
}
