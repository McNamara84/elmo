import { test, expect, type Page } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome } from '../utils';

const CSRF_ENDPOINT = '**/api/csrf_token.php*';
const SAVE_ENDPOINT = '**/save/save_data.php';
const SUBMIT_ENDPOINT = '**/send_xml_file.php';

function extractMultipartField(body: string, fieldName: string): string | null {
  const pattern = new RegExp(`name="${fieldName}"\\r\\n\\r\\n([^\\r\\n]*)`);
  const match = body.match(pattern);
  return match ? match[1] : null;
}

async function openSaveModal(page: Page): Promise<void> {
  const modal = page.locator('#modal-saveas');
  if (!(await modal.isVisible())) {
    await page.locator('#button-form-save').click();
  }
  await expect(modal).toBeVisible();
}

async function closeNotificationModalIfVisible(page: Page): Promise<void> {
  const notificationModal = page.locator('#modal-notification');
  if (await notificationModal.isVisible()) {
    await notificationModal.getByRole('button', { name: 'OK' }).click();
    await expect(notificationModal).toBeHidden();
  }
}

async function confirmSave(page: Page): Promise<void> {
  const filenameField = page.locator('#input-saveas-filename');
  if (!(await filenameField.inputValue())) {
    await filenameField.fill('dataset_playwright_token_rotation');
  }
  await page.locator('#button-saveas-save').click();
}

test.describe('CSRF Token Rotation Flow', () => {
  test('form token exists, rotates after save/submit, and save time gate works after rotation', async ({ page }) => {
    let formTokenCounter = 0;
    let feedbackTokenCounter = 0;

    await page.route(CSRF_ENDPOINT, async (route) => {
      const requestUrl = new URL(route.request().url());
      const scope = requestUrl.searchParams.get('scope') || 'form';

      if (scope === 'feedback') {
        feedbackTokenCounter += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            token: `feedback-token-${feedbackTokenCounter}`,
            scope,
          }),
        });
        return;
      }

      formTokenCounter += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: `form-token-${formTokenCounter}`,
          scope: 'form',
        }),
      });
    });

    await page.route(SAVE_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      const body = bodyBuffer ? bodyBuffer.toString('utf-8') : '';

      const timeSpent = parseInt(extractMultipartField(body, 'save_time_spent') || '0', 10);
      const csrfToken = extractMultipartField(body, 'csrf_token') || '';

      if (timeSpent < 2) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'insufficient time spent' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: `saved with token ${csrfToken}`,
      });
    });

    await page.route(SUBMIT_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      const body = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
      const csrfToken = extractMultipartField(body, 'csrf_token') || '';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: `submitted with token ${csrfToken}`,
        }),
      });
    });

    await navigateToHome(page);

    const formCsrfField = page.locator('#input-form-csrf-token');
    await expect(formCsrfField).toHaveValue('form-token-1');

    const tokenBeforeSave = await formCsrfField.inputValue();
    expect(tokenBeforeSave).toBe('form-token-1');

    await openSaveModal(page);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/save/save_data.php') && response.status() === 400),
      confirmSave(page),
    ]);

    await expect(page.locator('.alert-danger')).toBeVisible();

    await expect.poll(async () => formCsrfField.inputValue()).toBe('form-token-2');
    await closeNotificationModalIfVisible(page);

    await openSaveModal(page);
    await page.waitForTimeout(2200);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/save/save_data.php') && response.status() === 200),
      confirmSave(page),
    ]);

    await expect(page.locator('.alert-success')).toBeVisible();
    await expect.poll(async () => formCsrfField.inputValue()).toBe('form-token-3');
    await closeNotificationModalIfVisible(page);

    await completeMinimalDatasetForm(page);
    await page.locator('#button-form-submit').click();
    await expect(page.locator('#modal-submit')).toBeVisible();
    await page.check('#input-submit-privacycheck');

    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/send_xml_file.php') && response.status() === 200),
      page.locator('#button-submit-submit').click(),
    ]);

    await expect.poll(async () => formCsrfField.inputValue()).toBe('form-token-4');

    await page.unroute(CSRF_ENDPOINT);
    await page.unroute(SAVE_ENDPOINT);
    await page.unroute(SUBMIT_ENDPOINT);
  });
});
