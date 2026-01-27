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
    expect(actualRoot.titles.title).toBe(refRoot.titles.title);
    
    // Assert author name: combined 
    expect(actualRoot.creators.creator.creatorName).toBe(refRoot.creators.creator.creatorName);
    
    // Assert author name: first and last name separately  
    expect(actualRoot.creators.creator.givenName).toBe(refRoot.creators.creator.givenName);
    expect(actualRoot.creators.creator.familyName).toBe(refRoot.creators.creator.familyName);
    
    // Assert author ORCID
    expect(actualRoot.creators.creator.nameIdentifier).toBe(refRoot.creators.creator.nameIdentifier);
    
    // Assert author affiliation
    expect(actualRoot.creators.creator.affiliation).toBe(refRoot.creators.creator.affiliation);
    
    // Assert contact person is also a contributor 
    expect(actualRoot.contributors.contributor.contributorName).toBe(refRoot.contributors.contributor.contributorName);

    // Assert publication year
    expect(actualRoot.publicationYear).toBe(refRoot.publicationYear);

    // Assert date created
    expect(actualRoot.dates.date).toBe(refRoot.dates.date);

    // Assert resource type
    expect(actualRoot.resourceType).toBe(refRoot.resourceType);
    
    // Assert language
    expect(actualRoot.language).toBe(refRoot.language);
    
    // Assert abstract/description
    expect(actualRoot.descriptions.description).toBe(refRoot.descriptions.description);
    
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
    expect(actualRoot.titles.title).toBe(refRoot.titles.title);
    
    // Assert author name
    expect(actualRoot.creators.creator.creatorName).toBe(refRoot.creators.creator.creatorName);
    
    // Assert author ORCID
    expect(actualRoot.creators.creator.nameIdentifier).toBe(refRoot.creators.creator.nameIdentifier);
    
    // Assert author affiliation
    expect(actualRoot.creators.creator.affiliation).toBe(refRoot.creators.creator.affiliation);
    
    // Assert author givenName
    expect(actualRoot.creators.creator.givenName).toBe(refRoot.creators.creator.givenName);
    
    // Assert author familyName
    expect(actualRoot.creators.creator.familyName).toBe(refRoot.creators.creator.familyName);
    
    // Assert publication year
    expect(actualRoot.publicationYear).toBe(refRoot.publicationYear);

    // Assert resource type
    expect(actualRoot.resourceType).toBe(refRoot.resourceType);
    
    // Assert dataset language
    expect(actualRoot.language).toBe(refRoot.language);
    // Compare all the descriptions
    const descriptions = Array.isArray(actualRoot.descriptions.description)
      ? actualRoot.descriptions.description
      : [actualRoot.descriptions.description];
    const refDescriptions = Array.isArray(refRoot.descriptions.description)
      ? refRoot.descriptions.description
      : [refRoot.descriptions.description];
    expect(descriptions.length).toBe(refDescriptions.length);
    for (let i = 0; i < descriptions.length; i++) {
      expect(descriptions[i]).toBe(refDescriptions[i]);
    }

    // Assert keywords present
    expect(actualRoot.subjects.subject).toBe(refRoot.subjects.subject);

    // Assert related identifiers present
    expect(actualRoot.relatedIdentifiers.relatedIdentifier).toBe(refRoot.relatedIdentifiers.relatedIdentifier);
    // Assert related work identifier type 

    // Assert related work relation type

    // Assert funding references
    expect(actualRoot.fundingReferences.fundingReference.funderName).toBe(refRoot.fundingReferences.fundingReference.funderName);
    expect(actualRoot.fundingReferences.fundingReference.awardNumber).toBe(refRoot.fundingReferences.fundingReference.awardNumber);
    expect(actualRoot.fundingReferences.fundingReference.awardTitle).toBe(refRoot.fundingReferences.fundingReference.awardTitle);
    // Assert award URI 

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
    const actualAuthors = Array.isArray(actualRoot.creators?.creator)
      ? actualRoot.creators.creator
      : [actualRoot.creators?.creator];
    const referenceAuthors = Array.isArray(refRoot.creators?.creator)
      ? refRoot.creators.creator
      : [refRoot.creators?.creator];
    expect(actualAuthors.length).toBe(referenceAuthors.length);
    for (let i = 0; i < actualAuthors.length; i++) {
      expect(actualAuthors[i].creatorName).toBe(referenceAuthors[i].creatorName);
      expect(actualAuthors[i].givenName).toBe(referenceAuthors[i].givenName);
      expect(actualAuthors[i].familyName).toBe(referenceAuthors[i].familyName);
      expect(actualAuthors[i].nameIdentifier).toBe(referenceAuthors[i].nameIdentifier);
      expect(actualAuthors[i].affiliation).toBe(referenceAuthors[i].affiliation);
    }

    // Assert multiple keywords - check length and each value
    const actualKeywords = Array.isArray(actualRoot.subjects?.subject)
      ? actualRoot.subjects.subject
      : [actualRoot.subjects?.subject];
    const referenceKeywords = Array.isArray(refRoot.subjects?.subject)
      ? refRoot.subjects.subject
      : [refRoot.subjects?.subject];
    expect(actualKeywords.length).toBe(referenceKeywords.length);
    for (let i = 0; i < actualKeywords.length; i++) {
      expect(actualKeywords[i]).toBe(referenceKeywords[i]);
    }

    // Assert multiple related works - check length and each value
    const actualRelated = Array.isArray(actualRoot.relatedIdentifiers?.relatedIdentifier)
      ? actualRoot.relatedIdentifiers.relatedIdentifier
      : [actualRoot.relatedIdentifiers?.relatedIdentifier];
    const referenceRelated = Array.isArray(refRoot.relatedIdentifiers?.relatedIdentifier)
      ? refRoot.relatedIdentifiers.relatedIdentifier
      : [refRoot.relatedIdentifiers?.relatedIdentifier];
    expect(actualRelated.length).toBe(referenceRelated.length);
    for (let i = 0; i < actualRelated.length; i++) {
      // Assert related identifier, identifier type and relation 
      expect(actualRelated[i]).toBe(referenceRelated[i]);


      
    }

    // Assert multiple funding references - check length and each property
    const actualFunding = Array.isArray(actualRoot.fundingReferences?.fundingReference)
      ? actualRoot.fundingReferences.fundingReference
      : [actualRoot.fundingReferences?.fundingReference];
    const referenceFunding = Array.isArray(refRoot.fundingReferences?.fundingReference)
      ? refRoot.fundingReferences.fundingReference
      : [refRoot.fundingReferences?.fundingReference];
    expect(actualFunding.length).toBe(referenceFunding.length);
    for (let i = 0; i < actualFunding.length; i++) {
      expect(actualFunding[i].funderName).toBe(referenceFunding[i].funderName);
      expect(actualFunding[i].awardNumber).toBe(referenceFunding[i].awardNumber);
      expect(actualFunding[i].awardTitle).toBe(referenceFunding[i].awardTitle);
    }

    console.log('✓ Extended multiple entries XML verification passed');
  });
});

