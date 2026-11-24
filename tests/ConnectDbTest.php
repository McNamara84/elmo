<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/connect_db.php';

#[AllowMockObjectsWithoutExpectations]
final class ConnectDbTest extends TestCase
{
    protected function tearDown(): void
    {
        unset($GLOBALS['connection']);
        parent::tearDown();
    }

    public function testGetConnectionReusesAnInjectedMysqli(): void
    {
        $injected = $this->createMock(\mysqli::class);
        $GLOBALS['connection'] = $injected;

        self::assertSame($injected, getConnection());
        self::assertSame($injected, getConnection());
    }

    #[DataProvider('settingsFileProvider')]
    public function testSettingsFilesDoNotOpenAConnection(string $filename): void
    {
        $contents = file_get_contents(dirname(__DIR__) . '/' . $filename);
        self::assertNotFalse($contents);
        self::assertStringNotContainsString('function connectDb', $contents);
        self::assertStringNotContainsString('$connection = connectDb()', $contents);
        self::assertStringNotContainsString('new mysqli', $contents);
    }

    /** @return array<string, array{0: string}> */
    public static function settingsFileProvider(): array
    {
        return [
            'feature_flags.php' => ['feature_flags.php'],
            'includes/env_variables_reader.php' => ['includes/env_variables_reader.php'],
        ];
    }
}
