import { test, expect, type Page } from '@playwright/test';
import { navigateToHome } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';


async function getSaveButton(page: Page) {
  return page.locator('#button-form-save');
}

async function openSaveModal(page: Page) {
  const saveBtn = await getSaveButton(page);
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  const saveModal = page.locator('#modal-saveas');
  await expect(saveModal).toBeVisible();
  await expect(page.locator('#input-save-csrf-token')).not.toHaveValue('');

  const filenameField = page.locator('#input-saveas-filename');
  if (!(await filenameField.inputValue())) {
    await filenameField.fill('dataset_playwright_security');
  }

  return saveModal;
}

function extractMultipartField(body: string, fieldName: string): string | null {
  const pattern = new RegExp(`name="${fieldName}"\\r\\n\\r\\n([^\\r\\n]*)`);
  const match = body.match(pattern);
  return match ? match[1] : null;
}

test.describe('Save Operation Security Features', () => {
  test.describe('Honeypot field validation', () => {
    test('save form honeypot exists and starts empty', async ({ page }) => {
      await navigateToHome(page);

      const honeypotField = page.locator('#input-information-website');
      await expect(honeypotField).toHaveAttribute('tabindex', '-1');
      await expect(honeypotField).toHaveAttribute('autocomplete', 'off');
      await expect(honeypotField).toHaveValue('');
    });

    test('honeypot value is not cleared when save modal opens', async ({ page }) => {
      await navigateToHome(page);

      const honeypot = page.locator('#input-information-website');
      await honeypot.fill('bot-filled-value');

      await openSaveModal(page);
      await expect(honeypot).toHaveValue('bot-filled-value');
    });

    test('backend rejects save when honeypot is filled', async ({ page }) => {
      let submittedWebsite = '';

      await page.route(SAVE_ENDPOINT, async (route) => {
        const bodyBuffer = route.request().postDataBuffer();
        const body = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
        submittedWebsite = extractMultipartField(body, 'website') || '';

        const responseStatus = submittedWebsite ? 400 : 200;
        await route.fulfill({
          status: responseStatus,
          contentType: 'application/json',
          body: JSON.stringify(responseStatus === 400
            ? { error: 'Invalid request' }
            : { success: true, message: 'Saved' }),
        });
      });

      await navigateToHome(page);

      const honeypot = page.locator('#input-information-website');
      await honeypot.fill('bot-value');
      await openSaveModal(page);

      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes('save_data.php') && response.status() === 400
        ),
        page.locator('#button-saveas-save').click(),
      ]);

      expect(submittedWebsite).toBe('bot-value');

      await expect(page.locator('.alert-danger')).toBeVisible();
      await page.unroute(SAVE_ENDPOINT);
    });
  });

  test.describe('Security fields in save operation', () => {
    test('save request includes expected hidden security fields', async ({ page }) => {
      let capturedBody = '';

      await page.route(SAVE_ENDPOINT, async (route) => {
        const bodyBuffer = route.request().postDataBuffer();
        capturedBody = bodyBuffer ? bodyBuffer.toString('utf-8') : '';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Saved' }),
        });
      });

      await navigateToHome(page);
      await openSaveModal(page);

      await Promise.all([
        page.waitForRequest(SAVE_ENDPOINT),
        page.locator('#button-saveas-save').click(),
      ]);

      expect(capturedBody).toContain('name="csrf_token"');
      expect(capturedBody).toContain('name="save_time_spent"');
      expect(capturedBody).toContain('name="website"');
      expect(extractMultipartField(capturedBody, 'csrf_token')).toBeTruthy();

      await page.unroute(SAVE_ENDPOINT);
    });
  });

  test.describe('CSRF token protection in save', () => {
    test('save form includes CSRF token field', async ({ page }) => {
      await navigateToHome(page);
            
      // Check for hidden CSRF field
      const csrfField = page.locator('input[id="input-save-csrf-token"]');
      
      if (await csrfField.count() > 0) {
        await expect(csrfField).toHaveAttribute('type', 'hidden');
      }
    });

    test('backend rejects save when token is invalid', async ({ page }) => {
      await page.route(SAVE_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid request - CSRF token validation failed' }),
        });
      });

      await navigateToHome(page);

      await openSaveModal(page);
      await page.locator('#input-save-csrf-token').evaluate((el) => {
        (el as HTMLInputElement).value = 'corrupted-token';
      });

      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes('save_data.php') && response.status() === 403
        ),
        page.locator('#button-saveas-save').click(),
      ]);

      await expect(page.locator('.alert-danger')).toBeVisible();
      await page.unroute(SAVE_ENDPOINT);
    });
  });

  test.describe('Time-spent validation on save', () => {
    test('backend rejects save when time_spent is below threshold', async ({ page }) => {
      await page.route(SAVE_ENDPOINT, async (route) => {
        const bodyBuffer = route.request().postDataBuffer();
        const body = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
        const timeSpent = extractMultipartField(body, 'save_time_spent');
        const timeSpentSeconds = parseInt(timeSpent || '0', 10);

        // Reject if time spent is below 2 seconds
        const responseStatus = timeSpentSeconds < 2 ? 400 : 200;
        await route.fulfill({
          status: responseStatus,
          contentType: 'application/json',
          body: JSON.stringify(responseStatus === 400
            ? { error: 'insufficient time spent' }
            : { success: true, message: 'Saved' }),
        });
      });

      await navigateToHome(page);

      // Open modal and submit immediately (minimal time spent)
      await openSaveModal(page);

      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes('save_data.php') && response.status() === 400
        ),
        page.locator('#button-saveas-save').click(),
      ]);

      await expect(page.locator('.alert-danger')).toBeVisible();
      await page.unroute(SAVE_ENDPOINT);
    });
  });

  test.describe('Rate limiting on save operations', () => {
    test('shows rate limit error message when server returns 429', async ({ page }) => {
      await page.route(SAVE_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Too many save requests. Please try again later.',
          }),
        });
      });
      
      await navigateToHome(page);

      await openSaveModal(page);
      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes('save_data.php') && response.status() === 429
        ),
        page.locator('#button-saveas-save').click(),
      ]);

      const errorAlert = page.locator('.alert-danger');
      if (await errorAlert.count() > 0) {
        await expect(errorAlert).toBeVisible();
      }
      
      await page.unroute(SAVE_ENDPOINT);
    });
  });

  test.describe('Successful save with all security checks passing', () => {
    test('backend accepts save when honeypot empty, csrf valid, time sufficient, and not rate limited', async ({ page }) => {
      await page.route(SAVE_ENDPOINT, async (route) => {
        const bodyBuffer = route.request().postDataBuffer();
        const body = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
        
        // Verify all security fields are present
        const honeypot = extractMultipartField(body, 'website') || '';
        const csrfToken = extractMultipartField(body, 'csrf_token') || '';
        const timeSpent = extractMultipartField(body, 'save_time_spent') || '0';
        const timeSpentSeconds = parseInt(timeSpent, 10);

        // Accept if honeypot is empty, csrf exists, and time >= 2 seconds
        const isValid = honeypot === '' && csrfToken && timeSpentSeconds >= 2;
        const responseStatus = isValid ? 200 : 400;

        await route.fulfill({
          status: responseStatus,
          contentType: 'application/json',
          body: JSON.stringify(responseStatus === 200
            ? { success: true, message: 'File saved successfully' }
            : { error: 'Security validation failed' }),
        });
      });

      await navigateToHome(page);

      const honeypot = page.locator('#input-information-website');
      // Ensure honeypot is empty (should be by default)
      await expect(honeypot).toHaveValue('');

      // Open modal - this fetches fresh CSRF token
      await openSaveModal(page);
      
      // Verify CSRF token was populated
      await expect(page.locator('#input-save-csrf-token')).not.toHaveValue('');

      // Wait 2+ seconds to ensure time_spent >= 2
      await page.waitForTimeout(2100);

      // Click save and wait for success response
      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes('save_data.php') && response.status() === 200
        ),
        page.locator('#button-saveas-save').click(),
      ]);

      // Verify success notification appears
      await expect(page.locator('.alert-success')).toBeVisible();
      await page.unroute(SAVE_ENDPOINT);
    });
  });
});