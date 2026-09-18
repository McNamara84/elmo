/**
 * Map DataCite JSON attributes to ELMO form fields.
 *
 * This module parses the JSON response from the DataCite REST API and populates
 * the metadata editor form. Each section has its own mapping function to keep
 * the code maintainable and testable.
 *
 * Depends on jQuery ($) and Tagify being available globally.
 */

/* ------------------------------------------------------------------ */
/*  Helper: Tagify instance retrieval (mirrors mappingXmlToInputFields) */
/* ------------------------------------------------------------------ */

/**
 * Returns the Tagify instance attached to an element, if any.
 * @param {HTMLElement|jQuery} el
 * @returns {Tagify|null}
 */
function getTagify(el) {
  if (!el) return null;
  if (el.jquery) el = el[0]; // unwrap jQuery
  return el?._tagify ?? null;
}

function getAuthorStackController() {
  return typeof window !== 'undefined' && window.authorStack && typeof window.authorStack.setAuthors === 'function'
    ? window.authorStack
    : null;
}

function normalizeRorId(value) {
  return value ? String(value).trim().replace(/^https?:\/\/ror\.org\//, '') : '';
}

function extractCreatorOrcid(creator) {
  if (!Array.isArray(creator.nameIdentifiers)) {
    return '';
  }

  const orcidEntry = creator.nameIdentifiers.find(ni => ni.nameIdentifierScheme === 'ORCID');
  return orcidEntry ? (orcidEntry.nameIdentifier || '').replace('https://orcid.org/', '') : '';
}

function extractAffiliationsPayload(creator) {
  if (!Array.isArray(creator.affiliation)) {
    return [];
  }

  return creator.affiliation
    .map(affiliation => {
      if (typeof affiliation === 'string') {
        return { label: affiliation, rorId: '' };
      }

      return {
        label: affiliation.name || affiliation.value || '',
        rorId: normalizeRorId(affiliation.affiliationIdentifier || affiliation.rorId || affiliation.id || '')
      };
    })
    .filter(affiliation => affiliation.label !== '' || affiliation.rorId !== '');
}

function buildAuthorsPayloadFromCreators(creators) {
  return creators
    .map(creator => {
      const givenname = creator.givenName || '';
      const familyname = creator.familyName || '';
      const nameType = creator.nameType || '';
      const creatorName = creator.name || '';
      const affiliations = extractAffiliationsPayload(creator);

      if (givenname || familyname || nameType === 'Personal') {
        return {
          type: 'person',
          familyname,
          givenname,
          orcid: extractCreatorOrcid(creator),
          isContact: false,
          email: '',
          website: '',
          affiliations
        };
      }

      if (creatorName || nameType === 'Organizational') {
        return {
          type: 'institution',
          institutionname: creatorName,
          affiliations
        };
      }

      return null;
    })
    .filter(Boolean);
}

function normalizeNameKey(familyName, givenName) {
  return `${String(familyName || '').trim().toLowerCase()}\u0000${String(givenName || '').trim().toLowerCase()}`;
}

function getCurrentAuthorsPayload(authorStack) {
  if (authorStack && typeof authorStack.collectPayload === 'function') {
    return authorStack.collectPayload();
  }

  const payloadInput = document.querySelector('input[name="authorsPayload"]');
  if (!payloadInput || !payloadInput.value) {
    return [];
  }

  try {
    const parsed = JSON.parse(payloadInput.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Decodes HTML entities in a string (e.g. "&gt;" → ">").
 * DataCite subjects may contain HTML-encoded characters.
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

/* ------------------------------------------------------------------ */
/*  Vocabulary mapping helpers (fetched once, cached)                  */
/* ------------------------------------------------------------------ */

let _licenseMappingCache = null;
let _languageMappingCache = null;
let _titleTypeMappingCache = null;
let _roleMappingCache = null;
let _relationMappingCache = null;

/**
 * Loads vocabulary mapping tables from the API. Each loader caches its result.
 */
async function getLicenseMapping() {
  if (_licenseMappingCache) return _licenseMappingCache;
  try {
    const data = await $.getJSON('./api/v2/vocabs/licenses/all');
    _licenseMappingCache = {};
    data.forEach(l => { _licenseMappingCache[l.rightsIdentifier.toUpperCase()] = l.rights_id.toString(); });
  } catch {
    _licenseMappingCache = { 'CC-BY-4.0': '1', 'CC0-1.0': '2' };
  }
  return _licenseMappingCache;
}

async function getLanguageMapping() {
  if (_languageMappingCache) return _languageMappingCache;
  try {
    const data = await $.getJSON('./api/v2/vocabs/languages');
    _languageMappingCache = {};
    data.forEach(l => { _languageMappingCache[l.code.toLowerCase()] = l.id.toString(); });
  } catch {
    _languageMappingCache = { en: '1', de: '2', fr: '3' };
  }
  return _languageMappingCache;
}

async function getTitleTypeMapping() {
  if (_titleTypeMappingCache) return _titleTypeMappingCache;
  try {
    const data = await $.getJSON('./api/v2/vocabs/titletypes');
    _titleTypeMappingCache = {};
    data.forEach(t => {
      const key = t.name.replace(/\s+/g, '');
      _titleTypeMappingCache[key] = t.id.toString();
    });
    const main = data.find(t => t.name.toLowerCase() === 'main title');
    if (main) {
      _titleTypeMappingCache[''] = main.id.toString();
      _titleTypeMappingCache['MainTitle'] = main.id.toString();
    }
  } catch {
    _titleTypeMappingCache = { '': '', MainTitle: '', AlternativeTitle: '', TranslatedTitle: '' };
  }
  return _titleTypeMappingCache;
}

async function getRelationMapping() {
  if (_relationMappingCache) return _relationMappingCache;
  try {
    const data = await $.getJSON('./api/v2/vocabs/relations');
    _relationMappingCache = {};
    data.forEach(r => { _relationMappingCache[r.name] = r.relation_id.toString(); });
  } catch {
    _relationMappingCache = {};
  }
  return _relationMappingCache;
}

/* ------------------------------------------------------------------ */
/*  Normalizer helpers                                                */
/* ------------------------------------------------------------------ */

function normalizeRole(contributorType) {
  return (contributorType || '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * Converts a CamelCase relation type (e.g. "IsDocumentedBy") to the spaced
 * format used in ELMO select options (e.g. "Is Documented By").
 * @param {string} relationType
 * @returns {string}
 */
function normalizeRelationType(relationType) {
  return (relationType || '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Shared by XML upload and DOI prefill in the browser and in Jest.
var resourceTypeUtils = typeof module !== 'undefined' && module.exports
  ? require('./resourceTypeUtils')
  : window.resourceTypeUtils;

function mapTitleTypeFromJson(titleType, mapping) {
  const key = (titleType || '').replace(/\s+/g, '');
  return mapping[key] ?? mapping[''] ?? '';
}

/* ================================================================== */
/*  Per-section mapping functions                                     */
/* ================================================================== */

/**
 * Maps resource information fields (DOI, year, type, version, language).
 */
function prefillResourceInfo(attr) {
  if (attr.doi) {
    $('#input-resourceinformation-doi').val(attr.doi);
  }
  if (attr.publicationYear) {
    $('#input-resourceinformation-publicationyear').val(attr.publicationYear);
  }
  if (attr.version) {
    const $version = $('#input-resourceinformation-version');
    $version.val(attr.version);
    $version.addClass('prefill-highlight');
    $version.attr('title', window.elmo?.translate?.('doiPrefill.versionHint') || 'Please check and adjust the version if necessary.');
  }
  if (attr.types?.resourceTypeGeneral) {
    const selectField = document.querySelector('#input-resourceinformation-resourcetype');
    if (selectField) {
      const opt = resourceTypeUtils.findResourceTypeOption(
        Array.from(selectField.options),
        attr.types.resourceTypeGeneral
      );
      if (opt) opt.selected = true;
    }
  }
}

async function prefillLanguage(attr) {
  if (!attr.language) return;
  const mapping = await getLanguageMapping();
  const id = mapping[attr.language.toLowerCase()];
  if (id) {
    $('#input-resourceinformation-language').val(id);
  }
}

/**
 * Maps titles from the DataCite JSON to the form.
 */
async function prefillTitles(titles) {
  if (!Array.isArray(titles) || titles.length === 0) return;
  const mapping = await getTitleTypeMapping();

  titles.forEach((t, i) => {
    if (i === 0) {
      $('input[name="title[]"]:first').val(t.title || '');
      $('#input-resourceinformation-titletype').val(mapTitleTypeFromJson(t.titleType, mapping));
    } else {
      $('#button-resourceinformation-addtitle').click();
      const $row = $('input[name="title[]"]').eq(i).closest('.row');
      $row.find('input[name="title[]"]').val(t.title || '');
      $row.find('select[name="titleType[]"]').val(mapTitleTypeFromJson(t.titleType, mapping));
    }
  });
}

/**
 * Maps creators (authors) — both persons and institutions.
 */
function prefillCreators(creators) {
  if (!Array.isArray(creators) || creators.length === 0) return;

  const authorStack = getAuthorStackController();
  if (authorStack) {
    const authors = buildAuthorsPayloadFromCreators(creators);
    if (authors.length > 0) {
      authorStack.setAuthors(authors);
      return;
    }
  }

  let personIndex = 0;

  creators.forEach(creator => {
    const givenName = creator.givenName || '';
    const familyName = creator.familyName || '';
    const nameType = creator.nameType || '';
    const creatorName = creator.name || '';

    // Extract ORCID
    let orcid = '';
    if (Array.isArray(creator.nameIdentifiers)) {
      const orcidEntry = creator.nameIdentifiers.find(ni => ni.nameIdentifierScheme === 'ORCID');
      if (orcidEntry) {
        orcid = (orcidEntry.nameIdentifier || '').replace('https://orcid.org/', '');
      }
    }

    // Extract affiliations and ROR IDs
    const affiliations = [];
    const rorIds = [];
    if (Array.isArray(creator.affiliation)) {
      creator.affiliation.forEach(aff => {
        const name = typeof aff === 'string' ? aff : (aff.name || '');
        if (name) {
          affiliations.push(name);
          const rorId = typeof aff === 'object' ? (aff.affiliationIdentifier || '') : '';
          if (rorId) rorIds.push(rorId.replace('https://ror.org/', ''));
        }
      });
    }

    // Person authors
    if (givenName || familyName || nameType === 'Personal') {
      let $row;
      if (personIndex === 0) {
        $row = $('div[data-creator-row]').eq(0);
        if (!$row.length) {
          $('#button-author-add').click();
          $row = $('div[data-creator-row]').last();
        }
      } else {
        $('#button-author-add').click();
        $row = $('div[data-creator-row]').eq(personIndex);
      }
      personIndex++;

      $row.find('input[name="orcids[]"]').val(orcid);
      $row.find('input[name="familynames[]"]').val(familyName);
      $row.find('input[name="givennames[]"]').val(givenName);

      const affiliationValues = affiliations.map((affiliation, index) => ({
        value: affiliation,
        label: affiliation,
        rorId: rorIds[index] || '',
        id: rorIds[index] || ''
      }));
      const tagifyInput = $row.find('input[name="personAffiliation[]"]')[0];
      const tagify = getTagify(tagifyInput);
      if (tagify) {
        tagify.removeAllTags();
        tagify.addTags(affiliationValues);
        $row.find('input[name="authorPersonRorIds[]"]').val(rorIds.join(','));
      } else if (tagifyInput) {
        $(tagifyInput).val(JSON.stringify(affiliationValues));
        $row.find('input[name="authorPersonRorIds[]"]').val(rorIds.join(','));
      }
      tagifyInput?.dispatchEvent(new CustomEvent('author-affiliations:changed', { bubbles: true }));

      // Reset contact person fields
      $row.find('input[name="contacts[]"]').prop('checked', false);
      $row.find('.contact-person-input').hide();
      $row.find('input[name="cpEmail[]"]').val('');
      $row.find('input[name="cpOnlineResource[]"]').val('');
    }
    // Institutional authors
    else if (creatorName || nameType === 'Organizational') {
      let $instRows = $('div[data-authorinstitution-row]');
      const emptyRow = $instRows.toArray().find(row =>
        $(row).find('input[name="authorinstitutionName[]"]').val().trim() === ''
      );

      let $instRow;
      if (emptyRow) {
        $instRow = $(emptyRow);
      } else {
        $('#button-authorinstitution-add').click();
        $instRow = $('div[data-authorinstitution-row]').last();
      }

      $instRow.find('input[name="authorinstitutionName[]"]').val(creatorName);

      const affiliationValues = affiliations.map((affiliation, index) => ({
        value: affiliation,
        label: affiliation,
        rorId: rorIds[index] || '',
        id: rorIds[index] || ''
      }));
      const tagifyInput = $instRow.find('input[name="institutionAffiliation[]"]')[0];
      const tagify = getTagify(tagifyInput);
      if (tagify) {
        tagify.removeAllTags();
        tagify.addTags(affiliationValues);
      } else if (tagifyInput) {
        $(tagifyInput).val(JSON.stringify(affiliationValues));
      }
      $instRow.find('input[name="authorInstitutionRorIds[]"]').val(rorIds.join(','));
      tagifyInput?.dispatchEvent(new CustomEvent('author-affiliations:changed', { bubbles: true }));
    }
  });
}

/**
 * Maps contributors (persons and institutions) with role deduplication.
 */
function prefillContributors(contributors) {
  if (!Array.isArray(contributors) || contributors.length === 0) return;

  const personMap = new Map();
  const orgMap = new Map();

  contributors.forEach(c => {
    const contributorType = c.contributorType || '';
    const nameType = c.nameType || '';
    const givenName = c.givenName || '';
    const familyName = c.familyName || '';
    const contributorName = c.name || '';

    let orcid = '';
    if (Array.isArray(c.nameIdentifiers)) {
      const entry = c.nameIdentifiers.find(ni => ni.nameIdentifierScheme === 'ORCID');
      if (entry) orcid = (entry.nameIdentifier || '').replace('https://orcid.org/', '');
    }

    const affiliations = [];
    const rorIds = [];
    if (Array.isArray(c.affiliation)) {
      c.affiliation.forEach(aff => {
        const name = typeof aff === 'string' ? aff : (aff.name || '');
        if (name && !affiliations.includes(name)) {
          affiliations.push(name);
          const rid = typeof aff === 'object' ? (aff.affiliationIdentifier || '') : '';
          if (rid) {
            const clean = rid.replace('https://ror.org/', '');
            if (!rorIds.includes(clean)) rorIds.push(clean);
          }
        }
      });
    }

    const isPerson = nameType === 'Personal' || (givenName && familyName);

    if (isPerson) {
      const key = orcid || `${givenName}_${familyName}`;
      if (personMap.has(key)) {
        const existing = personMap.get(key);
        const role = normalizeRole(contributorType);
        if (!existing.roles.includes(role)) existing.roles.push(role);
        affiliations.forEach(a => { if (!existing.affiliations.includes(a)) existing.affiliations.push(a); });
        rorIds.forEach(r => { if (!existing.rorIds.includes(r)) existing.rorIds.push(r); });
      } else {
        personMap.set(key, { givenName, familyName, orcid, roles: [normalizeRole(contributorType)], affiliations, rorIds });
      }
    } else {
      if (orgMap.has(contributorName)) {
        const existing = orgMap.get(contributorName);
        const role = normalizeRole(contributorType);
        if (!existing.roles.includes(role)) existing.roles.push(role);
        affiliations.forEach(a => { if (!existing.affiliations.includes(a)) existing.affiliations.push(a); });
        rorIds.forEach(r => { if (!existing.rorIds.includes(r)) existing.rorIds.push(r); });
      } else {
        orgMap.set(contributorName, { name: contributorName, roles: [normalizeRole(contributorType)], affiliations, rorIds });
      }
    }
  });

  // Populate person contributors
  let personIdx = 0;
  for (const person of personMap.values()) {
    let $row;
    if (personIdx === 0) {
      $row = $('#group-contributorperson').find('[contributor-person-row]').first();
    } else {
      $('#button-contributor-addperson').click();
      $row = $('#group-contributorperson').find('.row').last();
    }
    const isCloned = personIdx > 0;
    personIdx++;

    // Roles
    const roleInput = $row.find('input[name="cbPersonRoles[]"]')[0];
    const tagifyRoles = getTagify(roleInput);
    if (tagifyRoles) {
      tagifyRoles.removeAllTags();
      tagifyRoles.addTags(person.roles.map(r => ({ value: r })));
    }

    if (person.orcid) $row.find('input[name="cbORCID[]"]').val(person.orcid);
    $row.find('input[name="cbPersonLastname[]"]').val(person.familyName);
    $row.find('input[name="cbPersonFirstname[]"]').val(person.givenName);

    // Affiliations — handle original vs cloned field names
    const affName = isCloned ? 'cbPersonAffiliations[]' : 'cbAffiliation[]';
    const affInput = $row.find(`input[name="${affName}"]`)[0];
    const tagifyAff = getTagify(affInput);
    if (tagifyAff) {
      tagifyAff.removeAllTags();
      tagifyAff.addTags(person.affiliations.map(a => ({ value: a })));
    }

    const rorName = isCloned ? 'cbPersonRorIds[]' : 'cbpRorIds[]';
    $row.find(`input[name="${rorName}"]`).val(person.rorIds.join(','));
  }

  // Populate organization contributors
  let orgIdx = 0;
  for (const org of orgMap.values()) {
    let $row;
    if (orgIdx === 0) {
      $row = $('#group-contributororganisation').find('[contributors-row]').first();
    } else {
      $('#button-contributor-addorganisation').click();
      $row = $('#group-contributororganisation').find('.row').last();
    }
    const isCloned = orgIdx > 0;
    orgIdx++;

    const roleInput = $row.find('input[name="cbOrganisationRoles[]"]')[0];
    const tagifyRoles = getTagify(roleInput);
    if (tagifyRoles) {
      tagifyRoles.removeAllTags();
      tagifyRoles.addTags(org.roles.map(r => ({ value: r })));
    }

    $row.find('input[name="cbOrganisationName[]"]').val(org.name);

    const affName = isCloned ? 'cbOrganisationAffiliations[]' : 'OrganisationAffiliation[]';
    const affInput = $row.find(`input[name="${affName}"]`)[0];
    const tagifyAff = getTagify(affInput);
    if (tagifyAff) {
      tagifyAff.removeAllTags();
      tagifyAff.addTags(org.affiliations.map(a => ({ value: a })));
    }

    const rorName = isCloned ? 'cbOrganisationRorIds[]' : 'hiddenOrganisationRorId[]';
    $row.find(`input[name="${rorName}"]`).val(org.rorIds.join(','));
  }
}

/**
 * Maps descriptions by descriptionType.
 */
function prefillDescriptions(descriptions) {
  if (!Array.isArray(descriptions) || descriptions.length === 0) return;

  const staticMapping = { Abstract: 'input-abstract' };
  const dynamicSlugs = ['Methods', 'TechnicalInfo', 'TechnicalInformation', 'SeriesInformation', 'TableOfContents', 'Other'];

  descriptions.forEach(d => {
    const type = d.descriptionType || '';
    const content = (d.description || '').trim();

    if (staticMapping[type]) {
      $(`#${staticMapping[type]}`).val(content);
      $('#collapse-abstract').addClass('show');
    } else if (dynamicSlugs.includes(type)) {
      const slug = type === 'TechnicalInformation' ? 'TechnicalInfo' : type;
      const $input = $(`#input-description-${slug}`);
      if ($input.length) {
        $input.val(content);
        $(`#collapse-description-${slug}`).addClass('show');
      }
    }
  });
}

/**
 * Maps dates from DataCite (dateType=Created → dateCreated, Available → embargo).
 */
function prefillDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return;

  dates.forEach(d => {
    const dateValue = (d.date || '').trim();
    if (d.dateType === 'Created') {
      $('input[name="dateCreated"]').val(dateValue.substring(0, 10));
    } else if (d.dateType === 'Available') {
      $('input[name="dateEmbargo"]').val(dateValue.substring(0, 10));
    }
  });
}

/**
 * Maps geoLocations to spatial/temporal coverage fields.
 */
function prefillGeoLocations(geoLocations) {
  if (!Array.isArray(geoLocations) || geoLocations.length === 0) return;

  geoLocations.forEach((geo, i) => {
    const $lastRow = $('textarea[name="tscDescription[]"]').last().closest('[tsc-row]');

    // Place description
    if (geo.geoLocationPlace) {
      $lastRow.find('textarea[name="tscDescription[]"]').val(geo.geoLocationPlace);
    }

    // Bounding box
    const box = geo.geoLocationBox;
    if (box) {
      $lastRow.find('input[name="tscLatitudeMin[]"]').val(box.southBoundLatitude ?? '');
      $lastRow.find('input[name="tscLatitudeMax[]"]').val(box.northBoundLatitude ?? '');
      $lastRow.find('input[name="tscLongitudeMin[]"]').val(box.westBoundLongitude ?? '');
      $lastRow.find('input[name="tscLongitudeMax[]"]').val(box.eastBoundLongitude ?? '');

      const rowId = $lastRow.attr('tsc-row-id');
      if (typeof window.updateMapOverlay === 'function') {
        window.updateMapOverlay(rowId, box.northBoundLatitude, box.eastBoundLongitude, box.southBoundLatitude, box.westBoundLongitude);
      }
    }

    // Point (set latMin=latMax, lonMin=lonMax)
    const point = geo.geoLocationPoint;
    if (point && !box) {
      const lat = point.pointLatitude ?? '';
      const lon = point.pointLongitude ?? '';
      $lastRow.find('input[name="tscLatitudeMin[]"]').val(lat);
      $lastRow.find('input[name="tscLatitudeMax[]"]').val(lat);
      $lastRow.find('input[name="tscLongitudeMin[]"]').val(lon);
      $lastRow.find('input[name="tscLongitudeMax[]"]').val(lon);
    }

    // Clone row for next entry
    if (i < geoLocations.length - 1) {
      $('#button-stc-add').click();
    }
  });
}

/**
 * Maps subjects to free keywords and thesaurus keyword tagify fields.
 */
function prefillKeywords(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return;

  const tagifyFree = getTagify(document.querySelector('#input-freekeyword'));
  if (!tagifyFree) return;

  const tagifyGCMD = getTagify(document.querySelector('#input-sciencekeyword'));
  const tagifyPlatforms = getTagify(document.querySelector('#input-platforms'));
  const tagifyInstruments = getTagify(document.querySelector('#input-instruments'));
  const tagifyChronostrat = getTagify(document.querySelector('#input-chronostratigraphy'));
  const tagifyGemet = getTagify(document.querySelector('#input-gemet'));
  const tagifyMsl = getTagify(document.querySelector('#input-mslkeyword'));

  subjects.forEach(s => {
    const rawKeyword = (typeof s === 'string') ? s : (s.subject || '');
    if (!rawKeyword) return;

    // Decode HTML entities (DataCite may deliver e.g. "&gt;" instead of ">")
    const keyword = decodeHtmlEntities(rawKeyword);

    const schemeURI = s.schemeURI || '';
    const subjectScheme = s.subjectScheme || '';
    const valueURI = s.valueURI || '';

    const tagData = { value: keyword, scheme: subjectScheme, schemeURI, id: valueURI };

    if (schemeURI === 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords' ||
      subjectScheme === 'NASA/GCMD Earth Science Keywords') {
      (tagifyGCMD || tagifyFree).addTags([tagData]);
    } else if (schemeURI === 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms' ||
      subjectScheme === 'NASA/GCMD Platforms') {
      (tagifyPlatforms || tagifyFree).addTags([tagData]);
    } else if (schemeURI === 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments' ||
      subjectScheme === 'NASA/GCMD Instruments') {
      (tagifyInstruments || tagifyFree).addTags([tagData]);
    } else if (
      schemeURI === 'http://resource.geosciml.org/vocabulary/timescale/gts2020' ||
      subjectScheme === 'International Chronostratigraphic Chart' ||
      subjectScheme === 'Chronostratigraphic Chart'
    ) {
      (tagifyChronostrat || tagifyFree).addTags([tagData]);
    } else if (
      schemeURI === 'http://www.eionet.europa.eu/gemet/gemetThesaurus' ||
      schemeURI === 'http://www.eionet.europa.eu/gemet/concept/' ||
      (subjectScheme && subjectScheme.includes('GEMET'))
    ) {
      (tagifyGemet || tagifyFree).addTags([tagData]);
    } else if (schemeURI.startsWith('https://epos-msl.uu.nl/voc/')) {
      (tagifyMsl || tagifyFree).addTags([tagData]);
    } else {
      tagifyFree.addTags([tagData]);
    }
  });
}

/**
 * Maps relatedIdentifiers to the Related Works form group.
 */
function prefillRelatedWorks(relatedIdentifiers) {
  if (!Array.isArray(relatedIdentifiers) || relatedIdentifiers.length === 0) return;

  const showUsedInstruments = window.ELMO_FEATURES && window.ELMO_FEATURES.showUsedInstruments;

  const entries = relatedIdentifiers.filter(ri => {
    if (showUsedInstruments && ri.relationType === 'IsCollectedBy') return false;
    return true;
  });

  entries.forEach((entry, i) => {
    const $lastRow = $('input[name="rIdentifier[]"]').last().closest('.row');

    $lastRow.find('input[name="rIdentifier[]"]').val(entry.relatedIdentifier || '');
    $lastRow.find('select[name="rIdentifierType[]"]').val(entry.relatedIdentifierType || '');

    // Match relation by visible text; DataCite uses CamelCase (e.g. "IsDocumentedBy")
    // while ELMO uses spaced form (e.g. "Is Documented By").
    const normalizedRelation = normalizeRelationType(entry.relationType);
    $lastRow.find('select[name="relation[]"]:first option').filter(function () {
      return $(this).text() === normalizedRelation || $(this).text() === entry.relationType;
    }).prop('selected', true);

    if (i < entries.length - 1) {
      $('#button-relatedwork-add').click();
    }
  });

  // Handle Used Instruments
  if (showUsedInstruments) {
    const instruments = relatedIdentifiers
      .filter(ri => ri.relationType === 'IsCollectedBy')
      .map(ri => ({
        pid: (ri.relatedIdentifier || '').trim(),
        pidType: ri.relatedIdentifierType || 'Handle',
        name: (ri.relatedIdentifier || '').trim(),
        instrumentTypes: []
      }));

    if (instruments.length > 0 && window.usedInstrumentsModule) {
      window.usedInstrumentsModule.loadInstrumentsFromAPI();
      setTimeout(() => window.usedInstrumentsModule.addInstrumentsByData(instruments), 500);
    }
  }
}

/**
 * Maps fundingReferences to the Funding form group.
 */
function prefillFunding(fundingReferences) {
  if (!Array.isArray(fundingReferences) || fundingReferences.length === 0) return;

  fundingReferences.forEach((f, i) => {
    const $lastRow = $('input[name="funder[]"]').last().closest('.row');

    $lastRow.find('input[name="funder[]"]').val(f.funderName || '');
    $lastRow.find('input[name="funderId[]"]').val(f.funderIdentifier || '');
    $lastRow.find('input[name="funderidtyp[]"]').val(f.funderIdentifierType || '');
    $lastRow.find('input[name="grantNummer[]"]').val(f.awardNumber || '');
    $lastRow.find('input[name="grantName[]"]').val(f.awardTitle || '');
    $lastRow.find('input[name="awardURI[]"]').val(f.awardURI || '');

    if (i < fundingReferences.length - 1) {
      $('#button-fundingreference-add').click();
    }
  });
}

/**
 * Maps rightsList to the license dropdown.
 */
async function prefillRights(rightsList) {
  if (!Array.isArray(rightsList) || rightsList.length === 0) return;

  const mapping = await getLicenseMapping();

  for (const rights of rightsList) {
    let identifier = rights.rightsIdentifier || '';

    // Try extracting from URI as fallback
    if (!identifier && rights.rightsUri) {
      const match = rights.rightsUri.match(/licenses\/([^/.]+)/);
      if (match) identifier = match[1];
    }

    // Compare case-insensitively (ELMO stores CC-BY-4.0, DataCite returns cc-by-4.0)
    const key = identifier.toUpperCase();
    if (key && mapping[key]) {
      $('#input-rights-license').val(mapping[key]);
      return; // Use first matching license
    }
  }
}

/* ================================================================== */
/*  Contact person email/website lookup (post-prefill)                */
/* ================================================================== */

/**
 * For each prefilled author, tries to find email/website in the local database
 * and populates the contact person fields.
 *
 * @param {Array} creators - The creators array from DataCite attributes.
 * @param {DoiLookupService} lookupService - The DOI lookup service instance.
 */
async function prefillContactPersons(creators, lookupService) {
  if (!Array.isArray(creators) || !lookupService) return;

  const authorStack = getAuthorStackController();
  if (authorStack) {
    const authors = getCurrentAuthorsPayload(authorStack).map(author => ({ ...author }));
    let changed = false;

    const promises = creators.map(creator => {
      const givenName = creator.givenName || '';
      const familyName = creator.familyName || '';
      if (!givenName && !familyName) return Promise.resolve();

      const orcid = extractCreatorOrcid(creator);

      return lookupService.lookupContacts({ orcid, familyname: familyName, givenname: givenName })
        .then(contact => {
          if (!contact || (!contact.email && !contact.website)) {
            return;
          }

          const creatorKey = normalizeNameKey(familyName, givenName);
          const author = authors.find(candidate => (
            candidate.type === 'person' && normalizeNameKey(candidate.familyname, candidate.givenname) === creatorKey
          ));

          if (!author) {
            return;
          }

          author.isContact = true;
          if (contact.email) author.email = contact.email;
          if (contact.website) author.website = contact.website;
          changed = true;
        })
        .catch(() => { /* best-effort: silently ignore lookup failures */ });
    });

    await Promise.all(promises);

    if (changed) {
      authorStack.setAuthors(authors);
    }
    return;
  }

  const $rows = $('div[data-creator-row]');
  const promises = [];

  creators.forEach((creator, i) => {
    const givenName = creator.givenName || '';
    const familyName = creator.familyName || '';
    if (!givenName && !familyName) return;

    let orcid = '';
    if (Array.isArray(creator.nameIdentifiers)) {
      const entry = creator.nameIdentifiers.find(ni => ni.nameIdentifierScheme === 'ORCID');
      if (entry) orcid = (entry.nameIdentifier || '').replace('https://orcid.org/', '');
    }

    const $row = $rows.eq(i);
    if (!$row.length) return;

    const promise = lookupService.lookupContacts({ orcid, familyname: familyName, givenname: givenName })
      .then(contact => {
        if (contact.email || contact.website) {
          $row.find('input[name="contacts[]"]').prop('checked', true);
          $row.find('.contact-person-input').show();
          if (contact.email) $row.find('input[name="cpEmail[]"]').val(contact.email);
          if (contact.website) $row.find('input[name="cpOnlineResource[]"]').val(contact.website);
        }
      })
      .catch(() => { /* best-effort: silently ignore lookup failures */ });

    promises.push(promise);
  });

  await Promise.all(promises);
}

/* ================================================================== */
/*  Main entry point                                                  */
/* ================================================================== */

/**
 * Applies all DOI prefill data to the form (called after user confirms in modal).
 *
 * @param {Object} attributes - The DataCite `data.attributes` object.
 * @param {DoiLookupService} [lookupService] - Optional service for contact person lookup.
 */
async function applyDoiPrefill(attributes, lookupService) {
  // Clear form first
  if (typeof clearInputFields === 'function') {
    clearInputFields();
  }

  // Wait for dynamic description type fields to be ready
  if (window.descriptionTypesReady) {
    await window.descriptionTypesReady;
  }

  // Synchronous prefills
  prefillResourceInfo(attributes);
  prefillCreators(attributes.creators);
  prefillContributors(attributes.contributors);
  prefillDescriptions(attributes.descriptions);
  prefillDates(attributes.dates);
  prefillGeoLocations(attributes.geoLocations);
  prefillKeywords(attributes.subjects);
  prefillRelatedWorks(attributes.relatedIdentifiers);
  prefillFunding(attributes.fundingReferences);

  // Async prefills (need API lookups for vocab mappings)
  await prefillLanguage(attributes);
  await prefillTitles(attributes.titles);
  await prefillRights(attributes.rightsList);

  // Post-prefill: look up contact person email/website from local DB
  if (lookupService && Array.isArray(attributes.creators)) {
    await prefillContactPersons(attributes.creators, lookupService);
  }
}

/* ================================================================== */
/*  Preview helper for modal rendering                                */
/* ================================================================== */

/**
 * Builds an HTML preview string for the DOI prefill confirmation modal.
 *
 * @param {Object} attributes - The DataCite attributes.
 * @returns {string} HTML string.
 */
function buildPrefillPreview(attributes) {
  const t = (key, fallback) => window.elmo?.translate?.(key) || fallback;
  const rows = [];

  // Title
  if (attributes.titles?.length) {
    rows.push(`<tr><th>${t('doiPrefill.previewTitle', 'Title')}</th><td>${escapeHtml(attributes.titles[0].title || '')}</td></tr>`);
  }

  // Authors
  if (attributes.creators?.length) {
    const names = attributes.creators.slice(0, 3).map(c => {
      if (c.givenName || c.familyName) return escapeHtml(`${c.familyName || ''}, ${c.givenName || ''}`);
      return escapeHtml(c.name || '');
    });
    let authorsStr = names.join('; ');
    if (attributes.creators.length > 3) {
      authorsStr += ` (+${attributes.creators.length - 3})`;
    }
    rows.push(`<tr><th>${t('doiPrefill.previewAuthors', 'Authors')}</th><td>${authorsStr}</td></tr>`);
  }

  // Resource type
  if (attributes.types?.resourceTypeGeneral) {
    rows.push(`<tr><th>${t('doiPrefill.previewType', 'Resource Type')}</th><td>${escapeHtml(attributes.types.resourceTypeGeneral)}</td></tr>`);
  }

  // Year
  if (attributes.publicationYear) {
    rows.push(`<tr><th>${t('doiPrefill.previewYear', 'Publication Year')}</th><td>${escapeHtml(String(attributes.publicationYear))}</td></tr>`);
  }

  // License
  if (attributes.rightsList?.length) {
    const license = attributes.rightsList[0].rights || attributes.rightsList[0].rightsIdentifier || '';
    if (license) {
      rows.push(`<tr><th>${t('doiPrefill.previewLicense', 'License')}</th><td>${escapeHtml(license)}</td></tr>`);
    }
  }

  return `<table class="table table-sm table-borderless mb-0">${rows.join('')}</table>`;
}

/**
 * Escapes HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Export for testing (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getTagify,
    decodeHtmlEntities,
    normalizeRole,
    normalizeRelationType,
    normalizeResourceTypeGeneral: resourceTypeUtils.normalizeResourceTypeGeneral,
    findResourceTypeOption: resourceTypeUtils.findResourceTypeOption,
    mapTitleTypeFromJson,
    prefillResourceInfo,
    prefillLanguage,
    prefillTitles,
    prefillCreators,
    prefillContributors,
    prefillDescriptions,
    prefillDates,
    prefillGeoLocations,
    prefillKeywords,
    prefillRelatedWorks,
    prefillFunding,
    prefillRights,
    prefillContactPersons,
    applyDoiPrefill,
    buildPrefillPreview,
    escapeHtml,
    // Expose cache resetters for testing
    _resetCaches: function () {
      _licenseMappingCache = null;
      _languageMappingCache = null;
      _titleTypeMappingCache = null;
      _roleMappingCache = null;
      _relationMappingCache = null;
    }
  };
}
