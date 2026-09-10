<?php
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_authors.php';
require_once __DIR__ . '/../save/formgroups/save_contactperson.php';
require_once __DIR__ . '/../save/formgroups/save_freekeywords.php';
require_once __DIR__ . '/../save/formgroups/save_contributorpersons.php';
require_once __DIR__ . '/../save/formgroups/save_contributorinstitutions.php';
require_once __DIR__ . '/../save/formgroups/save_descriptions.php';
require_once __DIR__ . '/../save/formgroups/save_thesauruskeywords.php';
require_once __DIR__ . '/../save/formgroups/save_spatialtemporalcoverage.php';
require_once __DIR__ . '/../save/formgroups/save_relatedwork.php';
require_once __DIR__ . '/../save/formgroups/save_usedinstruments.php';
require_once __DIR__ . '/../save/formgroups/save_fundingreferences.php';
require_once __DIR__ . '/author_payload_xml.php';

global $showGGMsProperties, $showMslMode;

if ($showGGMsProperties ?? false) {
    require_once __DIR__ . '/../save/formgroups/save_ggms_definition.php';
    require_once __DIR__ . '/../save/formgroups/save_ggms_properties.php';
    require_once __DIR__ . '/../save/formgroups/save_ggms_datasources.php';
    require_once __DIR__ . '/../save/formgroups/save_ggms_modeltypes.php';
}

if ($showMslMode ?? false) {
    require_once __DIR__ . '/../save/formgroups/save_originatinglaboratory.php';
}
/**
 * Existing functions (included above) dont alwys throw an exception, but sometimes just return false. This won't interrupt the save process
 * SO, This Wrapper to convert false returns from save functions into exceptions.
 *
 * @param callable $callback The function to call
 * @param mixed ...$args Arguments to pass to the function
 * @return mixed The return value from the callback
 * @throws Exception If the callback returns false
 */
if (!function_exists('executeSaveFunction')) {
function executeSaveFunction(callable $callback, mixed ...$args): mixed
{
    $functionName = is_array($callback) ? $callback[1] : $callback;

    try {
        $result = $callback(...$args);

        if ($result === false) {
            error_log("[💿SAVE]: Save operation failed: " . $functionName . " returned false");
            throw new Exception("Save operation failed: " . $functionName . " returned false");
        }

        return $result;
    } catch (Exception $e) {
        error_log("[💿SAVE]: Exception in " . $functionName . ": " . $e->getMessage());
        throw $e; // Re-throw so outer catch can handle it
    }
}
} // end function_exists('executeSaveFunction')

/**
 * Saves every enabled form group in a single database transaction.
 *
 * @param array<string, mixed> $postData Submitted form data.
 * @return int Database identifier of the saved resource.
 *
 * @throws Exception When a form-group save or transaction operation fails.
 */
function saveALL(array $postData): int {
    global $connection, $showMslMode, $showContributorPersons, $showContributorInstitutions;
    global $showThesauri, $showFreeKeywords, $showSpatialTemporalCoverage;
    global $showRelatedWork, $showUsedInstruments, $showFundingReference, $showGGMsProperties;

    $connection->begin_transaction();
    try {
        // main line: Saving all mandatory fields & optional fields if needed
        error_log("[💿SAVE]:Starting save process in save_data.php");
        $resource_id = executeSaveFunction('saveResourceInformationAndRights', $connection, $_POST);
        error_log("[💿SAVE]:the id generated is " . $resource_id);
        executeSaveFunction('saveAuthors', $connection, $_POST, $resource_id);
        executeSaveFunction('saveContactPerson', $connection, $_POST, $resource_id);
        if ($showMslMode ?? false) {
            executeSaveFunction('saveOriginatingLaboratories', $connection, $_POST, $resource_id);
        }
        if ($showContributorPersons) {
            executeSaveFunction('saveContributorPersons', $connection, $_POST, $resource_id);
        }
        if ($showContributorInstitutions) {
            executeSaveFunction('saveContributorInstitutions', $connection, $_POST, $resource_id);
        }
        executeSaveFunction('saveDescriptions', $connection, $_POST, $resource_id);
        if ($showThesauri) {
            executeSaveFunction('saveKeywords', $connection, $_POST, $resource_id);
        }
        if ($showFreeKeywords) {
            executeSaveFunction('saveFreeKeywords', $connection, $_POST, $resource_id);
        }
        if ($showSpatialTemporalCoverage) {
            executeSaveFunction('saveSpatialTemporalCoverage', $connection, $_POST, $resource_id);
        }
        if ($showRelatedWork) {
            executeSaveFunction('saveRelatedWork', $connection, $_POST, $resource_id);
        }
        if ($showUsedInstruments) {
            executeSaveFunction('saveUsedInstruments', $connection, $_POST, $resource_id);
        }
        if ($showFundingReference) {
            executeSaveFunction('saveFundingReferences', $connection, $_POST, $resource_id);
        }
        if ($showGGMsProperties ?? false) {
            executeSaveFunction('saveGGMsDefinition', $connection, $_POST, $resource_id);
            executeSaveFunction('saveGGMsProperties', $connection, $_POST, $resource_id);
            executeSaveFunction('saveGGMsDataSources', $connection, $_POST, $resource_id);
            executeSaveFunction('saveGGMsModeltypes', $connection, $_POST, $resource_id);
        }

        // Validate transaction commit
        if (!$connection->commit()) {
            throw new Exception("Transaction commit failed - database returned false");
        }

        error_log("[💿SAVE]: Transaction committed successfully for resource ID: " . $resource_id);
        return $resource_id;
    } catch (Exception $e) {
        $connection->rollback();
        throw $e;
    }
}

