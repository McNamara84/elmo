<?php

/**
 * Submit-path XML payload helpers.
 *
 * File generation, DataCite GEM additions, Submitted-date stamping, and XML
 * attachment filenames live here. Mail transport and Data Services mail text
 * live in mail_helper.php.
 */

/**
 * Create XML filename from metadata.
 *
 * @param array<string, mixed> $postData
 */
function buildXmlAttachmentFilename(int $resourceId, array $postData): string
{
    $firstAuthor = $postData['familynames'][0] ?? 'unknown';
    $mainTitle = $postData['title'][0] ?? 'untitled';

    $abbreviateTitle = substr($mainTitle, 0, 30);

    $deUmlauts = ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue', 'ß' => 'ss'];
    $firstAuthor = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $firstAuthor);
    $abbreviateTitle = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $abbreviateTitle);

    setlocale(LC_ALL, 'en_US.UTF-8');
    $firstAuthor = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $firstAuthor) ?: $firstAuthor;
    $abbreviateTitle = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $abbreviateTitle) ?: $abbreviateTitle;

    $cleanAuthor = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $firstAuthor)), '_') ?: 'unknown';
    $cleanTitle = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $abbreviateTitle)), '_') ?: 'untitled';

    $currentDateTime = date('Y-m-d_H-i-s');

    return "metadata{$resourceId}-{$cleanAuthor}-{$cleanTitle}-{$currentDateTime}.xml";
}

/**
 * Add an XML string attachment to a PHPMailer instance.
 *
 * @param \PHPMailer\PHPMailer\PHPMailer $mail
 * @param array<string, mixed> $postData
 */
function createAndAttachXmlFile($mail, string $xmlContent, int $resourceId, array $postData): string
{
    $xmlFilename = buildXmlAttachmentFilename($resourceId, $postData);

    $mail->addStringAttachment($xmlContent, $xmlFilename);
    error_log('XML attachment added: ' . $xmlFilename);

    return $xmlFilename;
}

/**
 * Shared submit objects.
 *
 * settings: routing and request fields, resolved once.
 * generated: XML package for one mail track (Data Services or ICGEM).
 *
 * @param array<string, mixed> $postData
 * @param array<string, mixed> $settings
 * @return array<string, mixed>
 */
function resolveFileGenerationSettings(array $postData, array $settings = []): array
{
    $showGGMsProperties = (bool) ($settings['showGGMsProperties'] ?? false);
    $doi = trim((string) ($settings['doi'] ?? $postData['doi'] ?? ''));

    $settings['showGGMsProperties'] = $showGGMsProperties;
    $settings['doi'] = $doi;
    $settings['elmogemSendsDataServicesMail'] = (bool) ($settings['elmogemSendsDataServicesMail']
        ?? (!$showGGMsProperties || $doi === ''));
    $settings['simulateEmail'] = (bool) ($settings['simulateEmail'] ?? false);

    return $settings;
}

/**
 * @return array{
 *   resourceId: int,
 *   payload: ?string,
 *   filename: ?string,
 *   researcherConfirmationData: array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>},
 *   attachments: array<int, array{filename: string, content?: string, path?: string}>
 * }
 */
function emptyGeneratedFile(int $resourceId): array
{
    return [
        'resourceId' => $resourceId,
        'payload' => null,
        'filename' => null,
        'researcherConfirmationData' => [
            'title' => '',
            'contacts' => [],
            'invalidContacts' => [],
        ],
        'attachments' => [],
    ];
}

/**
 * Optional data-description upload for the Data Services mail.
 *
 * @return array<int, array{filename: string, path: string}>
 *
 * @throws RuntimeException When the upload is the wrong type or too large.
 */
function collectDataDescriptionAttachments(int $resourceId): array
{
    if (!isset($_FILES['dataDescription']) || $_FILES['dataDescription']['error'] !== UPLOAD_ERR_OK) {
        return [];
    }

    $uploadedFile = $_FILES['dataDescription'];
    $fileType = mime_content_type($uploadedFile['tmp_name']);
    $allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!in_array($fileType, $allowedTypes, true)) {
        throw new RuntimeException('Invalid file type. Only PDF, DOC, and DOCX files are allowed.');
    }
    if ($uploadedFile['size'] > 10 * 1024 * 1024) {
        throw new RuntimeException('File size exceeds maximum limit of 10MB.');
    }

    $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));

    return [[
        'filename' => 'data_description_' . $resourceId . '.' . $fileExtension,
        'path' => $uploadedFile['tmp_name'],
    ]];
}

