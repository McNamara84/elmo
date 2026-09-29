<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/changelog_version.php';

final class ChangelogVersionTest extends TestCase
{
    public function testReadsVersionFromChangelogData(): void
    {
        self::assertSame('2.2.0', elmoChangelogVersion(__DIR__ . '/../json/changelog.json'));
    }

    public function testRejectsMissingOrInconsistentChangelogData(): void
    {
        self::assertNull(elmoChangelogVersion(__DIR__ . '/not-found-changelog.json'));
        $path = tempnam(sys_get_temp_dir(), 'elmo-changelog-');
        self::assertNotFalse($path);
        try {
            file_put_contents($path, '{"currentVersion":"2.2.0","releases":[{"version":"2.1.2"}]}');
            self::assertNull(elmoChangelogVersion($path));
            file_put_contents($path, '{invalid json');
            self::assertNull(elmoChangelogVersion($path));
        } finally {
            unlink($path);
        }
    }
}