/**
 * Generates an XML or JSON-LD download payload for a saved resource.
 *
 * For regular ELMO exports, an Authors section supplied in the current form
 * data replaces the database-derived Authors and ContactPersons sections before
 * any XSLT transformation. This keeps XML and JSON-LD downloads aligned with
 * the current Authors form state. ICGEM XML generation retains its specialized
 * controller path.
 *
 * @param int $resourceId Database identifier of the resource used as the export base.
 * @param array{format?: string, postData?: array<string, mixed>, variant?: string} $options Export options:
 *   - format (string): 'xml' or 'jsonld', defaults to 'xml'
 *   - postData (array): Optional current form data for author payload override
 *   - variant (string): 'gfz' or 'icgem' XML variant; if null, variant follows $showGGMsProperties
 * @return array{payload: string, contentType: string, extension: string, generator: string}
 *
 * @throws InvalidArgumentException When the requested format or variant is unsupported.
 * @throws RuntimeException When payload generation produces an empty document.
 * @throws Throwable When database access or a controller transformation fails.
 */
function generateDatasetPayloadByResourceId(int $resourceId, array $options = []): array
{
    global $connection;
    $downloadFormat = strtolower((string) ($options['format'] ?? 'xml'));
    $postData = $options['postData'] ?? null;
    $requestedVariant = isset($options['variant']) ? strtolower((string) $options['variant']) : null;

    if ($requestedVariant !== null && !in_array($requestedVariant, ['gfz', 'icgem'], true)) {
        throw new InvalidArgumentException("Unsupported download variant: {$requestedVariant}");
    }

    $useIcgem = $requestedVariant !== null
        ? $requestedVariant === 'icgem'
        : (bool) ($GLOBALS['showGGMsProperties'] ?? false);

    if ($downloadFormat === 'jsonld') {
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
        $controller = new DatasetController();
        $sourceXml = is_array($postData)
            ? buildResourceXmlWithAuthorPayload($connection, $controller, $resourceId, $postData)
            : null;
        $payload = (string) $controller->transformResourceToJsonLd($resourceId, $sourceXml);

        if ($payload === '') {
            throw new RuntimeException("Download generation returned empty JSON-LD for resource {$resourceId}");
        }

        return [
            'payload' => $payload,
            'contentType' => 'application/ld+json',
            'extension' => 'jsonld',
            'generator' => 'dataset-jsonld',
        ];
    }

    if ($downloadFormat !== 'xml') {
        throw new InvalidArgumentException("Unsupported download format: {$downloadFormat}");
    }

    if ($useIcgem) {
        require_once __DIR__ . '/../api/v2/controllers/ICGEMController.php';
        $controller = new ICGEMController();
        $payload = (string) $controller->createICGEMxml($resourceId);
        $generator = 'icgem-xml';
    } else {
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
        $controller = new DatasetController();

        $sourceXml = null;
        if (is_array($postData)) {
            $sourceXml = buildResourceXmlWithAuthorPayload($connection, $controller, $resourceId, $postData);
        }

        $payload = (string) $controller->envelopeXmlAsString($connection, $resourceId, $sourceXml);
        $generator = 'dataset-xml';
    }

    if ($payload === '') {
        throw new RuntimeException("Download generation returned empty XML for resource {$resourceId}");
    }

    return [
        'payload' => $payload,
        'contentType' => 'application/xml',
        'extension' => 'xml',
        'generator' => $generator,
    ];
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

    $getOrCreateChild = function (string $localName) use ($xpath, $resource, $createEl): DOMElement {
        $existing = $xpath->query('dc:' . $localName, $resource)->item(0);
        if ($existing instanceof DOMElement) {
            return $existing;
        }
        $el = $createEl($localName);
        $resource->appendChild($el);
        return $el;
    };

    // --- 2. Fill existing contributors ---
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
    $formats->appendChild($createEl('format', 'ICGEM-format'));

    // --- 4. Fill existing subjects ---
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

