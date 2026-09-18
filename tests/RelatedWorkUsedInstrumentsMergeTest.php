<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/save_to_db_helper.php';

final class RelatedWorkUsedInstrumentsMergeTest extends TestCase
{
    public function testEnabledUsedInstrumentsAreAppendedAfterPayloadAndDeduplicated(): void
    {
        $updatedXml = applyRelatedWorksPayloadToResourceXmlString(
            $this->databaseResourceXml(),
            [
                'relatedWorksPayload' => json_encode([
                    [
                        'identifier' => 'https://doi.org/10.1234/DUPLICATE',
                        'relation' => 'IsReferencedBy',
                        'identifierType' => 'DOI',
                    ],
                    [
                        'identifier' => '10.1234/duplicate',
                        'relation' => 'IsReferencedBy',
                        'identifierType' => 'doi',
                    ],
                    [
                        'identifier' => 'https://payload.example/work',
                        'relation' => 'References',
                        'identifierType' => 'URL',
                    ],
                    [
                        'identifier' => '21.11157/payload-instrument',
                        'relation' => 'IsCollectedBy',
                        'identifierType' => 'Handle',
                    ],
                ], JSON_THROW_ON_ERROR),
            ],
            true
        );

        self::assertSame([
            ['https://doi.org/10.1234/DUPLICATE', 'IsReferencedBy', 'DOI'],
            ['https://payload.example/work', 'References', 'URL'],
            ['21.11157/alpha', 'IsCollectedBy', 'Handle'],
            ['10.5555/instrument', 'IsCollectedBy', 'DOI'],
        ], $this->relatedWorks($updatedXml));
        self::assertStringNotContainsString('https://stored.example/old-normal', $updatedXml);
        self::assertStringNotContainsString('21.11157/payload-instrument', $updatedXml);
    }

    public function testDisabledUsedInstrumentsTreatsIsCollectedByAsNormalPayloadEntry(): void
    {
        $updatedXml = applyRelatedWorksPayloadToResourceXmlString(
            $this->databaseResourceXml(),
            [
                'relatedWorksPayload' => json_encode([
                    [
                        'identifier' => '21.11157/payload-instrument',
                        'relation' => 'IsCollectedBy',
                        'identifierType' => 'Handle',
                    ],
                ], JSON_THROW_ON_ERROR),
            ],
            false
        );

        self::assertSame([
            ['21.11157/payload-instrument', 'IsCollectedBy', 'Handle'],
        ], $this->relatedWorks($updatedXml));
        self::assertStringNotContainsString('21.11157/alpha', $updatedXml);
        self::assertStringNotContainsString('10.5555/instrument', $updatedXml);
    }

    public function testExplicitEmptyPayloadKeepsOnlyDatabaseInstrumentsWhenEnabled(): void
    {
        $updatedXml = applyRelatedWorksPayloadToResourceXmlString(
            $this->databaseResourceXml(),
            ['relatedWorksPayload' => '[]'],
            true
        );

        self::assertSame([
            ['21.11157/alpha', 'IsCollectedBy', 'Handle'],
            ['10.5555/instrument', 'IsCollectedBy', 'DOI'],
        ], $this->relatedWorks($updatedXml));
    }

    public function testExportCompositionUsesConfiguredUsedInstrumentsFeatureFlag(): void
    {
        $hadFeatureFlag = array_key_exists('showUsedInstruments', $GLOBALS);
        $previousFeatureFlag = $GLOBALS['showUsedInstruments'] ?? null;
        $GLOBALS['showUsedInstruments'] = true;

        try {
            $controller = new class($this->databaseResourceXml()) {
                public function __construct(private readonly string $resourceXml)
                {
                }

                public function getResourceAsXml(): string
                {
                    return $this->resourceXml;
                }
            };

            $updatedXml = buildResourceXmlWithCurrentFormPayloads(
                new \mysqli(),
                $controller,
                7,
                [
                    'relatedWorksPayload' => json_encode([
                        [
                            'identifier' => 'https://payload.example/only',
                            'relation' => 'References',
                            'identifierType' => 'URL',
                        ],
                    ], JSON_THROW_ON_ERROR),
                ]
            );
        } finally {
            if ($hadFeatureFlag) {
                $GLOBALS['showUsedInstruments'] = $previousFeatureFlag;
            } else {
                unset($GLOBALS['showUsedInstruments']);
            }
        }

        self::assertNotNull($updatedXml);
        self::assertSame([
            ['https://payload.example/only', 'References', 'URL'],
            ['21.11157/alpha', 'IsCollectedBy', 'Handle'],
            ['10.5555/instrument', 'IsCollectedBy', 'DOI'],
        ], $this->relatedWorks($updatedXml));
    }

    private function databaseResourceXml(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
  <RelatedWorks>
    <RelatedWork>
      <Identifier>https://stored.example/old-normal</Identifier>
      <Relation><name>References</name></Relation>
      <IdentifierType><name>URL</name></IdentifierType>
    </RelatedWork>
    <RelatedWork>
      <Identifier>21.11157/alpha</Identifier>
      <Relation><name>IsCollectedBy</name></Relation>
      <IdentifierType><name>Handle</name></IdentifierType>
    </RelatedWork>
    <RelatedWork>
      <Identifier> 21.11157/alpha </Identifier>
      <Relation><name>IsCollectedBy</name></Relation>
      <IdentifierType><name>Handle</name></IdentifierType>
    </RelatedWork>
    <RelatedWork>
      <Identifier>10.5555/instrument</Identifier>
      <Relation><name>IsCollectedBy</name></Relation>
      <IdentifierType><name>DOI</name></IdentifierType>
    </RelatedWork>
  </RelatedWorks>
</Resource>
XML;
    }

    /**
     * @return list<array{0: string, 1: string, 2: string}>
     */
    private function relatedWorks(string $xml): array
    {
        $dom = new \DOMDocument();
        self::assertTrue($dom->loadXML($xml));
        $xpath = new \DOMXPath($dom);
        $entries = [];

        foreach ($xpath->query('/Resource/RelatedWorks/RelatedWork') as $work) {
            $entries[] = [
                trim($xpath->evaluate('string(Identifier)', $work)),
                trim($xpath->evaluate('string(Relation/name)', $work)),
                trim($xpath->evaluate('string(IdentifierType/name)', $work)),
            ];
        }

        return $entries;
    }
}
