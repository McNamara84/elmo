<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_thesauruskeywords.php';
require_once __DIR__ . '/../save/formgroups/save_freekeywords.php';
require_once __DIR__ . '/../includes/save_to_db_helper.php';

/**
 * GCMD Platforms keywords in the database must appear as dace:subject in ICGEM XML.
 *
 * This isolates PHP save + generate-xml from the Playwright form POST. When these
 * pass, a roundtrip that still omits platforms is a missing POST field, not an
 * ICGEMController rewrite of DatasetController keyword export.
 */
final class ICGEMThesaurusSubjectsExportTest extends DatabaseTestCase
{
    private const GRACE_FO = 'Platforms > Space-based Platforms > Earth Observation Satellites > GRACE-FO';
    private const GRACE_FO_VALUE_URI = 'https://gcmd.earthdata.nasa.gov/kms/concept/f75e34e2-ebe7-4a6c-8bf6-da596a36b632';
    private const PLATFORMS_SCHEME_URI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms';

    public function testSaveKeywordsPersistsGcmdPlatformsFromPost(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.ICGEM.PLATFORMS.SAVE', 'ICGEM platforms save');

        $saved = saveKeywords($this->connection, $this->platformsPostData(), $resourceId);

        $this->assertTrue($saved);

        $stmt = $this->connection->prepare(
            'SELECT tk.keyword, tk.scheme, tk.schemeURI, tk.valueURI
             FROM Thesaurus_Keywords tk
             JOIN Resource_has_Thesaurus_Keywords rhtk
               ON tk.thesaurus_keywords_id = rhtk.Thesaurus_Keywords_thesaurus_keywords_id
             WHERE rhtk.Resource_resource_id = ?'
        );
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotFalse($row);
        $this->assertSame(self::GRACE_FO, $row['keyword']);
        $this->assertSame('NASA/GCMD Earth Platforms Keywords', $row['scheme']);
        $this->assertSame(self::PLATFORMS_SCHEME_URI, $row['schemeURI']);
        $this->assertSame(self::GRACE_FO_VALUE_URI, $row['valueURI']);
    }

    public function testIcgemXmlIncludesPlatformsSubjectFromDatabase(): void
    {
        $resourceId = $this->createResourceWithKeywords();

        $generated = generateDatasetPayloadByResourceId($resourceId, [
            'format' => 'xml',
            'variant' => 'icgem',
        ]);

        $this->assertSame('icgem-xml', $generated['generator']);
        $this->assertSubjectTextInXml($generated['payload'], self::GRACE_FO);
        $this->assertSubjectTextInXml($generated['payload'], 'Hole A');
        $this->assertStringContainsString(
            'schemeURI="' . self::PLATFORMS_SCHEME_URI . '"',
            $generated['payload']
        );
    }

    public function testDatasetXmlAlsoIncludesPlatformsSubjectFromDatabase(): void
    {
        $resourceId = $this->createResourceWithKeywords();

        $generated = generateDatasetPayloadByResourceId($resourceId, [
            'format' => 'xml',
            'variant' => 'gfz',
        ]);

        $this->assertSame('dataset-xml', $generated['generator']);
        $this->assertSubjectTextInXml($generated['payload'], self::GRACE_FO);
        $this->assertSubjectTextInXml($generated['payload'], 'Hole A');
    }

    private function assertSubjectTextInXml(string $xml, string $text): void
    {
        $encoded = htmlspecialchars($text, ENT_XML1, 'UTF-8');
        $this->assertTrue(
            str_contains($xml, $text) || str_contains($xml, $encoded),
            "Expected subject text missing from XML: {$text}"
        );
    }

    /**
     * @return array<string, string>
     */
    private function platformsPostData(): array
    {
        return [
            'platforms' => json_encode([
                [
                    'value' => self::GRACE_FO,
                    'id' => self::GRACE_FO_VALUE_URI,
                    'scheme' => 'NASA/GCMD Earth Platforms Keywords',
                    'schemeURI' => self::PLATFORMS_SCHEME_URI,
                    'language' => 'en',
                ],
            ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
        ];
    }

    private function createResourceWithKeywords(): int
    {
        $resourceId = $this->createResource('GFZ.TEST.ICGEM.PLATFORMS.XML', 'ICGEM platforms XML');

        saveKeywords($this->connection, $this->platformsPostData(), $resourceId);
        saveFreeKeywords($this->connection, [
            'freekeywords' => [json_encode([['value' => 'Hole A']], JSON_THROW_ON_ERROR)],
        ], $resourceId);

        return $resourceId;
    }
}
