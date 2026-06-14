import { test, expect } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome, SELECTORS } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';
const MOCK_XML_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>\n<dataset>Test duplicate funding</dataset>`;

/**
 * Bug #767: Duplicate Funding References When Optional Fields Are NULL.
 *
 * These tests verify the frontend form behaviour when identical funding
 * references are submitted with empty optional fields. The backend fix uses
 * the NULL-safe operator `<=>` to prevent duplicate rows.
 */

test.describe('Bug #767 – Duplicate Funding Reference with NULL optional fields', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('serializes duplicate funder-only entries correctly in form data', async ({ page }) => {
    await completeMinimalDatasetForm(page);

    // Fill the first funding reference row (only funder name, optional fields empty)
    const fundingGroup = page.locator(SELECTORS.formGroups.fundingReference);
    const firstFunder = fundingGroup.locator('.inputFunder').first();
    await firstFunder.fill('Test Funder Only');

    // Add a second identical funding reference row
    await page.locator('#button-fundingreference-add').click();
    const rows = page.locator('[funding-reference-row]');
    await expect(rows).toHaveCount(2);

    const secondFunder = rows.nth(1).locator('.inputFunder');
    await secondFunder.fill('Test Funder Only');

    // Trigger save
    await page.locator('#button-form-save').click();
    const saveModal = page.locator(SELECTORS.modals.saveAs);
    await expect(saveModal).toBeVisible({ timeout: 10_000 });
    await page.fill('#input-saveas-filename', 'bug-767-duplicate-funding');

    let capturedRequestBody = '';
    await page.route(SAVE_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      capturedRequestBody = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        headers: {
          'Content-Disposition': 'attachment; filename="bug-767-duplicate-funding.xml"',
        },
        body: MOCK_XML_RESPONSE,
      });
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    const responsePromise = page.waitForResponse(
      response => response.url().includes('save_data.php'),
      { timeout: 30_000 },
    );

    // Wait 2+ seconds to meet backend minimum interaction time for save
    await page.waitForTimeout(2100);

    await saveModal.getByRole('button', { name: 'Save' }).click();

    await Promise.all([downloadPromise, responsePromise]);

    // Verify both funder names are serialized in the POST body
    expect(capturedRequestBody).toContain('Test Funder Only');

    // Both funder[] entries should be present
    const funderMatches = capturedRequestBody.match(/name="funder\[\]"/g);
    expect(funderMatches).not.toBeNull();
    expect(funderMatches!.length).toBe(2);

    // Grant number, grant name, award URI should also be serialized (as empty values)
    expect(capturedRequestBody).toContain('name="grantNummer[]"');
    expect(capturedRequestBody).toContain('name="grantName[]"');
    expect(capturedRequestBody).toContain('name="awardURI[]"');

    await page.unroute(SAVE_ENDPOINT);
  });

  test('duplicate funding reference with only funder name is accepted by mocked backend', async ({ page }) => {
    await completeMinimalDatasetForm(page);

    // Fill only the funder name (all optional fields stay empty)
    const fundingGroup = page.locator(SELECTORS.formGroups.fundingReference);
    const firstFunder = fundingGroup.locator('.inputFunder').first();
    await firstFunder.fill('Duplicate Funder E2E');

    // Add second identical row
    await page.locator('#button-fundingreference-add').click();
    const rows = page.locator('[funding-reference-row]');
    await expect(rows).toHaveCount(2);

    const secondFunder = rows.nth(1).locator('.inputFunder');
    await secondFunder.fill('Duplicate Funder E2E');

    // Trigger save with mocked backend
    await page.locator('#button-form-save').click();
    const saveModal = page.locator(SELECTORS.modals.saveAs);
    await expect(saveModal).toBeVisible({ timeout: 10_000 });
    await page.fill('#input-saveas-filename', 'bug-767-real-save');

    let capturedRequestBody = '';
    await page.route(SAVE_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      capturedRequestBody = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        headers: {
          'Content-Disposition': 'attachment; filename="bug-767-real-save.xml"',
        },
        body: MOCK_XML_RESPONSE,
      });
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    const responsePromise = page.waitForResponse(
      response => response.url().includes('save_data.php'),
      { timeout: 30_000 },
    );

    // Wait 2+ seconds to meet backend minimum interaction time for save
    await page.waitForTimeout(2100);

    await saveModal.getByRole('button', { name: 'Save' }).click();

    const [, response] = await Promise.all([downloadPromise, responsePromise]);
    expect(response.status()).toBe(200);

    // Both duplicate funders should be serialized in the request body
    const funderMatches = capturedRequestBody.match(/name="funder\[\]"/g);
    expect(funderMatches).not.toBeNull();
    expect(funderMatches!.length).toBe(2);

    // Verify success notification appears (no error alerts)
    const notificationModal = page.locator(SELECTORS.modals.notification);
    await expect(notificationModal).toBeVisible({ timeout: 10_000 });

    const dangerAlert = notificationModal.locator('.alert-danger');
    const dangerCount = await dangerAlert.count();
    expect(dangerCount, 'Save should not produce error alerts').toBe(0);

    await page.unroute(SAVE_ENDPOINT);
  });
});
