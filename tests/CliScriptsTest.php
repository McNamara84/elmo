<?php

declare(strict_types=1);

namespace Tests;

use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

if (!defined('INCLUDED_FROM_TEST')) {
    define('INCLUDED_FROM_TEST', true);
}

require_once dirname(__DIR__) . '/scripts/install.php';
require_once dirname(__DIR__) . '/scripts/generate_xml_files.php';

#[CoversNothing]
final class CliScriptsTest extends TestCase
{
    #[DataProvider('validInstallActionProvider')]
    public function testParsesSupportedInstallActions(string $action): void
    {
        self::assertSame($action, parseInstallationAction(['install.php', $action]));
    }

    /** @return array<string, array{0: string}> */
    public static function validInstallActionProvider(): array
    {
        return [
            'basic' => ['basic'],
            'complete' => ['complete'],
        ];
    }

    #[DataProvider('invalidInstallArgumentsProvider')]
    public function testRejectsInvalidInstallActions(array $arguments): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('basic|complete');

        parseInstallationAction($arguments);
    }

    /** @return array<string, array{0: list<string>}> */
    public static function invalidInstallArgumentsProvider(): array
    {
        return [
            'missing action' => [['install.php']],
            'unknown action' => [['install.php', 'reset']],
        ];
    }

    public function testXmlGenerationExitCodesReflectStatus(): void
    {
        self::assertSame(0, xmlGenerationExitCode(['status' => 'success']));
        self::assertSame(1, xmlGenerationExitCode(['status' => 'warning']));
        self::assertSame(1, xmlGenerationExitCode(['status' => 'error']));
    }
}
