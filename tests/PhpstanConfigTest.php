<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

class PhpstanConfigTest extends TestCase
{
    public function testNodeModulesExcludePathIsMarkedOptional(): void
    {
        $configPath = dirname(__DIR__) . '/phpstan.neon.dist';
        $this->assertFileExists($configPath, 'The phpstan.neon.dist configuration file must exist.');

        $configContents = file_get_contents($configPath);
        $this->assertIsString($configContents, 'The phpstan.neon.dist configuration should be readable.');

        $this->assertStringContainsString('node_modules (?)', $configContents, 'The node_modules directory should be excluded as an optional path for PHPStan.');
    }
}