import { test, expect, type Page } from '@playwright/test';
import {
  completeMinimalDatasetForm,
  completeExtendedDatasetForm,
  completeExtendedMultipleEntries,
  navigateToHome,
} from '../utils';
import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

const XML_REFERENCE_DIR = path.join(__dirname, './outputDataReference');
const XML_ACTUAL_DIR = path.join(__dirname, './outputDataActual');

test.describe('Dataset Save with XML Verification', () => {
  test.beforeAll(() => {
  });

  test.beforeEach(() => {
    // Check prerequisites: verify all reference files exist
    const requiredReferenceFiles = ['minimal.json', 'extended.json', 'extended-multiple.json'];
    for (const file of requiredReferenceFiles) {
      const filePath = path.join(XML_REFERENCE_DIR, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(
          `PREREQUISITE ERROR: Reference file missing: ${filePath}\n` +
          `Required reference files for XML verification tests:\n` +
          requiredReferenceFiles.map(f => `  - ${path.join(XML_REFERENCE_DIR, f)}`).join('\n')
        );
      }
    }

    // Clean actual output directory before each test
    if (fs.existsSync(XML_ACTUAL_DIR)) {
      fs.rmSync(XML_ACTUAL_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(XML_ACTUAL_DIR, { recursive: true });
  });

  test('minimal dataset - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeMinimalDatasetForm(page);
    const { refRoot, actualRoot, refEnvelope, actualEnvelope } = await prepareReferencaeAndActualXml(page, 'minimal');

    // Assert title
    expect(actualRoot.titles.title['#text']).toBe(refRoot.titles.title['#text']);
    
    // Assert author name: combined 
    expect(actualRoot.creators.creator.creatorName['#text']).toBe(refRoot.creators.creator.creatorName['#text']);
    
    // Assert author name: first and last name separately  
    expect(actualRoot.creators.creator.givenName).toBe(refRoot.creators.creator.givenName);
    expect(actualRoot.creators.creator.familyName).toBe(refRoot.creators.creator.familyName);
    
    // Assert author ORCID
    expect(actualRoot.creators.creator.nameIdentifier['#text']).toBe(refRoot.creators.creator.nameIdentifier['#text']);
    
    // Assert author affiliation - can be a string or object with #text
    const actualAff = extractText(actualRoot.creators.creator.affiliation);
    const refAff = extractText(refRoot.creators.creator.affiliation);
    if (actualAff && refAff) {
      expect(actualAff).toBe(refAff);
    }
    
    // Assert contact person is also a contributor 
    expect(actualRoot.contributors.contributor.contributorName).toBe(refRoot.contributors.contributor.contributorName);

    // Assert publication year
    expect(actualRoot.publicationYear).toBe(refRoot.publicationYear);

    // Assert date created
    expect(actualRoot.dates.date['#text']).toBe(refRoot.dates.date['#text']);

    // Assert resource type
    expect(actualRoot.resourceType['#text']).toBe(refRoot.resourceType['#text']);
    
    // Assert language
    expect(actualRoot.language).toBe(refRoot.language);
    
    // Assert abstract/description
    expect(actualRoot.descriptions.description['#text']).toBe(refRoot.descriptions.description['#text']);
    
    // Assert contact person email
    expect(actualEnvelope.MD_Metadata.contact.CI_ResponsibleParty.contactInfo.CI_Contact.address.CI_Address.electronicMailAddress['gco:CharacterString']).toBe(
      refEnvelope.MD_Metadata.contact.CI_ResponsibleParty.contactInfo.CI_Contact.address.CI_Address.electronicMailAddress['gco:CharacterString']
    );

    console.log('✓ Minimal dataset XML verification passed');
  });

  test('extended dataset - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeExtendedDatasetForm(page);
    const { refRoot, actualRoot, refEnvelope, actualEnvelope } = await prepareReferencaeAndActualXml(page, 'extended');

    // Assert title
    expect(actualRoot.titles.title['#text']).toBe(refRoot.titles.title['#text']);
    
    // Assert publication year
    expect(actualRoot.publicationYear).toBe(refRoot.publicationYear);

    // Assert resource type
    expect(actualRoot.resourceType['#text']).toBe(refRoot.resourceType['#text']);
    
    // Assert dataset language
    expect(actualRoot.language).toBe(refRoot.language);
    
    // Compare all the descriptions
    const descriptions = toArray(actualRoot.descriptions.description);
    const refDescriptions = toArray(refRoot.descriptions.description);
    const actualDescriptionsByType = mapDescriptionsByType(descriptions);
    const refDescriptionsByType = mapDescriptionsByType(refDescriptions);
    expect(actualDescriptionsByType).toEqual(refDescriptionsByType);

    // Assert keywords present - handle both string and array formats
    if (actualRoot.subjects && refRoot.subjects) {
      const actualKeywords = toArray(actualRoot.subjects.subject);
      const refKeywords = toArray(refRoot.subjects.subject);
      expect(sortPrimitiveArray(actualKeywords)).toEqual(sortPrimitiveArray(refKeywords));
    }

    // Assert related identifiers with detailed attributes - handle both object and array formats
    if (actualRoot.relatedIdentifiers && refRoot.relatedIdentifiers) {
      const actualRelated = toArray(actualRoot.relatedIdentifiers.relatedIdentifier);
      const refRelated = toArray(refRoot.relatedIdentifiers.relatedIdentifier);
      expect(normalizeRelatedIdentifiers(actualRelated)).toEqual(normalizeRelatedIdentifiers(refRelated));
    }

    // Assert funding references with detailed attributes - handle both object and array formats
    if (actualRoot.fundingReferences && refRoot.fundingReferences) {
      const actualFunding = toArray(actualRoot.fundingReferences.fundingReference);
      const refFunding = toArray(refRoot.fundingReferences.fundingReference);
      expect(normalizeFundingReferences(actualFunding)).toEqual(normalizeFundingReferences(refFunding));
    }

    // Assert contact person email
    expect(actualEnvelope.MD_Metadata.contact.CI_ResponsibleParty.contactInfo.CI_Contact.address.CI_Address.electronicMailAddress['gco:CharacterString']).toBe(
      refEnvelope.MD_Metadata.contact.CI_ResponsibleParty.contactInfo.CI_Contact.address.CI_Address.electronicMailAddress['gco:CharacterString']
    );

    console.log('✓ Extended dataset XML verification passed');
  });

  test('extended with multiple entries - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeExtendedMultipleEntries(page);
    const { refRoot, actualRoot, refEnvelope, actualEnvelope } = await prepareReferencaeAndActualXml(page, 'extended-multiple');

    // Assert multiple authors - check length and each property
    const actualAuthors = toArray(actualRoot.creators?.creator);
    const referenceAuthors = toArray(refRoot.creators?.creator);
    // Assert multiple personal authors (persons)
    const personalCreators = actualAuthors.filter((c: any) => c.creatorName.nameType === 'Personal');
    const refPersonalCreators = referenceAuthors.filter((c: any) => c.creatorName.nameType === 'Personal');
    const personalByName = mapCreatorsByName(personalCreators);
    const refPersonalByName = mapCreatorsByName(refPersonalCreators);
    expect(personalByName).toEqual(refPersonalByName);

    // Assert organizational authors (institutions)
    const orgCreators = actualAuthors.filter((c: any) => c.creatorName.nameType === 'Organizational');
    const refOrgCreators = referenceAuthors.filter((c: any) => c.creatorName.nameType === 'Organizational');
    const orgByName = mapOrganizationalCreatorsByName(orgCreators);
    const refOrgByName = mapOrganizationalCreatorsByName(refOrgCreators);
    expect(orgByName).toEqual(refOrgByName);

    // Assert multiple keywords - check length and each value
    const actualKeywords = toArray(actualRoot.subjects?.subject);
    const referenceKeywords = toArray(refRoot.subjects?.subject);
    expect(sortPrimitiveArray(actualKeywords)).toEqual(sortPrimitiveArray(referenceKeywords));

    // Assert multiple descriptions - check length and each value
    const actualDescriptions = toArray(actualRoot.descriptions?.description);
    const referenceDescriptions = toArray(refRoot.descriptions?.description);
    expect(mapDescriptionsByType(actualDescriptions)).toEqual(mapDescriptionsByType(referenceDescriptions));

    // Assert multiple related works - check length and each value with attributes
    const actualRelated = toArray(actualRoot.relatedIdentifiers?.relatedIdentifier);
    const referenceRelated = toArray(refRoot.relatedIdentifiers?.relatedIdentifier);
    expect(normalizeRelatedIdentifiers(actualRelated)).toEqual(normalizeRelatedIdentifiers(referenceRelated));

    // Assert multiple funding references - check length and each property with attributes
    const actualFunding = toArray(actualRoot.fundingReferences?.fundingReference);
    const referenceFunding = toArray(refRoot.fundingReferences?.fundingReference);
    expect(normalizeFundingReferences(actualFunding)).toEqual(normalizeFundingReferences(referenceFunding));

        // Assert contributor persons - check length and each property
    const actualContributorPersons = toArray(actualRoot.contributors?.contributor).filter((c: any) => c.nameIdentifier);
    const refContributorPersons = toArray(refRoot.contributors?.contributor).filter((c: any) => c.nameIdentifier);
    expect(mapContributorPersonsByName(actualContributorPersons)).toEqual(mapContributorPersonsByName(refContributorPersons));

    // Assert contributor institutions - check length and each property
    const actualContributorInstitutions = toArray(actualRoot.contributors?.contributor).filter((c: any) => !c.nameIdentifier);
    const refContributorInstitutions = toArray(refRoot.contributors?.contributor).filter((c: any) => !c.nameIdentifier);
    expect(mapContributorInstitutionsByName(actualContributorInstitutions)).toEqual(mapContributorInstitutionsByName(refContributorInstitutions));

    console.log('✓ Extended multiple entries XML verification passed');
  });
});

