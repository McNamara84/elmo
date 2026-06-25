<?php

require_once __DIR__ . '/../save/formgroups/save_authors.php';

function buildResourceXmlWithAuthorPayload($connection, $controller, int $resourceId, array $postData): ?string
{
    if (!hasNonemptyAuthorsPayload($postData)) {
        return null;
    }

    $resourceXml = $controller->getResourceAsXml($connection, $resourceId);

    return applyAuthorsPayloadToResourceXmlString($resourceXml, $postData);
}

function applyAuthorsPayloadToResourceXmlString(string $resourceXml, array $postData): string
{
    $authors = normalizeAuthorsPayload($postData);
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = true;

    if (!$dom->loadXML($resourceXml)) {
        throw new RuntimeException('Could not parse resource XML for author payload replacement.');
    }

    $authorsElement = buildAuthorsElement($dom, $authors);
    $contactPersonsElement = buildContactPersonsElement($dom, $authors);
    replaceDirectChild($dom, $dom->documentElement, 'Authors', $authorsElement);
    replaceDirectChild($dom, $dom->documentElement, 'ContactPersons', $contactPersonsElement);

    return $dom->saveXML();
}

function replaceDirectChild(DOMDocument $dom, DOMElement $parent, string $nodeName, DOMElement $replacement): void
{
    foreach (iterator_to_array($parent->childNodes) as $child) {
        if ($child instanceof DOMElement && $child->localName === $nodeName && $child->namespaceURI === null) {
            $parent->replaceChild($replacement, $child);
            return;
        }
    }

    $parent->appendChild($replacement);
}

function buildAuthorsElement(DOMDocument $dom, array $authors): DOMElement
{
    $authorsElement = $dom->createElement('Authors');

    foreach ($authors as $author) {
        $authorsElement->appendChild(buildUnifiedAuthorElement($dom, $author));

        if (($author['type'] ?? '') === 'person') {
            $authorsElement->appendChild(buildAuthorPersonElement($dom, $author));
        } elseif (($author['type'] ?? '') === 'institution') {
            $authorsElement->appendChild(buildAuthorInstitutionElement($dom, $author));
        }
    }

    return $authorsElement;
}

function buildUnifiedAuthorElement(DOMDocument $dom, array $author): DOMElement
{
    $element = $dom->createElement('Author');

    if (($author['type'] ?? '') === 'institution') {
        appendTextChild($dom, $element, 'institutionname', $author['institutionname'] ?? '');
    } else {
        appendTextChild($dom, $element, 'familyname', $author['familyname'] ?? '');
        appendTextChild($dom, $element, 'givenname', $author['givenname'] ?? '');
        appendOptionalTextChild($dom, $element, 'orcid', $author['orcid'] ?? '');
    }

    appendAffiliationsElement($dom, $element, $author);

    return $element;
}

function buildAuthorPersonElement(DOMDocument $dom, array $author): DOMElement
{
    $element = $dom->createElement('AuthorPerson');
    appendTextChild($dom, $element, 'familyname', $author['familyname'] ?? '');
    appendTextChild($dom, $element, 'givenname', $author['givenname'] ?? '');
    appendOptionalTextChild($dom, $element, 'orcid', $author['orcid'] ?? '');
    appendAffiliationsElement($dom, $element, $author);

    return $element;
}

function buildAuthorInstitutionElement(DOMDocument $dom, array $author): DOMElement
{
    $element = $dom->createElement('AuthorInstitution');
    appendTextChild($dom, $element, 'institutionname', $author['institutionname'] ?? '');
    appendAffiliationsElement($dom, $element, $author);

    return $element;
}

function buildContactPersonsElement(DOMDocument $dom, array $authors): DOMElement
{
    $contactPersonsElement = $dom->createElement('ContactPersons');

    foreach ($authors as $author) {
        if (($author['type'] ?? '') !== 'person' || ($author['isContact'] ?? false) !== true) {
            continue;
        }

        $contactPerson = $dom->createElement('ContactPerson');
        appendTextChild($dom, $contactPerson, 'familyname', $author['familyname'] ?? '');
        appendTextChild($dom, $contactPerson, 'givenname', $author['givenname'] ?? '');
        appendOptionalTextChild($dom, $contactPerson, 'orcid', $author['orcid'] ?? '');
        appendOptionalTextChild($dom, $contactPerson, 'email', $author['email'] ?? '');
        appendOptionalTextChild($dom, $contactPerson, 'website', $author['website'] ?? '');
        appendAffiliationsElement($dom, $contactPerson, $author);
        $contactPersonsElement->appendChild($contactPerson);
    }

    return $contactPersonsElement;
}

function appendAffiliationsElement(DOMDocument $dom, DOMElement $parent, array $author): void
{
    $affiliations = parseAffiliationEntries($author['affiliation_data'] ?? '', $author['rorId_data'] ?? '');

    if (empty($affiliations)) {
        return;
    }

    $affiliationsElement = $dom->createElement('Affiliations');

    foreach ($affiliations as $affiliation) {
        if (($affiliation['label'] ?? '') === '') {
            continue;
        }

        $affiliationElement = $dom->createElement('Affiliation');
        appendTextChild($dom, $affiliationElement, 'name', $affiliation['label']);
        appendOptionalTextChild($dom, $affiliationElement, 'rorId', $affiliation['rorId'] ?? null);
        $affiliationsElement->appendChild($affiliationElement);
    }

    if ($affiliationsElement->hasChildNodes()) {
        $parent->appendChild($affiliationsElement);
    }
}

function appendTextChild(DOMDocument $dom, DOMElement $parent, string $name, $value): void
{
    $element = $dom->createElement($name);
    $element->appendChild($dom->createTextNode((string) $value));
    $parent->appendChild($element);
}

function appendOptionalTextChild(DOMDocument $dom, DOMElement $parent, string $name, $value): void
{
    if ($value === null || trim((string) $value) === '') {
        return;
    }

    appendTextChild($dom, $parent, $name, $value);
}