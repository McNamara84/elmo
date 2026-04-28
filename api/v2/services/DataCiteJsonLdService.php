<?php

class DataCiteJsonLdService
{
    private const DEFAULT_CONTEXT_URL = 'https://schema.stage.datacite.org/linked-data/context/fullcontext.jsonld';

    /**
     * Convert a DataCite XML document into compact JSON-LD.
     *
     * The output follows the XML-shaped DataCite JSON-LD pattern used by the
     * DataCite linked-data runner example with attrs/value keys.
     */
    public function convertXmlStringToJsonLd(string $xmlString): string
    {
        $payload = $this->convertXmlStringToArray($xmlString);

        return json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Convert a DataCite XML document into a compact JSON-LD array.
     *
     * @return array<string, mixed>
     */
    public function convertXmlStringToArray(string $xmlString): array
    {
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);

        try {
            if (!$document->loadXML($xmlString)) {
                throw new InvalidArgumentException('Invalid DataCite XML document.');
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }

        $resource = $document->documentElement;
        if (!$resource instanceof DOMElement || $resource->localName !== 'resource') {
            throw new InvalidArgumentException('Expected a DataCite resource root element.');
        }

        $payload = ['@context' => $this->getContextUrl()];
        $resourceId = $this->buildResourceId($resource);
        if ($resourceId !== null) {
            $payload['@id'] = $resourceId;
        }

        foreach ($this->collectElementChildren($resource) as $childName => $childNodes) {
            $payload[$childName] = $this->convertElements($childNodes);
        }

        return $payload;
    }

    /**
     * @return array<string, list<DOMElement>>
     */
    private function collectElementChildren(DOMElement $element): array
    {
        $children = [];
        foreach ($element->childNodes as $childNode) {
            if (!$childNode instanceof DOMElement) {
                continue;
            }

            $children[$childNode->localName] ??= [];
            $children[$childNode->localName][] = $childNode;
        }

        return $children;
    }

    /**
     * @param list<DOMElement> $elements
     * @return array<string, mixed>|list<array<string, mixed>>
     */
    private function convertElements(array $elements): array
    {
        $converted = array_map(fn (DOMElement $element) => $this->convertElement($element), $elements);

        return count($converted) === 1 ? $converted[0] : $converted;
    }

    /**
     * @return array<string, mixed>
     */
    private function convertElement(DOMElement $element): array
    {
        $result = [];

        $attributes = $this->collectAttributes($element);
        if ($attributes !== []) {
            $result['attrs'] = $attributes;
        }

        foreach ($this->collectElementChildren($element) as $childName => $childNodes) {
            $result[$childName] = $this->convertElements($childNodes);
        }

        $textContent = $this->extractDirectTextContent($element);
        if ($textContent !== null) {
            $result['value'] = $textContent;
        }

        return $result;
    }

    /**
     * @return array<string, string>
     */
    private function collectAttributes(DOMElement $element): array
    {
        $attributes = [];

        foreach ($element->attributes as $attribute) {
            $name = $attribute->nodeName;
            if ($name === 'xml:lang') {
                $name = 'lang';
            }

            $attributes[$name] = $attribute->nodeValue;
        }

        return $attributes;
    }

    private function extractDirectTextContent(DOMElement $element): ?string
    {
        $text = '';
        foreach ($element->childNodes as $childNode) {
            if ($childNode instanceof DOMText) {
                $text .= $childNode->nodeValue;
            }
        }

        $text = trim($text);
        return $text === '' ? null : $text;
    }

    private function getContextUrl(): string
    {
        $configuredUrl = getenv('DATACITE_JSONLD_CONTEXT_URL');
        if (is_string($configuredUrl) && trim($configuredUrl) !== '') {
            return trim($configuredUrl);
        }

        return self::DEFAULT_CONTEXT_URL;
    }

    private function buildResourceId(DOMElement $resource): ?string
    {
        foreach ($resource->childNodes as $childNode) {
            if (!$childNode instanceof DOMElement || $childNode->localName !== 'identifier') {
                continue;
            }

            $value = trim($childNode->textContent);
            if ($value === '') {
                return null;
            }

            if (preg_match('#^https?://#i', $value)) {
                return $value;
            }

            $identifierType = strtoupper((string) $childNode->getAttribute('identifierType'));
            if ($identifierType === 'DOI') {
                return 'https://doi.org/' . ltrim($value, '/');
            }

            return $value;
        }

        return null;
    }
}