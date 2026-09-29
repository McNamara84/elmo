<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class ResourceInformationImportXsltTest extends TestCase
{
    #[DataProvider('documents')]
    public function testMapsResourceFieldsAndOrderedTitles(string $xml): void
    {
        if (!class_exists('XSLTProcessor')) {
            self::markTestSkipped('XSL extension is unavailable.');
        }
        $source = new DOMDocument();
        self::assertTrue($source->loadXML($xml, LIBXML_NONET));
        $style = new DOMDocument();
        self::assertTrue($style->load(dirname(__DIR__) . '/schemas/XSLT/MappingDataCiteResourceInformationToMap.xslt', LIBXML_NONET));
        $processor = new XSLTProcessor();
        self::assertTrue($processor->importStylesheet($style));
        $result = $processor->transformToDoc($source);
        self::assertInstanceOf(DOMDocument::class, $result);
        $xpath = new DOMXPath($result);
        foreach (['Doi' => '10.5880/example', 'Year' => '2026', 'ResourceType' => 'Dataset',
            'Version' => '3.0', 'Language' => 'en'] as $field => $expected) {
            self::assertSame($expected, $xpath->evaluate("string(/ResourceInformation/{$field})"));
        }
        $titles = $xpath->query('/ResourceInformation/Titles/Title');
        self::assertCount(3, $titles);
        self::assertSame(['Main', 'Later', 'Earlier'], array_map(
            static fn (DOMNode $node) => trim($node->textContent), iterator_to_array($titles)
        ));
        self::assertSame(['', 'AlternativeTitle', 'TranslatedTitle'], array_map(
            static fn (DOMElement $node) => $node->getAttribute('type'), iterator_to_array($titles)
        ));
    }

    public static function documents(): iterable
    {
        $body = '<identifier identifierType="DOI">10.5880/example</identifier>'
            . '<publicationYear>2026</publicationYear><resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>'
            . '<version>3.0</version><language>en</language><titles><title>Main</title>'
            . '<title titleType="AlternativeTitle">Later</title><title titleType="TranslatedTitle">Earlier</title></titles>';
        yield 'DataCite namespace' => ['<resource xmlns="http://datacite.org/schema/kernel-4">' . $body . '</resource>'];
        yield 'no namespace' => ['<resource>' . $body . '</resource>'];
        yield 'ICGEM wrapper' => ['<metadata xmlns:dc="http://datacite.org/schema/kernel-4"><dc:resource>'
            . $body . '</dc:resource></metadata>'];
    }
}
