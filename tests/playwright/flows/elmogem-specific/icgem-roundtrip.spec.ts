/**
 * ICGEM Roundtrip Test Suite
 *
 * Validates the full form cycle for ICGEM (Global Gravity Model) metadata.
 *
 * ── Test steps ────────────────────────────────────────────────────────────────
 *   step 1  Parse all fields from the reference XML in Node.js context and
 *           assert every field was successfully extracted.
 *   step 2  Fill the GEM form from parsed data, save it.
 *   step 3  Verify the downloaded XML matches the expected values field-by-field.
 *   step 4  Clear the form and assert every field is empty.
 *   step 5  Upload the downloaded XML back into the GEM and verify that the
 *           fields match the reference.
 *
 * ── How the form gets filled ─────────────────────────────────────────────────
 *   Through the application's own upload path, never by a bespoke filler. The
 *   Load button hands the file to loadXmlToForm(), which runs the DataCite
 *   mappings, processKeywords() and icgemModule.loadIcgemXmlToForm(). A field
 *   that fails to roundtrip is therefore a defect in the feature rather than an
 *   omission in this file, and a fixture's contents define what is covered.
 *
 * ── Helper / utility usage by step ───────────────────────────────────────────
 *   parseIcgemXmlFile()         step 1
 *   uploadXmlIntoForm()         step 2, step 4, step 5
 *   downloadAndSaveIcgemXml()   step 2 → produces artifact consumed by step 3
 *   extractEnvelope()           step 3
 *   extractResource()           step 3
 *   extractGravProduct()        step 3
 *   extractHcm()                step 3
 *   toArray()                   step 1, step 3
 *   extractText()               step 1, step 3
 *   findKey()                   step 1, step 3
 *   getNode()                   step 1, step 3
 *   navigateToHome()            step 2, step 4
 *
 * ── Test cases ────────────────────────────────────────────────────────────────
 *   Each entry in TEST_CASES drives a full independent roundtrip run so the
 *   suite can be extended by adding a new object to that array without touching
 *   any test or helper code.
 *
 *   The fixtures are chosen so that between them every GGM input field is
 *   exercised, including the ones that only appear behind a toggle:
 *     datasources              spherical harmonics, satellite source
 *     defferent-datasources    all five data source types with their details
 *     ellipsoidal-flattening   ellipsoidal harmonics keyed on flattening,
 *                              Isostasy source with compensation depth
 *     static-timevariable      static model, time-variable coefficients,
 *                              every description section
 *     temporal                 temporal coverage and resolution
 *     temporal-release         temporal end date, institution, release number
 *     topographic-ellipsoidal  separate crust/mantle density, semiminor axis
 *     topographic-whole        whole-model density, multi-layer/spectral options
 *
 * ── Runs under ────────────────────────────────────────────────────────────────
 *   playwright.gem.config.ts  (showGGMsProperties=true, workers capped at 2)
 *
 *   Every step saves and downloads through the single-threaded PHP dev server,
 *   so more than two workers queue those requests behind each other until save
 *   exceeds the test timeout. Both configs cap it; do not raise it via --workers.
 *
 * ── NOTE on normalisation ─────────────────────────────────────────────────────
 *   Reference XML files MUST be produced by ELMOGEM (save/download), not
 *   hand-authored.  Step 3 compares the downloaded XML values verbatim against
 *   the parsed reference values, so any casing difference will cause a false failure.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import { navigateToHome, waitForFormInteractionReady } from '../../utils';
import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

// ─── Test cases ────────────────────────────────────────────────────────────────
//
// Drop a new .xml file into testDataIcgemRoundtrip/ and it
// will be picked up automatically — no code changes needed.

interface IcgemTestCase {
  /** Human-readable label used in test titles and output filenames. */
  label: string;
  /** Absolute path to the reference XML file. */
  referenceXmlPath: string;
}

const ICGEM_ROUNDTRIP_DIR = path.join(__dirname, './testDataIcgemRoundtrip');

// Automatically discover every .xml file in the roundtrip folder.
// Drop a new file there and it will be picked up without any code change.
const TEST_CASES: IcgemTestCase[] = fs
  .readdirSync(ICGEM_ROUNDTRIP_DIR)
  .filter((f) => f.endsWith('.xml'))
  .sort()
  .map((f) => ({
    label: f.replace(/\.xml$/, ''),
    referenceXmlPath: path.join(ICGEM_ROUNDTRIP_DIR, f),
  }));

// ─── Shared output directory ───────────────────────────────────────────────────

const XML_ACTUAL_DIR = path.join(__dirname, './outputDataActual');

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CreatorPersonal {
  lastName: string;
  firstName: string;
  orcid: string;
  affiliations: string[];
}

interface CreatorOrganizational {
  name: string;
  affiliations: string[];
}

interface Subject {
  text: string;
  scheme: string;
  schemeURI: string;
  valueURI: string;
  lang: string;
}

interface DataSource {
  /** XML attribute value: 'Satellite' | 'Ground data' | 'Altimetry' | 'Model' | 'Elevation/Terrain' */
  type: string;
  description: string;
  satelliteValueName?: string;
  satelliteValueUri?: string;
  satelliteSchemeName?: string;
  satelliteSchemeUri?: string;
  /**
   * Value of the type-specific detail element (groundDetail / altimetryDetail /
   * elevationTerrainDetail / modelDetail). The form stores these verbatim as the
   * option value of select[name="datasource_details[]"].
   */
  details?: string;
  /** Only emitted for Elevation/Terrain sources whose detail is "Isostasy". */
  compensationDepth?: string;
  /** Model-type sources only. */
  identifier?: string;
  identifierType?: string;
  name?: string;
}

interface DensityInformation {
  /** 'Whole' | 'Crust' | 'Mantle' */
  domain: string;
  /** 'Constant' | 'Layer-specific' | 'Density model' */
  type: string;
  description: string;
}

interface TopographicProperties {
  layerApproach: string;
  forwardModellingDomain: string;
  approximation: string;
  densities: DensityInformation[];
}

interface EllipsoidalParameters {
  semimajorAxisA: string;
  /** Form option value of #input-second-variable. */
  secondVariable: 'axis_b' | 'flattening' | 'reciprocal_flattening' | '';
  secondVariableValue: string;
}

/**
 * GGM description sections, keyed by the lowercased `section` attribute used in
 * grav:descriptions, mapped onto the accordion panel that holds them.
 * Mirrors the section→field mapping in js/mappingXmlToInputFieldsIcgem.js.
 */
const DESCRIPTION_SECTIONS: Record<string, { input: string; collapse: string }> = {
  'abstract': { input: '#input-abstract', collapse: '#collapse-abstract' },
  'general model description': { input: '#input-general-model-description', collapse: '#collapse-general-model-description' },
  'input data': { input: '#input-input-data', collapse: '#collapse-input-data' },
  'processing procedures': { input: '#input-processing-procedures', collapse: '#collapse-processing-procedures' },
  'specific features of resulting gravity field': { input: '#input-specific-features', collapse: '#collapse-specific-features' },
  'other': { input: '#input-other', collapse: '#collapse-other' },
};

interface IcgemParsedData {
  // ── Standard DataCite ──
  doi: string;
  title: string;
  publicationYear: string;
  language: string;
  version: string;
  abstract: string;
  dateCreated: string;
  rightsIdentifier: string;
  rightsURI: string;
  personalCreators: CreatorPersonal[];
  orgCreators: CreatorOrganizational[];
  contactPersonLastName: string;
  contactPersonFirstName: string;
  contactPersonOrcid: string;
  contactPersonEmail: string;
  contactPersonWebsite: string;
  subjects: Subject[];
  // ── ICGEM-specific ──
  modelName: string;
  modelType: string;
  mathRepresentation: string;
  celestialBody: string;
  fileFormat: string;
  tideSystem: string;
  degree: string;
  errors: string;
  errorHandling: string;
  radius: string;
  earthGravityConstant: string;
  /** Reference ellipsoid, present only for Ellipsoidal harmonics models. */
  ellipsoidal: EllipsoidalParameters | null;
  /** Static models: description of the time-variable coefficients. */
  staticInfoTimeVariableCoefficients: string;
  temporalStart: string;
  temporalEnd: string;
  temporalResolution: string; // raw number of days as a string
  temporalInstitution: string;
  temporalRelease: string;
  /** Topographic models: layer approach, domain, approximation and densities. */
  topographic: TopographicProperties | null;
  dataSources: DataSource[];
  /** All grav:descriptions keyed by lowercased section attribute. */
  ggmDescriptions: Record<string, string>;
  ggmAbstract: string;
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (Array.isArray(v)) return v;
  if (v !== undefined && v !== null) return [v as T];
  return [];
}

function extractText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return extractText(v[0]);
  if (v && typeof v === 'object' && '#text' in (v as object)) {
    return String((v as Record<string, unknown>)['#text']);
  }
  return '';
}

/**
 * Looks up a key in `obj` by exact match first, then by namespace-stripped suffix.
 * e.g. findKey(obj, 'modelName') matches both 'modelName' and 'grav:modelName'.
 */
