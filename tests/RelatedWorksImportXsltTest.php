<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RelatedWorksImportXsltTest extends TestCase
{
    private string $stylesheetPath;

    protected function setUp(): void
    {
        if (!class_exists('DOMDocument') || !class_exists('XSLTProcessor')) {
            $this->markTestSkipped('The DOM and XSL extensions are required.');
        }

        $this->stylesheetPath = dirname(__DIR__) . '/schemas/XSLT/MappingDataCiteRelatedWorksToMap.xslt';
    }

    public function testTransformsDefaultNamespaceInDocumentOrder(): void
    {
        $result = $this->transform(<<<'XML'
<resource xmlns="http://datacite.org/schema/kernel-4">
  <relatedIdentifiers>
    <relatedIdentifier relatedIdentifierType="DOI" relationType="IsReferencedBy">10.1234/one</relatedIdentifier>
    <relatedIdentifier relatedIdentifierType="URL" relationType="IsDocumentedBy">https://example.org/a?x=1&amp;y=2</relatedIdentifier>
  </relatedIdentifiers>
</resource>
XML);

        self::assertSame('RelatedWorks', $result->documentElement->nodeName);
        self::assertSame('', (string) $result->documentElement->namespaceURI);
        self::assertSame([
            ['10.1234/one', 'IsReferencedBy', 'DOI'],
            ['https://example.org/a?x=1&y=2', 'IsDocumentedBy', 'URL'],
        ], $this->entries($result));
    }

    public function testTransformsPrefixedDataCiteInsideEnvelope(): void
    {
        $result = $this->transform(<<<'XML'
<envelope xmlns:dc="http://datacite.org/schema/kernel-4">
  <header>ELMO</header>
  <dc:resource>
    <dc:relatedIdentifiers>
      <dc:relatedIdentifier relatedIdentifierType="Handle" relationType="IsSupplementTo">21.11157/example</dc:relatedIdentifier>
    </dc:relatedIdentifiers>
  </dc:resource>
</envelope>
XML);

        self::assertSame([
            ['21.11157/example', 'IsSupplementTo', 'Handle'],
        ], $this->entries($result));
    }

    public function testTransformsNamespaceFreeLegacyDocument(): void
    {
        $result = $this->transform(<<<'XML'
<resource>
  <relatedIdentifiers>
    <relatedIdentifier relatedIdentifierType="DOI" relationType="Cites">10.1234/legacy</relatedIdentifier>
  </relatedIdentifiers>
</resource>
XML);

        self::assertSame([
            ['10.1234/legacy', 'Cites', 'DOI'],
        ], $this->entries($result));
    }

    public function testTransformsDataCiteSectionInsideIcgemDocument(): void
    {
        $result = $this->transform(<<<'XML'
<icgemMetadata xmlns:dc="http://datacite.org/schema/kernel-4">
  <gravityFieldModel/>
  <dc:resource>
    <dc:relatedIdentifiers>
      <dc:relatedIdentifier relatedIdentifierType="DOI" relationType="IsSourceOf">10.1234/icgem</dc:relatedIdentifier>
    </dc:relatedIdentifiers>
  </dc:resource>
</icgemMetadata>
XML);

        self::assertSame([
            ['10.1234/icgem', 'IsSourceOf', 'DOI'],
        ], $this->entries($result));
    }

    public function testOptionallyExcludesUsedInstruments(): void
    {
        $xml = <<<'XML'
<resource xmlns="http://datacite.org/schema/kernel-4">
  <relatedIdentifiers>
    <relatedIdentifier relatedIdentifierType="Handle" relationType="IsCollectedBy">21.11157/instrument</relatedIdentifier>
    <relatedIdentifier relatedIdentifierType="DOI" relationType="IsReferencedBy">10.1234/work</relatedIdentifier>
  </relatedIdentifiers>
</resource>
XML;

        self::assertSame([
            ['21.11157/instrument', 'IsCollectedBy', 'Handle'],
            ['10.1234/work', 'IsReferencedBy', 'DOI'],
        ], $this->entries($this->transform($xml)));

        self::assertSame([
            ['10.1234/work', 'IsReferencedBy', 'DOI'],
        ], $this->entries($this->transform($xml, true)));
    }

    private function transform(string $xml, bool $excludeIsCollectedBy = false): DOMDocument
    {
        $source = new DOMDocument();
        self::assertTrue($source->loadXML($xml, LIBXML_NONET));

        $stylesheet = new DOMDocument();
        self::assertTrue($stylesheet->load($this->stylesheetPath, LIBXML_NONET));

        $processor = new XSLTProcessor();
        self::assertTrue($processor->importStylesheet($stylesheet));
        self::assertTrue($processor->setParameter('', 'excludeIsCollectedBy', $excludeIsCollectedBy ? 'true' : 'false'));

        $result = $processor->transformToDoc($source);
        self::assertInstanceOf(DOMDocument::class, $result);

        return $result;
    }

    /**
     * @return list<array{string, string, string}>
     */
    private function entries(DOMDocument $document): array
    {
        $entries = [];
        foreach ($document->getElementsByTagName('RelatedWork') as $work) {
            $entries[] = [
                trim($work->getElementsByTagName('Identifier')->item(0)?->textContent ?? ''),
                trim($work->getElementsByTagName('Relation')->item(0)?->getElementsByTagName('name')->item(0)?->textContent ?? ''),
                trim($work->getElementsByTagName('IdentifierType')->item(0)?->getElementsByTagName('name')->item(0)?->textContent ?? ''),
            ];
        }

        return $entries;
    }
}
