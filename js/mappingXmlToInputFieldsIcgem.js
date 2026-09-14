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
    return null;
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
 * Selects an option by text, creating it when the vocab dropdown is still loading.
 * Upload of MASCON metadata must not wait for /vocabs/mathreps to finish.
 * @param {jQuery} $select
 * @param {string} text
 * @returns {boolean}
 */
function selectOrCreateOption($select, text) {
  if (!$select.length || !text) return false;
  if (selectOptionByText($select, text)) {
    return true;
  }
  $select.append($('<option>', { value: text, text: text }));
  $select.val(text);
  return $select.val() === text;
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
    if (!selectOrCreateOption($select, scalars.mathematicalRepresentation)) {
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
      const daysToFrequency = {
        1: 'daily',
        7: 'weekly',
        30: 'monthly',
        90: 'quarterly',
        365: 'yearly',
      };
      const predefined = daysToFrequency[days];
      if (predefined) {
        $('#checkbox-custom-frequency').prop('checked', false).trigger('change');
        $('#select-release-frequency').prop('disabled', false).val(predefined);
      } else {
        $('#checkbox-custom-frequency').prop('checked', true).trigger('change');
        $('#input-temporal-frequency').val(String(days));
      }
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
 * Populates the GGMsDataSources form rows.
 * Each data source entry becomes one form row; the datasource type 'change' event
 * is triggered so row visibility updates correctly.
 * @param {Object} data - Parsed ICGEM data from parseIcgemXml()
 */
function populateIcgemDataSources(data) {
  const { dataSources } = data;
  if (dataSources.length === 0) return;

  for (let i = 0; i < dataSources.length; i++) {
    const ds = dataSources[i];

    if (i > 0) {
      $('.addDataSource').last().trigger('click');
    }

    const $row = $('[data-source-row]').last();
    const $typeSelect = $row.find('select[name="datasource_type[]"]');
    selectOptionByText($typeSelect, ds.inputDataSourceType);
    $typeSelect.trigger('change');

    if (ds.description) $row.find('textarea[name="datasource_description[]"]').val(ds.description);

    if (ds.inputDataSourceType === 'Satellite') {
      if (ds.satelliteValueName) {
        const platformInput = $row.find('input[name="satellite_platform[]"]')[0];
        const tag = {
          value: ds.satelliteValueName,
          id: ds.satelliteValueUri || '',
          scheme: ds.satelliteSchemeName || '',
          schemeURI: ds.satelliteSchemeUri || ''
        };
        if (platformInput && platformInput._tagify) {
          platformInput._tagify.addTags([tag]);
        } else if (platformInput) {
          $(platformInput).val(JSON.stringify([tag]));
        }
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
      if (ds.identifier) $row.find('input[name="dIdentifier[]"]').val(ds.identifier).trigger('input');
      if (ds.identifierType) {
        const $idTypeSelect = $row.find('select[name="dIdentifierType[]"]');
        if (!selectOptionByText($idTypeSelect, ds.identifierType)) {
          $idTypeSelect.val(ds.identifierType);
        }
      }
      if (ds.name) $row.find('input[name="dName[]"]').val(ds.name);
    }
  }
}

/**
 * Populates contact person email and website fields from the ICGEM-envelope's
 * grav:contact element (inside globalGravityProduct).
 *
 * Contact info (email/website) is stored positionally in grav:contact/grav:address
 * and grav:contact/grav:onlineResource. The i-th address and i-th onlineResource
 * correspond to the i-th ContactPerson contributor listed in the DataCite resource
 * section. Names from that section are used to locate the correct author row.
 *
 * The contact-person toggle checkbox fires on "click", so .prop('checked', true) alone
 * does not show the hidden fields. This function explicitly checks the checkbox and
 * calls .show() to ensure the fields are visible before populating them.
 *
 * @param {Document} xmlDoc
 */
function populateIcgemContactPersons(xmlDoc) {
  const daceNs = 'http://datacite.org/schema/kernel-4';

  function resolver(prefix) {
    if (prefix === 'icgv') return ICGEM_NAMESPACE_URI;
    if (prefix === 'grav') return ICGEM_NAMESPACE_URI;
    if (prefix === 'dc') return daceNs;
    if (prefix === 'dace') return daceNs;
    return null;
  }

  function xpFirst(xpath, ctx) {
    return xmlDoc.evaluate(xpath, ctx, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }

  function xpAll(xpath, ctx) {
    return xmlDoc.evaluate(xpath, ctx, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  }

  function nodeText(xpath, ctx) {
    const n = xpFirst(xpath, ctx);
    return n ? n.textContent.trim() : '';
  }

  function childElementsByLocalName(context, localName) {
    return Array.from(context.children || []).filter((node) => node.localName === localName);
  }

  function descendantElementsByLocalName(context, localName) {
    if (!context || typeof context.getElementsByTagName !== 'function') {
      return [];
    }

    return Array.from(context.getElementsByTagName('*')).filter((node) => (
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

    Array.from(contactNode.children || []).forEach((node) => {
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

  function applyAffiliationsToRow($row, affiliations) {
    if (!affiliations.length) return;

    const tagifyInput = $row.find('input[name="personAffiliation[]"]')[0];
    if (tagifyInput && tagifyInput._tagify) {
      tagifyInput._tagify.removeAllTags();
      tagifyInput._tagify.addTags(affiliations.map((affiliation) => ({
        value: affiliation.label,
        label: affiliation.label,
        rorId: affiliation.rorId
      })));
    } else {
      $row.find('input[name="personAffiliation[]"]').val(affiliations.map((affiliation) => affiliation.label).join(','));
    }

    $row.find('input[name="authorPersonRorIds[]"]').val(affiliations.map((affiliation) => affiliation.rorId).join(','));
  }

  // Locate globalGravityProduct
  const ggpNode = xpFirst('.//icgv:globalGravityProduct | .//grav:globalGravityProduct', xmlDoc)
    || descendantElementsByLocalName(xmlDoc, 'globalGravityProduct')[0];
  if (!ggpNode) return;

  // Find grav:contact and read emails (addresses) and websites (onlineResources).
  // These are in the same positional order as the ContactPerson contributors
  // in the DataCite resource section.
  const contactNode = xpFirst('icgv:contact | grav:contact', ggpNode)
    || childElementsByLocalName(ggpNode, 'contact')[0];
  if (!contactNode) return;

  const contactDetails = collectContactDetails(contactNode);
  if (contactDetails.length === 0) return;

  // Get ContactPerson contributors from the DataCite resource for name-based row matching.
  // These are listed in the same order as grav:contact addresses/onlineResources.
  const prefixedContribs = xpAll('.//dc:contributors/dc:contributor | .//dace:contributors/dace:contributor', xmlDoc);
  let contributorNodes = [];
  for (let i = 0; i < prefixedContribs.snapshotLength; i++) {
    contributorNodes.push(prefixedContribs.snapshotItem(i));
  }

  if (contributorNodes.length === 0) {
    contributorNodes = descendantElementsByLocalName(xmlDoc, 'contributor')
      .filter((node) => node.parentElement?.localName === 'contributors');
  }

  const contactPersons = [];
  contributorNodes.forEach((node) => {
    if (node.getAttribute('contributorType') !== 'ContactPerson') return;
    const familyName = nodeText('dc:familyName | dace:familyName | familyName', node);
    const givenName  = nodeText('dc:givenName  | dace:givenName  | givenName',  node);
    contactPersons.push({
      familyName,
      givenName,
      orcid: readOrcid(node),
      affiliations: readAffiliations(node)
    });
  });

  for (let i = 0; i < contactPersons.length; i++) {
    const detail = contactDetails[i] || { email: '', website: '' };

    contactPersons[i].email = detail.email;
    contactPersons[i].website = detail.website;
  }

  if (window.authorStack && typeof window.authorStack.collectPayload === 'function' && typeof window.authorStack.setAuthors === 'function') {
    const authors = window.authorStack.collectPayload().map(author => ({ ...author }));

    contactPersons.forEach(({ familyName, givenName, orcid, affiliations, email, website }) => {
      if ((!email && !website) || (!familyName && !givenName)) return;

      const normFamily = familyName.toLowerCase();
      const normGiven = givenName.toLowerCase();
      let author = authors.find(candidate => candidate.type === 'person'
        && String(candidate.familyname || '').trim().toLowerCase() === normFamily
        && String(candidate.givenname || '').trim().toLowerCase() === normGiven);

      if (!author) {
        author = {
          type: 'person',
          familyname: familyName,
          givenname: givenName,
          orcid: '',
          affiliations: []
        };
        authors.push(author);
      }

      author.isContact = true;
      author.orcid = orcid || author.orcid || '';
      if (affiliations.length) author.affiliations = affiliations;
      author.email = email || author.email || '';
      author.website = website || author.website || '';
    });

    window.authorStack.setAuthors(authors);
    return;
  }

  for (let i = 0; i < contactPersons.length; i++) {
    const { familyName, givenName, orcid, affiliations, email, website } = contactPersons[i];

    if (!email && !website) continue;
    if (!familyName && !givenName) continue;

    const normFamily = familyName.toLowerCase();
    const normGiven  = givenName.toLowerCase();
    let $row = $('div[data-creator-row]').filter(function () {
      const rf = ($('input[name="familynames[]"]', this).val() || '').trim().toLowerCase();
      const rg = ($('input[name="givennames[]"]', this).val() || '').trim().toLowerCase();
      return rf === normFamily && rg === normGiven;
    }).first();

    if (!$row.length) {
      const countBefore = $('div[data-creator-row]').length;
      $('#button-author-add').trigger('click');
      const $rows = $('div[data-creator-row]');
      if ($rows.length <= countBefore) {
        console.warn('populateIcgemContactPersons: could not create author row for contact person', { familyName, givenName });
        continue;
      }

      $row = $rows.last();
      $row.find('input[name="familynames[]"]').val(familyName);
      $row.find('input[name="givennames[]"]').val(givenName);
    }

    // Ensure the contact-person toggle is active and fields are visible.
    // The toggle handler fires on "click", not "change", so we must explicitly
    // check the checkbox and show the fields rather than relying on the event.
    $row.find('input[name="contacts[]"]').prop('checked', true);
    $row.find('.contact-person-input').show();

    if (email)   $row.find('input[name="cpEmail[]"]').val(email);
    if (website) $row.find('input[name="cpOnlineResource[]"]').val(website);
    if (orcid)   $row.find('input[name="orcids[]"]').val(orcid);
    applyAffiliationsToRow($row, affiliations);
  }
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
function loadIcgemXmlToForm(xmlDoc) {
  const data = parseIcgemXml(xmlDoc);
  if (!data) {
    console.error('loadIcgemXmlToForm: failed to locate ICGEM root node in XML document');
    return;
  }
  populateIcgemDefinition(data);
  populateIcgemProperties(data);
  populateIcgemModelTypes(data);
  populateIcgemDataSources(data);
  populateIcgemDescriptions(data);
  populateIcgemContactPersons(xmlDoc);

  $(document).trigger('icgem:form-populated');

  // Process DataCite keywords from <dace:subjects> elements
  // This ensures keywords are properly ingested during ICGEM uploads
  if (typeof window.processKeywords === 'function') {
    // Create a resolver that maps "ns" to the DataCite namespace
    function dataciteResolver(prefix) {
      if (prefix === 'ns') {
        return 'http://datacite.org/schema/kernel-4';
      }
      return null;
    }
    window.processKeywords(xmlDoc, dataciteResolver);
  }
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
    selectOrCreateOption,
    reverseDensityType,
    populateIcgemDefinition,
    populateIcgemProperties,
    populateIcgemModelTypes,
    populateIcgemDataSources,
    populateIcgemDescriptions,
    populateIcgemContactPersons,
    loadIcgemXmlToForm
  };
}