function findKey(obj: Record<string, unknown>, localName: string): string | undefined {
  if (localName in obj) return localName;
  return Object.keys(obj).find(k => k === localName || k.endsWith(`:${localName}`));
}

function getNode(obj: Record<string, unknown>, localName: string): unknown {
  const k = findKey(obj, localName);
  return k ? obj[k] : undefined;
}

/**
 * Normalises free-text values before comparison.
 *
 * Multi-line textarea values are submitted with CRLF line endings, so carriage
 * returns survive into the DataCite half of the envelope (serialised as `&#13;`)
 * while the ICGEM half is normalised to LF by ICGEMController::prepare().
 * Both sides carry identical text, so strip CR in either encoding.
 */
function normalizeText(value: string): string {
  return value.replace(/&#13;/g, '').replace(/\r/g, '');
}

/**
 * Maps an ICGEM densityInformationType ("Constant", "Layer-specific",
 * "Density model") back onto the option value used by the density selects.
 * Mirrors reverseDensityType() in js/mappingXmlToInputFieldsIcgem.js.
 */
function toDensityOptionValue(xmlValue: string): string {
  const lower = xmlValue.toLowerCase().trim();
  return lower === 'density model' ? 'density-model' : lower;
}

// ─── XML parsing ──────────────────────────────────────────────────────────────

/**
 * Parses the ICGEM reference XML file and returns a typed data object
 * containing ALL fields from the document.
 */
function parseIcgemXmlFile(xmlPath: string): IcgemParsedData {
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (_tagName: string, jpath: unknown) => {
      // Force arrays for elements that can repeat
      const alwaysArray = [
        'dace:creator',
        'dace:contributor',
        'dace:affiliation',
        'dace:subject',
        'dace:nameIdentifier',
        'dace:date',
        'dace:description',
        'grav:inputDataSource',
        'grav:description',
        'grav:topographicModelProperties',
        'grav:densityInformation',
      ];
      return typeof jpath === 'string' && alwaysArray.some(tag => jpath.endsWith(`.${tag}`) || jpath === tag);
    },
  });

  const parsed = parser.parse(xmlContent);

  const envelope = (parsed['grav:envelope'] ?? parsed['envelope']) as Record<string, unknown>;
  if (!envelope) throw new Error('parseIcgemXmlFile: could not locate <grav:envelope> root node');

  const resource = getNode(envelope, 'resource') as Record<string, unknown>;
  if (!resource) throw new Error('parseIcgemXmlFile: could not locate <dace:resource> inside envelope');

  const ggp = getNode(envelope, 'globalGravityProduct') as Record<string, unknown>;
  if (!ggp) throw new Error('parseIcgemXmlFile: could not locate <grav:globalGravityProduct> inside envelope');

  const hcm = getNode(ggp, 'harmonicCoefficientsModel') as Record<string, unknown>;
  if (!hcm) throw new Error('parseIcgemXmlFile: could not locate <grav:harmonicCoefficientsModel>');

  // ── DataCite fields ──

  const doi = extractText(getNode(resource, 'identifier'));

  const titlesNode = getNode(resource, 'titles') as Record<string, unknown> | undefined;
  const titleEl = titlesNode ? getNode(titlesNode, 'title') : undefined;
  const title = extractText(titleEl);

  const publicationYear = String((getNode(resource, 'publicationYear') as unknown) ?? '');
  const language = String((getNode(resource, 'language') as unknown) ?? '');
  const version = String((getNode(resource, 'version') as unknown) ?? '');

  // Abstract (DataCite descriptions section)
  const descriptionsNode = getNode(resource, 'descriptions') as Record<string, unknown> | undefined;
  const descList = descriptionsNode ? toArray(getNode(descriptionsNode, 'description')) : [];
  const abstractEl = descList.find((d: unknown) => (d as Record<string, unknown>)['descriptionType'] === 'Abstract');
  const abstract = normalizeText(extractText(abstractEl));

  // Date created
  const datesNode = getNode(resource, 'dates') as Record<string, unknown> | undefined;
  const dateList = datesNode ? toArray(getNode(datesNode, 'date')) : [];
  const dateCreatedEl = dateList.find((d: unknown) => (d as Record<string, unknown>)['dateType'] === 'Created');
  const dateCreated = extractText(dateCreatedEl);

  // Rights
  const rightsListNode = getNode(resource, 'rightsList') as Record<string, unknown> | undefined;
  const rightsEl = rightsListNode ? (getNode(rightsListNode, 'rights') as Record<string, unknown>) : undefined;
  const rightsIdentifier = String(rightsEl?.['rightsIdentifier'] ?? '');
  const rightsURI = String(rightsEl?.['rightsURI'] ?? '');

  // Creators
  const creatorsNode = getNode(resource, 'creators') as Record<string, unknown> | undefined;
  const creatorList = creatorsNode ? toArray(getNode(creatorsNode, 'creator')) : [];

  const personalCreators: CreatorPersonal[] = creatorList
    .filter((c: unknown) => (getNode(c as Record<string, unknown>, 'creatorName') as Record<string, unknown>)?.['nameType'] === 'Personal')
    .map((c: unknown) => {
      const cr = c as Record<string, unknown>;
      const nameIds = toArray(getNode(cr, 'nameIdentifier'));
      const orcidEntry = nameIds.find((n: unknown) => (n as Record<string, unknown>)['nameIdentifierScheme'] === 'ORCID');
      return {
        lastName: String(getNode(cr, 'familyName') ?? ''),
        firstName: String(getNode(cr, 'givenName') ?? ''),
        orcid: extractText(orcidEntry ?? getNode(cr, 'nameIdentifier')),
        affiliations: toArray(getNode(cr, 'affiliation')).map(extractText).filter(Boolean),
      };
    });

  const orgCreators: CreatorOrganizational[] = creatorList
    .filter((c: unknown) => (getNode(c as Record<string, unknown>, 'creatorName') as Record<string, unknown>)?.['nameType'] === 'Organizational')
    .map((c: unknown) => {
      const cr = c as Record<string, unknown>;
      return {
        name: extractText(getNode(cr, 'creatorName')),
        affiliations: toArray(getNode(cr, 'affiliation')).map(extractText).filter(Boolean),
      };
    });

  // Contact person (dace:contributors inside dace:resource)
  const contribsNode = getNode(resource, 'contributors') as Record<string, unknown> | undefined;
  const contribList = contribsNode ? toArray(getNode(contribsNode, 'contributor')) : [];
  const cpResource = contribList.find((c: unknown) => (c as Record<string, unknown>)['contributorType'] === 'ContactPerson') as Record<string, unknown> | undefined;
  const contactPersonLastName = String(getNode(cpResource ?? {}, 'familyName') ?? '');
  const contactPersonFirstName = String(getNode(cpResource ?? {}, 'givenName') ?? '');
  const cpOrcidList = cpResource ? toArray(getNode(cpResource, 'nameIdentifier')) : [];
  const cpOrcidEntry = cpOrcidList.find((n: unknown) => (n as Record<string, unknown>)['nameIdentifierScheme'] === 'ORCID');
  const contactPersonOrcid = extractText(cpOrcidEntry ?? cpOrcidList[0]);

  // Contact email and website (from grav:contact inside globalGravityProduct)
  const contactEl = getNode(ggp, 'contact') as Record<string, unknown> | undefined;
  const addressList = contactEl ? toArray(getNode(contactEl, 'address')) : [];
  const contactPersonEmail = extractText(addressList[0]);
  const onlineResourceList = contactEl ? toArray(getNode(contactEl, 'onlineResource')) : [];
  const contactPersonWebsite = extractText(onlineResourceList[0]);

  // Subjects / GCMD thesaurus keywords
  const subjectsNode = getNode(resource, 'subjects') as Record<string, unknown> | undefined;
  const subjects: Subject[] = subjectsNode
    ? toArray(getNode(subjectsNode, 'subject')).map((s: unknown) => {
        const sr = s as Record<string, unknown>;
        return {
          text: extractText(s),
          scheme: String(sr['subjectScheme'] ?? ''),
          schemeURI: String(sr['schemeURI'] ?? ''),
          valueURI: String(sr['valueURI'] ?? ''),
          lang: String(sr['xml:lang'] ?? ''),
        };
      })
    : [];

  // ── ICGEM-specific fields ──

  const modelName = String(getNode(hcm, 'modelName') ?? '');
  const modelType = String(getNode(hcm, 'modelType') ?? '');
  const mathRepresentation = String(getNode(hcm, 'mathematicalRepresentation') ?? '');
  const celestialBody = String(getNode(hcm, 'celestialBody') ?? '');
  const fileFormat = String(getNode(hcm, 'fileFormat') ?? '');
  const tideSystem = String(getNode(hcm, 'tideSystem') ?? '');
  const degree = String(getNode(hcm, 'degreeOrderMax') ?? '');
  const errors = String(getNode(hcm, 'errors') ?? '');
  const errorHandling = String(getNode(hcm, 'errorHandling') ?? '');
  const radius = String(getNode(hcm, 'radius') ?? '');
  const earthGravityConstant = String(getNode(hcm, 'earthGravityConstant') ?? '');

  // Reference ellipsoid. The form offers a single "second variable" slot, so the
  // first of axis b / flattening / reciprocal flattening present in the XML wins
  // (the exporter can only ever have written the one the form submitted).
  const epNode = getNode(hcm, 'ellipsoidalParameters') as Record<string, unknown> | undefined;
  let ellipsoidal: EllipsoidalParameters | null = null;
  if (epNode) {
    const secondVariableCandidates: Array<[EllipsoidalParameters['secondVariable'], string]> = [
      ['axis_b', String(getNode(epNode, 'semiminorAxisB') ?? '')],
      ['flattening', String(getNode(epNode, 'flattening') ?? '')],
      ['reciprocal_flattening', String(getNode(epNode, 'reciprocalFlattening') ?? '')],
    ];
    const [secondVariable, secondVariableValue] =
      secondVariableCandidates.find(([, value]) => value !== '') ?? ['' as const, ''];
    ellipsoidal = {
      semimajorAxisA: String(getNode(epNode, 'semimajorAxisA') ?? ''),
      secondVariable,
      secondVariableValue,
    };
  }

  // Static model properties
  const smpNode = getNode(hcm, 'staticModelProperties') as Record<string, unknown> | undefined;
  const staticInfoTimeVariableCoefficients = normalizeText(
    String(getNode(smpNode ?? {}, 'infoTimeVariableCoefficients') ?? ''),
  );

  // Temporal model properties
  const tmpNode = getNode(hcm, 'temporalModelProperties') as Record<string, unknown> | undefined;
  const temporalCoverage = String(getNode(tmpNode ?? {}, 'temporalCoverage') ?? '');
  const [rawTemporalStart = '', rawTemporalEnd = ''] = temporalCoverage.split('/');
  // The exporter writes the placeholders "unknown"/"open" when one bound is missing.
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const temporalStart = ISO_DATE.test(rawTemporalStart) ? rawTemporalStart : '';
  const temporalEnd = ISO_DATE.test(rawTemporalEnd) ? rawTemporalEnd : '';
  const temporalResolutionRaw = getNode(tmpNode ?? {}, 'temporalResolution');
  const temporalResolution = extractText(temporalResolutionRaw); // number of days
  const temporalInstitution = String(getNode(tmpNode ?? {}, 'generatingInstitution') ?? '');
  const temporalRelease = String(getNode(tmpNode ?? {}, 'release') ?? '');

  // Topographic model properties (the form can only produce a single block)
  const topNode = toArray(getNode(hcm, 'topographicModelProperties'))[0] as Record<string, unknown> | undefined;
  const topographic: TopographicProperties | null = topNode
    ? {
        layerApproach: String(getNode(topNode, 'layerApproach') ?? ''),
        forwardModellingDomain: String(getNode(topNode, 'forwardModellingDomain') ?? ''),
        approximation: String(getNode(topNode, 'approximation') ?? ''),
        densities: toArray(getNode(topNode, 'densityInformation')).map((d: unknown) => {
          const dn = d as Record<string, unknown>;
          return {
            domain: String(getNode(dn, 'densityInformationDomain') ?? ''),
            type: String(getNode(dn, 'densityInformationType') ?? ''),
            description: String(getNode(dn, 'densityInformationDescription') ?? ''),
          };
        }),
      }
    : null;

  // Data sources
  const optionalText = (node: Record<string, unknown>, localName: string): string | undefined =>
    getNode(node, localName) !== undefined ? String(getNode(node, localName)) : undefined;

  const dataSources: DataSource[] = toArray(getNode(ggp, 'inputDataSource')).map((ds: unknown) => {
    const d = ds as Record<string, unknown>;
    // Exactly one detail element is emitted, named after the source type.
    const details = optionalText(d, 'groundDetail')
      ?? optionalText(d, 'altimetryDetail')
      ?? optionalText(d, 'elevationTerrainDetail')
      ?? optionalText(d, 'modelDetail');
    return {
      type: String(d['type'] ?? 'Satellite'),
      description: String(getNode(d, 'description') ?? ''),
      satelliteValueName: optionalText(d, 'satelliteValueName'),
      satelliteValueUri: optionalText(d, 'satelliteValueUri'),
      satelliteSchemeName: optionalText(d, 'satelliteSchemeName'),
      satelliteSchemeUri: optionalText(d, 'satelliteSchemeUri'),
      details,
      compensationDepth: getNode(d, 'compensationDepth') !== undefined
        ? extractText(getNode(d, 'compensationDepth'))
        : undefined,
      identifier: optionalText(d, 'identifier'),
      identifierType: optionalText(d, 'identifierType'),
      name: optionalText(d, 'name'),
    };
  });

  // GGM descriptions, keyed by their section attribute
  const ggmDescsNode = getNode(ggp, 'descriptions') as Record<string, unknown> | undefined;
  const ggmDescList = ggmDescsNode ? toArray(getNode(ggmDescsNode, 'description')) : [];
  const ggmDescriptions: Record<string, string> = {};
  for (const d of ggmDescList) {
    const section = String((d as Record<string, unknown>)['section'] ?? '').toLowerCase();
    if (!section) continue;
    ggmDescriptions[section] = normalizeText(extractText(d));
  }
  const ggmAbstract = ggmDescriptions['abstract'] ?? '';

  return {
    doi, title, publicationYear, language, version,
    abstract, dateCreated, rightsIdentifier, rightsURI,
    personalCreators, orgCreators,
    contactPersonLastName, contactPersonFirstName, contactPersonOrcid, contactPersonEmail, contactPersonWebsite,
    subjects,
    modelName, modelType, mathRepresentation, celestialBody, fileFormat,
    tideSystem, degree, errors, errorHandling, radius, earthGravityConstant,
    ellipsoidal, staticInfoTimeVariableCoefficients,
    temporalStart, temporalEnd, temporalResolution, temporalInstitution, temporalRelease,
    topographic,
    dataSources, ggmDescriptions, ggmAbstract,
  };
}

