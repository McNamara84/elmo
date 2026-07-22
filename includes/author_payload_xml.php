<?php

require_once __DIR__ . '/../save/formgroups/save_authors.php';

/**
 * Builds internal Resource XML whose Authors-related sections reflect current form data.
 *
 * The database remains the source for all other resource sections. If the POST
 * data does not contain a non-empty Authors payload, null signals callers to use
 * their established database-only fallback.
 *
 * @param mysqli $connection Active database connection.
 * @param object $controller Controller exposing getResourceAsXml().
 * @param int $resourceId Database identifier of the resource.
 * @param array<string, mixed> $postData Current form data.
 * @return string|null Updated Resource XML or null when no Authors payload exists.
 *
 * @throws RuntimeException When the database-derived Resource XML is invalid.
 */
function buildResourceXmlWithAuthorPayload($connection, $controller, int $resourceId, array $postData): ?string
{
    if (!hasNonemptyAuthorsPayload($postData)) {
        return null;
    }

    $resourceXml = $controller->getResourceAsXml($connection, $resourceId);

    return applyAuthorsPayloadToResourceXmlString($resourceXml, $postData);
}

/**
 * Replaces the direct Authors and ContactPersons children in Resource XML.
 *
 * @param string $resourceXml Internal Resource XML.
 * @param array<string, mixed> $postData Current form data containing authorsPayload or legacy author fields.
 * @return string Updated XML document.
 *
 * @throws RuntimeException When the supplied XML cannot be parsed or serialized.
 */
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

    $updatedXml = $dom->saveXML();
    if ($updatedXml === false) {
        throw new RuntimeException('Could not serialize resource XML after author payload replacement.');
    }

    return $updatedXml;
}

/**
 * Replaces a non-namespaced direct child or appends it when absent.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param DOMElement $parent Parent element receiving the replacement.
 * @param string $nodeName Local name of the direct child.
 * @param DOMElement $replacement Replacement element.
 * @return void
 */
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

/**
 * Builds the unified and compatibility author elements in payload order.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param list<array<string, mixed>> $authors Normalized Authors payload.
 * @return DOMElement Authors container.
 */
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

/**
 * Builds the unified Author representation consumed by current XSLT mappings.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param array<string, mixed> $author Normalized person or institution author.
 * @return DOMElement Unified Author element.
 */
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

/**
 * Builds the compatibility AuthorPerson representation.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param array<string, mixed> $author Normalized person author.
 * @return DOMElement AuthorPerson element.
 */
function buildAuthorPersonElement(DOMDocument $dom, array $author): DOMElement
{
    $element = $dom->createElement('AuthorPerson');
    appendTextChild($dom, $element, 'familyname', $author['familyname'] ?? '');
    appendTextChild($dom, $element, 'givenname', $author['givenname'] ?? '');
    appendOptionalTextChild($dom, $element, 'orcid', $author['orcid'] ?? '');
    appendAffiliationsElement($dom, $element, $author);

    return $element;
}

/**
 * Builds the compatibility AuthorInstitution representation.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param array<string, mixed> $author Normalized institution author.
 * @return DOMElement AuthorInstitution element.
 */
function buildAuthorInstitutionElement(DOMDocument $dom, array $author): DOMElement
{
    $element = $dom->createElement('AuthorInstitution');
    appendTextChild($dom, $element, 'institutionname', $author['institutionname'] ?? '');
    appendAffiliationsElement($dom, $element, $author);

    return $element;
}

/**
 * Builds ContactPersons from person authors marked as contacts.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param list<array<string, mixed>> $authors Normalized Authors payload.
 * @return DOMElement ContactPersons container.
 */
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

/**
 * Appends normalized author affiliations to an XML element.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param DOMElement $parent Author or contact element.
 * @param array<string, mixed> $author Normalized author data.
 * @return void
 */
function appendAffiliationsElement(DOMDocument $dom, DOMElement $parent, array $author): void
{
    $affiliations = parseAffiliationEntries($author['affiliation_data'] ?? '', $author['rorId_data'] ?? '');

    if (empty($affiliations)) {
        return;
    }

    $affiliationsElement = $dom->createElement('Affiliations');

    foreach ($affiliations as $affiliation) {
        if ($affiliation['label'] === '') {
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

/**
 * Appends a text child, including empty strings when required by compatibility XML.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param DOMElement $parent Parent element.
 * @param string $name Child element name.
 * @param mixed $value Text value.
 * @return void
 */
function appendTextChild(DOMDocument $dom, DOMElement $parent, string $name, $value): void
{
    $element = $dom->createElement($name);
    $element->appendChild($dom->createTextNode((string) $value));
    $parent->appendChild($element);
}

/**
 * Appends a text child only when its value is non-empty.
 *
 * @param DOMDocument $dom Owning XML document.
 * @param DOMElement $parent Parent element.
 * @param string $name Child element name.
 * @param mixed $value Optional text value.
 * @return void
 */
function appendOptionalTextChild(DOMDocument $dom, DOMElement $parent, string $name, $value): void
{
    if ($value === null || trim((string) $value) === '') {
        return;
    }

    appendTextChild($dom, $parent, $name, $value);
}