/**
 * Extract title and unique researcher contacts from Data Services XML.
 *
 * @return array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>}
 */
function collectResearcherConfirmationDataFromXml(string $xmlContent): array
{
    $title = '';
    $contacts = [];
    $invalidContacts = [];
    $seen = [];

    if (trim($xmlContent) === '') {
        error_log('Researcher confirmation: XML content is empty.');
        return [
            'title' => $title,
            'contacts' => $contacts,
            'invalidContacts' => $invalidContacts,
        ];
    }

    try {
        $xml = new SimpleXMLElement($xmlContent);

        $titleNodes = $xml->xpath('//*[local-name()="title"]');
        if (!empty($titleNodes)) {
            $title = trim((string) $titleNodes[0]);
        }

        $pointOfContactNodes = $xml->xpath('//*[local-name()="pointOfContact"]');

        foreach ($pointOfContactNodes ?: [] as $pointOfContactNode) {
            $nameNodes = $pointOfContactNode->xpath('.//*[local-name()="individualName"]//*[local-name()="CharacterString"]');
            $emailNodes = $pointOfContactNode->xpath('.//*[local-name()="electronicMailAddress"]//*[local-name()="CharacterString"]');

            $fullName = '';
            $email = '';

            if (!empty($nameNodes)) {
                $fullName = trim((string) $nameNodes[0]);
            }
            if (!empty($emailNodes)) {
                $email = trim((string) $emailNodes[0]);
            }
            if ($fullName === '') {
                $fullName = 'researcher';
            }
            if (strpos($fullName, ',') !== false) {
                $nameParts = array_map('trim', explode(',', $fullName, 2));
                $fullName = trim(($nameParts[1] ?? '') . ' ' . $nameParts[0]);
            }

            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $invalidContacts[] = [
                    'fullName' => $fullName,
                    'email' => $email === '' ? '(empty)' : $email,
                ];
                continue;
            }

            $key = mb_strtolower($fullName) . '|' . mb_strtolower($email);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $contacts[] = [
                'fullName' => $fullName,
                'email' => $email,
            ];
        }

        error_log('Researcher confirmation: Extracted ' . count($contacts) . ' contact(s) from XML.');
    } catch (Exception $e) {
        error_log('Researcher confirmation: Failed to parse XML. ' . $e->getMessage());
    }

    return [
        'title' => $title,
        'contacts' => $contacts,
        'invalidContacts' => $invalidContacts,
    ];
}

/**
 * Adds or updates the DataCite Submitted date in an already generated XML envelope.
 *
 * Normal exports intentionally do not call this function. It is used by the real
 * submit flow after XML generation so saved drafts and API downloads are not
 * marked as submitted.
 *
 * @param string $xml Raw DataCite XML or all-format envelope XML.
 * @param string|null $submissionDate Date to write as YYYY-MM-DD; defaults to today.
 * @return string XML with exactly one DataCite Submitted date per DataCite resource.
 */