/**
 * Loads and prepares both reference and actual XML files for comparison.
 * 
 * Downloads the XML from the form submission, parses it, and compares it against
 * the reference XML file. Returns both the DataCite resource roots and full envelopes
 * for comprehensive XML verification.
 * 
 * @param {Page} page - Playwright page object for browser interaction
 * @param {string} type - Test type identifier ('minimal', 'extended', or 'extended-multiple')
 * @returns {Promise<{refRoot: any, actualRoot: any, refEnvelope: any, actualEnvelope: any}>} 
 *          Object containing DataCite resource roots and full envelopes for both reference and actual XMLs
 * @throws {Error} If reference file not found or XML parsing fails
 */
async function prepareReferencaeAndActualXml(page: Page, type: string) {
    // Save XML
    const { xmlContent, parsedXml } = await downloadAndSaveXml(page, type);

    const actualEnvelope = extractEnvelopeNode(parsedXml);
    if (!actualEnvelope) {
      const preview = xmlContent.slice(0, 500);
      throw new Error(`Expected XML envelope in save response, but none was found. Response preview: ${preview}`);
    }
    const actualRoot = extractResourceNode(actualEnvelope);
    if (!actualRoot) {
      throw new Error('Expected resource node inside XML envelope, but none was found.');
    }
    
    // Verify XML
    const refRoot = loadReferenceXml(type).envelope.resource;
    const refEnvelope = loadReferenceXml(type).envelope;

    return { refRoot, actualRoot, refEnvelope, actualEnvelope };
}

