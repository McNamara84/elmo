import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';

async function commitSave(page: import('@playwright/test').Page, filename: string) {
  const saveBtn = page.locator('#button-form-save');
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  const saveModal = page.locator('#modal-saveas');
  await expect(saveModal).toBeVisible();

  const filenameField = page.locator('#input-saveas-filename');
  await filenameField.fill(filename);

  await Promise.all([
    page.waitForRequest((request) => request.url().includes('csrf_token.php')),
    page.locator('#button-saveas-save').click(),
  ]);
}

test.describe('CSRF token on demand', () => {
  test('save populates the CSRF field after commit', async ({ page }) => {
    await page.route(SAVE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from('saved'),
      });
    });

    await navigateToHome(page);

    const csrfField = page.locator('#input-csrf-token');
    await expect(csrfField).toHaveValue('');

    await commitSave(page, 'dataset_playwright_on_demand');

    const tokenAfterSave = await csrfField.inputValue();
    expect(tokenAfterSave.length).toBeGreaterThanOrEqual(32);

    await page.unroute(SAVE_ENDPOINT);
  });

  test('same session reuses the token on a second save', async ({ page }) => {
    await page.route(SAVE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from('saved'),
      });
    });

    await navigateToHome(page);

    await commitSave(page, 'dataset_playwright_first');
    const firstToken = await page.locator('#input-csrf-token').inputValue();

    await commitSave(page, 'dataset_playwright_second');
    const secondToken = await page.locator('#input-csrf-token').inputValue();

    expect(firstToken.length).toBeGreaterThanOrEqual(32);
    expect(secondToken).toBe(firstToken);

    await page.unroute(SAVE_ENDPOINT);
  });
});
