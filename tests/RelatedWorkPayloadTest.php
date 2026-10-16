<?php

declare(strict_types=1);

namespace Tests;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/formgroups/save_relatedwork.php';

final class RelatedWorkPayloadTest extends TestCase
{
    public function testMissingPayloadFallsBackToLegacyArrays(): void
    {
        $entries = normalizeRelatedWorksPayload([
            'rIdentifier' => [' 10.1234/first ', '', 'https://example.org/third'],
            'relation' => ['7', '', 'References'],
            'rIdentifierType' => [' DOI ', '', 'URL'],
        ]);

        self::assertSame([
            [
                'entryKey' => 'related-work-legacy-0',
                'order' => 0,
                'identifier' => '10.1234/first',
                'relation' => '7',
                'relationId' => '7',
                'identifierType' => 'DOI',
            ],
            [
                'entryKey' => 'related-work-legacy-2',
                'order' => 1,
                'identifier' => 'https://example.org/third',
                'relation' => 'References',
                'relationId' => '',
                'identifierType' => 'URL',
            ],
        ], $entries);
    }

    public function testStructuredPayloadIsTrimmedAndKeepsListOrder(): void
    {
        $entries = normalizeRelatedWorksPayload([
            'relatedWorksPayload' => json_encode([
                [
                    'entryKey' => ' related-work-b ',
                    'order' => 99,
                    'identifier' => ' 10.1234/second ',
                    'relation' => ' IsSupplementTo ',
                    'relationId' => ' 12 ',
                    'identifierType' => ' DOI ',
                ],
                [
                    'entryKey' => 'empty-card',
                    'order' => 0,
                    'identifier' => ' ',
                    'relation' => '',
                    'relationId' => '',
                    'identifierType' => '',
                ],
                [
                    'entryKey' => 'related-work-a',
                    'order' => -5,
                    'identifier' => 'https://example.org/first',
                    'relation' => 'References',
                    'identifierType' => 'URL',
                ],
            ], JSON_THROW_ON_ERROR),
        ]);

        self::assertSame([
            [
                'entryKey' => 'related-work-b',
                'order' => 0,
                'identifier' => '10.1234/second',
                'relation' => 'IsSupplementTo',
                'relationId' => '12',
                'identifierType' => 'DOI',
            ],
            [
                'entryKey' => 'related-work-a',
                'order' => 1,
                'identifier' => 'https://example.org/first',
                'relation' => 'References',
                'relationId' => '',
                'identifierType' => 'URL',
            ],
        ], $entries);
    }

    public function testPayloadMayBeProvidedAsAnArray(): void
    {
        $entries = normalizeRelatedWorksPayload([
            'relatedWorksPayload' => [
                [
                    'identifier' => '10.1234/array',
                    'relation' => 'Cites',
                    'identifierType' => 'DOI',
                ],
            ],
        ]);

        self::assertCount(1, $entries);
        self::assertSame('10.1234/array', $entries[0]['identifier']);
        self::assertSame(0, $entries[0]['order']);
    }

    public function testDoiResolverPrefixesAreRemovedFromStructuredAndLegacyInput(): void
    {
        $structuredEntries = normalizeRelatedWorksPayload([
            'relatedWorksPayload' => json_encode([
                [
                    'identifier' => 'https://doi.org/10.5880/icgem.2026.003',
                    'relation' => 'References',
                    'identifierType' => 'DOI',
                ],
                [
                    'identifier' => 'https://example.org/10.5880/not-a-doi',
                    'relation' => 'References',
                    'identifierType' => 'URL',
                ],
            ], JSON_THROW_ON_ERROR),
        ]);
        $legacyEntries = normalizeRelatedWorksPayload([
            'rIdentifier' => ['doi: 10.5880/ICGEM.2019.004'],
            'relation' => ['References'],
            'rIdentifierType' => ['DOI'],
        ]);

        self::assertSame('10.5880/icgem.2026.003', $structuredEntries[0]['identifier']);
        self::assertSame('https://example.org/10.5880/not-a-doi', $structuredEntries[1]['identifier']);
        self::assertSame('10.5880/ICGEM.2019.004', $legacyEntries[0]['identifier']);
    }

    public function testExplicitEmptyPayloadOverridesStaleLegacyFields(): void
    {
        $entries = normalizeRelatedWorksPayload([
            'relatedWorksPayload' => '[]',
            'rIdentifier' => ['10.1234/stale'],
            'relation' => ['1'],
            'rIdentifierType' => ['DOI'],
        ]);

        self::assertSame([], $entries);
    }

    public function testRelationIdIsPreferredAsPersistenceReference(): void
    {
        $entry = [
            'relation' => 'IsCitedBy',
            'relationId' => '42',
        ];

        self::assertSame('42', getRelatedWorkRelationReference($entry));
        self::assertSame('IsCitedBy', getRelatedWorkRelationReference([
            'relation' => 'IsCitedBy',
            'relationId' => '',
        ]));
    }

    public function testInvalidJsonPayloadIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('invalid JSON');

        normalizeRelatedWorksPayload(['relatedWorksPayload' => '{not-json']);
    }

    public function testPayloadMustBeAList(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('decode to a list');

        normalizeRelatedWorksPayload([
            'relatedWorksPayload' => json_encode([
                'identifier' => '10.1234/not-a-list',
                'relation' => 'Cites',
                'identifierType' => 'DOI',
            ], JSON_THROW_ON_ERROR),
        ]);
    }

    public function testEachPayloadEntryMustBeAnObject(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('entry 0 must be an object');

        normalizeRelatedWorksPayload([
            'relatedWorksPayload' => json_encode(['not-an-object'], JSON_THROW_ON_ERROR),
        ]);
    }
}
