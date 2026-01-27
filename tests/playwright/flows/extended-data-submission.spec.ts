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

const XML_REFERENCE_DIR = path.join(__dirname, './outputDataEndToEnd');
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
    
    // Save XML
    const { xmlContent, parsedXml } = await downloadAndSaveXml(page, 'minimal');
    
    // Verify XML
    const refRoot = loadReferenceXml('minimal').envelope.resource;
    const actualRoot = parsedXml.envelope.resource;

    // Assert title
    expect(actualRoot.titles.title).toBe(refRoot.titles.title);
    
    // Assert author name
    expect(actualRoot.creators.creator.creatorName).toBe(refRoot.creators.creator.creatorName);
    
    // Assert author ORCID
    expect(actualRoot.creators.creator.nameIdentifier).toBe(refRoot.creators.creator.nameIdentifier);
    
    // Assert author affiliation
    expect(actualRoot.creators.creator.affiliation).toBe(refRoot.creators.creator.affiliation);
    
    // Assert publication year
    expect(actualRoot.publicationYear).toBe(refRoot.publicationYear);

    // Assert resource type
    expect(actualRoot.resourceType).toBe(refRoot.resourceType);
    
    // Assert abstract/description
    expect(actualRoot.descriptions.description).toBe(refRoot.descriptions.description);
    
    // Assert contact person email
    expect(actualRoot.contact.CI_ResponsibleParty.contactInfo.CI_Contact.address.CI_Address.electronicMailAddress['gco:CharacterString']).toBe(
      refRoot.contact.CI_ResponsibleParty.contactInfo.CI_Contact.address.CI_Address.electronicMailAddress['gco:CharacterString']
    );

    console.log('✓ Minimal dataset XML verification passed');
  });

  test('extended dataset - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeExtendedDatasetForm(page);
    
    // Save XML
    const { xmlContent, parsedXml } = await downloadAndSaveXml(page, 'extended');
    
    // Verify XML
    const referenceXml = loadReferenceXml('extended');

    // Assert root element
    expect(parsedXml).toHaveProperty('resource');
    
    // Assert title
    const actualTitle = parsedXml.resource.titles?.title;
    const referenceTitle = referenceXml.resource.titles?.title;
    expect(actualTitle).toBe(referenceTitle);

    // Assert descriptions present
    expect(parsedXml.resource.descriptions?.description).toBeDefined();

    // Assert methods in description
    const descriptions = Array.isArray(parsedXml.resource.descriptions.description)
      ? parsedXml.resource.descriptions.description
      : [parsedXml.resource.descriptions.description];
    const methodsDesc = descriptions.find((d: any) => d['@_descriptionType'] === 'Methods');
    expect(methodsDesc).toBeDefined();

    // Assert keywords present
    expect(parsedXml.resource.subjects?.subject).toBeDefined();

    // Assert related works present
    expect(parsedXml.resource.relatedIdentifiers?.relatedIdentifier).toBeDefined();

    // Assert funding references present
    expect(parsedXml.resource.fundingReferences?.fundingReference).toBeDefined();

    console.log('✓ Extended dataset XML verification passed');
  });

  test('extended with multiple entries - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeExtendedMultipleEntries(page);
    
    // Save XML
    const { xmlContent, parsedXml } = await downloadAndSaveXml(page, 'extended-multiple');
    
    // Verify XML
    const referenceXml = loadReferenceXml('extended-multiple');

    // Assert root element
    expect(parsedXml).toHaveProperty('resource');

    // Assert multiple authors
    const actualAuthors = Array.isArray(parsedXml.resource.creators?.creator)
      ? parsedXml.resource.creators.creator
      : [parsedXml.resource.creators?.creator];
    const referenceAuthors = Array.isArray(referenceXml.resource.creators?.creator)
      ? referenceXml.resource.creators.creator
      : [referenceXml.resource.creators?.creator];
    expect(actualAuthors.length).toBe(referenceAuthors.length);

    // Assert multiple keywords
    const actualKeywords = Array.isArray(parsedXml.resource.subjects?.subject)
      ? parsedXml.resource.subjects.subject
      : [parsedXml.resource.subjects?.subject];
    const referenceKeywords = Array.isArray(referenceXml.resource.subjects?.subject)
      ? referenceXml.resource.subjects.subject
      : [referenceXml.resource.subjects?.subject];
    expect(actualKeywords.length).toBe(referenceKeywords.length);

    // Assert multiple related works
    const actualRelated = Array.isArray(parsedXml.resource.relatedIdentifiers?.relatedIdentifier)
      ? parsedXml.resource.relatedIdentifiers.relatedIdentifier
      : [parsedXml.resource.relatedIdentifiers?.relatedIdentifier];
    const referenceRelated = Array.isArray(referenceXml.resource.relatedIdentifiers?.relatedIdentifier)
      ? referenceXml.resource.relatedIdentifiers.relatedIdentifier
      : [referenceXml.resource.relatedIdentifiers?.relatedIdentifier];
    expect(actualRelated.length).toBe(referenceRelated.length);

    console.log('✓ Extended multiple entries XML verification passed');
  });
});

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

  // Parse XML using fast-xml-parser
  const parser = new XMLParser();
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
