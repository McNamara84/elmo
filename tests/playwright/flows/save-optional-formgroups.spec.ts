import { test, expect, type Page } from '@playwright/test';

const SAVE_ENDPOINT = '**/save/save_data.php';

/**
 * Tests for saving datasets with Contributor Persons and Spatial/Temporal Coverage.
 * These tests verify that the save endpoint handles optional formgroups correctly
 * and returns proper HTTP responses (not 500 errors).
 * 
 * Bug context:
 * - Bug #1: HTTP 500 when saving with Contributor Person data
 * - Bug #2: HTTP 500 when saving with Spatial/Temporal Coverage data  
 * - Both bugs were discovered on Stage environment
 * 
 * Note: Tests run serially to avoid race conditions with shared contributor/role data
 */
test.describe.configure({ mode: 'serial' });

test.describe('Save with optional formgroups - Contributor Persons and Coverage', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    // Wait for form to be ready
    await expect(page.locator('.navbar')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#form-mde')).toBeVisible({ timeout: 10_000 });
  });

  /**
   * Helper to fill mandatory fields before testing optional fields
   */
  async function fillMandatoryFields(page: Page) {
    // Resource Information
    await page.fill('#input-resourceinformation-title', `E2E Test Dataset ${Date.now()}`);
    await page.selectOption('#input-resourceinformation-resourcetype', { index: 1 });
    await page.selectOption('#input-resourceinformation-language', { index: 1 });
    await page.fill('#input-resourceinformation-publicationyear', '2026');

    // Author
    await page.fill('#input-author-orcid', '0000-0002-1825-0097');
    // Wait for ORCID lookup
    await page.waitForTimeout(1500);
    
    // Fill author name if not auto-populated
    const lastNameValue = await page.inputValue('#input-author-lastname');
    if (!lastNameValue) {
      await page.fill('#input-author-lastname', 'TestLastName');
      await page.fill('#input-author-firstname', 'TestFirstName');
    }

    // Abstract
    await page.fill('#input-abstract', 'This is a test abstract for E2E testing.');

    // Date Created
    await page.fill('#input-date-created', '2026-01-24');
  }

  /**
   * Helper to trigger save and capture the response
   */
  async function triggerSaveAndCaptureResponse(page: Page): Promise<{ status: number; ok: boolean }> {
    // Click Save button
    await page.click('#button-form-save');

    // Wait for save modal
    const saveModal = page.locator('#modal-saveas');
    await expect(saveModal).toBeVisible({ timeout: 10_000 });

    // Set up response listener before clicking save
    const responsePromise = page.waitForResponse(
      response => response.url().includes('save_data.php'),
      { timeout: 30_000 }
    );

    // Click Save button in modal
    await page.click('#button-saveas-save');

    // Wait for response
    const response = await responsePromise;
    return { status: response.status(), ok: response.ok() };
  }

  test('saves dataset with Contributor Person without HTTP 500 error', async ({ page }) => {
    // Fill mandatory fields first
    await fillMandatoryFields(page);

    // Add Contributor Person (field IDs: input-contributor-*)
    await page.fill('#input-contributor-lastname', 'ContributorLastName');
    await page.fill('#input-contributor-firstname', 'ContributorFirstName');

    // Wait for role Tagify to be initialized, then add a role
    // Role is required when contributor name is filled
    await page.waitForFunction(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      return !!input?._tagify && input._tagify.whitelist?.length >= 1;
    }, { timeout: 10_000 });

    await page.evaluate(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      input._tagify.addTags(['Data Curator']);
    });

    // Trigger save and check response
    const response = await triggerSaveAndCaptureResponse(page);

    // Assert that we don't get HTTP 500
    expect(response.status, 'Save with Contributor Person should not return HTTP 500').not.toBe(500);
    expect(response.ok, 'Save response should be successful').toBe(true);
  });

  test('saves dataset with Spatial/Temporal Coverage without HTTP 500 error', async ({ page }) => {
    // Fill mandatory fields first
    await fillMandatoryFields(page);

    // Add Spatial/Temporal Coverage
    await page.fill('#input-stc-latmin_1', '52.5');
    await page.fill('#input-stc-latmax_1', '52.6');
    await page.fill('#input-stc-longmin_1', '13.3');
    await page.fill('#input-stc-longmax_1', '13.4');
    await page.fill('#input-stc-datestart', '2026-01-01');
    await page.fill('#input-stc-dateend', '2026-12-31');

    // Trigger save and check response
    const response = await triggerSaveAndCaptureResponse(page);

    // Assert that we don't get HTTP 500
    expect(response.status, 'Save with Coverage should not return HTTP 500').not.toBe(500);
    expect(response.ok, 'Save response should be successful').toBe(true);
  });

  test('saves dataset with both Contributor Person AND Coverage without HTTP 500 error', async ({ page }) => {
    // Fill mandatory fields first
    await fillMandatoryFields(page);

    // Add Contributor Person (field IDs: input-contributor-*)
    await page.fill('#input-contributor-orcid', '0000-0001-5000-0007');
    await page.waitForTimeout(1000);
    const contributorLastName = await page.inputValue('#input-contributor-lastname');
    if (!contributorLastName) {
      await page.fill('#input-contributor-lastname', 'ContributorLastName');
      await page.fill('#input-contributor-firstname', 'ContributorFirstName');
    }

    // Wait for role Tagify to be initialized, then add a role
    await page.waitForFunction(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      return !!input?._tagify && input._tagify.whitelist?.length >= 1;
    }, { timeout: 10_000 });

    await page.evaluate(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      input._tagify.addTags(['Data Curator']);
    });

    // Add Spatial/Temporal Coverage
    await page.fill('#input-stc-latmin_1', '52.5');
    await page.fill('#input-stc-latmax_1', '52.6');
    await page.fill('#input-stc-longmin_1', '13.3');
    await page.fill('#input-stc-longmax_1', '13.4');
    await page.fill('#input-stc-datestart', '2026-01-01');
    await page.fill('#input-stc-dateend', '2026-12-31');

    // Trigger save and check response
    const response = await triggerSaveAndCaptureResponse(page);

    // Assert that we don't get HTTP 500
    expect(response.status, 'Save with Contributor + Coverage should not return HTTP 500').not.toBe(500);
    expect(response.ok, 'Save response should be successful').toBe(true);
  });

  test('downloads XML file after successful save with Contributor Person', async ({ page }) => {
    // Fill mandatory fields first
    await fillMandatoryFields(page);

    // Add Contributor Person (field IDs: input-contributor-*)
    await page.fill('#input-contributor-lastname', 'ContributorLastName');
    await page.fill('#input-contributor-firstname', 'ContributorFirstName');

    // Wait for role Tagify to be initialized, then add a role
    await page.waitForFunction(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      return !!input?._tagify && input._tagify.whitelist?.length >= 1;
    }, { timeout: 10_000 });

    await page.evaluate(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      input._tagify.addTags(['Data Curator']);
    });

    // Click Save button
    await page.click('#button-form-save');
    const saveModal = page.locator('#modal-saveas');
    await expect(saveModal).toBeVisible({ timeout: 10_000 });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });

    // Click Save button in modal
    await page.click('#button-saveas-save');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.xml$/);
  });

  test('downloads XML file after successful save with Coverage', async ({ page }) => {
    // Fill mandatory fields first
    await fillMandatoryFields(page);

    // Add Spatial/Temporal Coverage - need all coordinate fields
    await page.fill('#input-stc-latmin_1', '52.5');
    await page.fill('#input-stc-latmax_1', '52.6');
    await page.fill('#input-stc-longmin_1', '13.3');
    await page.fill('#input-stc-longmax_1', '13.4');
    await page.fill('#input-stc-datestart', '2026-01-01');

    // Click Save button
    await page.click('#button-form-save');
    const saveModal = page.locator('#modal-saveas');
    await expect(saveModal).toBeVisible({ timeout: 10_000 });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });

    // Click Save button in modal
    await page.click('#button-saveas-save');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.xml$/);
  });
});
