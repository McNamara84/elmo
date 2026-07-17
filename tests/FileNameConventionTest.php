<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__) . '/scripts/check_file_names.php';

#[CoversNothing]
final class FileNameConventionTest extends TestCase
{
    #[DataProvider('validPathProvider')]
    public function testAcceptsValidNames(string $path): void
    {
        self::assertNull(elmoFileNameViolation($path));
    }

    /** @return array<string, array{0: string}> */
    public static function validPathProvider(): array
    {
        return [
            'procedural PHP' => ['endpoints/send_feedback_mail.php'],
            'single-word PHP' => ['index.php'],
            'PHP test class' => ['tests/FileNameConventionTest.php'],
            'camel-case JavaScript' => ['js/submitHandler.js'],
            'single-word JavaScript' => ['js/logging.js'],
            'kebab-case HTML' => ['example-form.html'],
            'kebab-case icon' => ['assets/icons/apple-touch-icon.png'],
            'Playwright spec' => ['tests/playwright/feedback-security.spec.ts'],
            'legacy CI router exception' => ['ci-router.php'],
            'tool configuration' => ['composer.json'],
            'excluded dependency' => ['vendor/PackageName.php'],
        ];
    }

    #[DataProvider('invalidPathProvider')]
    public function testRejectsInvalidNames(string $path, string $messageFragment): void
    {
        $violation = elmoFileNameViolation($path);

        self::assertNotNull($violation);
        self::assertStringContainsString($messageFragment, $violation);
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function invalidPathProvider(): array
    {
        return [
            'procedural PHP with hyphen' => ['bad-endpoint.php', 'snake_case'],
            'PHP test without PascalCase' => ['tests/file_name_Test.php', 'PascalCase'],
            'JavaScript with snake case' => ['js/bad_module.js', 'camelCase'],
            'HTML with camel case' => ['formGroups.html', 'kebab-case'],
            'asset with underscore' => ['assets/icons/app_icon.svg', 'kebab-case'],
            'spec with camel case' => ['tests/playwright/badSpec.spec.ts', 'kebab-case'],
        ];
    }
}
