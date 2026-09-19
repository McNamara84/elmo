<?php

require_once __DIR__ . '/../save/formgroups/save_relatedwork.php';

/**
 * Reports whether current form data explicitly supplies a Related Works payload.
 *
 * An empty JSON array is authoritative: it means that existing Related Works
 * must be removed from the Resource XML before it is transformed.
 *
 * @param array<string, mixed> $postData Current form data.
 */
function hasRelatedWorksPayload(array $postData): bool
{
    return array_key_exists('relatedWorksPayload', $postData);
}

/**
 * Replaces the direct RelatedWorks child with entries from current form data.
 *
 * Only entries that the draft-save path can persist are exported. An explicitly
 * empty payload removes the existing container so the forward XSLTs cannot emit
 * an empty relatedIdentifiers element.
 *
 * When Used Instruments are enabled, database-derived IsCollectedBy entries
 * remain owned by that form group and are appended after the payload entries.
 * Payload-supplied IsCollectedBy entries are ignored in that mode.
 *
 * @param string $resourceXml Internal Resource XML.
 * @param array<string, mixed> $postData Current form data containing relatedWorksPayload.
 * @param bool $usedInstrumentsEnabled Whether IsCollectedBy belongs to Used Instruments.
 * @return string Updated XML document.
 *
 * @throws InvalidArgumentException When the Related Works payload is malformed.
 * @throws RuntimeException When the supplied XML cannot be parsed or serialized.
 */
function applyRelatedWorksPayloadToResourceXmlString(
    string $resourceXml,
    array $postData,
    bool $usedInstrumentsEnabled = false
): string {
    $relatedWorks = array_values(array_filter(
        normalizeRelatedWorksPayload($postData),
        static fn (array $entry): bool => $entry['identifier'] !== '' && $entry['relation'] !== ''
    ));

    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = true;

    if (!$dom->loadXML($resourceXml)) {
        throw new RuntimeException('Could not parse resource XML for Related Works payload replacement.');
    }

    $root = $dom->documentElement;
    if (!$root instanceof DOMElement) {
        throw new RuntimeException('Resource XML does not contain a document element.');
    }

    $existingContainers = [];
    foreach ($root->childNodes as $child) {
        if ($child instanceof DOMElement && $child->localName === 'RelatedWorks' && $child->namespaceURI === null) {
            $existingContainers[] = $child;
        }
    }

    if ($usedInstrumentsEnabled) {
        $relatedWorks = array_values(array_filter(
            $relatedWorks,
            static fn (array $entry): bool => $entry['relation'] !== 'IsCollectedBy'
        ));
        $relatedWorks = array_merge(
            $relatedWorks,
            extractUsedInstrumentRelatedWorks($existingContainers)
        );
    }

    $relatedWorks = deduplicateRelatedWorksForXml($relatedWorks);

    $relatedWorksElement = buildRelatedWorksElement($dom, $relatedWorks);
    if ($relatedWorksElement->hasChildNodes()) {
        if ($existingContainers !== []) {
            $root->replaceChild($relatedWorksElement, $existingContainers[0]);
            array_shift($existingContainers);
        } else {
            $root->appendChild($relatedWorksElement);
        }
    }

    foreach ($existingContainers as $existingContainer) {
        $root->removeChild($existingContainer);
    }

    $updatedXml = $dom->saveXML();
    if ($updatedXml === false) {
        throw new RuntimeException('Could not serialize resource XML after Related Works payload replacement.');
    }

    return $updatedXml;
}

/**
 * Extracts database-derived Used Instruments in their existing XML order.
 *
 * @param list<DOMElement> $containers Existing non-namespaced RelatedWorks containers.
 * @return list<array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}>
 */
function extractUsedInstrumentRelatedWorks(array $containers): array
{
    $instruments = [];

    foreach ($containers as $container) {
        foreach ($container->childNodes as $child) {
            if (!$child instanceof DOMElement || $child->localName !== 'RelatedWork' || $child->namespaceURI !== null) {
                continue;
            }

            $entry = relatedWorkEntryFromXmlElement($child, count($instruments));
            if ($entry === null || $entry['relation'] !== 'IsCollectedBy') {
                continue;
            }

            $instruments[] = $entry;
        }
    }

    return $instruments;
}