function markDataCiteEnvelopeAsSubmitted(string $xml, ?string $submissionDate = null): string
{
    $submissionDate = $submissionDate ?: date('Y-m-d');

    $dom = new DOMDocument();
    $dom->formatOutput = true;
    if (!$dom->loadXML($xml)) {
        return $xml;
    }

    $ns = 'http://datacite.org/schema/kernel-4';
    $xpath = new DOMXPath($dom);
    $xpath->registerNamespace('dc', $ns);

    $resources = $xpath->query('//dc:resource');
    foreach ($resources as $resource) {
        if (!$resource instanceof DOMElement) {
            continue;
        }

        $dates = $xpath->query('dc:dates', $resource)->item(0);
        if (!$dates instanceof DOMElement) {
            $dates = $dom->createElementNS($ns, 'dates');
            $insertBefore = findDataCiteDatesInsertBefore($xpath, $resource);
            if ($insertBefore !== null) {
                $resource->insertBefore($dates, $insertBefore);
            } else {
                $resource->appendChild($dates);
            }
        }

        $submittedDate = null;
        $duplicates = [];
        $submittedDates = $xpath->query('dc:date[@dateType="Submitted"]', $dates);
        foreach ($submittedDates as $dateNode) {
            if (!$dateNode instanceof DOMElement) {
                continue;
            }
            if ($submittedDate === null) {
                $submittedDate = $dateNode;
                continue;
            }
            $duplicates[] = $dateNode;
        }

        foreach ($duplicates as $duplicate) {
            $duplicate->parentNode->removeChild($duplicate);
        }

        if (!$submittedDate instanceof DOMElement) {
            $submittedDate = $dom->createElementNS($ns, 'date');
            $submittedDate->setAttribute('dateType', 'Submitted');
            $dates->appendChild($submittedDate);
        }

        while ($submittedDate->firstChild) {
            $submittedDate->removeChild($submittedDate->firstChild);
        }
        $submittedDate->setAttribute('dateType', 'Submitted');
        $submittedDate->appendChild($dom->createTextNode($submissionDate));
    }

    return $dom->saveXML();
}

/**
 * Finds the first DataCite child that must follow <dates> in schema order.
 *
 * Copied from DatasetController so submit-path XML can be stamped without
 * constructing a controller (and its mysqli connection).
 *
 * @param DOMXPath $xpath XPath configured with the DataCite namespace.
 * @param DOMElement $resource DataCite resource element.
 * @return DOMNode|null Node before which <dates> should be inserted.
 */
function findDataCiteDatesInsertBefore(DOMXPath $xpath, DOMElement $resource): ?DOMNode
{
    $followingDateElements = [
        'language',
        'alternateIdentifiers',
        'relatedIdentifiers',
        'sizes',
        'formats',
        'version',
        'rightsList',
        'descriptions',
        'geoLocations',
        'fundingReferences',
        'relatedItems'
    ];

    foreach ($followingDateElements as $elementName) {
        $node = $xpath->query("dc:{$elementName}", $resource)->item(0);
        if ($node instanceof DOMNode) {
            return $node;
        }
    }

    return null;
}

/**
 * Prepare the Data Services XML package.
 *
 * Always requests the gfz variant, so generateDatasetPayloadByResourceId()
 * returns generator dataset-xml. That payload is then marked Submitted.
 *
 * @param array<string, mixed> $postData
 * @param array<string, mixed> $settings
 * @return array<string, mixed>
 *
 * @throws RuntimeException When XML generation fails or the payload is empty.
 */
function generateFile(int $resourceId, array $postData, array $settings = []): array
{
    $settings = resolveFileGenerationSettings($postData, $settings);
    $generated = emptyGeneratedFile($resourceId);

    if (!$settings['elmogemSendsDataServicesMail']) {
        return $generated;
    }

    try {
        $payloadData = generateDatasetPayloadByResourceId($resourceId, [
            'postData' => $postData,
            'variant' => 'gfz',
        ]);
        $xmlContent = $payloadData['payload'];

        if ($payloadData['generator'] === 'dataset-xml') {
            $xmlContent = markDataCiteEnvelopeAsSubmitted($xmlContent, date('Y-m-d'));
        }

        if ($settings['showGGMsProperties']) {
            $xmlContent = applyElmoGemAdditionsToDataciteXml($xmlContent, true, true);
        }

        if (trim((string) $xmlContent) === '') {
            throw new RuntimeException('Generated XML payload is empty.');
        }

        $generated['payload'] = $xmlContent;
        $generated['filename'] = buildXmlAttachmentFilename($resourceId, $postData);
        $generated['researcherConfirmationData'] = collectResearcherConfirmationDataFromXml($xmlContent);
        $generated['attachments'] = collectDataDescriptionAttachments($resourceId);

        return $generated;
    } catch (Throwable $e) {
        throw new RuntimeException('generateFile: ' . $e->getMessage(), 0, $e);
    }
}

/**
 * Prepare the ICGEM XML package.
 *
 * @param array<string, mixed> $postData
 * @param array<string, mixed> $settings
 * @return array<string, mixed>
 *
 * @throws RuntimeException When ICGEM XML generation fails or the payload is empty.
 */