// ─── Assertion helpers ─────────────────────────────────────────────────────────

/**
 * Asserts a numeric input's value by magnitude rather than by string.
 *
 * Radius, gravity constant and the ellipsoid parameters are stored as SQL
 * doubles, so PHP renders values of 1e14 and above in scientific notation
 * ("3.986004415E+14"). That is the same number the form was filled with.
 */
async function expectNumericValue(locator: Locator, expected: string, label: string): Promise<void> {
  await expect
    .poll(async () => Number(await locator.inputValue()), { message: label, timeout: 5_000 })
    .toBe(Number(expected));
}

/**
 * Subject labels as a deduplicated, sorted set.
 *
 * A GCMD platform that is also used as a data source satellite is exported
 * twice, because save_ggms_datasources.php ingests the satellite into
 * Thesaurus_Keywords on top of the standalone keyword. Comparing sets keeps
 * that duplication from being mistaken for a roundtrip failure.
 */
function subjectTexts(subjects: Subject[]): string[] {
  return [...new Set(subjects.map((s) => normalizeText(s.text)))].sort();
}

/** True once any Tagify instance on the page holds a tag with this label. */
function findTagifyTag(page: Page, label: string): Promise<boolean> {
  return page.evaluate((text: string) => {
    type TagifyInput = HTMLInputElement & { _tagify?: { value?: Array<{ value: string }> } };
    return Array.from(document.querySelectorAll<TagifyInput>('input')).some(
      (input) => input._tagify?.value?.some((tag) => tag.value.trim() === text),
    );
  }, label);
}

/**
 * GCMD Tagify inputs are created only after ERNIE reports those thesauri as
 * available. CI's GEM job does not have ERNIE, so stub availability as true
 * (inputs exist) and vocab fetches as 503 (import waits, then addTags with
 * enforceWhitelist off). That matches a session without ERNIE instead of
 * inventing whitelist entries.
 */
async function stubThesaurusAvailability(page: Page): Promise<void> {
  await page.route('**/api/v2/vocabs/thesauri/availability', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
        platforms: { available: true, displayName: 'GCMD Platforms' },
        instruments: { available: true, displayName: 'GCMD Instruments' },
        chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
        gemet: { available: false, displayName: 'GEMET' },
      }),
    });
  });
  // No ERNIE in GitHub CI (and often none in Docker). Stub the lazy vocab
  // fetches as unavailable so import waits on a fast 503 instead of a hanging
  // PHP proxy, then addTags with enforceWhitelist off — the same path as a
  // real session without ERNIE. Always stub here so local and CI match.
  const unavailable = {
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Thesaurus vocabulary currently unavailable' }),
  };
  for (const slug of ['gcmd-science-keywords', 'gcmd-platforms', 'gcmd-instruments']) {
    await page.route(`**/api/v2/vocabs/thesauri/${slug}`, async (route) => {
      await route.fulfill(unavailable);
    });
  }
}

async function openGemHome(page: Page): Promise<void> {
  await stubThesaurusAvailability(page);
  await navigateToHome(page);
}

