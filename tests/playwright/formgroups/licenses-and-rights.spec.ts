import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../utils';

test.describe("Licenses and Rights", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator('#input-rights-license')).toBeVisible();
  });

  test("License dropdown follows the resource-type API", async ({ page }) => {
    const license = page.locator('#input-rights-license');
    const resourceType = page.locator('#input-resourceinformation-resourcetype');
    for (const label of ['Software', 'Dataset']) {
      // Clear the previous choice so this assertion contains only current grants.
      await page.evaluate(() => { (window as any).elmo.licenses.selection = null; });
      await resourceType.selectOption({ label });
      await expect(license).toBeEnabled();
      const response = await page.request.get('api/v2/vocabs/licenses/resource-type/' + await resourceType.inputValue());
      expect(response.ok()).toBe(true);
      const body = await response.json();
      expect(body.availability).toBe('available');
      await expect(license.locator('option')).toHaveCount(body.licenses.length + 1);
      expect(await license.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
        .toEqual(['', ...body.licenses.map((row: { rights_id: number }) => String(row.rights_id))]);
    }
  });

  test("Help button displays rights help", async ({ page }) => {
    // Ensure help is on
    await enableHelp(page);

    // Open help for rights section
    await page.locator('[data-help-section-id="help-rights"]').click();
    const modal = page.locator(SELECTORS.modals.help);
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-body')).toContainText('Licenses and Rights');
  });
  test("License dropdown does not contain duplicate entries (#875)", async ({ page }) => {
    const licenseSelect = page.locator('#input-rights-license');
    
    await page.locator('#input-resourceinformation-resourcetype').selectOption({ label: 'Dataset' });
    await expect(licenseSelect).toBeEnabled();
    
    const options = licenseSelect.locator("option");
    const allTextContents = await options.allTextContents();
    
    // Filter out empty options
    const validLicenses = allTextContents.filter(text => text.trim() !== '');
    
    // Check for duplicates by comparing length with Set (which removes duplicates)
    const uniqueLicenses = new Set(validLicenses);
    expect(validLicenses.length).toBe(uniqueLicenses.size);
  });
});