function extractEnvelopeNode(parsedXml: any): any | null {
  if (!parsedXml || typeof parsedXml !== 'object') {
    return null;
  }

  if (parsedXml.envelope && typeof parsedXml.envelope === 'object') {
    return parsedXml.envelope;
  }

  const envelopeKey = Object.keys(parsedXml).find((key) => key.endsWith(':envelope'));
  if (envelopeKey && typeof parsedXml[envelopeKey] === 'object') {
    return parsedXml[envelopeKey];
  }

  return null;
}

function extractResourceNode(envelope: any): any | null {
  if (!envelope || typeof envelope !== 'object') {
    return null;
  }

  if (envelope.resource && typeof envelope.resource === 'object') {
    return envelope.resource;
  }

  const resourceKey = Object.keys(envelope).find((key) => key.endsWith(':resource'));
  if (resourceKey && typeof envelope[resourceKey] === 'object') {
    return envelope[resourceKey];
  }

  return null;
}

/**
 * Loads and parses a reference XML file from the output reference directory.
 * 
 * Maps test type identifiers to their corresponding JSON files and reads the
 * pre-stored reference data for comparison with actual form output.
 * 
 * @param {string} testName - Test type identifier ('minimal', 'extended', or 'extended-multiple')
 * @returns {any} Parsed JSON object containing the complete envelope with DataCite resource and ISO metadata
 * @throws {Error} If the reference file does not exist or cannot be parsed
 */
