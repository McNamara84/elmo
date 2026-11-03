import { test, expect } from '@playwright/test';
import { expectNavbarVisible, navigateToHome } from '../utils';

test.describe('License Dropdown - No Duplicates', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await page.locator('#input-resourceinformation-resourcetype').selectOption({ label: 'Dataset' });
    await expect(page.locator('#input-rights-license')).toBeEnabled();
  });

  test('reloading the same grants does not duplicate entries', async ({ page }) => {
    const license = page.locator('#input-rights-license');
    const values = () => license.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
    const initial = await values();
    expect(initial.length).toBeGreaterThan(1);
    await page.locator('#input-resourceinformation-resourcetype').dispatchEvent('change');
    await expect(license).toBeEnabled();
    expect(await values()).toEqual(initial);
    expect(new Set(await values()).size).toBe(initial.length);
  });

  test('defaults CC BY only when this profile allows it', async ({ page }) => {
    const id = await page.locator('#input-resourceinformation-resourcetype').inputValue();
    const response = await page.request.get('api/v2/vocabs/licenses/resource-type/' + id);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const cc = body.licenses.find((row: { rightsIdentifier: string; schemeURI: string }) =>
      row.rightsIdentifier?.toUpperCase() === 'CC-BY-4.0' && /^https:\/\/spdx\.org\/licenses\/?$/.test(row.schemeURI));
    await expect(page.locator('#input-rights-license')).toHaveValue(cc ? String(cc.rights_id) : '');
  });
});
