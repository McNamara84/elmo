/**
 * ICGEM XML mapping module.
 * Parses ICGEM metadata XML documents and populates ELMOGEM form fields.
 *
 * Exposed as window.icgemModule for use by upload.js and mappingXmlToInputFields.js.
 * @requires jQuery
 */

const ICGEM_NAMESPACE_URI = 'http://icgem.gfz.de/schema';

// ─── Schema detection ────────────────────────────────────────────────────────

/**
 * Detects the XML schema of the uploaded document.
 * @param {Document} xmlDoc
 * @returns {'icgem'|'datacite-or-envelope'}
 */
function detectXmlSchema(xmlDoc) {
  if (xmlDoc.documentElement.namespaceURI === ICGEM_NAMESPACE_URI) {
    return 'icgem';
  }
  return 'datacite-or-envelope';
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Builds a flat dict of { localName: textContent } from the direct element
 * children of a given node that contain only text (leaf nodes).
 * Container children (those with element children of their own) are skipped.
 * @param {Element} node
 * @returns {Object.<string, string>}
 */
function leafChildren(node) {
  const dict = {};
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType !== 1) continue;
    const hasElementChild = Array.from(child.childNodes).some(n => n.nodeType === 1);
    if (!hasElementChild) {
      dict[child.localName] = child.textContent.trim();
    }
  }
  return dict;
}

/**
 * Parses an ICGEM XML document into a structured data object ready for form population.
 *
 * Namespace prefix detection is inlined: the actual prefix used in the document
 * (e.g. "grav", "icgv", or none) is detected at parse time. Leaf element reading
 * uses DOM child traversal (prefix-independent). XPath with the stable "icgv" alias
 * is used only to locate container nodes.
 *
 * @param {Document} xmlDoc
 * @returns {{
 *   scalars: Object,
 *   ellipsoidal: Object,
 *   staticModel: Object,
 *   temporalModel: Object,
 *   topographicModels: Array,
 *   dataSources: Array,
 *   descriptions: Array
 * }|null} Structured data object, or null if the root ICGEM node is not found.
 */