function loadReferenceXml(testName: string): any {
  const filenameMap: Record<string, string> = {
    'minimal': 'minimal',
    'extended': 'extended',
    'extended-multiple': 'extended-multiple'
  };

  const refJsonPath = path.join(XML_REFERENCE_DIR, `${filenameMap[testName]}.json`);
  const jsonContent = fs.readFileSync(refJsonPath, 'utf-8');
  return JSON.parse(jsonContent);
}

/**
 * Captures XML from the save response and saves it for verification.
 * 
 * Triggers the form save flow (Save button -> Save modal confirmation), waits for the
 * save response, parses the XML using fast-xml-parser with attribute support,
 * and saves both raw XML and parsed JSON representations to the actual output directory.
 * 
 * The parser configuration preserves XML attributes without prefixes, enabling direct
 * comparison with reference files.
 * 
 * @param {Page} page - Playwright page object for browser interaction
 * @param {string} testName - Test type identifier for file naming ('minimal', 'extended', or 'extended-multiple')
 * @returns {Promise<{xmlContent: string, parsedXml: any}>} 
 *          Object containing raw XML content and parsed JSON structure
 * @throws {Error} If response fails or XML parsing fails
 */
async function downloadAndSaveXml(
  page: Page,
  testName: string
): Promise<{ xmlContent: string; parsedXml: any }> {
  const responsePromise = page.waitForResponse(async (response) => {
    if (!response.url().includes('/save/save_data.php') || response.request().method() !== 'POST') {
      return false;
    }

    const contentType = (await response.headerValue('content-type')) || '';
    const disposition = (await response.headerValue('content-disposition')) || '';
    return contentType.includes('xml') || disposition.includes('.xml');
  }, { timeout: 30_000 });

  // Wait for Save button and click
  const saveButton = page.getByRole('button', { name: 'Save' });
  await saveButton.waitFor({ state: 'visible', timeout: 5000 });
  await saveButton.click();

  // Wait for Save As modal to be visible
  const saveModal = page.locator('#modal-saveas');
  await saveModal.waitFor({ state: 'visible', timeout: 5000 });

  // Fill filename if needed
  const filenameInput = page.locator('#input-saveas-filename');
  await filenameInput.fill(testName);

  // Click the save button in the modal
  const saveConfirmButton = page.locator('#button-saveas-save');
  await saveConfirmButton.click();

  // Read and parse XML response body (more reliable than browser download events in CI)
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const xmlContent = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });
  const parsedXml = parser.parse(xmlContent);

  // Save files
  const xmlActualPath = path.join(XML_ACTUAL_DIR, `test-result-${testName}.xml`);
  fs.writeFileSync(xmlActualPath, xmlContent, 'utf-8');

  const jsonActualPath = path.join(XML_ACTUAL_DIR, `test-result-${testName}.json`);
  fs.writeFileSync(jsonActualPath, JSON.stringify(parsedXml, null, 2), 'utf-8');

  return { xmlContent, parsedXml };
}

/**
 * Normalizes XML-parsed data to always return an array.
 * 
 * Handles the XML parser quirk where single elements become objects and
 * multiple elements become arrays. Converts both to a consistent array format.
 * 
 * @param {any} structure - A value that can be an array, single object, or undefined
 * @returns {Array<any>} Always returns an array:
 *   - If input is already an array → returns as-is
 *   - If input is a single object → wraps in array
 *   - If input is undefined/null → returns empty array
 * 
 * @example
 * toArray(undefined)           // Returns: []
 * toArray({name: 'test'})      // Returns: [{name: 'test'}]
 * toArray([{...}, {...}])      // Returns: [{...}, {...}]
 */
function toArray(structure: any): Array<any> {
  if (Array.isArray(structure)) {
    return structure;
  } else if (structure) {
    return [structure];
  } else {
    return [];
  }
}
/**
 * Extracts a text value from XML-parsed data.
 * 
 * Handles both simple string values and objects with a '#text' property.
 * This is necessary because the XML parser returns different structures:
 * - Simple values become strings: "value"
 * - Complex elements become objects with '#text': { '#text': 'value', otherProp: '...' }
 * 
 * @param {any} value - A value that can be a string or object with '#text' property
 * @returns {string | undefined} The extracted text value or undefined if not found
 * 
 * @example
 * extractText("simple")                    // Returns: "simple"
 * extractText({ '#text': 'complex' })     // Returns: "complex"
 * extractText(undefined)                   // Returns: undefined
 */
