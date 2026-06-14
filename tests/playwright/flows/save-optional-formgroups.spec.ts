import { test, expect, type Page } from '@playwright/test';
import { navigateToHome } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';
const MOCK_XML_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>\n<dataset>Test dataset with optional formgroups</dataset>`;

/**
 * Tests for saving datasets with Contributor Persons and Spatial/Temporal Coverage.
 * These tests verify that the form correctly handles optional formgroups
 * and that the data is properly serialized for the save endpoint.
 * 
 * Bug context:
 * - Bug #1: HTTP 500 when saving with Contributor Person data (fixed in PHP)
 * - Bug #2: HTTP 500 when saving with Spatial/Temporal Coverage data (fixed in PHP)
 * - Both bugs were discovered on Stage environment
 * 
 * These tests mock the backend response to ensure consistent CI behavior.
 * The actual PHP fix is tested on Stage environment separately.
 */

test.describe('Save with optional formgroups - Contributor Persons and Coverage', () => {
  
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  /**
   * Helper to fill mandatory fields before testing optional fields
   */
  async function fillMandatoryFields(page: Page) {
    // Resource Information
    await page.fill('#input-resourceinformation-title', `E2E Test Dataset ${Date.now()}`);
    
    // Wait for Resource Type dropdown to be populated
    await page.waitForFunction(() => {
      const resourceType = document.querySelector('#input-resourceinformation-resourcetype') as HTMLSelectElement;
      return resourceType && resourceType.options.length > 1;
    }, { timeout: 10_000 });
    
    // Use explicit option values for stability (matches approach in utils/flows.ts)
    // Value '5' = Dataset, Value '1' = English
    await page.selectOption('#input-resourceinformation-resourcetype', '5');
    
    // Wait for Language dropdown to be populated
    await page.waitForFunction(() => {
      const language = document.querySelector('#input-resourceinformation-language') as HTMLSelectElement;
      return language && language.options.length > 1;
    }, { timeout: 10_000 });
    
    await page.selectOption('#input-resourceinformation-language', '1');
    await page.fill('#input-resourceinformation-publicationyear', '2026');

    // Author - fill directly without ORCID lookup for speed
    await page.fill('#input-author-lastname', 'TestLastName');
    await page.fill('#input-author-firstname', 'TestFirstName');

    // Abstract
    await page.fill('#input-abstract', 'This is a test abstract for E2E testing.');

    // Date Created
    await page.fill('#input-date-created', '2026-01-24');
  }

  /**
   * Helper to set up mocked save endpoint
   */
  async function mockSaveEndpoint(page: Page): Promise<{ getRequestBody: () => string | null }> {
    let capturedRequestBody: string | null = null;
    
    await page.route(SAVE_ENDPOINT, async (route) => {
      const request = route.request();
      capturedRequestBody = request.postData();
      
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        headers: {
          'Content-Disposition': 'attachment; filename="test-optional-formgroups.xml"',
        },
        body: MOCK_XML_RESPONSE,
      });
    });
    
    return {
      getRequestBody: () => capturedRequestBody,
    };
  }

  /**
   * Helper to trigger save with mocked endpoint
   */
  async function triggerSaveWithMock(page: Page): Promise<{ requestBody: string | null }> {
    const { getRequestBody } = await mockSaveEndpoint(page);
    
    // Click Save button
    await page.click('#button-form-save');

    // Wait for save modal
    const saveModal = page.locator('#modal-saveas');
    await expect(saveModal).toBeVisible({ timeout: 10_000 });

    // Fill filename
    await page.fill('#input-saveas-filename', 'test-optional-formgroups');

    // Set up download and response listeners
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    const responsePromise = page.waitForResponse(
      response => response.url().includes('save_data.php'),
      { timeout: 30_000 }
    );

    // Wait 2+ seconds to meet backend minimum interaction time for save
    await page.waitForTimeout(2100);

    // Click Save button in modal
    await page.click('#button-saveas-save');

    // Wait for both
    const [, response] = await Promise.all([downloadPromise, responsePromise]);

    expect(response.status()).toBe(200);
    
    // Clean up route
    await page.unroute(SAVE_ENDPOINT);
    
    return { requestBody: getRequestBody() };
  }

  test('saves dataset with Contributor Person data in request body', async ({ page }) => {
    await fillMandatoryFields(page);

    // Contributor section must be available in CI test fixture
    const contributorSection = page.locator('#input-contributor-lastname');
    await expect(contributorSection).toBeVisible({ timeout: 10_000 });

    // Add Contributor Person
    await page.fill('#input-contributor-lastname', 'ContributorLastName');
    await page.fill('#input-contributor-firstname', 'ContributorFirstName');

    // Wait for role Tagify to be initialized
    const roleInput = page.locator('#input-contributor-personrole');
    const roleInputExists = await roleInput.count() > 0;
    
    if (roleInputExists) {
      // Wait for Tagify initialization with longer timeout for CI and fail if unavailable
      await page.waitForFunction(() => {
        const input: any = document.querySelector('#input-contributor-personrole');
        return !!input?._tagify && Array.isArray(input._tagify.whitelist) && input._tagify.whitelist.length >= 1;
      }, { timeout: 20_000 });

      // Add the first available role from whitelist
      await page.evaluate(() => {
        const input: any = document.querySelector('#input-contributor-personrole');
        if (input?._tagify?.whitelist?.length > 0) {
          const firstRole = input._tagify.whitelist[0];
          input._tagify.addTags([firstRole]);
        }
      });
      
      // Wait for tag to be registered
      await page.waitForTimeout(500);
    }

    // Trigger save with mocked endpoint
    const { requestBody } = await triggerSaveWithMock(page);

    // Verify contributor data was included in request
    expect(requestBody).not.toBeNull();
    expect(requestBody).toContain('ContributorLastName');
    expect(requestBody).toContain('ContributorFirstName');
  });

  test('saves dataset with Spatial/Temporal Coverage data in request body', async ({ page }) => {
    await fillMandatoryFields(page);

    // Coverage section must be available in CI test fixture
    const coverageSection = page.locator('#input-stc-latmin_1');
    await expect(coverageSection).toBeVisible({ timeout: 10_000 });

    // Add Spatial/Temporal Coverage
    await page.fill('#input-stc-latmin_1', '52.5');
    await page.fill('#input-stc-latmax_1', '52.6');
    await page.fill('#input-stc-longmin_1', '13.3');
    await page.fill('#input-stc-longmax_1', '13.4');
    await page.fill('#input-stc-datestart', '2026-01-01');
    await page.fill('#input-stc-dateend', '2026-12-31');

    // Trigger save with mocked endpoint
    const { requestBody } = await triggerSaveWithMock(page);

    // Verify coverage data was included in request
    expect(requestBody).not.toBeNull();
    expect(requestBody).toContain('52.5');
    expect(requestBody).toContain('52.6');
    expect(requestBody).toContain('13.3');
    expect(requestBody).toContain('13.4');
  });

  test('saves dataset with both Contributor Person AND Coverage in request body', async ({ page }) => {
    await fillMandatoryFields(page);

    // Both sections must be available in CI test fixture
    const contributorSection = page.locator('#input-contributor-lastname');
    const coverageSection = page.locator('#input-stc-latmin_1');
    await expect(contributorSection).toBeVisible({ timeout: 10_000 });
    await expect(coverageSection).toBeVisible({ timeout: 10_000 });

    // Add Contributor Person
    await page.fill('#input-contributor-lastname', 'ContributorLastName');
    await page.fill('#input-contributor-firstname', 'ContributorFirstName');

    // Add role if Tagify is available
    await page.waitForFunction(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      return !!input?._tagify && Array.isArray(input._tagify.whitelist) && input._tagify.whitelist.length >= 1;
    }, { timeout: 20_000 });

    await page.evaluate(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      if (input?._tagify?.whitelist?.length > 0) {
        input._tagify.addTags([input._tagify.whitelist[0]]);
      }
    });
    await page.waitForTimeout(500);

    // Add Spatial/Temporal Coverage
    await page.fill('#input-stc-latmin_1', '52.5');
    await page.fill('#input-stc-latmax_1', '52.6');
    await page.fill('#input-stc-longmin_1', '13.3');
    await page.fill('#input-stc-longmax_1', '13.4');
    await page.fill('#input-stc-datestart', '2026-01-01');
    await page.fill('#input-stc-dateend', '2026-12-31');

    // Trigger save with mocked endpoint
    const { requestBody } = await triggerSaveWithMock(page);

    // Verify both contributor and coverage data were included
    expect(requestBody).not.toBeNull();
    expect(requestBody).toContain('ContributorLastName');
    expect(requestBody).toContain('52.5');
  });

  test('downloads XML file after successful save with optional formgroups', async ({ page }) => {
    await fillMandatoryFields(page);

    // Add Coverage (simpler than Contributor, no Tagify needed)
    const coverageSection = page.locator('#input-stc-latmin_1');
    const isCoverageVisible = await coverageSection.isVisible().catch(() => false);
    
    if (isCoverageVisible) {
      await page.fill('#input-stc-latmin_1', '52.5');
      await page.fill('#input-stc-latmax_1', '52.6');
      await page.fill('#input-stc-longmin_1', '13.3');
      await page.fill('#input-stc-longmax_1', '13.4');
    }

    // Set up mocked endpoint
    await mockSaveEndpoint(page);
    
    // Click Save button
    await page.click('#button-form-save');
    const saveModal = page.locator('#modal-saveas');
    await expect(saveModal).toBeVisible({ timeout: 10_000 });
    
    await page.fill('#input-saveas-filename', 'test-optional-formgroups');

    // Wait for download
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    // Wait 2+ seconds to meet backend minimum interaction time for save
    await page.waitForTimeout(2100);
    await page.click('#button-saveas-save');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.xml$/);
    
    await page.unroute(SAVE_ENDPOINT);
  });
});
