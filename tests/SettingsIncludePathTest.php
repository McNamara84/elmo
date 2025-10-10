<?php

declare(strict_types=1);

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SettingsIncludePathTest extends TestCase
{
    #[DataProvider('scriptProvider')]
    public function testScriptsUseAbsoluteSettingsInclude(string $script, string $pattern): void
    {
        $filePath = __DIR__ . '/../' . $script;
        $contents = file_get_contents($filePath);
        $this->assertNotFalse($contents, sprintf('Failed to read %s', $script));

        $matches = preg_match($pattern, $contents);
        $this->assertSame(
            1,
            $matches,
            sprintf('Expected %s to include settings.php using __DIR__', $script)
        );
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function scriptProvider(): array
    {
        return [
            'api.php include' => ['api.php', '/include\s+__DIR__\s*\.\s*[\'\"]\/settings\\.php[\'\"]\s*;/'],
            'index.php include_once' => ['index.php', '/include_once\s+__DIR__\s*\.\s*[\'\"]\/settings\\.php[\'\"]\s*;/'],
            'install.php require_once' => ['install.php', '/\$settingsPath\s*=\s*__DIR__\s*\.\s*[\'\"]\/settings\\.php[\'\"]\s*;[\s\S]*require_once\s+\$settingsPath\s*;/'],
            'send_feedback_mail.php include' => ['send_feedback_mail.php', '/include\s+__DIR__\s*\.\s*[\'\"]\/settings\\.php[\'\"]\s*;/'],
        ];
    }
}