/**
 * Combine the following 2 functions to load the parsed XMLs -- the reference and the actual -- for comparison
 * and return their roots. the envelopes are also returned to check the metadata outside the Datacite Scheme.
 */
async function prepareReferencaeAndActualXml(page: Page, type: string) {
    // Save XML
    const { xmlContent, parsedXml } = await downloadAndSaveXml(page, type);
    
    // Verify XML
    const refRoot = loadReferenceXml(type).envelope.resource;
    const actualRoot = parsedXml.envelope.resource;

    const refEnvelope = loadReferenceXml(type).envelope;
    const actualEnvelope = parsedXml.envelope;

    return { refRoot, actualRoot, refEnvelope, actualEnvelope };
}

/**
 * Load reference XML for comparison
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
 * Download XML from form and save to actual output directory
 */
async function downloadAndSaveXml(
  page: Page,
  testName: string
): Promise<{ xmlContent: string; parsedXml: any }> {
  // Wait for download event
  const downloadPromise = page.waitForEvent('download');

  // Click Save button in the form
  await page.getByRole('button', { name: 'Save' }).click();

  // Click Save button in the save modal
  await page.locator('#button-saveas-save').click();

  // Wait for download to complete
  const download = await downloadPromise;

  // Get the downloaded file path
  const filePath = await download.path();

  // Read the XML file
  const xmlContent = fs.readFileSync(filePath, 'utf-8');
  console.log(`Downloaded XML for ${testName}:`, xmlContent);

  // Parse XML using fast-xml-parser with attribute parsing enabled
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });
  const parsedXml = parser.parse(xmlContent);

  console.log(`Parsed XML structure for ${testName}:`, JSON.stringify(parsedXml, null, 2));

  // Save raw XML to actual output directory with "test-result" prefix
  const xmlActualPath = path.join(XML_ACTUAL_DIR, `test-result-${testName}.xml`);
  fs.writeFileSync(xmlActualPath, xmlContent, 'utf-8');
  console.log(`XML saved to: ${xmlActualPath}`);

  // Save parsed structure as JSON for easy inspection
  const jsonActualPath = path.join(XML_ACTUAL_DIR, `test-result-${testName}.json`);
  fs.writeFileSync(jsonActualPath, JSON.stringify(parsedXml, null, 2), 'utf-8');
  console.log(`JSON saved to: ${jsonActualPath}`);

  // Verify the file was downloaded
  expect(download.suggestedFilename()).toBeTruthy();
  expect(xmlContent).toBeTruthy();
  expect(parsedXml).toBeTruthy();

  return { xmlContent, parsedXml };
}
