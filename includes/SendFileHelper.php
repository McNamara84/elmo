<?php

/**
 * Submit-path XML payload helpers.
 *
 * File generation, DataCite GEM additions, and XML attachment filenames live
 * here. Mail transport and Data Services mail text live in mail_helper.php.
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
 * Resolve the shared ELMO-GEM routing toggle inputs.
 *
 * @param array<string, mixed> $postData
 * @param array{showGGMsProperties?: bool, elmogemSendsDataServicesMail?: bool} $settings
 * @return array{showGGMsProperties: bool, elmogemSendsDataServicesMail: bool}
 */
function resolveFileGenerationSettings(array $postData, array $settings = []): array
{
    $showGGMsProperties = (bool) ($settings['showGGMsProperties'] ?? false);

    return [
        'showGGMsProperties' => $showGGMsProperties,
        'elmogemSendsDataServicesMail' => (bool) ($settings['elmogemSendsDataServicesMail']
            ?? (!$showGGMsProperties || trim((string) ($postData['doi'] ?? '')) === '')),
    ];
}

/**
 * Prepare the Data Services payload required by the submit workflow.
 *
 * @param array<string, mixed> $postData
 * @param array{showGGMsProperties?: bool, elmogemSendsDataServicesMail?: bool} $settings
 * @return array{
 *   dataServicesPayload: ?string,
 *   dataServicesPayloadData: ?array{payload: string, contentType: string, extension: string, generator: string},
 *   researcherConfirmationData: array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>},
 *   shouldSendDataServicesMail: bool
 * }
 */
function generateFile(int $resourceId, array $postData, array $settings = []): array
{
    $resolvedSettings = resolveFileGenerationSettings($postData, $settings);
    $showGGMsProperties = $resolvedSettings['showGGMsProperties'];
    $elmogemSendsDataServicesMail = $resolvedSettings['elmogemSendsDataServicesMail'];

    $generated = [
        'dataServicesPayload' => null,
        'dataServicesPayloadData' => null,
        'researcherConfirmationData' => [
            'title' => '',
            'contacts' => [],
            'invalidContacts' => [],
        ],
        'shouldSendDataServicesMail' => !$showGGMsProperties || $elmogemSendsDataServicesMail,
    ];

    if ($showGGMsProperties && !$elmogemSendsDataServicesMail) {
        return $generated;
    }

    if ($generated['shouldSendDataServicesMail']) {
        $dataServicesOptions = ['postData' => $postData];
        if ($showGGMsProperties) {
            $dataServicesOptions['variant'] = 'gfz';
        }

        $payloadData = generateDatasetPayloadByResourceId($resourceId, $dataServicesOptions);
        $xmlContent = $payloadData['payload'];

        if ($payloadData['generator'] === 'dataset-xml') {
            // Only require real controller if not already defined (e.g., via mock in tests)
            // Use false to prevent autoloader from loading real class
            if (!class_exists('DatasetController', false)) {
                require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
            }
            $datasetController = new DatasetController();
            $xmlContent = $datasetController->markDataCiteEnvelopeAsSubmitted($xmlContent, date('Y-m-d'));
        }

        if ($showGGMsProperties) {
            $xmlContent = applyElmoGemAdditionsToDataciteXml($xmlContent, true, true);
        }

        $generated['dataServicesPayload'] = $xmlContent;
        $generated['dataServicesPayloadData'] = [
            'payload' => $xmlContent,
            'contentType' => $payloadData['contentType'],
            'extension' => $payloadData['extension'],
            'generator' => $payloadData['generator'],
        ];
        $generated['researcherConfirmationData'] = collectResearcherConfirmationDataFromXml($generated['dataServicesPayload']);
    }

    return $generated;
}

/**
 * Prepare the ICGEM payload for ELMO-GEM submissions.
 *
 * @param array<string, mixed> $postData
 * @param array{showGGMsProperties?: bool, elmogemSendsDataServicesMail?: bool} $settings
 * @return array{
 *   icgemPayload: ?string,
 *   icgemPayloadData: ?array{payload: string, contentType: string, extension: string, generator: string},
 *   researcherConfirmationData: array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>},
 *   shouldSendIcgemMail: bool
 * }
 */
function generateICGEMFile(int $resourceId, array $postData, array $settings = []): array
{
    $resolvedSettings = resolveFileGenerationSettings($postData, $settings);
    $showGGMsProperties = $resolvedSettings['showGGMsProperties'];

    $generated = [
        'icgemPayload' => null,
        'icgemPayloadData' => null,
        'researcherConfirmationData' => [
            'title' => '',
            'contacts' => [],
            'invalidContacts' => [],
        ],
        'shouldSendIcgemMail' => $showGGMsProperties,
    ];

    if (!$showGGMsProperties) {
        return $generated;
    }

    $payloadData = generateDatasetPayloadByResourceId($resourceId, [
        'postData' => $postData,
        'variant' => 'icgem',
    ]);
    $xmlContent = applyElmoGemAdditionsToDataciteXml($payloadData['payload'], true, false);

    $generated['icgemPayload'] = $xmlContent;
    $generated['icgemPayloadData'] = [
        'payload' => $xmlContent,
        'contentType' => $payloadData['contentType'],
        'extension' => $payloadData['extension'],
        'generator' => $payloadData['generator'],
    ];
    $generated['researcherConfirmationData'] = collectGGMsResearcherConfirmationDataFromXml($xmlContent);

    return $generated;
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
