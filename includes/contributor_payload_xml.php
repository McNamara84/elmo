<?php

require_once __DIR__ . '/../save/formgroups/save_contributors_payload.php';
require_once __DIR__ . '/author_payload_xml.php';

/** Replace Contributors in current Resource XML, including an explicit empty list. */
function applyContributorsPayloadToResourceXmlString(string $resourceXml, array $postData, bool $allowInstitutionContact = false): string
{
    $entries = normalizeContributorsPayload($postData, $allowInstitutionContact);
    if ($entries === null) return $resourceXml;
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = true;
    if (!$dom->loadXML($resourceXml) || !$dom->documentElement) {
        throw new RuntimeException('Could not parse resource XML for Contributor replacement.');
    }
    $root = $dom->documentElement;
    $contributors = $dom->createElement('Contributors');
    $persons = $dom->createElement('Persons');
    $institutions = $dom->createElement('Institutions');
    foreach ($entries as $entry) {
        $unified = buildContributorXmlElement($dom, $entry, 'Contributor');
        $unified->setAttribute('type', $entry['type']);
        $unified->setAttribute('order', (string) $entry['order']);
        $contributors->appendChild($unified);
        $compat = buildContributorXmlElement($dom, $entry, $entry['type'] === 'person' ? 'Person' : 'Institution');
        ($entry['type'] === 'person' ? $persons : $institutions)->appendChild($compat);
    }
    if ($persons->hasChildNodes()) $contributors->appendChild($persons);
    if ($institutions->hasChildNodes()) $contributors->appendChild($institutions);
    replaceDirectChild($dom, $root, 'Contributors', $contributors);

    $contacts = null;
    $institutionContacts = $dom->createElement('ContactInstitutions');
    foreach (iterator_to_array($root->childNodes) as $child) {
        if ($child instanceof DOMElement && $child->localName === 'ContactPersons') $contacts = $child;
    }
    foreach ($entries as $entry) {
        if (!in_array('Contact Person', $entry['roles'], true)) continue;
        if ($entry['type'] === 'institution') {
            $contact = $dom->createElement('ContactInstitution');
            appendTextChild($dom, $contact, 'name', $entry['institutionname']);
            appendOptionalTextChild($dom, $contact, 'email', $entry['email']);
            appendOptionalTextChild($dom, $contact, 'website', $entry['website']);
            $institutionContacts->appendChild($contact);
            continue;
        }
        if (!$contacts) {
            $contacts = $dom->createElement('ContactPersons');
            $root->appendChild($contacts);
        }
        $duplicate = false;
        foreach ($contacts->getElementsByTagName('ContactPerson') as $existing) {
            if (strcasecmp($existing->getElementsByTagName('familyname')->item(0)?->textContent ?? '', $entry['familyname']) === 0 &&
                strcasecmp($existing->getElementsByTagName('email')->item(0)?->textContent ?? '', $entry['email']) === 0) {
                $duplicate = true;
                break;
            }
        }
        if ($duplicate) continue;
        $contact = $dom->createElement('ContactPerson');
        foreach (['familyname', 'givenname', 'orcid', 'email', 'website'] as $key) {
            appendOptionalTextChild($dom, $contact, $key, $entry[$key]);
        }
        if ($entry['affiliations']) appendContributorAffiliations($dom, $contact, $entry['affiliations']);
        $contacts->appendChild($contact);
    }
    replaceDirectChild($dom, $root, 'ContactInstitutions', $institutionContacts);
    placeResourceChild($root, $contributors, ['Descriptions', 'ThesaurusKeywords', 'FreeKeywords', 'RelatedWorks']);
    if ($contacts) {
        placeResourceChild($root, $contacts, ['ContactInstitutions', 'OriginatingLaboratories', 'Contributors', 'Descriptions']);
    }
    placeResourceChild($root, $institutionContacts, ['OriginatingLaboratories', 'Contributors', 'Descriptions']);
    return $dom->saveXML();
}

/** Keep optional Resource sections in the order declared by the Freestyle schema. */
function placeResourceChild(DOMElement $root, DOMElement $child, array $beforeNames): void
{
    if ($child->parentNode === $root) $root->removeChild($child);
    foreach (iterator_to_array($root->childNodes) as $sibling) {
        if ($sibling instanceof DOMElement && in_array($sibling->localName, $beforeNames, true)) {
            $root->insertBefore($child, $sibling);
            return;
        }
    }
    $root->appendChild($child);
}

function buildContributorXmlElement(DOMDocument $dom, array $entry, string $nodeName): DOMElement
{
    $element = $dom->createElement($nodeName);
    if ($entry['type'] === 'person') {
        appendTextChild($dom, $element, 'familyname', $entry['familyname']);
        appendOptionalTextChild($dom, $element, 'givenname', $entry['givenname']);
        appendOptionalTextChild($dom, $element, 'orcid', $entry['orcid']);
    } else {
        appendTextChild($dom, $element, $nodeName === 'Institution' ? 'name' : 'institutionname', $entry['institutionname']);
    }
    appendContributorAffiliations($dom, $element, $entry['affiliations']);
    $roles = $dom->createElement('Roles');
    foreach ($entry['roles'] as $role) {
        $roleNode = $dom->createElement('Role');
        appendTextChild($dom, $roleNode, 'name', $role);
        $roles->appendChild($roleNode);
    }
    $element->appendChild($roles);
    if (in_array('Contact Person', $entry['roles'], true)) {
        appendOptionalTextChild($dom, $element, 'email', $entry['email']);
        appendOptionalTextChild($dom, $element, 'website', $entry['website']);
    }
    return $element;
}

function appendContributorAffiliations(DOMDocument $dom, DOMElement $parent, array $affiliations): void
{
    $container = $dom->createElement('Affiliations');
    foreach ($affiliations as $item) {
        $affiliation = $dom->createElement('Affiliation');
        appendTextChild($dom, $affiliation, 'name', $item['label']);
        appendOptionalTextChild($dom, $affiliation, 'rorId', $item['rorId']);
        $container->appendChild($affiliation);
    }
    $parent->appendChild($container);
}