// ─── Upload helper ─────────────────────────────────────────────────────────────

/**
 * Loads an XML file into the form through the application's own upload path.
 *
 * This is what drives every step of the roundtrip: the Load button hands the
 * file to loadXmlToForm(), which runs the DataCite mappings, processKeywords()
 * and – for ICGEM documents – icgemModule.loadIcgemXmlToForm(). Filling the
 * form any other way would test the test rather than the feature.
 */
async function uploadXmlIntoForm(page: Page, xmlPath: string, expectedSubjects: string[] = []): Promise<void> {
  if (!fs.existsSync(xmlPath)) {
    throw new Error(`Upload source XML not found: ${xmlPath}`);
  }

  const loadButton = page.locator('#button-form-load');
  await loadButton.waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => typeof (window as any).thesauriReady?.then === 'function');
  await page.evaluate(() => (window as any).thesauriReady);
  // thesauriReady also resolves when availability fails and no GCMD inputs
  // are created. processKeywords then skips those subjects, so wait until
  // the Tagify instances actually exist before uploading.
  await page.waitForFunction(() => {
    const science = document.querySelector('#input-sciencekeyword') as { _tagify?: unknown } | null;
    const platforms = document.querySelector('#input-platforms') as { _tagify?: unknown } | null;
    return Boolean(science?._tagify && platforms?._tagify);
  }, { timeout: 15_000 });

  await loadButton.click();

  const uploadModal = page.locator('#modal-uploadxml');
  await uploadModal.waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('#input-uploadxml-file').setInputFiles(xmlPath);

  // Model name is written at the start of loadIcgemXmlToForm. The upload
  // spinner stays up until loadXmlToForm returns, which is after keywords
  // and data sources are fully applied. Saving earlier persists whatever
  // happens to be in the POST at that moment (often satellite subjects only).
  await page.waitForFunction(
    () => {
      const modelName = document.querySelector<HTMLInputElement>('#input-model-name')?.value;
      const spinner = document.getElementById('upload-spinner-overlay');
      return Boolean(modelName) && Boolean(spinner?.classList.contains('d-none'));
    },
    { timeout: 30_000 },
  );

  // Wait until every imported subject is on a Tagify instance.
  for (const subject of expectedSubjects) {
    await expect
      .poll(() => findTagifyTag(page, subject), {
        message: `subject "${subject}" imported into a keyword field before save`,
        timeout: 20_000,
      })
      .toBe(true);
  }

  // The modal normally closes itself when showUploadToast fires; dismiss it via
  // the Bootstrap API when it does not, rather than blocking on the toast.
  if (await uploadModal.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const modalEl = document.getElementById('modal-uploadxml');
      if (!modalEl) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bsModal = (window as any).bootstrap?.Modal?.getInstance?.(modalEl);
      if (bsModal) bsModal.hide();
      else modalEl.classList.remove('show');
    });
    await uploadModal.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

// ─── Save / download helper ────────────────────────────────────────────────────

/**
 * Clicks Save, confirms the Save-As modal, intercepts the POST response,
 * writes both raw XML and parsed JSON to XML_ACTUAL_DIR, and returns both.
 */
async function downloadAndSaveIcgemXml(
  page: Page,
  testName: string,
): Promise<{ xmlContent: string; parsedXml: Record<string, unknown> }> {
  let capturedBody = '';
  let capturedStatus = 0;
  let capturedHeaders: Record<string, string> = {};

  await page.route('**/save/save_data.php', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const response = await route.fetch();
    capturedStatus = response.status();
    capturedHeaders = response.headers();
    const body = await response.body();
    capturedBody = body.toString('utf-8');
    await route.fulfill({ response, body });
  });

  const saveButton = page.locator('#button-form-save');
  await saveButton.waitFor({ state: 'visible', timeout: 5_000 });
  await saveButton.click();

  const saveModal = page.locator('#modal-saveas');
  await saveModal.waitFor({ state: 'visible', timeout: 5_000 });
  
  // Wait for CSRF token to be fetched and populated
  const filenameInput = page.locator('#input-saveas-filename');
  await filenameInput.fill(testName);

  await waitForFormInteractionReady(page, 'save');

  await page.locator('#button-saveas-save').click();

  await page.waitForResponse(
    resp => resp.url().includes('/save/save_data.php') && resp.request().method() === 'POST',
    { timeout: 30_000 },
  );

  await page.unroute('**/save/save_data.php');

  if (capturedStatus !== 200 || capturedBody.trim().length === 0) {
    const headerStr = Object.entries(capturedHeaders).map(([k, v]) => `${k}: ${v}`).join(', ');
    throw new Error(
      `Save endpoint returned unexpected response.\n` +
      `  Status: ${capturedStatus}\n` +
      `  Body length: ${capturedBody.length} (trimmed: ${capturedBody.trim().length})\n` +
      `  Headers: ${headerStr}\n` +
      `  Body (first 500 chars): ${JSON.stringify(capturedBody.slice(0, 500))}`,
    );
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (_tagName: string, jpath: unknown) => {
      const alwaysArray = [
        'dace:creator', 'creator',
        'dace:contributor', 'contributor',
        'dace:affiliation', 'affiliation',
        'dace:subject', 'subject',
        'dace:nameIdentifier', 'nameIdentifier',
        'dace:date', 'date',
        'dace:description', 'description',
        'grav:inputDataSource', 'inputDataSource',
        'grav:description',
      ];
      return typeof jpath === 'string' && alwaysArray.some(tag => jpath.endsWith(`.${tag}`) || jpath === tag);
    },
  });

  const parsedXml = parser.parse(capturedBody) as Record<string, unknown>;

  fs.writeFileSync(path.join(XML_ACTUAL_DIR, `${testName}.xml`), capturedBody, 'utf-8');
  fs.writeFileSync(path.join(XML_ACTUAL_DIR, `${testName}.json`), JSON.stringify(parsedXml, null, 2), 'utf-8');

  return { xmlContent: capturedBody, parsedXml };
}

// ─── Parsed XML navigation helpers ────────────────────────────────────────────

function extractEnvelope(parsedXml: Record<string, unknown>): Record<string, unknown> | null {
  if (!parsedXml || typeof parsedXml !== 'object') return null;
  const key = findKey(parsedXml, 'envelope');
  return key ? (parsedXml[key] as Record<string, unknown>) : null;
}

function extractResource(envelope: Record<string, unknown>): Record<string, unknown> | null {
  const key = findKey(envelope, 'resource');
  return key ? (envelope[key] as Record<string, unknown>) : null;
}

function extractGravProduct(envelope: Record<string, unknown>): Record<string, unknown> | null {
  const key = findKey(envelope, 'globalGravityProduct');
  return key ? (envelope[key] as Record<string, unknown>) : null;
}

function extractHcm(ggp: Record<string, unknown>): Record<string, unknown> | null {
  const key = findKey(ggp, 'harmonicCoefficientsModel');
  return key ? (ggp[key] as Record<string, unknown>) : null;
}

// ─── Parsed data (module-level constant – synchronous, no browser) ─────────────

// ─── Tests ────────────────────────────────────────────────────────────────────

