import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

// Minimal DataCite XML with two titles – used for load-only tests
const XML_TWO_TITLES = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/title.test</identifier>
  <publicationYear>2025</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="Main Title">First Title</title>
    <title xml:lang="en" titleType="Alternative Title">Second Title</title>
  </titles>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
    </creator>
  </creators>
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">Test description.</description>
  </descriptions>
  <dates>
    <date dateType="Created">2025-01-10</date>
  </dates>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">Creative Commons Attribution 4.0</rights>
  </rightsList>
</resource>`;

/**
 * Helper: uploads an XML string via the upload modal and waits until
 * the first title input is populated (indicating XML processing is done).
 */
async function uploadXmlAndWaitForTitles(page: import('@playwright/test').Page, xml: string, fileName: string) {
  await page.locator('#button-form-load').click();
  await expect(page.locator('div#modal-uploadxml')).toBeVisible({ timeout: 5_000 });

  await page.setInputFiles('#input-uploadxml-file', {
    name: fileName,
    mimeType: 'text/xml',
    buffer: Buffer.from(xml, 'utf-8'),
  });

  // Wait until both title inputs exist and the first one is populated
  await page.waitForFunction(
    () => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[name="title[]"]');
      return inputs.length >= 2 && inputs[0].value.length > 0 && inputs[1].value.length > 0;
    },
    { timeout: 20_000 },
  );
}

test.describe('XML Upload - Multiple Titles (Issue #1045)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);

    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15_000 });

    // Wait for title type dropdown to be populated from API
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-titletype');
      return select && select.querySelectorAll('option[value]').length > 1;
    }, { timeout: 30_000 });
  });

  test('loads both titles from XML with 2 titles', async ({ page }) => {
    await uploadXmlAndWaitForTitles(page, XML_TWO_TITLES, 'two-titles.xml');

    const allTitles = page.locator('input[name="title[]"]');
    expect(await allTitles.count()).toBe(2);
    await expect(allTitles.first()).toHaveValue('First Title');
    await expect(allTitles.nth(1)).toHaveValue('Second Title');

    // Verify second title type is "Alternative Title"
    const allTitleTypes = page.locator('select[name="titleType[]"]');
    expect(await allTitleTypes.count()).toBe(2);
    const selectedText = await allTitleTypes.nth(1).locator('option:checked').textContent();
    expect(selectedText?.trim()).toContain('Alternative Title');
  });

  test('clears manually added titles before loading XML', async ({ page }) => {
    // Step 1: Manually add a second title row and fill in values
    await page.locator('#button-resourceinformation-addtitle').click();
    const titleInputsBefore = page.locator('input[name="title[]"]');
    expect(await titleInputsBefore.count()).toBe(2);
    await titleInputsBefore.first().fill('manual-first');
    await titleInputsBefore.nth(1).fill('manual-second');

    // Step 2: Load XML – clearInputFields() must reset the internal
    // titlesNumber counter via elmo:clearTitles so that the second
    // title row can be re-added by processTitles().
    await uploadXmlAndWaitForTitles(page, XML_TWO_TITLES, 'two-titles.xml');

    const allTitles = page.locator('input[name="title[]"]');
    expect(await allTitles.count()).toBe(2);
    await expect(allTitles.first()).toHaveValue('First Title');
    await expect(allTitles.nth(1)).toHaveValue('Second Title');
  });

  test('adding a second title pre-selects a title type (not empty)', async ({ page }) => {
    // Click "Add Title" to add a second title row
    await page.locator('#button-resourceinformation-addtitle').click();

    // The second row's title type dropdown must have a non-empty selection
    const allTitleTypes = page.locator('select[name="titleType[]"]');
    expect(await allTitleTypes.count()).toBe(2);

    const secondTitleTypeValue = await allTitleTypes.nth(1).inputValue();
    expect(secondTitleTypeValue).not.toBe('');

    // Verify it selected "Alternative Title"
    const selectedText = await allTitleTypes.nth(1).locator('option:checked').textContent();
    expect(selectedText?.trim()).toContain('Alternative Title');
  });

  test('save-as with 2 titles produces XML containing both titles (issue #1045)', async ({ page }) => {
    // Step 1: Enter first title
    await page.locator('input[name="title[]"]').first().fill('TESTTITLE1');

    // Step 2: Add second title row
    await page.locator('#button-resourceinformation-addtitle').click();
    const allTitles = page.locator('input[name="title[]"]');
    expect(await allTitles.count()).toBe(2);
    await allTitles.nth(1).fill('TESTTITLE2');

    // The title type should now be pre-selected (no longer empty after our fix)
    const secondTitleTypeValue = await page.locator('select[name="titleType[]"]').nth(1).inputValue();
    expect(secondTitleTypeValue).not.toBe('');

    // Step 3: Intercept the save POST to capture the generated XML
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      (async () => {
        // Open Save As modal
        await page.locator('#button-form-save').click();
        await expect(page.locator('#modal-saveas')).toBeVisible({ timeout: 5_000 });
        await page.locator('#input-saveas-filename').fill('test-two-titles');
        await page.locator('#button-saveas-save').click();
      })(),
    ]);

    // Step 4: Read the downloaded XML and verify both titles are present
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const fs = await import('node:fs');
    const xmlContent = fs.readFileSync(downloadPath!, 'utf-8');

    expect(xmlContent).toContain('TESTTITLE1');
    expect(xmlContent).toContain('TESTTITLE2');

    // Step 5: Load the saved XML back and verify both titles appear in the form
    await uploadXmlAndWaitForTitles(page, xmlContent, 'test-two-titles.xml');

    const loadedTitles = page.locator('input[name="title[]"]');
    expect(await loadedTitles.count()).toBe(2);
    await expect(loadedTitles.first()).toHaveValue('TESTTITLE1');
    await expect(loadedTitles.nth(1)).toHaveValue('TESTTITLE2');
  });
});
