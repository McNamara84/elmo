<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__) . '/includes/http_routing.php';

#[CoversNothing]
final class HttpRoutingTest extends TestCase
{
    #[DataProvider('compatibilityRouteProvider')]
    public function testResolvesCompatibilityRoutes(string $legacyPath, string $canonicalPath): void
    {
        self::assertSame($canonicalPath, elmoCompatibilityTarget($legacyPath));
        self::assertSame($canonicalPath, elmoCompatibilityTarget($legacyPath . '?cache=1'));
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function compatibilityRouteProvider(): array
    {
        return [
            'API v1 tombstone' => ['/api.php', '/api/deprecated_v1.php'],
            'privacy policy' => ['/doc/privacyPolicy.html', '/doc/privacy-policy.html'],
            'feedback endpoint' => ['/send_feedback_mail.php', '/endpoints/send_feedback_mail.php'],
            'submit endpoint' => ['/send_xml_file.php', '/endpoints/send_xml_file.php'],
            'logging endpoint' => ['/log_page_event.php', '/endpoints/log_page_event.php'],
            'favicon' => ['/favicon.ico', '/assets/icons/favicon.ico'],
            'PWA icon' => ['/web-app-manifest-512x512.png', '/assets/icons/web-app-manifest-512x512.png'],
            'GFZ logo' => ['/logos/GFZ-logo.png', '/assets/logos/gfz-logo.svg'],
            'Data Services logo' => ['/logos/GFZ_Data_Services_logo.png', '/assets/logos/gfz-data-services-logo.svg'],
            'ORCID logo' => ['/logos/orcid.logo.png', '/assets/logos/orcid-logo.png'],
        ];
    }

    public function testReturnsNullForCanonicalAndUnknownRoutes(): void
    {
        self::assertNull(elmoCompatibilityTarget('/endpoints/send_xml_file.php'));
        self::assertNull(elmoCompatibilityTarget('/unknown.php'));
    }

    #[DataProvider('blockedPathProvider')]
    public function testBlocksCliScriptsOverHttp(string $path): void
    {
        self::assertTrue(elmoIsHttpBlockedPath($path));
    }

    /** @return array<string, array{0: string}> */
    public static function blockedPathProvider(): array
    {
        return [
            'directory' => ['/scripts'],
            'directory slash' => ['/scripts/'],
            'installer' => ['/scripts/install.php'],
            'generator with query' => ['/scripts/generate_xml_files.php?all=1'],
        ];
    }

    public function testDoesNotBlockSimilarlyNamedOrCanonicalApplicationPaths(): void
    {
        self::assertFalse(elmoIsHttpBlockedPath('/scripts-archive/install.php'));
        self::assertFalse(elmoIsHttpBlockedPath('/endpoints/send_xml_file.php'));
    }

    #[DataProvider('contentTypeProvider')]
    public function testReturnsStaticContentTypes(string $path, string $expected): void
    {
        self::assertSame($expected, elmoStaticContentType($path));
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function contentTypeProvider(): array
    {
        return [
            'HTML' => ['privacy-policy.html', 'text/html; charset=UTF-8'],
            'ICO' => ['favicon.ico', 'image/x-icon'],
            'PNG' => ['icon.png', 'image/png'],
            'SVG' => ['icon.svg', 'image/svg+xml'],
            'unknown' => ['file.bin', 'application/octet-stream'],
        ];
    }
}