function generateICGEMFile(int $resourceId, array $postData, array $settings = []): array
{
    $settings = resolveFileGenerationSettings($postData, $settings);
    $generated = emptyGeneratedFile($resourceId);

    if (!$settings['showGGMsProperties']) {
        return $generated;
    }

    try {
        $payloadData = generateDatasetPayloadByResourceId($resourceId, [
            'postData' => $postData,
            'variant' => 'icgem',
        ]);
        $xmlContent = applyElmoGemAdditionsToDataciteXml($payloadData['payload'], true, false);

        if (trim((string) $xmlContent) === '') {
            throw new RuntimeException('Generated ICGEM XML payload is empty.');
        }

        $generated['payload'] = $xmlContent;
        $generated['filename'] = buildXmlAttachmentFilename($resourceId, $postData);
        $generated['researcherConfirmationData'] = collectGGMsResearcherConfirmationDataFromXml($xmlContent);

        return $generated;
    } catch (Throwable $e) {
        throw new RuntimeException('generateICGEMFile: ' . $e->getMessage(), 0, $e);
    }
}

/**
 * Apply ELMO-GEM DataCite additions (contributors, format, GCMD subjects).
 *
 * Guarded for send_xml_file.php call sites:
 * - non-GEM: return input unchanged
 * - GEM Data Services envelope (default xmlns, empty prefix): only when $elmogemSendsDataServicesMail
 * - GEM ICGEM envelope (dace: prefix): always when $showGGMsProperties
 */