function extractText(value: any): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return value?.['#text'];
}

function mapDescriptionsByType(descriptions: Array<any>): Record<string, string> {
  return descriptions.reduce((acc, description) => {
    const type = String(description?.descriptionType ?? 'unknown');
    const text = String(description?.['#text'] ?? '');
    acc[type] = text;
    return acc;
  }, {} as Record<string, string>);
}

function mapCreatorsByName(creators: Array<any>): Record<string, { givenName: string; familyName: string; nameIdentifier: string }> {
  return creators.reduce((acc, creator) => {
    const name = String(creator?.creatorName?.['#text'] ?? creator?.creatorName ?? '');
    acc[name] = {
      givenName: String(creator?.givenName ?? ''),
      familyName: String(creator?.familyName ?? ''),
      nameIdentifier: String(creator?.nameIdentifier?.['#text'] ?? '')
    };
    return acc;
  }, {} as Record<string, { givenName: string; familyName: string; nameIdentifier: string }>);
}

function mapOrganizationalCreatorsByName(creators: Array<any>): Record<string, string> {
  return creators.reduce((acc, creator) => {
    const name = String(creator?.creatorName?.['#text'] ?? creator?.creatorName ?? '');
    const affiliation = String(extractText(creator?.affiliation) ?? '');
    acc[name] = affiliation;
    return acc;
  }, {} as Record<string, string>);
}

function sortPrimitiveArray(values: Array<any>): Array<string> {
  return values.map((value) => String(value)).sort((a, b) => a.localeCompare(b));
}

function normalizeRelatedIdentifiers(values: Array<any>): Array<{ value: string; type: string; relation: string }> {
  return values
    .map((entry) => ({
      value: String(entry?.['#text'] ?? ''),
      type: String(entry?.relatedIdentifierType ?? ''),
      relation: String(entry?.relationType ?? '')
    }))
    .sort((a, b) => `${a.value}|${a.type}|${a.relation}`.localeCompare(`${b.value}|${b.type}|${b.relation}`));
}

function normalizeFundingReferences(values: Array<any>): Array<{ funderName: string; awardNumber: string; awardURI: string; awardTitle: string }> {
  return values
    .map((entry) => ({
      funderName: String(entry?.funderName ?? ''),
      awardNumber: String(entry?.awardNumber?.['#text'] ?? ''),
      awardURI: String(entry?.awardNumber?.awardURI ?? ''),
      awardTitle: String(entry?.awardTitle ?? '')
    }))
    .sort((a, b) => `${a.funderName}|${a.awardNumber}|${a.awardTitle}`.localeCompare(`${b.funderName}|${b.awardNumber}|${b.awardTitle}`));
}

function mapContributorPersonsByName(contributors: Array<any>): Record<string, { givenName: string; familyName: string; nameIdentifier: string; contributorType: string }> {
  return contributors.reduce((acc, contributor) => {
    const name = String(contributor?.contributorName?.['#text'] ?? contributor?.contributorName ?? '');
    acc[name] = {
      givenName: String(contributor?.givenName ?? ''),
      familyName: String(contributor?.familyName ?? ''),
      nameIdentifier: String(contributor?.nameIdentifier?.['#text'] ?? ''),
      contributorType: String(contributor?.contributorType ?? '')
    };
    return acc;
  }, {} as Record<string, { givenName: string; familyName: string; nameIdentifier: string; contributorType: string }>);
}

function mapContributorInstitutionsByName(contributors: Array<any>): Record<string, { contributorType: string; affiliation: string }> {
  return contributors.reduce((acc, contributor) => {
    const name = String(contributor?.contributorName?.['#text'] ?? contributor?.contributorName ?? '');
    acc[name] = {
      contributorType: String(contributor?.contributorType ?? ''),
      affiliation: String(extractText(contributor?.affiliation) ?? '')
    };
    return acc;
  }, {} as Record<string, { contributorType: string; affiliation: string }>);
}