/**
 * Reads an internal RelatedWork element into the normalized payload shape.
 *
 * @return array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}|null
 */
function relatedWorkEntryFromXmlElement(DOMElement $element, int $order): ?array
{
    $identifier = relatedWorkDirectChildText($element, 'Identifier');
    $relation = relatedWorkNestedName($element, 'Relation');

    if ($identifier === '' || $relation === '') {
        return null;
    }

    return [
        'entryKey' => "used-instrument-{$order}",
        'order' => $order,
        'identifier' => $identifier,
        'relation' => $relation,
        'relationId' => '',
        'identifierType' => relatedWorkNestedName($element, 'IdentifierType'),
    ];
}

/**
 * Returns trimmed text from a non-namespaced direct child.
 */
function relatedWorkDirectChildText(DOMElement $parent, string $name): string
{
    foreach ($parent->childNodes as $child) {
        if ($child instanceof DOMElement && $child->localName === $name && $child->namespaceURI === null) {
            return trim($child->textContent);
        }
    }

    return '';
}

/**
 * Returns the name child from an internal Relation or IdentifierType element.
 */
function relatedWorkNestedName(DOMElement $parent, string $containerName): string
{
    foreach ($parent->childNodes as $child) {
        if (!$child instanceof DOMElement || $child->localName !== $containerName || $child->namespaceURI !== null) {
            continue;
        }

        return relatedWorkDirectChildText($child, 'name');
    }

    return '';
}

/**
 * Removes duplicate Related Works while retaining the first occurrence.
 *
 * Payload order therefore wins, followed by the database order of preserved
 * instruments. DOI resolver variants are considered the same identifier;
 * other identifier values are only trimmed because URL paths can be case-sensitive.
 *
 * @param list<array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}> $relatedWorks
 * @return list<array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}>
 */
function deduplicateRelatedWorksForXml(array $relatedWorks): array
{
    $deduplicated = [];
    $seen = [];

    foreach ($relatedWorks as $relatedWork) {
        $identifierType = trim($relatedWork['identifierType']);
        $key = implode("\x1F", [
            strtolower(trim($relatedWork['relation'])),
            strtolower($identifierType),
            normalizeRelatedWorkIdentifierForComparison($relatedWork['identifier'], $identifierType),
        ]);

        if (isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $relatedWork['order'] = count($deduplicated);
        $deduplicated[] = $relatedWork;
    }

    return $deduplicated;
}

/**
 * Normalizes identifiers only as far as their type permits safe comparison.
 */
function normalizeRelatedWorkIdentifierForComparison(string $identifier, string $identifierType): string
{
    $identifier = trim($identifier);

    if (strcasecmp(trim($identifierType), 'DOI') !== 0) {
        return $identifier;
    }

    $normalized = preg_replace(
        '~^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)~i',
        '',
        $identifier
    );

    return strtolower($normalized ?? $identifier);
}

/**
 * Builds the internal RelatedWorks structure consumed by the forward XSLTs.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param list<array{entryKey: string, order: int, identifier: string, relation: string, relationId: string, identifierType: string}> $relatedWorks
 */
function buildRelatedWorksElement(DOMDocument $dom, array $relatedWorks): DOMElement
{
    $container = $dom->createElement('RelatedWorks');

    foreach ($relatedWorks as $relatedWork) {
        $workElement = $dom->createElement('RelatedWork');
        appendRelatedWorkTextChild($dom, $workElement, 'Identifier', $relatedWork['identifier']);

        $relationElement = $dom->createElement('Relation');
        appendRelatedWorkTextChild($dom, $relationElement, 'name', $relatedWork['relation']);
        $workElement->appendChild($relationElement);

        $identifierTypeElement = $dom->createElement('IdentifierType');
        appendRelatedWorkTextChild($dom, $identifierTypeElement, 'name', $relatedWork['identifierType']);
        $workElement->appendChild($identifierTypeElement);

        $container->appendChild($workElement);
    }

    return $container;
}

/**
 * Appends an escaped text child to an internal Related Work element.
 */
function appendRelatedWorkTextChild(
    DOMDocument $dom,
    DOMElement $parent,
    string $name,
    string $value
): void {
    $element = $dom->createElement($name);
    $element->appendChild($dom->createTextNode($value));
    $parent->appendChild($element);
}
