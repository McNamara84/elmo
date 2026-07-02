import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';

test.describe('Session token preservation', () => {
  test('form CSRF token is reused across saves in the same session', async ({ page }) => {
    await page.route(SAVE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from('saved'),
      });
    });

    await navigateToHome(page);
    await expect(page.locator('#input-csrf-token')).toHaveValue('');

    const saveBtn = page.locator('#button-form-save');
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();

    const saveModal = page.locator('#modal-saveas');
    await expect(saveModal).toBeVisible();

    const filenameField = page.locator('#input-saveas-filename');
    if (!(await filenameField.inputValue())) {
      await filenameField.fill('dataset_playwright_session');
    }

    let firstToken = '';
    await Promise.all([
      page.waitForRequest((request) => request.url().includes('csrf_token.php')),
      page.locator('#button-saveas-save').click(),
    ]);
    await expect(page.locator('#input-csrf-token')).not.toHaveValue('');
    firstToken = await page.locator('#input-csrf-token').inputValue();

    await saveBtn.click();
    await expect(saveModal).toBeVisible();
    if (!(await filenameField.inputValue())) {
      await filenameField.fill('dataset_playwright_session_2');
    }

    await Promise.all([
      page.waitForRequest((request) => request.url().includes('save_data.php')),
      page.locator('#button-saveas-save').click(),
    ]);

    const secondToken = await page.locator('#input-csrf-token').inputValue();
    expect(secondToken).toBe(firstToken);

    await page.unroute(SAVE_ENDPOINT);
  });
});
