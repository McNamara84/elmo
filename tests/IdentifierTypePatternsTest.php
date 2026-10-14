<?php

declare(strict_types=1);

namespace Tests;

use IdentifierTypePatterns;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/services/IdentifierTypePatterns.php';

#[CoversClass(IdentifierTypePatterns::class)]
final class IdentifierTypePatternsTest extends TestCase
{
    public static function knownTypes(): array
    {
        return array_map(static fn(string $name): array => [$name], ['DOI', 'IGSN', 'RAiD', 'arXiv', 'ISBN', 'EAN13', 'Handle', 'URL']);
    }

    #[DataProvider('knownTypes')]
    public function testDeliveredPatternsAreAuthoritativeForEveryKnownType(string $name): void
    {
        self::assertSame('^central-only$', IdentifierTypePatterns::validationPattern(['name' => $name, 'pattern' => '^central-only$']));
        $pattern = IdentifierTypePatterns::validationPattern(['name' => $name, 'pattern' => '^stale$', 'patterns' => [
            'validation' => [['pattern' => '/^central-only$/i'], ['pattern' => '^changed$/']],
            'detection' => [['pattern' => '^ignored$']],
        ]]);
        self::assertSame(1, preg_match('~' . $pattern . '~D', 'central-only'));
        self::assertSame(1, preg_match('~' . $pattern . '~D', 'changed'));
        self::assertSame(0, preg_match('~' . $pattern . '~D', 'stale'));
        self::assertSame(0, preg_match('~' . $pattern . '~D', 'ignored'));
        self::assertSame(0, preg_match('~' . $pattern . '~D', 'changed extra'));
    }

    public static function missingPatterns(): array
    {
        return [[[]], [['patterns' => ['validation' => []], 'pattern' => '^stale$']],
            [['patterns' => ['validation' => null], 'pattern' => '^stale$']],
            [['patterns' => ['validation' => [null, [], ['pattern' => '   '], ['pattern' => 5]]]]],
            [['pattern' => ['wrong type']]]];
    }

    #[DataProvider('missingPatterns')]
    public function testMissingOrMalformedDefinitionsNeverInventAFormat(array $metadata): void
    {
        self::assertSame('', IdentifierTypePatterns::validationPattern(['name' => 'IGSN'] + $metadata));
    }

    public function testDecodedBackslashesArePreserved(): void
    {
        self::assertSame('^test$', IdentifierTypePatterns::normalize('"^test$"'));
        self::assertSame('^test/', IdentifierTypePatterns::normalize('^test/'));
        self::assertSame('^a\\\\b$', IdentifierTypePatterns::validationPattern(['name' => 'DOI', 'pattern' => '^a\\\\b$']));
    }
}
