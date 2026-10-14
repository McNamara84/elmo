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
    public static function acceptedFormats(): array
    {
        return [
            ['DOI', 'doi: 10.1234/ABC'], ['DOI', 'https://doi.org/10.1234/ABC'],
            ['IGSN', '10.60510/gf1211s-47'], ['IGSN', 'https://doi.org/10.60510/gf1211s-47'], ['IGSN', 'GFZABC123'],
            ['RAiD', 'https://raid.org/10.82210/162fda4d'], ['RAiD', '10.82210/162fda4d'],
            ['arXiv', 'https://arxiv.org/abs/2507.21532'], ['arXiv', 'hep-th/9603067v2'], ['arXiv', 'arXiv:2507.21532'],
            ['ISBN', '978-3-510-96872-5'], ['ISBN', '9783831048069'], ['ISBN', '0-8044-2957-X'], ['ISBN', '979-10-90636-07-1'],
            ['EAN13', '9783831048069'], ['Handle', 'hdl:1234/item'], ['URL', 'https://example.org/page'],
        ];
    }

    #[DataProvider('acceptedFormats')]
    public function testKnownFormatsValidateEvenWithStaleVocabulary(string $name, string $input): void
    {
        $pattern = IdentifierTypePatterns::validationPattern(['name' => $name, 'pattern' => '^obsolete$']);
        self::assertSame(1, preg_match('~' . $pattern . '~iD', $input), $name . ': ' . $input);
    }

    public static function rejectedFormats(): array
    {
        return [['ISBN', '978--3-510-96872-5'], ['ISBN', '978383104806'], ['ISBN', '97838310480699'], ['ISBN', '979-0-060-11561-5'],
            ['EAN13', '978-3-8310-4806-9'], ['RAiD', 'https://raid.org.evil.org/10.82210/id'], ['arXiv', 'https://arxiv.org/abs/invalid'], ['Handle', '123456']];
    }

    #[DataProvider('rejectedFormats')]
    public function testRejectsInvalidForms(string $name, string $input): void
    {
        self::assertSame(0, preg_match('~' . IdentifierTypePatterns::supported()[$name] . '~iD', $input));
    }

    public function testGroupedValidationAlternativesAreCombinedWithoutDetectionRules(): void
    {
        $pattern = IdentifierTypePatterns::validationPattern(['name' => 'Custom', 'patterns' => [
            'validation' => [['pattern' => '/^first$/i'], ['pattern' => '^second$/'], ['pattern' => '']],
            'detection' => [['pattern' => '^wrong']],
        ]]);
        self::assertSame(1, preg_match('~' . $pattern . '~D', 'first'));
        self::assertSame(1, preg_match('~' . $pattern . '~D', 'second'));
        self::assertSame(0, preg_match('~' . $pattern . '~D', 'wrong'));
        self::assertSame(0, preg_match('~' . $pattern . '~D', 'first extra'));
    }

    public function testEmptyLegacyAndCaseInsensitiveNames(): void
    {
        self::assertSame('', IdentifierTypePatterns::validationPattern(['name' => 'Custom']));
        self::assertSame('^test$', IdentifierTypePatterns::normalize('"^test$"'));
        self::assertSame('^test/', IdentifierTypePatterns::normalize('^test/'));
        self::assertSame(IdentifierTypePatterns::supported()['RAiD'], IdentifierTypePatterns::validationPattern(['name' => 'raid']));
    }
}
