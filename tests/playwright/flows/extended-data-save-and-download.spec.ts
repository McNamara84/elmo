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
    expect(descriptions.length).toBe(refDescriptions.length);
    for (let i = 0; i < descriptions.length; i++) {
      expect(descriptions[i]['#text']).toBe(refDescriptions[i]['#text']);
    }

    // Assert keywords present - handle both string and array formats
    if (actualRoot.subjects && refRoot.subjects) {
      const actualKeywords = toArray(actualRoot.subjects.subject);
      const refKeywords = toArray(refRoot.subjects.subject);
      expect(actualKeywords).toEqual(refKeywords);
    }

    // Assert related identifiers with detailed attributes - handle both object and array formats
    if (actualRoot.relatedIdentifiers && refRoot.relatedIdentifiers) {
      const actualRelated = toArray(actualRoot.relatedIdentifiers.relatedIdentifier);
      const refRelated = toArray(refRoot.relatedIdentifiers.relatedIdentifier);
      expect(actualRelated.length).toBe(refRelated.length);
      for (let i = 0; i < actualRelated.length; i++) {
        expect(actualRelated[i]['#text']).toBe(refRelated[i]['#text']);
        expect(actualRelated[i].relatedIdentifierType).toBe(refRelated[i].relatedIdentifierType);
        expect(actualRelated[i].relationType).toBe(refRelated[i].relationType);
      }
    }

    // Assert funding references with detailed attributes - handle both object and array formats
    if (actualRoot.fundingReferences && refRoot.fundingReferences) {
      const actualFunding = toArray(actualRoot.fundingReferences.fundingReference);
      const refFunding = toArray(refRoot.fundingReferences.fundingReference);
      expect(actualFunding.length).toBe(refFunding.length);
      for (let i = 0; i < actualFunding.length; i++) {
        expect(actualFunding[i].funderName).toBe(refFunding[i].funderName);
        expect(actualFunding[i].awardNumber['#text']).toBe(refFunding[i].awardNumber['#text']);
        expect(actualFunding[i].awardNumber.awardURI).toBe(refFunding[i].awardNumber.awardURI);
        expect(actualFunding[i].awardTitle).toBe(refFunding[i].awardTitle);
      }
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
    expect(personalCreators.length).toBe(refPersonalCreators.length);
    for (let i = 0; i < personalCreators.length; i++) {
      expect(personalCreators[i].creatorName['#text']).toBe(refPersonalCreators[i].creatorName['#text']);
      expect(personalCreators[i].givenName).toBe(refPersonalCreators[i].givenName);
      expect(personalCreators[i].familyName).toBe(refPersonalCreators[i].familyName);
      expect(personalCreators[i].nameIdentifier['#text']).toBe(refPersonalCreators[i].nameIdentifier['#text']);
    }

    // Assert organizational authors (institutions)
    const orgCreators = actualAuthors.filter((c: any) => c.creatorName.nameType === 'Organizational');
    const refOrgCreators = referenceAuthors.filter((c: any) => c.creatorName.nameType === 'Organizational');
    expect(orgCreators.length).toBe(refOrgCreators.length);
    for (let i = 0; i < orgCreators.length; i++) {
      expect(orgCreators[i].creatorName['#text']).toBe(refOrgCreators[i].creatorName['#text']);
      // Organization affiliations can be strings or objects with #text
      const actualOrgAff = extractText(orgCreators[i].affiliation);
      const refOrgAff = extractText(refOrgCreators[i].affiliation);
      if (actualOrgAff && refOrgAff) {
        expect(actualOrgAff).toBe(refOrgAff);
      }
    }

    // Assert multiple keywords - check length and each value
    const actualKeywords = toArray(actualRoot.subjects?.subject);
    const referenceKeywords = toArray(refRoot.subjects?.subject);
    expect(actualKeywords.length).toBe(referenceKeywords.length);
    for (let i = 0; i < actualKeywords.length; i++) {
      expect(actualKeywords[i]).toBe(referenceKeywords[i]);
    }

    // Assert multiple descriptions - check length and each value
    const actualDescriptions = toArray(actualRoot.descriptions?.description);
    const referenceDescriptions = toArray(refRoot.descriptions?.description);
    expect(actualDescriptions.length).toBe(referenceDescriptions.length);
    for (let i = 0; i < actualDescriptions.length; i++) {
      expect(actualDescriptions[i]['#text']).toBe(referenceDescriptions[i]['#text']);
    }

    // Assert multiple related works - check length and each value with attributes
    const actualRelated = toArray(actualRoot.relatedIdentifiers?.relatedIdentifier);
    const referenceRelated = toArray(refRoot.relatedIdentifiers?.relatedIdentifier);
    expect(actualRelated.length).toBe(referenceRelated.length);
    for (let i = 0; i < actualRelated.length; i++) {
      expect(actualRelated[i]['#text']).toBe(referenceRelated[i]['#text']);
      expect(actualRelated[i].relatedIdentifierType).toBe(referenceRelated[i].relatedIdentifierType);
      expect(actualRelated[i].relationType).toBe(referenceRelated[i].relationType);
    }

    // Assert multiple funding references - check length and each property with attributes
    const actualFunding = toArray(actualRoot.fundingReferences?.fundingReference);
    const referenceFunding = toArray(refRoot.fundingReferences?.fundingReference);
    expect(actualFunding.length).toBe(referenceFunding.length);
    for (let i = 0; i < actualFunding.length; i++) {
      expect(actualFunding[i].funderName).toBe(referenceFunding[i].funderName);
      expect(actualFunding[i].awardNumber['#text']).toBe(referenceFunding[i].awardNumber['#text']);
      expect(actualFunding[i].awardNumber.awardURI).toBe(referenceFunding[i].awardNumber.awardURI);
      expect(actualFunding[i].awardTitle).toBe(referenceFunding[i].awardTitle);
    }

        // Assert contributor persons - check length and each property
    const actualContributorPersons = toArray(actualRoot.contributors?.contributor).filter((c: any) => c.nameIdentifier);
    const refContributorPersons = toArray(refRoot.contributors?.contributor).filter((c: any) => c.nameIdentifier);
    expect(actualContributorPersons.length).toBe(refContributorPersons.length);
    for (let i = 0; i < actualContributorPersons.length; i++) {
      expect(actualContributorPersons[i].contributorName['#text']).toBe(refContributorPersons[i].contributorName['#text']);
      expect(actualContributorPersons[i].givenName).toBe(refContributorPersons[i].givenName);
      expect(actualContributorPersons[i].familyName).toBe(refContributorPersons[i].familyName);
      expect(actualContributorPersons[i].nameIdentifier['#text']).toBe(refContributorPersons[i].nameIdentifier['#text']);
      expect(actualContributorPersons[i].contributorType).toBe(refContributorPersons[i].contributorType);
    }

    // Assert contributor institutions - check length and each property
    const actualContributorInstitutions = toArray(actualRoot.contributors?.contributor).filter((c: any) => !c.nameIdentifier);
    const refContributorInstitutions = toArray(refRoot.contributors?.contributor).filter((c: any) => !c.nameIdentifier);
    expect(actualContributorInstitutions.length).toBe(refContributorInstitutions.length);
    for (let i = 0; i < actualContributorInstitutions.length; i++) {
      expect(actualContributorInstitutions[i].contributorName['#text']).toBe(refContributorInstitutions[i].contributorName['#text']);
      expect(actualContributorInstitutions[i].contributorType).toBe(refContributorInstitutions[i].contributorType);
      // Affiliation can be a string or object with #text
      const actualContribAff = extractText(actualContributorInstitutions[i].affiliation);
      const refContribAff = extractText(refContributorInstitutions[i].affiliation);
      if (actualContribAff && refContribAff) {
        expect(actualContribAff).toBe(refContribAff);
      }
    }

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
  const status = response.status();
  const xmlContent = await response.text();
  const headers = await response.allHeaders();

  // Fail fast with detailed diagnostics when save response is broken
  if (status !== 200 || xmlContent.trim().length === 0) {
    const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join(', ');
    throw new Error(
      `Save endpoint returned unexpected response.\n` +
      `  Status: ${status}\n` +
      `  Body length: ${xmlContent.length} (trimmed: ${xmlContent.trim().length})\n` +
      `  Headers: ${headerStr}\n` +
      `  Body (first 500 chars): ${JSON.stringify(xmlContent.slice(0, 500))}\n` +
      `  Content-Length header: ${headers['content-length'] ?? '(not set)'}`
    );
  }

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