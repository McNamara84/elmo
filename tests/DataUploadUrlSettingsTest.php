<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Tests for the DATA_UPLOAD_URL environment variable integration.
 *
 * Verifies that:
 * - All settings files define $dataUploadUrl consistently
 * - The variable reads from the DATA_UPLOAD_URL environment variable
 * - An empty string is used as fallback when the env var is not set
 * - The footer publishes dataUploadUrl through the browser allowlist
 */
#[CoversNothing]
final class DataUploadUrlSettingsTest extends TestCase
{
    private string $projectRoot;

    protected function setUp(): void
    {
        parent::setUp();
        $this->projectRoot = dirname(__DIR__);
    }

    // ── Settings files consistency tests ─────────────────────────────

    /**
     * The environment reader must define $dataUploadUrl from DATA_UPLOAD_URL.
     */
    #[DataProvider('settingsFileProvider')]
    public function testSettingsFileDefinesDataUploadUrl(string $filename): void
    {
        $filePath = $this->projectRoot . '/' . $filename;
        $this->assertFileExists($filePath);

        $contents = file_get_contents($filePath);
        $this->assertNotFalse($contents);

        $this->assertStringContainsString(
            "\$dataUploadUrl = getenv_with_warning('DATA_UPLOAD_URL');",
            $contents,
            sprintf('%s must define $dataUploadUrl reading from DATA_UPLOAD_URL env var', $filename)
        );
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function settingsFileProvider(): array
    {
        return [
            'includes/env_variables_reader.php' => ['includes/env_variables_reader.php'],
        ];
    }

    // ── Environment variable behavior tests ──────────────────────────

    public function testDataUploadUrlReadsFromEnvironment(): void
    {
        $testUrl = 'https://nextcloud.gfz.de/s/testshare123';

        // Save current value
        $previous = getenv('DATA_UPLOAD_URL');

        try {
            putenv("DATA_UPLOAD_URL={$testUrl}");
            $result = getenv('DATA_UPLOAD_URL') ?: '';
            $this->assertSame($testUrl, $result);
        } finally {
            // Restore previous value
            if ($previous === false) {
                putenv('DATA_UPLOAD_URL');
            } else {
                putenv("DATA_UPLOAD_URL={$previous}");
            }
        }
    }

    public function testDataUploadUrlFallsBackToEmptyString(): void
    {
        // Save current value
        $previous = getenv('DATA_UPLOAD_URL');

        try {
            putenv('DATA_UPLOAD_URL');
            $result = getenv('DATA_UPLOAD_URL') ?: '';
            $this->assertSame('', $result);
        } finally {
            // Restore previous value
            if ($previous !== false) {
                putenv("DATA_UPLOAD_URL={$previous}");
            }
        }
    }

    // ── Docker-Compose integration tests ─────────────────────────────

    #[DataProvider('dockerComposeFileProvider')]
    public function testDockerComposeIncludesDataUploadUrl(string $filename): void
    {
        $filePath = $this->projectRoot . '/' . $filename;
        $this->assertFileExists($filePath);

        $contents = file_get_contents($filePath);
        $this->assertNotFalse($contents);

        $this->assertStringContainsString(
            'DATA_UPLOAD_URL:',
            $contents,
            sprintf('%s must pass DATA_UPLOAD_URL to the container environment', $filename)
        );
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function dockerComposeFileProvider(): array
    {
        return [
            'docker-compose.yml' => ['docker-compose.yml'],
            'docker-compose.prod.yml' => ['docker-compose.prod.yml'],
            'docker-compose.stage.yml' => ['docker-compose.stage.yml'],
        ];
    }

    // ── .env_sample documentation test ───────────────────────────────

    public function testEnvSampleDocumentsDataUploadUrl(): void
    {
        $filePath = $this->projectRoot . '/.env_sample';
        $this->assertFileExists($filePath);

        $contents = file_get_contents($filePath);
        $this->assertNotFalse($contents);

        $this->assertStringContainsString(
            'DATA_UPLOAD_URL=',
            $contents,
            '.env_sample must document the DATA_UPLOAD_URL variable'
        );
    }

    // ── Frontend integration test ────────────────────────────────────

    public function testFooterHtmlOutputsDataUploadUrlToJavaScript(): void
    {
        $dataUploadUrl = 'https://nextcloud.example.com/upload';
        $xmlSubmitAddress = 'curator@example.org';
        $contactAddressRepository = 'repo@example.org';
        $showFeedbackLink = false;
        $maxTitles = 2;

        ob_start();
        try {
            include $this->projectRoot . '/footer.html';
            $html = (string) ob_get_contents();
        } finally {
            ob_end_clean();
        }

        $this->assertSame(1, preg_match('/window\.ELMO_FEATURES = (\{.*?\});/s', $html, $match));
        $features = json_decode($match[1], true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame($dataUploadUrl, $features['dataUploadUrl']);
        $this->assertSame($xmlSubmitAddress, $features['xmlSubmitAddress']);
        $this->assertArrayNotHasKey('contactAddressRepository', $features);
        $this->assertArrayNotHasKey('showFreeKeywords', $features);
    }

    // ── Translation keys consistency tests ───────────────────────────

    #[DataProvider('languageFileProvider')]
    public function testLanguageFileContainsDataUploadTranslationKeys(string $locale): void
    {
        $filePath = $this->projectRoot . '/lang/' . $locale . '.json';
        $this->assertFileExists($filePath);

        $contents = file_get_contents($filePath);
        $this->assertNotFalse($contents);

        $json = json_decode($contents, true);
        $this->assertIsArray($json, sprintf('%s.json must be valid JSON', $locale));

        $alerts = $json['alerts'] ?? [];
        $this->assertIsArray($alerts);

        $requiredKeys = [
            'dataUploadTitle',
            'dataUploadMessage',
            'dataUploadLinkText',
            'dataUploadFileNameHint',
        ];

        foreach ($requiredKeys as $key) {
            $this->assertArrayHasKey(
                $key,
                $alerts,
                sprintf('lang/%s.json alerts section must contain key "%s"', $locale, $key)
            );
            $this->assertNotEmpty(
                $alerts[$key],
                sprintf('lang/%s.json alerts.%s must not be empty', $locale, $key)
            );
        }
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function languageFileProvider(): array
    {
        return [
            'de' => ['de'],
            'en' => ['en'],
            'fr' => ['fr'],
        ];
    }

    /**
     * Verify all locale files have the same set of data upload keys
     * (structural consistency across languages).
     */
    public function testAllLanguageFilesHaveConsistentDataUploadKeys(): void
    {
        $locales = ['de', 'en', 'fr'];
        $keysByLocale = [];

        foreach ($locales as $locale) {
            $filePath = $this->projectRoot . '/lang/' . $locale . '.json';
            $json = json_decode(file_get_contents($filePath), true);
            $alerts = $json['alerts'] ?? [];

            $dataUploadKeys = array_filter(
                array_keys($alerts),
                fn(string $key) => str_starts_with($key, 'dataUpload')
            );
            sort($dataUploadKeys);
            $keysByLocale[$locale] = $dataUploadKeys;
        }

        // All locales must have the exact same keys
        $this->assertSame(
            $keysByLocale['de'],
            $keysByLocale['en'],
            'de.json and en.json must have the same dataUpload* keys'
        );
        $this->assertSame(
            $keysByLocale['en'],
            $keysByLocale['fr'],
            'en.json and fr.json must have the same dataUpload* keys'
        );
    }
}