function parseIcgemXml(xmlDoc) {
  // ── Inline prefix detection ─────────────────────────────────────────────────
  const root = xmlDoc.documentElement;
  let detectedPrefix = null;
  if (typeof root.lookupPrefix === 'function') {
    detectedPrefix = root.lookupPrefix(ICGEM_NAMESPACE_URI);
  }
  if (!detectedPrefix) {
    for (let i = 0; i < root.attributes.length; i++) {
      const attr = root.attributes[i];
      if (attr.name.startsWith('xmlns:') && attr.value === ICGEM_NAMESPACE_URI) {
        detectedPrefix = attr.name.slice('xmlns:'.length);
        break;
      }
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  // XPath resolver: maps the stable alias "icgv" to the ICGEM namespace URI,
  // regardless of whatever prefix the document itself uses.
  function resolver(prefix) {
    if (prefix === 'icgv') return ICGEM_NAMESPACE_URI;
    return '';
  }

  function xpFirst(xpath, contextNode) {
    return xmlDoc.evaluate(
      xpath, contextNode, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
  }

  function xpAll(xpath, contextNode) {
    return xmlDoc.evaluate(
      xpath, contextNode, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );
  }

  // Find the root ICGEM model node
  const shm = xpFirst(
    './/icgv:harmonicCoefficientsModel | .//harmonicCoefficientsModel',
    xmlDoc
  );
  if (!shm) return null;

  // Scalar fields — direct leaf children of harmonicCoefficientsModel
  const scalars = leafChildren(shm);

  // Ellipsoidal parameters
  const epNode = xpFirst('.//icgv:ellipsoidalParameters | .//ellipsoidalParameters', shm);
  const ellipsoidal = epNode ? leafChildren(epNode) : {};

  // Static model properties
  const smpNode = xpFirst('.//icgv:staticModelProperties | .//staticModelProperties', shm);
  const staticModel = smpNode ? leafChildren(smpNode) : {};

  // Temporal model properties
  const tmpNode = xpFirst('.//icgv:temporalModelProperties | .//temporalModelProperties', shm);
  const temporalModel = tmpNode ? leafChildren(tmpNode) : {};

  // Topographic model properties (array — typically one, but may repeat)
  const topSnap = xpAll('.//icgv:topographicModelProperties | .//topographicModelProperties', shm);
  const topographicModels = [];
  for (let i = 0; i < topSnap.snapshotLength; i++) {
    const topNode = topSnap.snapshotItem(i);
    const topDict = leafChildren(topNode);
    const densSnap = xpAll('.//icgv:densityInformation | .//densityInformation', topNode);
    topDict.densityInformation = [];
    for (let d = 0; d < densSnap.snapshotLength; d++) {
      topDict.densityInformation.push(leafChildren(densSnap.snapshotItem(d)));
    }
    topographicModels.push(topDict);
  }

  // Global gravity product → data sources and descriptions
  const ggpNode = xpFirst('.//icgv:globalGravityProduct | .//globalGravityProduct', xmlDoc);

  const dataSources = [];
  if (ggpNode) {
    // Use DOM child traversal instead of XPath to avoid namespace-resolution edge cases.
    // localName comparison is namespace-agnostic and works regardless of prefix.
    for (let i = 0; i < ggpNode.childNodes.length; i++) {
      const child = ggpNode.childNodes[i];
      if (child.nodeType !== 1 || child.localName !== 'inputDataSource') continue;
      const dsData = leafChildren(child);
      dsData.inputDataSourceType = child.getAttribute('type');
      dataSources.push(dsData);
    }
  }

  const descriptions = [];
  const descSnap = ggpNode
    ? xpAll('.//icgv:description[@section] | .//description[@section]', ggpNode)
    : xpAll('.//icgv:globalGravityProduct//icgv:description[@section] | .//globalGravityProduct//description[@section]', xmlDoc);
  for (let i = 0; i < descSnap.snapshotLength; i++) {
    const n = descSnap.snapshotItem(i);
    descriptions.push({
      section: (n.getAttribute('section') || '').toLowerCase(),
      content: n.textContent.trim()
    });
  }

  return { scalars, ellipsoidal, staticModel, temporalModel, topographicModels, dataSources, descriptions };
}

// ─── Form population helpers ─────────────────────────────────────────────────

/**
 * Sets a <select> value by matching option text case-insensitively.
 * @param {jQuery} $select
 * @param {string} text
 * @returns {boolean} True if an option was matched and selected.
 */
function selectOptionByText($select, text) {
  if (!$select.length || !text) return false;
  const lower = text.toLowerCase();
  const match = Array.from($select[0].options).find(o => o.text.trim().toLowerCase() === lower);
  if (match) {
    $select.val(match.value);
    return true;
  }
  return false;
}

/**
 * XML stores the reference-model type as "Model". The form option is labelled
 * "Reference Model", so an exact text match misses it and the row stays Satellite.
 */
const ICGEM_DATASOURCE_TYPE_LABELS = {
  Model: 'Reference Model'
};

function selectDataSourceType($typeSelect, xmlType) {
  const formLabel = ICGEM_DATASOURCE_TYPE_LABELS[xmlType];
  if (formLabel && selectOptionByText($typeSelect, formLabel)) return true;
  return selectOptionByText($typeSelect, xmlType);
}

/**
 * Reverse-maps ICGEM densityInformationType values to form select option values.
 * XML stores "Constant", "Layer-specific", "Density model"; form uses lowercase/hyphenated.
 * @param {string} xmlValue
 * @returns {string}
 */
function reverseDensityType(xmlValue) {
  const lower = (xmlValue || '').toLowerCase().trim();
  if (lower === 'density model') return 'density-model';
  return lower;
}

// ─── Form population functions ────────────────────────────────────────────────

/**
 * Populates the GGMsDefinition form fields.
 * @param {Object} data - Parsed ICGEM data from parseIcgemXml()
 */
function populateIcgemDefinition(data) {
  const { scalars } = data;

  if (scalars.modelName) $('#input-model-name').val(scalars.modelName);

  if (scalars.modelType) {
    const $select = $('#input-model-type');
    if (!selectOptionByText($select, scalars.modelType)) {
      $select.val(scalars.modelType);
    }
    $select.trigger('change');
  }

  if (scalars.mathematicalRepresentation) {
    const $select = $('#input-mathematical-representation');
    if (!selectOptionByText($select, scalars.mathematicalRepresentation)) {
      $select.val(scalars.mathematicalRepresentation);
    }
    $select.trigger('change');
  }

  if (scalars.fileFormat) {
    const $select = $('#input-file-format');
    if (!selectOptionByText($select, scalars.fileFormat)) {
      $select.val(scalars.fileFormat);
    }
  }

  if (scalars.celestialBody) $('#input-celestial-body').val(scalars.celestialBody);
}

/**
 * Populates the GGMsProperties form fields.
 * @param {Object} data - Parsed ICGEM data from parseIcgemXml()
 */
function populateIcgemProperties(data) {
  const { scalars, ellipsoidal } = data;

  // Tide system: XML values ("Zero-tide", "Mean-tide", "Tide-free") match option values directly
  if (scalars.tideSystem) $('#input-tide-system').val(scalars.tideSystem);

  if (scalars.degreeOrderMax) $('#input-degree').val(scalars.degreeOrderMax);

  // Errors: XML stores "Formal" (ucfirst), select values are lowercase
  if (scalars.errors) {
    $('#input-errors').val(scalars.errors.toLowerCase()).trigger('change');
  }

  if (scalars.errorHandling) $('#input-error-handling-approach').val(scalars.errorHandling);

  if (scalars.radius) $('#input-radius').val(scalars.radius);

  if (scalars.earthGravityConstant) $('#input-earth-gravity-constant').val(scalars.earthGravityConstant);

  if (ellipsoidal.semimajorAxisA) $('#input-semimajor-axis').val(ellipsoidal.semimajorAxisA);

  if (ellipsoidal.semiminorAxisB) {
    $('#input-second-variable').val('axis_b');
    $('#input-second-variable-value').val(ellipsoidal.semiminorAxisB);
  } else if (ellipsoidal.reciprocalFlattening) {
    $('#input-second-variable').val('reciprocal_flattening');
    $('#input-second-variable-value').val(ellipsoidal.reciprocalFlattening);
  } else if (ellipsoidal.flattening) {
    $('#input-second-variable').val('flattening');
    $('#input-second-variable-value').val(ellipsoidal.flattening);
  } else if (ellipsoidal.eccentricity) {
    $('#input-second-variable').val('eccentricity');
    $('#input-second-variable-value').val(ellipsoidal.eccentricity);
  }
}

/**
 * Populates the GGMsModelTypes form fields.
 * Handles static, temporal, and topographic model type-specific properties.
 * @param {Object} data - Parsed ICGEM data from parseIcgemXml()
 */
function populateIcgemModelTypes(data) {
  const { staticModel, temporalModel, topographicModels } = data;

  // Static model
  if (staticModel.infoTimeVariableCoefficients) {
    $('#checkbox-time-variable').prop('checked', true);
    $('#time-variable-description-container').removeClass('d-none');
    $('#input-static-description').val(staticModel.infoTimeVariableCoefficients);
  }

  // Temporal model
  // temporalCoverage is an ISO 8601 interval: "YYYY-MM-DD/YYYY-MM-DD" or "YYYY-MM-DD/open".
  // Split on "/" and only ingest each part if it looks like a date.
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (temporalModel.temporalCoverage) {
    const [rawStart, rawEnd] = temporalModel.temporalCoverage.split('/');
    if (rawStart && ISO_DATE.test(rawStart.trim())) $('#input-temporal-start').val(rawStart.trim());
    if (rawEnd   && ISO_DATE.test(rawEnd.trim()))   $('#input-temporal-end').val(rawEnd.trim());
  }
  // Fallback: explicit startDate/stopDate elements (older schema variants)
  if (temporalModel.startDate && ISO_DATE.test(temporalModel.startDate)) $('#input-temporal-start').val(temporalModel.startDate);
  if (temporalModel.stopDate  && ISO_DATE.test(temporalModel.stopDate))  $('#input-temporal-end').val(temporalModel.stopDate);
  if (temporalModel.generatingInstitution) $('#input-temporal-institution').val(temporalModel.generatingInstitution);
  if (temporalModel.release) $('#input-release-number').val(temporalModel.release);

  if (temporalModel.temporalResolution) {
    const days = parseInt(temporalModel.temporalResolution, 10);
    if (!isNaN(days)) {
      $('#checkbox-custom-frequency').prop('checked', true);
      $('#custom-frequency-container').removeClass('d-none');
      $('#input-temporal-frequency').val(days);
    }
  }

  // Topographic model (process first entry)
  if (topographicModels.length > 0) {
    const topo = topographicModels[0];

    if (topo.layerApproach) $('#select-topo-layerapproach').val(topo.layerApproach.toLowerCase());
    if (topo.forwardModellingDomain) $('#select-topo-domain').val(topo.forwardModellingDomain.toLowerCase());
    if (topo.approximation) $('#select-topo-approximation').val(topo.approximation.toLowerCase());

    const densities = topo.densityInformation || [];

    // Determine mode upfront: separate if any entry uses Crust or Mantle domain
    const isSeparate = densities.some(d => {
      const dom = (d.densityInformationDomain || '').toLowerCase();
      return dom === 'crust' || dom === 'mantle';
    });

    $('#checkbox-separate-density').prop('checked', isSeparate).trigger('change');

    for (const density of densities) {
      const domain = (density.densityInformationDomain || '').toLowerCase();
      const infoType = reverseDensityType(density.densityInformationType || '');
      const description = density.densityInformationDescription || '';

      if (domain === 'whole') {
        $('#select-topo-density').val(infoType);
        if (description) $('#input-topo-density-details').val(description);
      } else if (domain === 'crust') {
        $('#select-topo-density-crust').val(infoType);
        if (description) $('#input-topo-density-details-crust').val(description);
      } else if (domain === 'mantle') {
        $('#select-topo-density-mantle').val(infoType);
        if (description) $('#input-topo-density-details-mantle').val(description);
      }
    }
  }
}

/**
 * Groups consecutive satellite XML entries with the same description for the form.
 *
 * ICGEM stores one satellite keyword per inputDataSource, while the form allows
 * several keywords in one row. The repeated description is the only grouping
 * hint available after a roundtrip. Entries without a keyword remain separate so
 * an incomplete saved row is not hidden by a neighbouring populated row.
 *
 * @param {Array<Object>} dataSources
 * @returns {Array<Object>}
 */
function groupIcgemDataSourcesForForm(dataSources) {
  const grouped = [];

  for (const dataSource of dataSources) {
    const isPopulatedSatellite = dataSource.inputDataSourceType === 'Satellite'
      && Boolean(dataSource.satelliteValueName);

    if (!isPopulatedSatellite) {
      grouped.push({ ...dataSource });
      continue;
    }

    const description = typeof dataSource.description === 'string'
      ? dataSource.description.trim()
      : '';
    const tag = {
      value: dataSource.satelliteValueName,
      id: dataSource.satelliteValueUri || '',
      scheme: dataSource.satelliteSchemeName || '',
      schemeURI: dataSource.satelliteSchemeUri || ''
    };
    const previous = grouped[grouped.length - 1];
    const previousDescription = previous && typeof previous.description === 'string'
      ? previous.description.trim()
      : '';
    const canJoinPrevious = previous
      && previous.inputDataSourceType === 'Satellite'
      && Array.isArray(previous.satellitePlatforms)
      && previousDescription === description;

    if (canJoinPrevious) {
      previous.satellitePlatforms.push(tag);
      continue;
    }

    grouped.push({
      ...dataSource,
      satellitePlatforms: [tag]
    });
  }

  return grouped;
}

/**
 * Writes satellite platform tags into a datasource Tagify (or the raw input)
 * and flushes the hidden value so save POSTs the JSON, not only the UI chips.
 * @param {HTMLInputElement|undefined} platformInput
 * @param {Array<Object>} tags
 */
function applySatellitePlatformTags(platformInput, tags) {
  if (platformInput && platformInput._tagify) {
    platformInput._tagify.addTags(tags);
    if (typeof platformInput._tagify.update === 'function') {
      platformInput._tagify.update();
    } else if (typeof platformInput._tagify._updateHiddenField === 'function') {
      platformInput._tagify._updateHiddenField();
    }
    return;
  }
  if (platformInput) {
    $(platformInput).val(JSON.stringify(tags));
  }
}

/**
 * Makes the data source stack hold exactly `count` rows, also when the user
 * removed every row. Rows are added via the add button and removed via their
 * remove buttons so widgets, Tagify state and translations stay consistent.
 * @param {number} count
 * @returns {jQuery} The data source rows in form order
 */
function ensureDataSourceRows(count) {
  const rowSelector = '#group-datasources [data-source-row]';
  const $surplus = $(rowSelector).slice(count);
  $surplus.find('.removeButton').trigger('click');
  $surplus.remove();

  const $addButton = $('#button-datasource-add');
  const missing = count - $(rowSelector).length;
  for (let i = 0; i < missing; i++) {
    $addButton.trigger('click');
  }

  const $rows = $(rowSelector);
  if ($rows.length !== count) {
    throw new Error(`Expected ${count} data source rows, found ${$rows.length}`);
  }
  return $rows;
}

/**
 * Populates the GGMsDataSources form rows.
 * Consecutive satellite entries with the same description share one form row.
 * All other entries become separate rows. The datasource type 'change' event is
 * triggered so row visibility updates correctly.
 *
 * Waits for GCMD platforms (shared tree) before addTags; aborts on timeout.
 * Flushes the hidden input so ingestSatellitePlatformAsKeyword sees the JSON.
 *
 * @param {Object} data - Parsed ICGEM data from parseIcgemXml()
 */
async function populateIcgemDataSources(data) {
  const { dataSources } = data;
  if (dataSources.length === 0) return;

  const formDataSources = groupIcgemDataSourcesForForm(dataSources);
  const needsSatelliteVocab = formDataSources.some(
    (ds) => Array.isArray(ds.satellitePlatforms) && ds.satellitePlatforms.length > 0
  );
  if (needsSatelliteVocab && typeof window.waitForThesaurusVocabulary === 'function') {
    const result = await window.waitForThesaurusVocabulary('platforms');
    if (result !== 'loaded') {
      throw new Error('GCMD platforms vocabulary not ready for satellite import');
    }
  }

  const $rows = ensureDataSourceRows(formDataSources.length);

  for (let i = 0; i < formDataSources.length; i++) {
    const ds = formDataSources[i];
    const $row = $rows.eq(i);
    window.elmo?.invalidateIdentifierDetection?.($row.find('input[name="dIdentifier[]"]')[0]);
    const $typeSelect = $row.find('select[name="datasource_type[]"]');
    selectDataSourceType($typeSelect, ds.inputDataSourceType);
    $typeSelect.trigger('change');

    if (ds.description) $row.find('textarea[name="datasource_description[]"]').val(ds.description);

    if (ds.inputDataSourceType === 'Satellite') {
      if (Array.isArray(ds.satellitePlatforms) && ds.satellitePlatforms.length > 0) {
        applySatellitePlatformTags(
          $row.find('input[name="satellite_platform[]"]')[0],
          ds.satellitePlatforms
        );
      }
    } else if (ds.inputDataSourceType === 'Ground data') {
      if (ds.groundDetail) $row.find('select[name="datasource_details[]"]').val(ds.groundDetail);
    } else if (ds.inputDataSourceType === 'Altimetry') {
      if (ds.altimetryDetail) $row.find('select[name="datasource_details[]"]').val(ds.altimetryDetail);
    } else if (ds.inputDataSourceType === 'Elevation/Terrain') {
      if (ds.elevationTerrainDetail) {
        $row.find('select[name="datasource_details[]"]').val(ds.elevationTerrainDetail).trigger('change');
      }
      if (ds.compensationDepth) $row.find('input[name="compensation_depth[]"]').val(ds.compensationDepth);
    } else if (ds.inputDataSourceType === 'Model') {
      if (ds.modelDetail) $row.find('select[name="datasource_details[]"]').val(ds.modelDetail);
      // Do not .trigger('input') when XML already has identifierType: that
      // debounce-fires updateIdentifierType() and can overwrite the select
      // after options arrive.
      if (ds.identifier) {
        const $idInput = $row.find('input[name="dIdentifier[]"]');
        if (ds.identifierType) {
          $idInput.val(ds.identifier);
        } else {
          $idInput.val(ds.identifier).trigger('input');
        }
      }
      if (ds.identifierType) {
        const $idTypeSelect = $row.find('select[name="dIdentifierType[]"]');
        // Type change already asked setupIdentifierTypesDropdown to fetch; await
        // that (or start it) so DOI/etc. options exist before .val().
        if (typeof window.setupIdentifierTypesDropdown === 'function') {
          await window.setupIdentifierTypesDropdown($idTypeSelect);
        }
        if (!selectOptionByText($idTypeSelect, ds.identifierType)) {
          $idTypeSelect.val(ds.identifierType);
        }
        window.elmo?.restoreIdentifierType?.($row.find('input[name="dIdentifier[]"]')[0]);
      }
      if (ds.name) $row.find('input[name="dName[]"]').val(ds.name);
    }
  }
}

/**
 * Copies ICGEM contact details onto contributor cards.
 *
 * A grav:contacts/grav:contact entry carries its own name and identifier. An ORCID
 * matches only that ORCID, so two people with the same name stay separate.
 * A missing card is added with the Contact Person role. An older grav:contact
 * list has no names. Each person takes one address. A repeated author does not
 * take a second one. An institution without the Contact Person role keeps its
 * address when the list has a slot for it.
 *
 * Author cards are left unchanged. Add another contact field in readNamedContact
 * and applyDetail.
 *
 * @param {Document} xmlDoc Parsed ICGEM envelope, including its DataCite resource.
 * @throws {Error} When the contributors group is present but not initialized.
 */
function populateIcgemContactPersons(xmlDoc) {
  const dataciteNs = 'http://datacite.org/schema/kernel-4';

  function listedElements(nodes) {
    return Array.from(nodes || []);
  }

  function childElementsByLocalName(context, localName) {
    if (!context) return [];
    const children = context.children
      ? listedElements(context.children)
      : listedElements(context.childNodes).filter((node) => node.nodeType === 1);
    if (!localName) return children;
    return children.filter((node) => node.localName === localName);
  }

  function descendantElementsByLocalName(context, localName) {
    if (!context || typeof context.getElementsByTagName !== 'function') {
      return [];
    }

    return listedElements(context.getElementsByTagName('*')).filter((node) => (
      node.localName === localName
    ));
  }

  function normalizeOrcid(value) {
    return String(value || '').trim().replace(/^https?:\/\/orcid\.org\//, '');
  }

  function normalizeRorId(value) {
    return String(value || '').trim().replace(/^https?:\/\/ror\.org\//, '');
  }

  function readAffiliations(contributorNode) {
    return ['personAffiliation', 'affiliation']
      .flatMap((localName) => childElementsByLocalName(contributorNode, localName))
      .map((node) => ({
        label: node.textContent.trim(),
        rorId: normalizeRorId(node.getAttribute('affiliationIdentifier'))
      }))
      .filter((affiliation) => affiliation.label || affiliation.rorId);
  }

  function readOrcid(contributorNode) {
    const orcidNode = childElementsByLocalName(contributorNode, 'nameIdentifier').find((node) => (
      String(node.getAttribute('nameIdentifierScheme') || '').toUpperCase() === 'ORCID'
    ));

    return normalizeOrcid(orcidNode ? orcidNode.textContent : '');
  }

  function collectContactDetails(contactNode) {
    const details = [];
    let current = null;

    childElementsByLocalName(contactNode).forEach((node) => {
      const value = node.textContent.trim();
      if (!value) return;

      if (node.localName === 'address') {
        current = { email: value, website: '' };
        details.push(current);
        return;
      }

      if (node.localName === 'onlineResource') {
        if (!current || current.website) {
          current = { email: '', website: value };
          details.push(current);
          return;
        }
        current.website = value;
      }
    });

    return details;
  }

  function personNameKey(familyName, givenName) {
    return `${String(familyName || '').trim().toLowerCase()}\0${String(givenName || '').trim().toLowerCase()}`;
  }

  function childText(node, localName) {
    const child = childElementsByLocalName(node, localName)[0];
    return child ? child.textContent.trim() : '';
  }

  function readNamedContact(node) {
    const type = childText(node, 'type');
    const name = childText(node, 'name');
    const identifierType = childText(node, 'identifierType').toUpperCase();
    const identifier = childText(node, 'identifier');
    const personal = type !== 'institutional';
    let familyName = '';
    let givenName = '';
    if (personal && name.includes(',')) {
      const parts = name.split(',');
      familyName = (parts.shift() || '').trim();
      givenName = parts.join(',').trim();
    } else if (personal) {
      familyName = name;
    }
    return {
      person: personal,
      familyName,
      givenName,
      institutionname: personal ? '' : name,
      orcid: identifierType === 'ORCID' ? normalizeOrcid(identifier) : '',
      rorId: identifierType === 'ROR' ? normalizeRorId(identifier) : '',
      affiliations: [],
      email: childText(node, 'address'),
      website: childText(node, 'onlineResource')
    };
  }

  const ggpNode = descendantElementsByLocalName(xmlDoc, 'globalGravityProduct')[0];
  if (!ggpNode) return;

  const namedContacts = childElementsByLocalName(childElementsByLocalName(ggpNode, 'contacts')[0], 'contact')
    .map(readNamedContact)
    .filter((contact) => contact.email || contact.website || contact.familyName || contact.institutionname);
  const legacyDetails = namedContacts.length
    ? []
    : collectContactDetails(childElementsByLocalName(ggpNode, 'contact')[0]);
  if (namedContacts.length === 0 && legacyDetails.length === 0) return;

  let contributorNodes = typeof xmlDoc.getElementsByTagNameNS === 'function'
    ? listedElements(xmlDoc.getElementsByTagNameNS(dataciteNs, 'contributor'))
    : [];
  if (contributorNodes.length === 0) {
    contributorNodes = descendantElementsByLocalName(xmlDoc, 'contributor')
      .filter((node) => node.parentElement?.localName === 'contributors');
  }

  function readIdentity(node) {
    const nameNode = childElementsByLocalName(node, 'contributorName')[0];
    const nameType = nameNode ? (nameNode.getAttribute('nameType') || '') : '';
    const display = nameNode ? nameNode.textContent.trim() : '';
    let familyName = childText(node, 'familyName');
    let givenName = childText(node, 'givenName');
    if (nameType === 'Personal' && !familyName && display.includes(',')) {
      const parts = display.split(',').map((part) => part.trim());
      familyName = parts[0] || '';
      givenName = parts[1] || '';
    }
    const person = nameType === 'Personal' || Boolean(familyName || givenName);
    const roleRaw = node.getAttribute('contributorType') || 'Other';
    const orcid = readOrcid(node);
    return {
      person,
      familyName,
      givenName,
      institutionname: person ? '' : display,
      orcid,
      affiliations: readAffiliations(node),
      role: roleRaw.replace(/([a-z])([A-Z])/g, '$1 $2'),
      contactPerson: roleRaw === 'ContactPerson',
      key: person
        ? `person:${orcid || personNameKey(familyName, givenName)}`
        : `institution:${display.trim().toLowerCase()}`
    };
  }

  const identities = [];
  contributorNodes.forEach((node) => {
    if (childElementsByLocalName(node, 'nameIdentifier').some((item) => (
      item.getAttribute('nameIdentifierScheme') === 'labid'
    ))) return;
    const identity = readIdentity(node);
    if (identity.person ? !(identity.familyName || identity.givenName) : !identity.institutionname) return;
    identities.push(identity);
  });

  const contactIdentities = identities.filter((identity) => identity.contactPerson);
  const contributorStack = window.contributorStack;
  const contributorsReady = typeof contributorStack?.collectPayload === 'function'
    && typeof contributorStack?.setContributors === 'function';
  if (document.querySelector('[name="contributorsPayload"]') && !contributorsReady) {
    throw new Error('Contributors form is not initialized.');
  }

  function cloneContributors() {
    return contributorStack.collectPayload().map((contributor) => ({
      ...contributor,
      roles: Array.isArray(contributor.roles) ? [...contributor.roles] : [],
      affiliations: Array.isArray(contributor.affiliations)
        ? contributor.affiliations.map((item) => ({ ...item }))
        : []
    }));
  }

  if (namedContacts.length === 0 && contactIdentities.length === 0) {
    if (!contributorsReady) {
      console.warn("couldn't determine the contact person from metadata");
      return;
    }
    const contributors = cloneContributors();
    const cards = contributors.filter((card) => card.roles.includes('Contact Person'));
    if (cards.length === 0) {
      console.warn("couldn't determine the contact person from metadata");
      return;
    }
    legacyDetails.forEach((detail, index) => {
      if (!cards[index]) return;
      cards[index].email = detail.email || cards[index].email || '';
      cards[index].website = detail.website || cards[index].website || '';
    });
    contributorStack.setContributors(contributors);
    return;
  }

  if (!contributorsReady) return;

  const supports = (type) => contributorStack.supportsType?.(type) !== false;
  const contributors = cloneContributors();

  function findCard(identity) {
    if (identity.orcid) {
      const byOrcid = contributors.find((card) => (
        card.type === 'person' && normalizeOrcid(card.orcid) === identity.orcid
      ));
      if (byOrcid) return byOrcid;
    }
    if (identity.rorId) {
      const byRor = contributors.find((card) => (
        card.type === 'institution'
        && (card.affiliations || []).some((item) => normalizeRorId(item.rorId) === identity.rorId)
      ));
      if (byRor) return byRor;
    }
    if (identity.person) {
      const key = personNameKey(identity.familyName, identity.givenName);
      // A card that already has a different ORCID is a different person.
      return contributors.find((card) => (
        card.type === 'person'
        && personNameKey(card.familyname, card.givenname) === key
        && (!identity.orcid || !normalizeOrcid(card.orcid) || normalizeOrcid(card.orcid) === identity.orcid)
      )) || null;
    }
    const institutionName = String(identity.institutionname || '').trim().toLowerCase();
    return contributors.find((card) => (
      card.type === 'institution'
      && String(card.institutionname || '').trim().toLowerCase() === institutionName
    ));
  }

  function newCard(identity) {
    return {
      type: identity.person ? 'person' : 'institution',
      familyname: identity.familyName || '',
      givenname: identity.givenName || '',
      orcid: identity.orcid || '',
      institutionname: identity.institutionname || '',
      roles: ['Contact Person'],
      affiliations: (identity.affiliations || []).map((item) => ({ ...item })),
      email: '',
      website: ''
    };
  }

  function applyDetail(target, detail) {
    target.email = detail.email || target.email || '';
    target.website = detail.website || target.website || '';
  }

  let changed = false;
  function place(identity, detail) {
    const type = identity.person ? 'person' : 'institution';
    if (!supports(type)) return;
    let card = findCard(identity);
    if (!card) {
      card = newCard(identity);
      contributors.push(card);
    }
    if (!card.roles.includes('Contact Person')) card.roles.push('Contact Person');
    if (identity.orcid && !normalizeOrcid(card.orcid)) card.orcid = identity.orcid;
    if ((!card.affiliations || card.affiliations.length === 0) && identity.affiliations?.length) {
      card.affiliations = identity.affiliations.map((item) => ({ ...item }));
    }
    if (detail) applyDetail(card, detail);
    changed = true;
  }

  function dedupeIdentities(list) {
    const seen = new Set();
    return list.filter((identity) => {
      const key = identity.person
        ? `person:${identity.orcid || personNameKey(identity.familyName, identity.givenName)}`
        : `institution:${String(identity.institutionname || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (namedContacts.length) {
    namedContacts.forEach((contact) => place(contact, contact));
  } else {
    // One address per person. An author who is already a contributor contact
    // does not take a second address, or the next person's email moves.
    // An institution without the Contact Person role stays in the sequence
    // when the address list has a slot for it, because export writes that slot.
    const people = dedupeIdentities(contactIdentities);
    const institutions = dedupeIdentities(identities.filter((identity) => (
      !identity.person && !identity.contactPerson
    )));
    const withInstitutions = dedupeIdentities(identities.filter((identity) => (
      identity.contactPerson || !identity.person
    )));
    const sequence = institutions.length && legacyDetails.length === people.length + institutions.length
      ? withInstitutions
      : people;
    sequence.forEach((identity, index) => {
      if (!legacyDetails[index]) return;
      place(identity, legacyDetails[index]);
    });
  }

  if (changed) contributorStack.setContributors(contributors);
}

/**
 * Populates the GGMsDescriptions form fields.
 * ICGEM descriptions use a 'section' attribute (unlike DataCite descriptionType).
 * @param {Object} data - Parsed ICGEM data from parseIcgemXml()
 */
function populateIcgemDescriptions(data) {
  const { descriptions } = data;

  const sectionToId = {
    'abstract': 'input-abstract',
    'general model description': 'input-general-model-description',
    'input data': 'input-input-data',
    'processing procedures': 'input-processing-procedures',
    'specific features of resulting gravity field': 'input-specific-features',
    'other': 'input-other'
  };

  const sectionToCollapse = {
    'abstract': 'collapse-abstract',
    'general model description': 'collapse-general-model-description',
    'input data': 'collapse-input-data',
    'processing procedures': 'collapse-processing-procedures',
    'specific features of resulting gravity field': 'collapse-specific-features',
    'other': 'collapse-other'
  };

  for (const { section, content } of descriptions) {
    const inputId = sectionToId[section];
    if (inputId) {
      $(`#${inputId}`).val(content);
      const collapseId = sectionToCollapse[section];
      if (collapseId) $(`#${collapseId}`).addClass('show');
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses the ICGEM XML document and populates all ICGEM-specific form fields
 * (definition, properties, model types, data sources, descriptions).
 * @param {Document} xmlDoc
 */
async function loadIcgemXmlToForm(xmlDoc) {
  const data = parseIcgemXml(xmlDoc);
  if (!data) {
    console.error('loadIcgemXmlToForm: failed to locate ICGEM root node in XML document');
    return;
  }
  populateIcgemDefinition(data);
  populateIcgemProperties(data);
  populateIcgemModelTypes(data);
  populateIcgemDescriptions(data);
  await populateIcgemDataSources(data);
  populateIcgemContactPersons(xmlDoc);

}

// Expose as browser module
if (typeof window !== 'undefined') {
  window.icgemModule = {
    detectXmlSchema,
    loadIcgemXmlToForm
  };
}

// Export for testing (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ICGEM_NAMESPACE_URI,
    detectXmlSchema,
    parseIcgemXml,
    leafChildren,
    selectOptionByText,
    reverseDensityType,
    groupIcgemDataSourcesForForm,
    ensureDataSourceRows,
    populateIcgemDefinition,
    populateIcgemProperties,
    populateIcgemModelTypes,
    populateIcgemDataSources,
    populateIcgemDescriptions,
    populateIcgemContactPersons,
    loadIcgemXmlToForm
  };
}