function applyElmoGemAdditionsToDataciteXml(
    string $xmlContent,
    bool $showGGMsProperties,
    bool $elmogemSendsDataServicesMail,
): string {
    if (!$showGGMsProperties) {
        return $xmlContent;
    }

    $dom = new DOMDocument();
    $dom->preserveWhiteSpace = false;
    $dom->formatOutput = true;
    $dom->loadXML($xmlContent);

    $xpath = new DOMXPath($dom);
    // DataCite's document element is always <resource>. In envelopes it is a child
    // of <envelope> / <grav:envelope>, not the XML document root.
    // PHP DOM does not expose xmlns declarations as attributes; namespaceURI/prefix
    // on the resource element are the equivalent of that xmlns.
    $resource = $xpath->query(
        '//*[local-name()="resource" and starts-with(namespace-uri(), "http://datacite.org/schema")]'
    )->item(0);

    if (!$resource instanceof DOMElement) {
        throw new RuntimeException('DataCite resource element not found.');
    }

    $dataciteNs = $resource->namespaceURI;
    $datacitePrefix = $resource->prefix; // '' for default xmlns, e.g. 'dace' for ICGEM

    // DatasetController / Data Services envelopes use default xmlns (empty prefix).
    // Skip when GEM does not send that mail; ICGEM envelopes keep the dace: prefix.
    if (!$elmogemSendsDataServicesMail && $datacitePrefix === '') {
        return $xmlContent;
    }

    $xpath->registerNamespace('dc', $dataciteNs);

    // Helper to build a tag name honoring the discovered prefix
    $tag = function (string $localName) use ($datacitePrefix): string {
        return $datacitePrefix === '' ? $localName : "$datacitePrefix:$localName";
    };

    // Helper to create a namespaced element with optional text content
    $createEl = function (string $localName, ?string $text = null) use ($dom, $dataciteNs, $tag) {
        $el = $dom->createElementNS($dataciteNs, $tag($localName));
        if ($text !== null) {
            $el->appendChild($dom->createTextNode($text));
        }
        return $el;
    };

    $childText = function (DOMElement $parent, string $localName) use ($xpath): string {
        $node = $xpath->query('dc:' . $localName, $parent)->item(0);
        return $node instanceof DOMNode ? trim($node->textContent) : '';
    };

    // Find a namespaced child. $matches is optional: without it the first element
    // of that local name is returned (full element presence). With it, equality is
    // whatever the callback checks — e.g. contributorType + givenName + familyName.
    $findChild = function (DOMElement $parent, string $localName, ?callable $matches = null) use ($xpath): ?DOMElement {
        foreach ($xpath->query('dc:' . $localName, $parent) as $existing) {
            if (!$existing instanceof DOMElement) {
                continue;
            }
            if ($matches === null || $matches($existing)) {
                return $existing;
            }
        }
        return null;
    };

    $getOrCreateChild = function (
        string $localName,
        ?DOMElement $parent = null,
        ?callable $matches = null,
    ) use ($findChild, $resource, $createEl): DOMElement {
        $parent ??= $resource;
        $existing = $findChild($parent, $localName, $matches);
        if ($existing instanceof DOMElement) {
            return $existing;
        }
        $el = $createEl($localName);
        $parent->appendChild($el);
        return $el;
    };

    // --- 2. Fill existing contributors (skip per person if type+given+family match) ---
    $contributorsData = [
        [
            'contributorType' => 'DataCurator',
            'name' => 'Ince, E. Sinem',
            'givenName' => 'E. Sinem',
            'familyName' => 'Ince',
            'orcid' => '0000-0002-3393-1392',
            'affiliation' => 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
        ],
        [
            'contributorType' => 'DataManager',
            'name' => 'Reißland, Sven',
            'givenName' => 'Sven',
            'familyName' => 'Reißland',
            'orcid' => '0000-0001-6293-5336',
            'affiliation' => 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
        ],
    ];

    $contributors = $getOrCreateChild('contributors');
    foreach ($contributorsData as $c) {
        $alreadyPresent = $findChild(
            $contributors,
            'contributor',
            function (DOMElement $el) use ($c, $childText): bool {
                return $el->getAttribute('contributorType') === $c['contributorType']
                    && $childText($el, 'givenName') === $c['givenName']
                    && $childText($el, 'familyName') === $c['familyName'];
            }
        );
        if ($alreadyPresent instanceof DOMElement) {
            continue;
        }

        $contributor = $createEl('contributor');
        $contributor->setAttribute('contributorType', $c['contributorType']);

        $contributorName = $createEl('contributorName', $c['name']);
        $contributorName->setAttribute('nameType', 'Personal');
        $contributor->appendChild($contributorName);

        $contributor->appendChild($createEl('givenName', $c['givenName']));
        $contributor->appendChild($createEl('familyName', $c['familyName']));

        $nameIdentifier = $createEl('nameIdentifier', $c['orcid']);
        $nameIdentifier->setAttribute('nameIdentifierScheme', 'ORCID');
        $nameIdentifier->setAttribute('schemeURI', 'https://orcid.org/');
        $contributor->appendChild($nameIdentifier);

        $contributor->appendChild($createEl('affiliation', $c['affiliation']));

        $contributors->appendChild($contributor);
    }

    // --- 3. Add format (create <formats> if the resource does not already have one) ---
    $formats = $getOrCreateChild('formats');
    $alreadyHasFormat = $findChild(
        $formats,
        'format',
        fn (DOMElement $el): bool => trim($el->textContent) === 'ICGEM-format'
    );
    if (!$alreadyHasFormat instanceof DOMElement) {
        $formats->appendChild($createEl('format', 'ICGEM-format'));
    }

    // --- 4. Fill existing subjects (skip a keyword already present by valueURI) ---
    $subjectsData = [
        [
            'text' => 'GEOID CHARACTERISTICS',
            'valueURI' => 'https://gcmd.earthdata.nasa.gov/kms/concept/6bbbf7b0-434b-4dbc-9fe8-e5e31fe99614',
        ],
        [
            'text' => 'GRAVITY/GRAVITATIONAL FIELD',
            'valueURI' => 'https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa',
        ],
    ];

    $subjects = $getOrCreateChild('subjects');
    foreach ($subjectsData as $s) {
        $alreadyPresent = $findChild(
            $subjects,
            'subject',
            fn (DOMElement $el): bool => $el->getAttribute('valueURI') === $s['valueURI']
        );
        if ($alreadyPresent instanceof DOMElement) {
            continue;
        }

        $subject = $createEl('subject', $s['text']);
        // xml:lang uses the reserved 'xml' namespace, not the DataCite one
        $subject->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:lang', 'en');
        $subject->setAttribute('subjectScheme', 'Science Keywords');
        $subject->setAttribute('schemeURI', 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords');
        $subject->setAttribute('valueURI', $s['valueURI']);
        $subjects->appendChild($subject);
    }

    return $dom->saveXML();
}
