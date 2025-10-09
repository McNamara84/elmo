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
            sprintf('Expected %s to include helper_functions.php using __DIR__', $script)
        );
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function scriptProvider(): array
    {
        // This pattern looks for the construction of the absolute path,
        // regardless of how it's included (include, require, require_once, etc.).
        $pattern = '/__DIR__\s*\.\s*[\'\"]\/helper_functions\\.php[\'\"]/';

        return [
            'api.php' => ['api.php', $pattern],
            'index.php' => ['index.php', $pattern],
            'install.php' => ['install.php', $pattern],
            'send_feedback_mail.php' => ['send_feedback_mail.php', $pattern],
        ];
    }
}