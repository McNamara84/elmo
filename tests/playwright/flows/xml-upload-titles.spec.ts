import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

const XML_TWO_TITLES = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/title.test</identifier>
  <publicationYear>2025</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="Main Title">test</title>
    <title xml:lang="en" titleType="Alternative Title">blabla</title>
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

test.describe('XML Upload - Multiple Titles (Issue #1045)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);

    // Wait for the page to be fully loaded
    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15_000 });

    // Wait for title type dropdown to be populated from API
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-titletype');
      return select && select.querySelectorAll('option[value]').length > 1;
    }, { timeout: 30_000 });
  });

  test('loads both titles from XML with 2 titles', async ({ page }) => {
    // Click "Load" button to open upload modal
    await page.locator('#button-form-load').click();
    const modal = page.locator('div#modal-uploadxml');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Upload the XML file
    await page.setInputFiles('#input-uploadxml-file', {
      name: 'two-titles.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(XML_TWO_TITLES, 'utf-8'),
    });

    // Wait for first title to be populated (indicates XML processing started)
    await page.waitForFunction(
      () => {
        const input = document.querySelector<HTMLInputElement>('#input-resourceinformation-title');
        return input != null && input.value.length > 0;
      },
      { timeout: 20_000 },
    );

    // Small wait for additional title rows to be created
    await page.waitForTimeout(500);

    // CHECK: First title should be "test"
    const firstTitle = page.locator('input[name="title[]"]').first();
    await expect(firstTitle).toHaveValue('test');

    // CHECK: There should be 2 title inputs
    const allTitleInputs = page.locator('input[name="title[]"]');
    const titleCount = await allTitleInputs.count();
    console.log(`Number of title inputs found: ${titleCount}`);

    // Log all title values for debugging
    for (let i = 0; i < titleCount; i++) {
      const val = await allTitleInputs.nth(i).inputValue();
      console.log(`Title ${i}: "${val}"`);
    }

    // This assertion should catch the bug: we expect 2 title inputs
    expect(titleCount).toBe(2);

    // CHECK: Second title should be "blabla"
    const secondTitle = allTitleInputs.nth(1);
    await expect(secondTitle).toHaveValue('blabla');

    // CHECK: Second title type should be "Alternative Title"
    const allTitleTypeSelects = page.locator('select[name="titleType[]"]');
    const selectCount = await allTitleTypeSelects.count();
    console.log(`Number of titleType selects found: ${selectCount}`);

    if (selectCount >= 2) {
      const secondTitleType = allTitleTypeSelects.nth(1);
      const selectedText = await secondTitleType.locator('option:checked').textContent();
      console.log(`Second title type selected: "${selectedText}"`);
      expect(selectedText?.trim()).toContain('Alternative Title');
    }
  });

  test('loads both titles after user previously added 2 titles manually (exact issue #1045 scenario)', async ({ page }) => {
    // Step 1: Manually add a second title (simulating what the bug reporter did)
    await page.locator('#button-resourceinformation-addtitle').click();

    // Verify second title row was created
    const titleInputsBefore = page.locator('input[name="title[]"]');
    expect(await titleInputsBefore.count()).toBe(2);

    // Fill in both titles manually
    await titleInputsBefore.first().fill('manual-first');
    await titleInputsBefore.nth(1).fill('manual-second');

    // Step 2: Now load XML with 2 titles (this is where the bug occurred)
    await page.locator('#button-form-load').click();
    const modal = page.locator('div#modal-uploadxml');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    await page.setInputFiles('#input-uploadxml-file', {
      name: 'two-titles.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(XML_TWO_TITLES, 'utf-8'),
    });

    // Wait for first title to be populated from XML
    await page.waitForFunction(
      () => {
        const inputs = document.querySelectorAll<HTMLInputElement>('input[name="title[]"]');
        return inputs.length > 0 && inputs[0].value.length > 0;
      },
      { timeout: 20_000 },
    );

    // Small wait for DOM updates
    await page.waitForTimeout(500);

    // CHECK: There should be exactly 2 title inputs
    const allTitleInputs = page.locator('input[name="title[]"]');
    const titleCount = await allTitleInputs.count();
    console.log(`After load - Number of title inputs: ${titleCount}`);

    for (let i = 0; i < titleCount; i++) {
      const val = await allTitleInputs.nth(i).inputValue();
      console.log(`After load - Title ${i}: "${val}"`);
    }

    expect(titleCount).toBe(2);
    await expect(allTitleInputs.first()).toHaveValue('test');
    await expect(allTitleInputs.nth(1)).toHaveValue('blabla');
  });
});
