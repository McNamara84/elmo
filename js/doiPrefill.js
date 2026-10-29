/**
 * Map DataCite JSON attributes to ELMO form fields.
 *
 * This module parses the JSON response from the DataCite REST API and populates
 * the metadata editor form. Each section has its own mapping function to keep
 * the code maintainable and testable.
 *
 * Loaded as an ES module. Thesaurus targets come from THESAURUS_CONFIG.
 * applyDoiPrefill and buildPrefillPreview are also assigned to window because
 * doiPrefillHandler.js is a classic script.
 *
 * Depends on jQuery ($) and Tagify being available globally.
 */
import { THESAURUS_CONFIG } from './thesaurusConfig.js';

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

function getRelatedWorkStackController() {
  return typeof window !== 'undefined'
    && window.relatedWorkStack
    && typeof window.relatedWorkStack.setRelatedWorks === 'function'
    ? window.relatedWorkStack
    : null;
}

function normalizeRorId(value) {
  return value ? String(value).trim().replace(/^https?:\/\/ror\.org\//, '') : '';
}

/**
 * Read a normalized ORCID from a DataCite creator or contributor.
 * @param {Object} creator DataCite person with optional nameIdentifiers.
 * @returns {string} Bare ORCID, or an empty string when none is supplied.
 */
function extractCreatorOrcid(creator) {
  if (!Array.isArray(creator.nameIdentifiers)) {
    return '';
  }

  const orcidEntry = creator.nameIdentifiers.find(ni => ni.nameIdentifierScheme === 'ORCID');
  return normalizeOrcid(orcidEntry?.nameIdentifier);
}

/**
 * Normalize identifier representation for comparison without checking its checksum.
 * @param {string|null|undefined} value Bare identifier or ORCID URL.
 * @returns {string} Trimmed identifier with an uppercase check character.
 */
function normalizeOrcid(value) {
  return String(value || '').trim().replace(/^https?:\/\/orcid\.org\//i, '').toUpperCase();
}

/**
 * Preserve personal display names when DataCite omits structured names.
 * Only the explicit "family, given" format supplies missing name components.
 * @param {Object} person DataCite creator or contributor.
 * @returns {{familyname: string, givenname: string}} Names in their original spelling.
 */
function extractPersonNames(person) {
  let givenname = person.givenName || '';
  let familyname = person.familyName || '';
  if (person.nameType === 'Personal') {
    const parts = String(person.name || '').split(',').map(part => part.trim());
    if (parts.length === 2 && parts.every(Boolean)) {
      familyname ||= parts[0];
      givenname ||= parts[1];
    } else if (!givenname && !familyname) {
      // Keep an unstructured name intact for manual correction; never guess its order.
      familyname = person.name || '';
    }
  }
  return { familyname, givenname };
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

/**
 * Build ordered author entries; explicit contributor roles are applied separately.
 * @param {Object[]} creators DataCite creators in publication order.
 * @returns {Object[]} Personal and institutional author payloads.
 */
function buildAuthorsPayloadFromCreators(creators) {
  return creators
    .map(creator => {
      const { givenname, familyname } = extractPersonNames(creator);
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

/**
 * Build an exact name key tolerant of Unicode encoding, case and whitespace.
 * Keep accents and name boundaries to avoid merging distinct people.
 * @param {string|undefined} familyName Family name.
 * @param {string|undefined} givenName Given name.
 * @returns {string} Comparison key, not a display name.
 */
function normalizeDoiPersonNameKey(familyName, givenName) {
  const normalize = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  return `${normalize(familyName)}\u0000${normalize(givenName)}`;
}

// Shared JSDoc object type for the annotations below. A standalone @typedef
// describes a data structure; it does not need a function declaration.

/**
 * Identity used to match an imported contact to an author.
 * @typedef {Object} DoiContactIdentity
 * @property {string} orcid Normalized ORCID, or an empty string.
 * @property {string} familyname Family name, possibly empty.
 * @property {string} givenname Given name, possibly empty.
 */

/**
 * Resolve only an unambiguous person, with ORCID taking precedence over names.
 * An ambiguous ORCID must not fall through to a weaker name match.
 * @param {Object[]} authors Current ordered author payload.
 * @param {DoiContactIdentity} identity Normalized contact identity.
 * @returns {number} Author index, or -1 for missing, conflicting or ambiguous matches.
 */
function findContactAuthorIndex(authors, identity) {
  const people = authors.map((author, index) => ({ author, index })).filter(({ author }) => author.type === 'person');
  if (identity.orcid) {
    const matches = people.filter(({ author }) => normalizeOrcid(author.orcid) === identity.orcid);
    if (matches.length) return matches.length === 1 ? matches[0].index : -1;
  }
  if (!identity.familyname.trim() || !identity.givenname.trim()) return -1;
  const key = normalizeDoiPersonNameKey(identity.familyname, identity.givenname);
  const matches = people.filter(({ author }) => {
    const orcid = normalizeOrcid(author.orcid);
    // A name match is allowed only when at least one ORCID is missing.
    // Two different ORCIDs must keep people separate, even if their names match.
    return !(identity.orcid && orcid && identity.orcid !== orcid)
      && normalizeDoiPersonNameKey(author.familyname, author.givenname) === key;
  });
  return matches.length === 1 ? matches[0].index : -1;
}

function getCurrentAuthorsPayload(authorStack) {
  if (authorStack?.collectPayload) return authorStack.collectPayload();
  if (document.querySelector('[name="authorsPayload"]')) throw new Error('Authors form is not initialized.');
  return [];
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
  const resource = {};
  if (attr.publicationYear) resource.year = String(attr.publicationYear);
  if (attr.version) {
    const $version = $('#input-resourceinformation-version');
    resource.version = String(attr.version);
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
      if (opt) resource.resourceTypeId = opt.value;
    }
  }
  if (window.resourceInformation?.setResourceInformation) {
    window.resourceInformation.setResourceInformation(resource);
  } else {
    if (resource.year) $('#input-resourceinformation-publicationyear').val(resource.year);
    if (resource.version) $('#input-resourceinformation-version').val(resource.version);
    if (resource.resourceTypeId) $('#input-resourceinformation-resourcetype').val(resource.resourceTypeId);
  }
}

async function prefillLanguage(attr) {
  if (!attr.language) return;
  const mapping = await getLanguageMapping();
  const id = mapping[attr.language.toLowerCase()];
  if (id) {
    if (window.resourceInformation?.setResourceInformation) {
      window.resourceInformation.setResourceInformation({ languageId: id });
    } else $('#input-resourceinformation-language').val(id);
  }
}

/**
 * Maps titles from the DataCite JSON to the form.
 */
async function prefillTitles(titles) {
  if (!Array.isArray(titles) || titles.length === 0) return;
  const mapping = await getTitleTypeMapping();

  if (window.resourceInformation?.setResourceInformation) {
    window.resourceInformation.setResourceInformation({ titles: titles.map((title, position) => ({
      key: position === 0 ? 'main' : `prefill-${position}`,
      text: title.title || '',
      typeId: mapTitleTypeFromJson(title.titleType, mapping),
      position
    })) });
    return;
  }

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
 * @param {Object[]|null|undefined} creators DataCite creators.
 * @returns {void}
 * @throws {Error} When authors are supplied before the author form is initialized.
 */
function prefillCreators(creators) {
  if (!Array.isArray(creators) || creators.length === 0) return;

  const authorStack = getAuthorStackController();
  if (!authorStack) throw new Error("Authors form is not initialized.");
  const authors = buildAuthorsPayloadFromCreators(creators);
  if (authors.length > 0) {
    authorStack.setAuthors(authors);
    return;
  }

}

/**
 * Maps contributor roles, transferring explicit personal contacts to matching authors.
 * @param {Object[]|null|undefined} contributors DataCite contributors with their roles.
 * @returns {void}
 * @throws {Error} When a required form controller has not been initialized.
 */
function prefillContributors(contributors) {
  if (!Array.isArray(contributors) || contributors.length === 0) return;

  const authorStack = getAuthorStackController();
  const contributorStack = window.contributorStack;
  const entries = [];
  const byKey = new Map();
  const authors = getCurrentAuthorsPayload(authorStack).map(author => ({ ...author }));
  let authorsChanged = false;
  contributors.forEach(c => {
    const role = normalizeRole(c.contributorType || 'Other');
    const { givenname, familyname } = extractPersonNames(c);
    const person = c.nameType === 'Personal' || Boolean(givenname || familyname);
    const orcid = extractCreatorOrcid(c);
    const identity = { orcid, familyname, givenname };
    // Author contact roles also apply when the Contributors form group is disabled.
    if (role === 'Contact Person' && person) {
      const index = findContactAuthorIndex(authors, identity);
      if (index !== -1) {
        authors[index].isContact = true;
        authorsChanged = true;
        return;
      }
    }
    if (!contributorStack?.setContributors) return;
    const institutionname = c.name || '';
    // A nameless entry has no safe deduplication key; keep it separate for correction.
    const key = person
      ? (orcid || familyname || givenname ? `person:${orcid || normalizeDoiPersonNameKey(familyname, givenname)}` : Symbol())
      : `institution:${institutionname.trim().toLowerCase()}`;
    const affiliations = (c.affiliation || []).map(item => ({
      label: typeof item === 'string' ? item : (item.name || ''),
      rorId: (typeof item === 'string' ? '' : item.affiliationIdentifier || '').replace(/^https?:\/\/ror\.org\//, '')
    })).filter(item => item.label);
    let entry = byKey.get(key);
    if (!entry) {
      entry = person
        ? { type: 'person', familyname, givenname, orcid, roles: [], affiliations: [], email: '', website: '' }
        : { type: 'institution', institutionname, roles: [], affiliations: [], email: '', website: '' };
      byKey.set(key, entry);
      entries.push(entry);
    }
    if (!entry.roles.includes(role)) entry.roles.push(role);
    affiliations.forEach(item => {
      const existing = entry.affiliations.find(affiliation => affiliation.label === item.label);
      if (!existing) entry.affiliations.push(item);
      else if (!existing.rorId && item.rorId) existing.rorId = item.rorId;
    });
  });
  if (authorsChanged) authorStack.setAuthors(authors);
  if (contributorStack?.setContributors) contributorStack.setContributors(entries);
  else if (document.querySelector('[name="contributorsPayload"]')) throw new Error('Contributors form is not initialized.');
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

    // Point: Latitude Min + Longitude Min only. Max stays empty.
    const point = geo.geoLocationPoint;
    if (point && !box) {
      const lat = point.pointLatitude ?? '';
      const lon = point.pointLongitude ?? '';
      $lastRow.find('input[name="tscLatitudeMin[]"]').val(lat);
      $lastRow.find('input[name="tscLatitudeMax[]"]').val('');
      $lastRow.find('input[name="tscLongitudeMin[]"]').val(lon);
      $lastRow.find('input[name="tscLongitudeMax[]"]').val('');

      const rowId = $lastRow.attr('tsc-row-id');
      if (typeof window.updateMapOverlay === 'function' || typeof updateMapOverlay === 'function') {
        window.updateMapOverlay(rowId, '', '', lat, lon);
      }
    }

    // Clone row for next entry
    if (i < geoLocations.length - 1) {
      $('#button-stc-add').click();
    }
  });
}

/**
 * DataCite JSON uses schemeUri/valueUri. Saved XML and some callers use schemeURI/valueURI.
 * @param {Object|string} subject
 * @param {...string} keys
 * @returns {string}
 */
function subjectProperty(subject, ...keys) {
  if (!subject || typeof subject !== 'object') return '';
  for (const key of keys) {
    if (subject[key]) return subject[key];
  }
  return '';
}

/**
 * Which keyword field a DataCite subject belongs in.
 * Scheme URIs are authoritative. DataCite also labels GCMD instruments as
 * "GCMD Instruments" rather than the vocabulary's "NASA/GCMD Instruments".
 * @param {Object|string} subject
 * @returns {string}
 */
function classifyDoiSubject(subject) {
  const schemeURI = subjectProperty(subject, 'schemeURI', 'schemeUri');
  const subjectScheme = subjectProperty(subject, 'subjectScheme');

  if (schemeURI === 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords' ||
    subjectScheme === 'NASA/GCMD Earth Science Keywords') {
    return 'science_keywords';
  }
  if (schemeURI === 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms' ||
    subjectScheme === 'NASA/GCMD Platforms' ||
    subjectScheme === 'GCMD Platforms') {
    return 'platforms';
  }
  if (schemeURI === 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments' ||
    subjectScheme === 'NASA/GCMD Instruments' ||
    subjectScheme === 'GCMD Instruments') {
    return 'instruments';
  }
  if (
    schemeURI === 'http://resource.geosciml.org/vocabulary/timescale/gts2020' ||
    subjectScheme === 'International Chronostratigraphic Chart' ||
    subjectScheme === 'Chronostratigraphic Chart'
  ) {
    return 'chronostratigraphy';
  }
  if (
    schemeURI === 'http://www.eionet.europa.eu/gemet/gemetThesaurus' ||
    schemeURI === 'http://www.eionet.europa.eu/gemet/concept/' ||
    (subjectScheme && subjectScheme.includes('GEMET'))
  ) {
    return 'gemet';
  }
  if (schemeURI.startsWith('https://epos-msl.uu.nl/voc/')) {
    return 'msl';
  }
  return 'free';
}

/**
 * Adds one thesaurus keyword, rewritten to the loaded whitelist when possible.
 * The DataCite scheme name is not copied: the vocabulary entry is the scheme
 * that save writes into subjectScheme.
 * @param {Tagify} tagify
 * @param {{value: string, id: string, schemeURI: string}} tagData
 */
function addThesaurusTag(tagify, tagData) {
  const whitelist = tagify.settings?.whitelist || [];
  const resolved = typeof window.resolveThesaurusTag === 'function'
    ? window.resolveThesaurusTag(tagData, whitelist)
    : tagData;
  const settings = tagify.settings;
  const enforceWhitelist = settings?.enforceWhitelist;
  if (settings) settings.enforceWhitelist = false;
  try {
    tagify.addTags([resolved]);
  } finally {
    if (settings && enforceWhitelist !== undefined) {
      settings.enforceWhitelist = enforceWhitelist;
    }
  }
}

/**
 * Input selector for a DOI subject group.
 * MSL is outside THESAURUS_CONFIG. satellitePlatforms is dynamicOnly and has no keyword input.
 * @param {string} group
 * @returns {string}
 */
function thesaurusInputSelector(group) {
  if (group === 'msl') return '#input-mslkeyword';
  const config = THESAURUS_CONFIG[group];
  if (!config?.inputId || config.dynamicOnly) return '';
  return config.inputId.startsWith('#') ? config.inputId : `#${config.inputId}`;
}

function thesaurusTargets() {
  return Object.fromEntries(
    [...Object.keys(THESAURUS_CONFIG), 'msl']
      .map(group => [group, thesaurusInputSelector(group)])
      .filter(([, selector]) => selector)
      .map(([group, selector]) => [group, getTagify(document.querySelector(selector))])
  );
}

/**
 * Starts lazy vocabulary loading for one thesaurus that is not ready yet.
 * Returns null when there is nothing to wait for, so callers can stay synchronous.
 * @param {string} group
 * @returns {Promise<'loaded'|'error'|'timeout'|'missing'>|null}
 */
function wakeThesaurusVocabulary(group) {
  const config = THESAURUS_CONFIG[group];
  if (!config?.inputId || config.dynamicOnly) return null;
  const ready = typeof window.isThesaurusConsumerReady === 'function'
    && window.isThesaurusConsumerReady(group);
  if (ready || typeof window.waitForThesaurusVocabulary !== 'function') return null;
  return window.waitForThesaurusVocabulary(group);
}

/**
 * Maps subjects to free keywords and thesaurus keyword tagify fields.
 * Loads each targeted thesaurus first so a keyword is stored as the vocabulary's
 * full breadcrumb instead of the shorter DataCite label.
 * @param {Array<Object|string>} subjects
 * @returns {Promise<void>}
 */
async function prefillKeywords(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return;

  const tagifyFree = getTagify(document.querySelector('#input-freekeyword'));
  if (!tagifyFree) return;

  if (window.thesauriReady && typeof window.thesauriReady.then === 'function') {
    await window.thesauriReady;
  }

  const prepared = [];
  subjects.forEach(subject => {
    const rawKeyword = (typeof subject === 'string') ? subject : (subject.subject || '');
    if (!rawKeyword) return;

    // Decode HTML entities (DataCite may deliver e.g. "&gt;" instead of ">")
    const keyword = decodeHtmlEntities(rawKeyword);
    prepared.push({
      group: classifyDoiSubject(subject),
      keyword,
      schemeURI: subjectProperty(subject, 'schemeURI', 'schemeUri'),
      valueURI: subjectProperty(subject, 'valueURI', 'valueUri'),
    });
  });

  const pendingVocabularies = [...new Set(prepared.map(entry => entry.group))]
    .map(wakeThesaurusVocabulary)
    .filter(Boolean);
  if (pendingVocabularies.length > 0) {
    await Promise.all(pendingVocabularies);
  }

  const targets = thesaurusTargets();
  prepared.forEach(entry => {
    const target = entry.group === 'free' ? null : targets[entry.group];
    if (target) {
      addThesaurusTag(target, {
        value: entry.keyword,
        id: entry.valueURI,
        schemeURI: entry.schemeURI,
      });
      return;
    }
    tagifyFree.addTags([{ value: entry.keyword }]);
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

  const relatedWorkStack = getRelatedWorkStackController();
  if (relatedWorkStack) {
    relatedWorkStack.setRelatedWorks(entries.map(entry => ({
      identifier: entry.relatedIdentifier || '',
      identifierType: entry.relatedIdentifierType || '',
      relation: entry.relationType || '',
      relationId: ''
    })));
  } else {
    entries.forEach((entry, i) => {
      const $lastRow = $('input[name="rIdentifier[]"]').last().closest('.row');

      $lastRow.find('input[name="rIdentifier[]"]').val(entry.relatedIdentifier || '');
      $lastRow.find('select[name="rIdentifierType[]"]').val(entry.relatedIdentifierType || '');

      const normalizedRelation = normalizeRelationType(entry.relationType);
      $lastRow.find('select[name="relation[]"]:first option').filter(function () {
        return $(this).text() === normalizedRelation || $(this).text() === entry.relationType;
      }).prop('selected', true);

      if (i < entries.length - 1) {
        $('#button-relatedwork-add').click();
      }
    });
  }

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
/*  Main entry point                                                  */
/* ================================================================== */

/**
 * Applies all DOI prefill data to the form (called after user confirms in modal).
 * Clears previous input and retains the source DOI in the metadata search field.
 * The separate submission DOI remains empty after importing metadata.
 *
 * @param {Object} attributes - The DataCite `data.attributes` object.
 * @returns {Promise<void>} Resolves after mapping the public DataCite metadata.
 */
async function applyDoiPrefill(attributes) {
  const clearInputFields = await window.loadClearInputFields();
  clearInputFields();
  // Clearing resets both DOI fields. Keep the import source visible while the
  // submission DOI stays empty for a new dataset.
  $('#input-resourceinformation-source-doi').val(attributes.doi || '');

  // Wait for dynamic description type fields to be ready
  if (window.descriptionTypesReady) {
    await window.descriptionTypesReady;
  }
  if (window.elmo && window.elmo.dropdownsReady) {
    await window.elmo.dropdownsReady;
  }

  // Synchronous prefills
  prefillResourceInfo(attributes);
  prefillCreators(attributes.creators);
  prefillContributors(attributes.contributors);
  prefillDescriptions(attributes.descriptions);
  prefillDates(attributes.dates);
  prefillGeoLocations(attributes.geoLocations);
  prefillRelatedWorks(attributes.relatedIdentifiers);
  prefillFunding(attributes.fundingReferences);

  // Async prefills (need API lookups for vocab mappings)
  await prefillLanguage(attributes);
  await prefillTitles(attributes.titles);
  await prefillRights(attributes.rightsList);
  await prefillKeywords(attributes.subjects);
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

// doiPrefillHandler.js is a classic script and reads these as globals.
if (typeof window !== 'undefined') {
  window.applyDoiPrefill = applyDoiPrefill;
  window.buildPrefillPreview = buildPrefillPreview;
}

// Export for testing (CommonJS, after Babel rewrites the import above)
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
    classifyDoiSubject,
    prefillKeywords,
    prefillRelatedWorks,
    prefillFunding,
    prefillRights,
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
