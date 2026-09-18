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
 * @param string $resourceXml Internal Resource XML.
 * @param array<string, mixed> $postData Current form data containing relatedWorksPayload.
 * @return string Updated XML document.
 *
 * @throws InvalidArgumentException When the Related Works payload is malformed.
 * @throws RuntimeException When the supplied XML cannot be parsed or serialized.
 */
function applyRelatedWorksPayloadToResourceXmlString(string $resourceXml, array $postData): string
{
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
