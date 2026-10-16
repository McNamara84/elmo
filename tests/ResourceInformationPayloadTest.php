<?php

declare(strict_types=1);

namespace Tests;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/resource_information_payload.php';

final class ResourceInformationPayloadTest extends TestCase
{
    public function testStructuredPayloadOverridesLegacyFieldsAndKeepsTitleOrder(): void
    {
        $post = [
            'doi' => '10.9999/old',
            'title' => ['Old title'],
            'Rights' => '5',
            'resourceInformationPayload' => json_encode([
                'doi' => '10.5880/example',
                'year' => '2026',
                'resourceTypeId' => '10',
                'version' => '3.0',
                'languageId' => '1',
                'titles' => [
                    ['entryKey' => 'main', 'text' => 'Main', 'typeId' => '1'],
                    ['entryKey' => 'second', 'text' => 'Second', 'typeId' => '3'],
                    ['entryKey' => 'first', 'text' => 'First', 'typeId' => '2'],
                ],
            ], JSON_THROW_ON_ERROR),
        ];

        $normalized = \normalizeResourceInformationPostData($post);

        self::assertSame('10.5880/example', $normalized['doi']);
        self::assertSame('3.0', $normalized['version']);
        self::assertSame(['Main', 'Second', 'First'], $normalized['title']);
        self::assertSame(['1', '3', '2'], $normalized['titleType']);
        self::assertSame('5', $normalized['Rights']);
    }

    public function testLegacyRequestRemainsUsable(): void
    {
        $legacy = ['doi' => '', 'title' => ['Legacy']];
        self::assertSame($legacy, \normalizeResourceInformationPostData($legacy));
    }

    public function testMalformedPayloadDoesNotFallBackToLegacyFields(): void
    {
        $this->expectException(InvalidArgumentException::class);
        \normalizeResourceInformationPostData([
            'title' => ['stale'],
            'resourceInformationPayload' => '{malformed',
        ]);
    }

    public function testIntegerVersionKeepsExplicitMinorComponent(): void
    {
        self::assertSame('3.0', \normalizeResourceVersion('3'));
        self::assertSame('3.0', \normalizeResourceVersion('3.0'));
        self::assertSame('3.14', \normalizeResourceVersion('3.14'));
    }
}
