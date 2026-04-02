/**
 * Regression test for console errors and XML upload field population.
 *
 * Verifies that the following issues do not regress:
 * - Race condition in applyTranslations() when descriptionTypes AJAX resolves first
 * - Abstract and Funder fields not populated during XML upload
 * - Duplicate modal IDs in HTML
 *
 * Uses the Playwright baseURL fixture (from playwright.config.ts or --base-url).
 * Override via Playwright config, e.g.:
 *   npx playwright test stage-diagnosis --project=chromium
 */
import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/elmo.test</identifier>
  <publicationYear>2024</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="MainTitle">Stage Diagnosis Test</title>
  </titles>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
    </creator>
  </creators>
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">This is a test abstract for diagnosis.</description>
  </descriptions>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">CC BY 4.0</rights>
  </rightsList>
  <fundingReferences>
    <fundingReference>
      <funderName>Deutsche Forschungsgemeinschaft</funderName>
      <funderIdentifier funderIdentifierType="Crossref Funder ID">501100001659</funderIdentifier>
      <awardNumber awardURI="https://example.org/grants/TEST123">TEST123</awardNumber>
      <awardTitle>Test Grant Title</awardTitle>
    </fundingReference>
  </fundingReferences>
</resource>`;

test.describe('Console errors regression', () => {
  test('no JavaScript errors on initial page load', async ({ page }) => {
    const jsErrors: string[] = [];
    const consoleErrors: string[] = [];

    // Register listeners BEFORE navigation to capture initialization-time errors
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await navigateToHome(page);

    // Wait for async initialization via concrete conditions, not fixed sleeps
    await page.waitForFunction(
      () => (window as any).descriptionTypesReady instanceof Promise,
      { timeout: 10_000 },
    );
    await page.evaluate(() => (window as any).descriptionTypesReady);

    // Filter out known external/non-critical warnings
    const criticalErrors = jsErrors.filter(
      (e) => !e.includes('google.maps') && !e.includes('installHook'),
    );

    expect(criticalErrors).toEqual([]);
  });

  test('descriptionTypesReady promise resolves', async ({ page }) => {
    await navigateToHome(page);

    // Wait for the promise to exist on window
    await page.waitForFunction(
      () => (window as any).descriptionTypesReady instanceof Promise,
      { timeout: 10_000 },
    );

    const promiseState = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        if (!(window as any).descriptionTypesReady) {
          resolve('NOT_SET');
          return;
        }
        let resolved = false;
        (window as any).descriptionTypesReady.then(() => {
          resolved = true;
          resolve('RESOLVED');
        });
        setTimeout(() => {
          if (!resolved) resolve('STUCK');
        }, 10000);
      });
    });

    expect(promiseState).toBe('RESOLVED');
  });

  test('no duplicate HTML IDs on upload modal', async ({ page }) => {
    await navigateToHome(page);

    // Wait for the upload modal element to be in the DOM
    await page.waitForSelector('#modal-uploadxml', { timeout: 10_000 });

    // Verify the upload modal ID is unique (was duplicated on both div and h5)
    const uploadModalCount = await page.evaluate(() => {
      return document.querySelectorAll('#modal-uploadxml').length;
    });

    expect(uploadModalCount).toBe(1);

    // Verify the label element now has a distinct ID
    const labelExists = await page.evaluate(() => {
      return document.querySelector('#modal-uploadxml-label') !== null;
    });

    expect(labelExists).toBe(true);
  });
});

test.describe('XML Upload field population regression', () => {
  test('Abstract and Funder fields are populated after XML upload', async ({ page }) => {
    const jsErrors: string[] = [];

    // Register pageerror listener BEFORE navigation
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });

    await navigateToHome(page);

    // Wait for async initialization via concrete condition
    await page.waitForFunction(
      () => (window as any).descriptionTypesReady instanceof Promise,
      { timeout: 10_000 },
    );

    // Click Load button
    const loadButton = page.locator('#button-form-load');
    await expect(loadButton).toBeVisible({ timeout: 10_000 });
    await loadButton.click();

    // Wait for upload modal
    const modal = page.locator('div#modal-uploadxml');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Upload XML file
    await page.setInputFiles('#input-uploadxml-file', {
      name: 'regression-test.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(SAMPLE_XML, 'utf-8'),
    });

    // Wait for title to be populated (indicates loadXmlToForm completed initial steps)
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Stage Diagnosis Test',
      { timeout: 15_000 },
    );

    // Wait for descriptionTypesReady to resolve (gates Funder/Abstract population)
    await page.evaluate(() => (window as any).descriptionTypesReady);

    // Assert Abstract was populated
    await expect(page.locator('#input-abstract')).toHaveValue(
      'This is a test abstract for diagnosis.',
      { timeout: 10_000 },
    );

    // Assert Funder fields were populated
    await expect(page.locator('input[name="funder[]"]').first()).toHaveValue(
      'Deutsche Forschungsgemeinschaft',
      { timeout: 10_000 },
    );
    await expect(page.locator('input[name="grantNummer[]"]').first()).toHaveValue(
      'TEST123',
    );
    await expect(page.locator('input[name="grantName[]"]').first()).toHaveValue(
      'Test Grant Title',
    );
  });
});
