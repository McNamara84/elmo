<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/identifier_type_patterns.php';

final class IdentifierTypePatternsTest extends TestCase
{
    public function testValidationPatternIsSeparateFromDetection(): void
    {
        $resolved = resolveIdentifierTypePatterns([
            'id' => 1,
            'name' => 'DOI',
            'patterns' => [
                'validation' => [
                    ['pattern' => '^10\\.\\d{4,}\\/\\S+$', 'priority' => 10],
                ],
                'detection' => [
                    ['pattern' => '^https?:\\/\\/(?:doi\\.org|dx\\.doi\\.org)\\/(.+)', 'priority' => 30],
                    ['pattern' => '^doi:', 'priority' => 20],
                    ['pattern' => '^10\\.\\d{4,}', 'priority' => 10],
                ],
            ],
        ]);

        $this->assertSame('^10\\.\\d{4,}\\/\\S+$', $resolved['pattern']);
        $this->assertSame(
            '^https?:\\/\\/(?:doi\\.org|dx\\.doi\\.org)\\/(.+)',
            $resolved['detectionPatterns'][0]['pattern']
        );
        $this->assertSame(30, $resolved['detectionPatterns'][0]['priority']);
    }

    public function testEmptyValidationFallsBackToDetection(): void
    {
        $resolved = resolveIdentifierTypePatterns([
            'name' => 'URL',
            'patterns' => [
                'validation' => [],
                'detection' => [
                    ['pattern' => '^https?:\\/\\/', 'priority' => 1],
                ],
            ],
        ]);

        $this->assertSame('^https?:\\/\\/', $resolved['pattern']);
        $this->assertSame('^https?:\\/\\/', $resolved['detectionPatterns'][0]['pattern']);
    }

    public function testUrlValidationKeepsDocumentLinks(): void
    {
        $resolved = resolveIdentifierTypePatterns([
            'id' => 21,
            'name' => 'URL',
            'patterns' => [
                'validation' => [
                    ['pattern' => '^https?:\\/\\/\\S+$', 'priority' => 10],
                ],
                'detection' => [
                    ['pattern' => '^https?:\\/\\/', 'priority' => 1],
                ],
            ],
        ]);

        $this->assertSame('^https?:\\/\\/\\S+$', $resolved['pattern']);
        $document = 'https://icgem.gfz.de/docs/Foerste-et-al-EIGEN-6C4.pdf';
        $this->assertSame(1, preg_match('#' . $resolved['pattern'] . '#', $document));
        $this->assertSame(1, preg_match('#' . $resolved['detectionPatterns'][0]['pattern'] . '#', $document));
    }

    public function testLegacyPatternStillResolves(): void
    {
        $resolved = resolveIdentifierTypePatterns([
            'name' => 'Handle',
            'pattern' => '^(hdl:)?\\d+(\\.\\d+)*(\\/[^\\s]+)?$',
        ]);

        $this->assertSame('^(hdl:)?\\d+(\\.\\d+)*(\\/[^\\s]+)?$', $resolved['pattern']);
        $this->assertSame($resolved['pattern'], $resolved['detectionPatterns'][0]['pattern']);
    }

    public function testMultipleValidationPatternsAreCombined(): void
    {
        $resolved = resolveIdentifierTypePatterns([
            'name' => 'arXiv',
            'patterns' => [
                'validation' => [
                    ['pattern' => '^\\d{4}\\.\\d{4,5}(v\\d+)?$', 'priority' => 10],
                    ['pattern' => '^[a-z-]+\\/\\d{7}$', 'priority' => 5],
                ],
                'detection' => [],
            ],
        ]);

        $this->assertSame(
            '(?:^\\d{4}\\.\\d{4,5}(v\\d+)?$)|(?:^[a-z-]+\\/\\d{7}$)',
            $resolved['pattern']
        );
    }
}
