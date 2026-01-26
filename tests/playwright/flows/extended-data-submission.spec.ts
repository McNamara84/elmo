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

const XML_REFERENCE_DIR = path.join(__dirname, '../xml-references');

test.describe('Dataset Save with XML Verification', () => {
  test.beforeAll(() => {
    // Create reference directory if it doesn't exist
    if (!fs.existsSync(XML_REFERENCE_DIR)) {
      fs.mkdirSync(XML_REFERENCE_DIR, { recursive: true });
    }
  });

  test('minimal dataset - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeMinimalDatasetForm(page);
    await saveAndVerifyXml(page, 'minimal');
  });

  test('extended dataset - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeExtendedDatasetForm(page);
    await saveAndVerifyXml(page, 'extended');
  });

  test('extended with multiple entries - save and verify XML', async ({ page }) => {
    await navigateToHome(page);
    await completeExtendedMultipleEntries(page);
    await saveAndVerifyXml(page, 'extended-multiple');
  });
});

/**
 * Helper function to save and verify XML
 */
async function saveAndVerifyXml(page: Page, testName: string) {
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

  // Save raw XML to reference directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const xmlRefPath = path.join(XML_REFERENCE_DIR, `${testName}-${timestamp}.xml`);
  fs.writeFileSync(xmlRefPath, xmlContent, 'utf-8');
  console.log(`XML reference saved to: ${xmlRefPath}`);

  // Save parsed structure as JSON for easy inspection
  const jsonRefPath = path.join(XML_REFERENCE_DIR, `${testName}-${timestamp}.json`);
  fs.writeFileSync(jsonRefPath, JSON.stringify(parsedXml, null, 2), 'utf-8');
  console.log(`JSON reference saved to: ${jsonRefPath}`);

  // Verify the file was downloaded
  expect(download.suggestedFilename()).toBeTruthy();
  expect(xmlContent).toBeTruthy();
  expect(parsedXml).toBeTruthy();
}
