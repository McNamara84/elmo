<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';

#[CoversFunction('applyGgmsModelNameToDatasetTitles')]
final class ApplyGgmsModelNameToDatasetTitlesTest extends TestCase
{
    /**
     * @return array<string, array{0: array<int, string>, 1: string, 2: array<int, string>}>
     */
    public static function prefixCases(): array
    {
        return [
            'adds model name when title does not contain it' => [
                ['Global gravity field'],
                'EIGEN-6C4',
                ['EIGEN-6C4: Global gravity field'],
            ],
            'skips when title already contains model name' => [
                ['EIGEN-6C4: Global gravity field'],
                'EIGEN-6C4',
                ['EIGEN-6C4: Global gravity field'],
            ],
            'skips when title contains model name case-insensitively' => [
                ['Global gravity field eigen-6c4'],
                'EIGEN-6C4',
                ['eigen-6c4 Global gravity field'],
            ],
            'keeps an empty title empty' => [
                [''],
                'EIGEN-6C4',
                [''],
            ],
            'does nothing when model name is empty' => [
                ['Global gravity field'],
                '',
                ['Global gravity field'],
            ],
            'does not change later titles' => [
                ['Global gravity field', 'Alternative title'],
                'EIGEN-6C4',
                ['EIGEN-6C4: Global gravity field', 'Alternative title'],
            ],
        ];
    }

    /**
     * @param array<int, string> $titles
     * @param array<int, string> $expected
     */
    #[DataProvider('prefixCases')]
    #[TestDox('applyGgmsModelNameToDatasetTitles: $modelName')]
    public function testPrefixRules(array $titles, string $modelName, array $expected): void
    {
        $this->assertSame($expected, applyGgmsModelNameToDatasetTitles($titles, $modelName));
    }
}