for (const testCase of TEST_CASES) {
  const parsedData = parseIcgemXmlFile(testCase.referenceXmlPath);

  test.describe.serial(`ICGEM roundtrip – ${testCase.label}`, () => {

  test.beforeAll(() => {
    if (!fs.existsSync(testCase.referenceXmlPath)) {
      throw new Error(`[PREREQUISITE] Reference XML missing: ${testCase.referenceXmlPath}`);
    }
    fs.mkdirSync(XML_ACTUAL_DIR, { recursive: true });
    fs.rmSync(path.join(XML_ACTUAL_DIR, `${testCase.label}.xml`), { force: true });
    fs.rmSync(path.join(XML_ACTUAL_DIR, `${testCase.label}.json`), { force: true });
  });

  // ── Step 1: parse validation ────────────────────────────────────────────

  test('Step 1 – parse: all expected fields extracted from reference XML', () => {
    // DataCite
    // Note: DOI is parsed but not used in form-fill tests (will remain empty)
    expect(parsedData.title, 'title').not.toBe('');
    expect(parsedData.publicationYear, 'publicationYear').not.toBe('');
    expect(parsedData.language, 'language').not.toBe('');
    // version, abstract, dateCreated are optional – not all ICGEM records include them
    if (parsedData.version) expect(parsedData.version, 'version').not.toBe('');
    expect(parsedData.abstract, 'abstract').not.toBe('');
    expect(parsedData.dateCreated, 'dateCreated').not.toBe('');
    expect(parsedData.rightsIdentifier, 'rightsIdentifier').not.toBe('');
    expect(parsedData.rightsURI, 'rightsURI').not.toBe('');

    // Creators
    expect(parsedData.personalCreators.length, 'personalCreators.length').toBeGreaterThan(0);
    for (const [i, c] of parsedData.personalCreators.entries()) {
      expect(c.lastName, `personalCreators[${i}].lastName`).not.toBe('');
      expect(c.firstName, `personalCreators[${i}].firstName`).not.toBe('');
      if (c.orcid) expect(c.orcid, `personalCreators[${i}].orcid`).not.toBe(''); // ORCID is optional
      // affiliations are optional – some records list creators without affiliation
      if (c.affiliations.length > 0) {
        for (const aff of c.affiliations) expect(aff, `personalCreators[${i}].affiliation`).not.toBe('');
      }
    }
    if (parsedData.orgCreators.length > 0) {
      for (const [i, c] of parsedData.orgCreators.entries()) {
        expect(c.name, `orgCreators[${i}].name`).not.toBe('');
        expect(c.affiliations.length, `orgCreators[${i}].affiliations.length`).toBeGreaterThan(0);
      }
    }

    // Contact person – email is required, website is optional
    if (parsedData.contactPersonLastName) expect(parsedData.contactPersonLastName, 'contactPersonLastName').not.toBe('');
    expect(parsedData.contactPersonEmail, 'contactPersonEmail').not.toBe('');

    // Subjects (GCMD keywords)
    expect(parsedData.subjects.length, 'subjects.length').toBeGreaterThan(0);
    for (const [i, s] of parsedData.subjects.entries()) {
      expect(s.text, `subjects[${i}].text`).not.toBe('');
      if (s.scheme) expect(s.scheme, `subjects[${i}].scheme`).not.toBe('');
      if (s.scheme) expect(s.valueURI, `subjects[${i}].valueURI`).not.toBe('');
    }

    // ICGEM core
    expect(parsedData.modelName, 'modelName').not.toBe('');
    expect(parsedData.modelType, 'modelType').not.toBe('');
    expect(parsedData.mathRepresentation, 'mathRepresentation').not.toBe('');
    expect(parsedData.celestialBody, 'celestialBody').not.toBe('');
    expect(parsedData.fileFormat, 'fileFormat').not.toBe('');
    expect(parsedData.tideSystem, 'tideSystem').not.toBe('');
    expect(parsedData.degree, 'degree').not.toBe('');
    expect(parsedData.errors, 'errors').not.toBe('');
    // radius only applies to Spherical harmonics models
    if (parsedData.mathRepresentation.toLowerCase().includes('spherical')) {
      expect(parsedData.radius, 'radius').not.toBe('');
    }
    expect(parsedData.earthGravityConstant, 'earthGravityConstant').not.toBe('');

    // Reference ellipsoid replaces the radius for Ellipsoidal harmonics models
    if (parsedData.mathRepresentation.toLowerCase().includes('ellipsoidal')) {
      expect(parsedData.ellipsoidal, 'ellipsoidalParameters').not.toBeNull();
      expect(parsedData.ellipsoidal!.semimajorAxisA, 'semimajorAxisA').not.toBe('');
      expect(parsedData.ellipsoidal!.secondVariable, 'secondVariable').not.toBe('');
      expect(parsedData.ellipsoidal!.secondVariableValue, 'secondVariableValue').not.toBe('');
    }

    // temporal fields only apply to Temporal model type
    if (parsedData.modelType.toLowerCase() === 'temporal') {
      expect(parsedData.temporalStart, 'temporalStart').not.toBe('');
      expect(parsedData.temporalResolution, 'temporalResolution').not.toBe('');
    }

    // Topographic models must describe layer approach, domain and density
    if (parsedData.modelType.toLowerCase() === 'topographic') {
      expect(parsedData.topographic, 'topographicModelProperties').not.toBeNull();
      expect(parsedData.topographic!.layerApproach, 'layerApproach').not.toBe('');
      expect(parsedData.topographic!.forwardModellingDomain, 'forwardModellingDomain').not.toBe('');
      expect(parsedData.topographic!.densities.length, 'densityInformation.length').toBeGreaterThan(0);
      for (const [i, d] of parsedData.topographic!.densities.entries()) {
        expect(d.domain, `densityInformation[${i}].domain`).not.toBe('');
        expect(d.type, `densityInformation[${i}].type`).not.toBe('');
      }
      // The whole-model density and the crust/mantle pair are mutually exclusive
      const domains = parsedData.topographic!.densities.map(d => d.domain.toLowerCase());
      if (domains.includes('crust') || domains.includes('mantle')) {
        expect(domains, 'densityInformation domains (separate density excludes Whole)').not.toContain('whole');
      }
    }

    // Data sources
    expect(parsedData.dataSources.length, 'dataSources.length').toBeGreaterThan(0);
    for (const [i, ds] of parsedData.dataSources.entries()) {
      expect(ds.type, `dataSources[${i}].type`).not.toBe('');
      // description may be legitimately empty in some XMLs (e.g. temporal model)
      if (ds.satelliteValueName) expect(ds.satelliteValueName, `dataSources[${i}].satelliteValueName`).toBeTruthy();
      if (ds.satelliteValueUri) expect(ds.satelliteValueUri, `dataSources[${i}].satelliteValueUri`).toBeTruthy();
    }

    // GGM descriptions – Abstract is mandatory, the other sections are optional
    expect(parsedData.ggmAbstract, 'ggmAbstract').not.toBe('');
    for (const section of Object.keys(parsedData.ggmDescriptions)) {
      expect(Object.keys(DESCRIPTION_SECTIONS), `description section "${section}"`).toContain(section);
      expect(parsedData.ggmDescriptions[section], `description "${section}"`).not.toBe('');
    }

    console.log('✓ 1.1 – all reference XML fields parsed successfully');
    console.log('  Title:', parsedData.title);
    console.log('  Model name:', parsedData.modelName);
    console.log('  Model type:', parsedData.modelType);
    console.log('  Subjects count:', parsedData.subjects.length);
    console.log('  Data sources count:', parsedData.dataSources.length);
  });

  // ── Step 2: fill form → save → verify XML ──────────────────────────────

  test('Step 2 – fill form from parsed data, save, and verify saved XML', async ({ page }) => {
    await openGemHome(page);
    await uploadXmlIntoForm(page, testCase.referenceXmlPath, subjectTexts(parsedData.subjects));

    const { parsedXml } = await downloadAndSaveIcgemXml(page, testCase.label);

    const envelope = extractEnvelope(parsedXml);
    expect(envelope, 'XML envelope node').toBeTruthy();

    const resource = extractResource(envelope!);
    expect(resource, 'DataCite resource node').toBeTruthy();

    const ggp = extractGravProduct(envelope!);
    expect(ggp, 'grav:globalGravityProduct node').toBeTruthy();

    const hcm = extractHcm(ggp!);
    expect(hcm, 'harmonicCoefficientsModel node').toBeTruthy();

    // Helper: assert a single field with a meaningful label
    function assertField(actualRaw: unknown, expectedValue: string, fieldLabel: string): void {
      expect(normalizeText(extractText(actualRaw)), `[FIELD: ${fieldLabel}]`).toBe(normalizeText(expectedValue));
    }

    // ── DataCite fields ──
    const titlesNode = getNode(resource!, 'titles') as Record<string, unknown>;
    assertField(getNode(titlesNode, 'title'), parsedData.title, 'title');

    assertField(
      getNode(resource!, 'publicationYear'),
      parsedData.publicationYear,
      'publicationYear',
    );

    assertField(getNode(resource!, 'language'), parsedData.language, 'language');

    // Abstract
    const descs = getNode(resource!, 'descriptions') as Record<string, unknown> | undefined;
    const descItems = descs ? toArray(getNode(descs, 'description')) : [];
    const savedAbstract = descItems.find(
      (d: unknown) => (d as Record<string, unknown>)['descriptionType'] === 'Abstract',
    );
    assertField(savedAbstract, parsedData.abstract, 'abstract');

    // Date created
    const datesNode = getNode(resource!, 'dates') as Record<string, unknown> | undefined;
    const dateItems = datesNode ? toArray(getNode(datesNode, 'date')) : [];
    const savedCreatedDate = dateItems.find(
      (d: unknown) => (d as Record<string, unknown>)['dateType'] === 'Created',
    );
    assertField(savedCreatedDate, parsedData.dateCreated, 'dateCreated');

    // ── ICGEM fields ──
    assertField(getNode(hcm!, 'modelName'), parsedData.modelName, 'modelName');
    assertField(getNode(hcm!, 'modelType'), parsedData.modelType, 'modelType');
    assertField(getNode(hcm!, 'mathematicalRepresentation'), parsedData.mathRepresentation, 'mathematicalRepresentation');
    assertField(getNode(hcm!, 'celestialBody'), parsedData.celestialBody, 'celestialBody');
    assertField(getNode(hcm!, 'fileFormat'), parsedData.fileFormat, 'fileFormat');
    assertField(getNode(hcm!, 'tideSystem'), parsedData.tideSystem, 'tideSystem');
    assertField(getNode(hcm!, 'degreeOrderMax'), parsedData.degree, 'degreeOrderMax');
    assertField(getNode(hcm!, 'earthGravityConstant'), parsedData.earthGravityConstant, 'earthGravityConstant');

    // Errors: saved XML preserves the original capitalisation from the form option text ("No")
    assertField(getNode(hcm!, 'errors'), parsedData.errors, 'errors');

    if (parsedData.errorHandling) {
      assertField(getNode(hcm!, 'errorHandling'), parsedData.errorHandling, 'errorHandling');
    }

    // Radius (may be absent if math representation is not Spherical harmonics)
    const savedRadius = extractText(getNode(hcm!, 'radius'));
    if (parsedData.radius) {
      expect(savedRadius, '[FIELD: radius]').toBe(parsedData.radius);
    }

    // Reference ellipsoid
    if (parsedData.ellipsoidal) {
      const savedEp = getNode(hcm!, 'ellipsoidalParameters') as Record<string, unknown> | undefined;
      expect(savedEp, '[FIELD: ellipsoidalParameters]').toBeTruthy();
      assertField(getNode(savedEp!, 'semimajorAxisA'), parsedData.ellipsoidal.semimajorAxisA, 'semimajorAxisA');

      const secondVariableElement: Record<string, string> = {
        axis_b: 'semiminorAxisB',
        flattening: 'flattening',
        reciprocal_flattening: 'reciprocalFlattening',
      };
      const elementName = secondVariableElement[parsedData.ellipsoidal.secondVariable];
      if (elementName) {
        assertField(getNode(savedEp!, elementName), parsedData.ellipsoidal.secondVariableValue, elementName);
      }
    }

    // Static model properties
    if (parsedData.staticInfoTimeVariableCoefficients) {
      const savedStatic = getNode(hcm!, 'staticModelProperties') as Record<string, unknown> | undefined;
      expect(savedStatic, '[FIELD: staticModelProperties]').toBeTruthy();
      assertField(
        getNode(savedStatic!, 'infoTimeVariableCoefficients'),
        parsedData.staticInfoTimeVariableCoefficients,
        'infoTimeVariableCoefficients',
      );
    }

    // Temporal coverage – check start date
    const tmpNode = getNode(hcm!, 'temporalModelProperties') as Record<string, unknown> | undefined;
    if (tmpNode) {
      const coverage = extractText(getNode(tmpNode, 'temporalCoverage'));
      const [savedStart, savedEnd] = coverage.split('/');
      expect(savedStart, '[FIELD: temporalStart]').toBe(parsedData.temporalStart);
      if (parsedData.temporalEnd) {
        expect(savedEnd, '[FIELD: temporalEnd]').toBe(parsedData.temporalEnd);
      }

      // Temporal resolution
      const savedResolution = extractText(getNode(tmpNode, 'temporalResolution'));
      expect(savedResolution, '[FIELD: temporalResolution]').toBe(parsedData.temporalResolution);

      if (parsedData.temporalInstitution) {
        assertField(getNode(tmpNode, 'generatingInstitution'), parsedData.temporalInstitution, 'generatingInstitution');
      }
      if (parsedData.temporalRelease) {
        assertField(getNode(tmpNode, 'release'), parsedData.temporalRelease, 'release');
      }
    }

    // Topographic model properties
    if (parsedData.topographic) {
      const savedTopo = toArray(getNode(hcm!, 'topographicModelProperties'))[0] as Record<string, unknown> | undefined;
      expect(savedTopo, '[FIELD: topographicModelProperties]').toBeTruthy();
      assertField(getNode(savedTopo!, 'layerApproach'), parsedData.topographic.layerApproach, 'layerApproach');
      assertField(getNode(savedTopo!, 'forwardModellingDomain'), parsedData.topographic.forwardModellingDomain, 'forwardModellingDomain');
      if (parsedData.topographic.approximation) {
        assertField(getNode(savedTopo!, 'approximation'), parsedData.topographic.approximation, 'approximation');
      }

      const savedDensities = toArray(getNode(savedTopo!, 'densityInformation')) as Record<string, unknown>[];
      expect(savedDensities.length, '[FIELD: densityInformation.length]').toBe(parsedData.topographic.densities.length);
      for (const expectedDensity of parsedData.topographic.densities) {
        const savedDensity = savedDensities.find(
          d => extractText(getNode(d, 'densityInformationDomain')).toLowerCase() === expectedDensity.domain.toLowerCase(),
        );
        expect(savedDensity, `[FIELD: densityInformation(${expectedDensity.domain})]`).toBeTruthy();
        assertField(
          getNode(savedDensity!, 'densityInformationType'),
          expectedDensity.type,
          `densityInformation(${expectedDensity.domain}).type`,
        );
        if (expectedDensity.description) {
          assertField(
            getNode(savedDensity!, 'densityInformationDescription'),
            expectedDensity.description,
            `densityInformation(${expectedDensity.domain}).description`,
          );
        }
      }
    }

    // Data sources count and fields
    const savedDsSources = toArray(getNode(ggp!, 'inputDataSource'));
    expect(savedDsSources.length, '[FIELD: dataSources.length]').toBe(parsedData.dataSources.length);
    for (let i = 0; i < parsedData.dataSources.length; i++) {
      const ref = parsedData.dataSources[i];
      const actual = savedDsSources[i] as Record<string, unknown>;
      expect(String(actual['type'] ?? ''), `[FIELD: dataSources[${i}].type]`).toBe(ref.type);
      const actual_description = extractText(getNode(actual, 'description'));
      console.log(`Data source ${i} description:`, actual_description, `(expected: ${ref.description})`);
      expect(actual_description, `[FIELD: dataSources[${i}].description]`).toBe(ref.description);
      
      if (ref.satelliteValueName) {
        expect(
          extractText(getNode(actual, 'satelliteValueName')),
          `[FIELD: dataSources[${i}].satelliteValueName]`,
        ).toBe(ref.satelliteValueName);
      }

      // Type-specific detail element, named after the source type
      if (ref.details) {
        const detailElement = {
          'Ground data': 'groundDetail',
          'Altimetry': 'altimetryDetail',
          'Elevation/Terrain': 'elevationTerrainDetail',
          'Model': 'modelDetail',
        }[ref.type];
        expect(detailElement, `[FIELD: dataSources[${i}] detail element for type ${ref.type}]`).toBeTruthy();
        expect(
          extractText(getNode(actual, detailElement!)),
          `[FIELD: dataSources[${i}].${detailElement}]`,
        ).toBe(ref.details);
      }

      if (ref.compensationDepth) {
        expect(
          extractText(getNode(actual, 'compensationDepth')),
          `[FIELD: dataSources[${i}].compensationDepth]`,
        ).toBe(ref.compensationDepth);
      }

      for (const [key, element] of [['identifier', 'identifier'], ['identifierType', 'identifierType'], ['name', 'name']] as const) {
        const expectedValue = ref[key];
        if (!expectedValue) continue;
        expect(
          extractText(getNode(actual, element)),
          `[FIELD: dataSources[${i}].${element}]`,
        ).toBe(expectedValue);
      }
    }

    // GGM descriptions – every section present in the reference must survive
    const savedGgmDescs = getNode(ggp!, 'descriptions') as Record<string, unknown> | undefined;
    const savedGgmDescList = savedGgmDescs ? toArray(getNode(savedGgmDescs, 'description')) : [];
    for (const [section, expectedContent] of Object.entries(parsedData.ggmDescriptions)) {
      const savedDesc = savedGgmDescList.find(
        d => String((d as Record<string, unknown>)['section'] ?? '').toLowerCase() === section,
      );
      expect(savedDesc, `[FIELD: description section "${section}"]`).toBeTruthy();
      assertField(savedDesc, expectedContent, `description(${section})`);
    }

    // Subjects – thesaurus keywords, free keywords and data source satellites
    // all converge into dace:subjects, so compare the whole set at once.
    const savedSubjectsNode = getNode(resource!, 'subjects') as Record<string, unknown> | undefined;
    const savedSubjectTexts = savedSubjectsNode
      ? [...new Set(toArray(getNode(savedSubjectsNode, 'subject')).map((s) => normalizeText(extractText(s))))].sort()
      : [];
    expect(savedSubjectTexts, '[FIELD: subjects]').toEqual(subjectTexts(parsedData.subjects));

    console.log('✓ 1.2 + 2.1 – form fill and save XML verification passed');
  });

  // ── Step 3: fill form → clear → assert all fields empty ────────────────

  test('Step 3 – fill form, clear, assert all fields empty', async ({ page }) => {
    await openGemHome(page);
    await uploadXmlIntoForm(page, testCase.referenceXmlPath, subjectTexts(parsedData.subjects));

    // Trigger clear form flow
    await page.locator('#button-form-reset').click();
    await page.locator('#modal-confirm').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('#button-confirm-action').click();

    // Wait for the form to be visibly reset (model name is a reliable sentinel)
    await page.waitForFunction(
      () => (document.querySelector<HTMLInputElement>('#input-model-name'))?.value === '',
      { timeout: 10_000 },
    );

    // ── Standard DataCite fields ───────────────────────────────────────────
    await expect(page.locator('#input-resourceinformation-doi'), 'DOI').toHaveValue('');
    await expect(page.locator('#input-resourceinformation-title'), 'title').toHaveValue('');
    await expect(page.locator('#input-resourceinformation-publicationyear'), 'publicationYear').toHaveValue('');
    await expect(page.locator('#input-resourceinformation-version'), 'version').toHaveValue('');
    await expect(page.locator('#input-abstract'), 'abstract').toHaveValue('');
    await expect(page.locator('#input-date-created'), 'dateCreated').toHaveValue('');

    await expect(page.locator('#group-author [data-author-entry-row]'), 'authors after clear').toHaveCount(0);
    await expect(page.locator('[data-author-summary-count]'), 'authors summary after clear').toContainText(/0\s+(entries|Einträge)/i);

    // ── ICGEM Definition fields ────────────────────────────────────────────
    await expect(page.locator('#input-model-name'), 'modelName').toHaveValue('');
    await expect(page.locator('#input-model-type'), 'modelType').toHaveValue('');
    await expect(page.locator('#input-mathematical-representation'), 'mathRepresentation').toHaveValue('');
    await expect(page.locator('#input-file-format'), 'fileFormat').toHaveValue('');

    // Celestial body resets to "Earth" (the default selected option) or ''
    const celestialBodyVal = await page.locator('#input-celestial-body').inputValue();
    expect(['', 'Earth'], 'celestialBody after reset').toContain(celestialBodyVal);

    // ── ICGEM Properties fields ────────────────────────────────────────────
    await expect(page.locator('#input-tide-system'), 'tideSystem').toHaveValue('');
    await expect(page.locator('#input-degree'), 'degree').toHaveValue('');
    await expect(page.locator('#input-errors'), 'errors').toHaveValue('');
    await expect(page.locator('#input-earth-gravity-constant'), 'earthGravityConstant').toHaveValue('');

    // Radius might be hidden; check if the input exists and is empty
    const radiusVal = await page.locator('#input-radius').inputValue().catch(() => '');
    expect(radiusVal, 'radius').toBe('');

    await expect(page.locator('#input-error-handling-approach'), 'errorHandling').toHaveValue('');

    // ── Reference ellipsoid ────────────────────────────────────────────────
    await expect(page.locator('#input-semimajor-axis'), 'semimajorAxisA').toHaveValue('');
    await expect(page.locator('#input-second-variable'), 'secondVariable').toHaveValue('');
    await expect(page.locator('#input-second-variable-value'), 'secondVariableValue').toHaveValue('');

    // ── ICGEM Static fields ────────────────────────────────────────────────
    const timeVariableChecked = await page.locator('#checkbox-time-variable').isChecked().catch(() => false);
    expect(timeVariableChecked, 'timeVariable checkbox').toBe(false);
    await expect(page.locator('#input-static-description'), 'staticDescription').toHaveValue('');

    // ── ICGEM Temporal fields ──────────────────────────────────────────────
    await expect(page.locator('#input-temporal-start'), 'temporalStart').toHaveValue('');
    await expect(page.locator('#input-temporal-end'), 'temporalEnd').toHaveValue('');
    await expect(page.locator('#select-temporal-frequency-predef'), 'temporalFrequencyPredef').toHaveValue('');
    await expect(page.locator('#input-temporal-frequency'), 'temporalFrequency').toHaveValue('');
    await expect(page.locator('#input-temporal-institution'), 'temporalInstitution').toHaveValue('');
    await expect(page.locator('#input-release-number'), 'releaseNumber').toHaveValue('');

    // Custom frequency checkbox should be unchecked after reset
    const freqChecked = await page.locator('#checkbox-custom-frequency').isChecked().catch(() => false);
    expect(freqChecked, 'customFrequency checkbox').toBe(false);

    // ── ICGEM Topographic fields ───────────────────────────────────────────
    await expect(page.locator('#select-topo-layerapproach'), 'topoLayerApproach').toHaveValue('');
    await expect(page.locator('#select-topo-domain'), 'topoDomain').toHaveValue('');
    await expect(page.locator('#select-topo-approximation'), 'topoApproximation').toHaveValue('');
    await expect(page.locator('#select-topo-density'), 'topoDensity').toHaveValue('');
    await expect(page.locator('#input-topo-density-details'), 'topoDensityDetails').toHaveValue('');
    const separateDensityChecked = await page.locator('#checkbox-separate-density').isChecked().catch(() => false);
    expect(separateDensityChecked, 'separateDensity checkbox').toBe(false);
    await expect(page.locator('#select-topo-density-crust'), 'topoDensityCrust').toHaveValue('');
    await expect(page.locator('#input-topo-density-details-crust'), 'topoDensityDetailsCrust').toHaveValue('');
    await expect(page.locator('#select-topo-density-mantle'), 'topoDensityMantle').toHaveValue('');
    await expect(page.locator('#input-topo-density-details-mantle'), 'topoDensityDetailsMantle').toHaveValue('');

    // ── Data sources: back to 1 default empty row ──────────────────────────
    const dsRows = page.locator('#group-datasources .row[data-source-row]');
    await expect(dsRows, 'dataSources row count after clear').toHaveCount(1, { timeout: 5_000 });
    const firstDsRow = dsRows.first();
    await expect(
      firstDsRow.locator('textarea[name="datasource_description[]"]'),
      'datasource[0] description after clear',
    ).toHaveValue('');
    await expect(firstDsRow.locator('input[name="dIdentifier[]"]'), 'datasource[0] identifier after clear').toHaveValue('');
    await expect(firstDsRow.locator('input[name="dName[]"]'), 'datasource[0] model name after clear').toHaveValue('');
    await expect(firstDsRow.locator('input[name="compensation_depth[]"]'), 'datasource[0] compensation depth after clear').toHaveValue('');

    // ── Descriptions ───────────────────────────────────────────────────────
    for (const { input } of Object.values(DESCRIPTION_SECTIONS)) {
      await expect(page.locator(input), `description ${input}`).toHaveValue('');
    }

    console.log('✓ 3 + 3.1 – clear-form verification passed');
  });

  // ── Step 4: fill form → save → upload saved XML → assert form values ────

  test('Step 4 – upload saved XML, assert form values match', async ({ page }) => {
    const savedXmlPath = path.join(XML_ACTUAL_DIR, `${testCase.label}.xml`);
    if (!fs.existsSync(savedXmlPath)) {
      throw new Error(`[PREREQUISITE] Saved XML not found – run Step 2 first: ${savedXmlPath}`);
    }

    // Upload the SAVED XML produced by Step 2, not the reference XML
    await openGemHome(page);
    await uploadXmlIntoForm(page, savedXmlPath, subjectTexts(parsedData.subjects));

    // ── Standard DataCite fields ───────────────────────────────────────────
    await expect(page.locator('#input-resourceinformation-title'), 'title').toHaveValue(parsedData.title);
    await expect(page.locator('#input-resourceinformation-publicationyear'), 'publicationYear').toHaveValue(parsedData.publicationYear);
    await expect(page.locator('#input-resourceinformation-version'), 'version').toHaveValue(parsedData.version);
    // The abstract is restored from grav:descriptions (ICGEM uploads skip the
    // DataCite description mapping), so it is asserted with the other sections below.
    await expect(page.locator('#input-date-created'), 'dateCreated').toHaveValue(parsedData.dateCreated);

    // DOI is populated from XML by the upload handler
    await expect(page.locator('#input-resourceinformation-doi'), 'doi').toHaveValue(parsedData.doi);

    // Author: first personal creator
    if (parsedData.personalCreators.length > 0) {
      const pc = parsedData.personalCreators[0];
      const authorRow = page.locator('#group-author [data-creator-row]').first();

      await expect(authorRow.locator('[id^="input-author-lastname"]'), 'author lastName').toHaveValue(pc.lastName);
      await expect(authorRow.locator('[id^="input-author-firstname"]'), 'author firstName').toHaveValue(pc.firstName);

      // ORCID value may include the full URL or just the number
      const orcidValue = await authorRow.locator('[id^="input-author-orcid"]').inputValue();
      expect(orcidValue, 'author ORCID').toContain(pc.orcid);

      // Affiliations – verify all affiliations appear in the Authors affiliation editor
      if (pc.affiliations.length > 0) {
        const affiliationLabels = await authorRow.locator('[data-author-affiliation-label]').evaluateAll(
          (inputs) => inputs.map((input) => (input as HTMLInputElement).value),
        );
        const combined = affiliationLabels.join('\n');
        for (const aff of pc.affiliations) {
          expect(combined, `author affiliation: "${aff}"`).toContain(aff);
        }
      }
    }

    // Contact person email (required) and website (optional).
    // Email comes from grav:contact/grav:address; the matching author is the
    // row whose contact checkbox was checked, not necessarily the first creator.
    const contactRow = page.locator('#group-author [data-creator-row]').filter({
      has: page.locator('input[name="contacts[]"]:checked'),
    }).first();
    await expect(
      contactRow.locator('input[name="cpEmail[]"]'),
      'contactPersonEmail',
    ).toHaveValue(parsedData.contactPersonEmail, { timeout: 5_000 });
    if (parsedData.contactPersonWebsite) {
      await expect(
        contactRow.locator('input[name="cpOnlineResource[]"]'),
        'contactPersonWebsite',
      ).toHaveValue(parsedData.contactPersonWebsite, { timeout: 5_000 });
    }

    // ── ICGEM Definition fields ────────────────────────────────────────────
    await expect(page.locator('#input-model-name'), 'modelName').toHaveValue(parsedData.modelName);
    await expect(page.locator('#input-celestial-body'), 'celestialBody').toHaveValue(parsedData.celestialBody);

    // Model type: verify selected option text
    const modelTypeText = await page.locator('#input-model-type option:checked').textContent();
    expect(modelTypeText?.trim(), 'modelType (option text)').toBe(parsedData.modelType);

    // Mathematical representation: verify selected option text
    const mathRepText = await page.locator('#input-mathematical-representation option:checked').textContent();
    expect(mathRepText?.trim(), 'mathematicalRepresentation (option text)').toBe(parsedData.mathRepresentation);

    // File format: verify selected option text
    const fileFormatText = await page.locator('#input-file-format option:checked').textContent();
    expect(fileFormatText?.trim(), 'fileFormat (option text)').toBe(parsedData.fileFormat);

    // ── ICGEM Properties ──────────────────────────────────────────────────
    // Tide system: form option value equals the XML value ("Zero-tide")
    await expect(page.locator('#input-tide-system'), 'tideSystem').toHaveValue(parsedData.tideSystem);

    await expect(page.locator('#input-degree'), 'degree').toHaveValue(parsedData.degree);

    // Errors: upload handler calls .toLowerCase(), so "No" → "no"
    await expect(page.locator('#input-errors'), 'errors (normalized to lowercase)').toHaveValue(
      parsedData.errors.toLowerCase(),
    );

    await expectNumericValue(
      page.locator('#input-earth-gravity-constant'),
      parsedData.earthGravityConstant,
      'earthGravityConstant',
    );

    if (parsedData.errorHandling) {
      await expect(page.locator('#input-error-handling-approach'), 'errorHandling').toHaveValue(parsedData.errorHandling);
    }

    // Radius (visible only for Spherical harmonics math representation)
    const radiusVisible = await page.locator('#input-radius').isVisible().catch(() => false);
    if (radiusVisible && parsedData.radius) {
      await expectNumericValue(page.locator('#input-radius'), parsedData.radius, 'radius');
    }

    // ── Reference ellipsoid ────────────────────────────────────────────────
    if (parsedData.ellipsoidal) {
      await expectNumericValue(
        page.locator('#input-semimajor-axis'),
        parsedData.ellipsoidal.semimajorAxisA,
        'semimajorAxisA',
      );
      if (parsedData.ellipsoidal.secondVariable) {
        await expect(page.locator('#input-second-variable'), 'secondVariable').toHaveValue(
          parsedData.ellipsoidal.secondVariable,
        );
        await expectNumericValue(
          page.locator('#input-second-variable-value'),
          parsedData.ellipsoidal.secondVariableValue,
          'secondVariableValue',
        );
      }
    }

    // ── ICGEM Static fields ────────────────────────────────────────────────
    if (parsedData.staticInfoTimeVariableCoefficients) {
      await expect(page.locator('#checkbox-time-variable'), 'timeVariable checkbox').toBeChecked();
      await expect(page.locator('#input-static-description'), 'staticDescription').toHaveValue(
        parsedData.staticInfoTimeVariableCoefficients,
      );
    }

    // ── ICGEM Temporal fields ──────────────────────────────────────────────
    if (parsedData.temporalStart) {
      await expect(page.locator('#input-temporal-start'), 'temporalStart').toHaveValue(parsedData.temporalStart);
    }
    if (parsedData.temporalEnd) {
      await expect(page.locator('#input-temporal-end'), 'temporalEnd').toHaveValue(parsedData.temporalEnd);
    }
    if (parsedData.temporalInstitution) {
      await expect(page.locator('#input-temporal-institution'), 'temporalInstitution').toHaveValue(
        parsedData.temporalInstitution,
      );
    }
    if (parsedData.temporalRelease) {
      await expect(page.locator('#input-release-number'), 'releaseNumber').toHaveValue(parsedData.temporalRelease);
    }

    if (parsedData.temporalResolution) {
      const freqChecked = await page.locator('#checkbox-custom-frequency').isChecked().catch(() => false);
      expect(freqChecked, 'customFrequency checkbox').toBe(true);
      await expect(page.locator('#input-temporal-frequency'), 'temporalResolution (days)').toHaveValue(
        parsedData.temporalResolution,
      );
    }

    // ── ICGEM Topographic fields ───────────────────────────────────────────
    if (parsedData.topographic) {
      const topo = parsedData.topographic;
      if (topo.layerApproach) {
        await expect(page.locator('#select-topo-layerapproach'), 'topoLayerApproach').toHaveValue(
          topo.layerApproach.toLowerCase(),
        );
      }
      if (topo.forwardModellingDomain) {
        await expect(page.locator('#select-topo-domain'), 'topoDomain').toHaveValue(
          topo.forwardModellingDomain.toLowerCase(),
        );
      }
      if (topo.approximation) {
        await expect(page.locator('#select-topo-approximation'), 'topoApproximation').toHaveValue(
          topo.approximation.toLowerCase(),
        );
      }

      const separateExpected = topo.densities.some(d => ['crust', 'mantle'].includes(d.domain.toLowerCase()));
      expect(
        await page.locator('#checkbox-separate-density').isChecked(),
        'separateDensity checkbox',
      ).toBe(separateExpected);

      for (const density of topo.densities) {
        const suffix = { whole: '', crust: '-crust', mantle: '-mantle' }[density.domain.toLowerCase()]!;
        await expect(
          page.locator(`#select-topo-density${suffix}`),
          `topoDensity(${density.domain})`,
        ).toHaveValue(toDensityOptionValue(density.type));
        if (density.description) {
          await expect(
            page.locator(`#input-topo-density-details${suffix}`),
            `topoDensityDetails(${density.domain})`,
          ).toHaveValue(density.description);
        }
      }
    }

    // ── Data sources ──────────────────────────────────────────────────────
    const dsRows = page.locator('#group-datasources .row[data-source-row]');
    await expect(dsRows, 'dataSources row count').toHaveCount(parsedData.dataSources.length, { timeout: 10_000 });

    for (let i = 0; i < parsedData.dataSources.length; i++) {
      const dsRow = dsRows.nth(i);
      const ref = parsedData.dataSources[i];

      await expect(
        dsRow.locator('textarea[name="datasource_description[]"]'),
        `dataSources[${i}].description`,
      ).toHaveValue(ref.description);

      if (ref.satelliteValueName) {
        const tagContents = await dsRow.locator('.tagify__tag').allTextContents();
        expect(tagContents.join('\n'), `dataSources[${i}].satelliteValueName`).toContain(
          ref.satelliteValueName,
        );
      }

      if (ref.details) {
        await expect(
          dsRow.locator('select[name="datasource_details[]"]'),
          `dataSources[${i}].details`,
        ).toHaveValue(ref.details);
      }

      if (ref.compensationDepth) {
        await expect(
          dsRow.locator('input[name="compensation_depth[]"]'),
          `dataSources[${i}].compensationDepth`,
        ).toHaveValue(ref.compensationDepth);
      }

      if (ref.identifier) {
        await expect(
          dsRow.locator('input[name="dIdentifier[]"]'),
          `dataSources[${i}].identifier`,
        ).toHaveValue(ref.identifier);
      }
      if (ref.identifierType) {
        await expect(
          dsRow.locator('select[name="dIdentifierType[]"]'),
          `dataSources[${i}].identifierType`,
        ).toHaveValue(ref.identifierType);
      }
      if (ref.name) {
        await expect(
          dsRow.locator('input[name="dName[]"]'),
          `dataSources[${i}].name`,
        ).toHaveValue(ref.name);
      }
    }

    // ── Descriptions ──────────────────────────────────────────────────────
    for (const [section, content] of Object.entries(parsedData.ggmDescriptions)) {
      await expect(
        page.locator(DESCRIPTION_SECTIONS[section].input),
        `description(${section})`,
      ).toHaveValue(content);
    }

    // ── GCMD Subjects (thesaurus + free keywords) ─────────────────────────
    // Every subject must land in some Tagify field: processKeywords() routes by
    // schemeURI into the GCMD pickers and drops anything unrecognised into free
    // keywords. Scanning all Tagify instances rather than inputs whose name
    // contains "keyword" also covers satellite_platform[] on the data rows.
    for (const subject of subjectTexts(parsedData.subjects)) {
      await expect
        .poll(() => findTagifyTag(page, subject), {
          message: `subject "${subject}" restored into a keyword field`,
          timeout: 10_000,
        })
        .toBe(true);
    }

    console.log('✓ 4 – fill/save/upload roundtrip and form-value verification passed');
  });
  }); // closes test.describe
} // closes for (const testCase of TEST_CASES)
