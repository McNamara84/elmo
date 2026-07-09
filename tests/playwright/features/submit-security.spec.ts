import { test, expect, type Page } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome, SELECTORS } from '../utils';

const SUBMIT_ENDPOINT = '**/send_xml_file.php';

async function openSubmitModal(page: Page) {
  await completeMinimalDatasetForm(page);

  const submitBtn = page.locator('#button-form-submit');
  await submitBtn.scrollIntoViewIfNeeded();
  await submitBtn.click();

  const submitModal = page.locator('#modal-submit');
  await expect(submitModal).toBeVisible({ timeout: 5000 });

  // Form token is in main form, not modal - verify it exists in the main form
  const csrfField = page.locator('#input-csrf-token');
  await expect(csrfField).toHaveValue('');

  return { submitModal, csrfField };
}

function extractMultipartField(body: string, fieldName: string): string | null {
  const pattern = new RegExp(`name="${fieldName}"\\r\\n\\r\\n([^\\r\\n]*)`);
  const match = body.match(pattern);
  return match ? match[1] : null;
}

async function submitFromModalWithPrivacyConsent(page: Page) {
  const privacyCheckbox = page.locator('#input-submit-privacycheck');
  if (!(await privacyCheckbox.isChecked())) {
    await privacyCheckbox.check();
  }

  const modalSubmitButton = page.locator('#button-submit-submit');
  await expect(modalSubmitButton).toBeEnabled();
  await modalSubmitButton.click();
}

test.describe('Submit Operation Security Features', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('submit modal exposes honeypot + CSRF fields and honeypot starts empty', async ({ page }) => {
    const { submitModal, csrfField } = await openSubmitModal(page);

    const honeypotField = submitModal.locator('input[name="website"]').first();
    await expect(honeypotField).toHaveAttribute('tabindex', '-1');
    await expect(honeypotField).toHaveAttribute('autocomplete', 'off');
    await expect(honeypotField).toHaveValue('');

    // CSRF token is in main form, not in modal
    await expect(csrfField).toHaveAttribute('type', 'hidden');
    await expect(csrfField).toHaveValue('');
  });

  test('normal submit with privacy consent succeeds', async ({ page }) => {
    await page.route(SUBMIT_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Submitted successfully' }),
      });
    });

    const { submitModal } = await openSubmitModal(page);

    await Promise.all([
      page.waitForRequest(SUBMIT_ENDPOINT),
      submitFromModalWithPrivacyConsent(page),
    ]);

    const notificationModal = page.locator(SELECTORS.modals.notification);
    await expect(notificationModal).toBeVisible();
    await expect(notificationModal.locator('.alert-success')).toBeVisible();

    await page.unroute(SUBMIT_ENDPOINT);
  });

  test('backend rejects submit when CSRF token is corrupted', async ({ page }) => {
    await page.route('**/api/csrf_token.php', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, token: 'corrupted-token' }),
      });
    });

    await openSubmitModal(page);

    // Wait 3+ seconds from page load to satisfy server-side minimum interaction time
    await page.waitForTimeout(3100);

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php') && response.request().method() === 'POST'
    );

    await submitFromModalWithPrivacyConsent(page);
    const response = await responsePromise;

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toBe('Invalid request. Please reload the page and try again.');
  });
  test('backend rejects submit when modal honeypot field is filled', async ({ page }) => {
    const { submitModal } = await openSubmitModal(page);

    const honeypot = submitModal.locator('input[name="website"]').first();
    await honeypot.waitFor({ state: 'attached' });

    // Wait 3+ seconds from page load for server-side minimum interaction time.
    // Fill honeypot only after the modal open animation completes — shown.bs.modal resets the field.
    await page.waitForTimeout(3100);
    await honeypot.fill('I am a bot');

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php') && response.request().method() === 'POST'
    );

    await submitFromModalWithPrivacyConsent(page);
    const response = await responsePromise;

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toBe('Invalid request.');
  });

  test('backend rejects submit when main-form honeypot field is filled', async ({ page }) => {
    await completeMinimalDatasetForm(page);
    await page.locator('#input-information-website').fill('I am a bot');

    await page.locator('#button-form-submit').click();
    await expect(page.locator('#modal-submit')).toBeVisible({ timeout: 5000 });
    await page.check('#input-submit-privacycheck');

    await page.waitForTimeout(3100);

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php') && response.request().method() === 'POST'
    );

    await submitFromModalWithPrivacyConsent(page);
    const response = await responsePromise;

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toBe('Invalid request.');
  });

  test('submit POST does not include client-side time_spent field', async ({ page }) => {
    let capturedBody = '';

    await page.route(SUBMIT_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      capturedBody = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Submitted successfully' }),
      });
    });

    await openSubmitModal(page);
    await page.waitForTimeout(3100);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('send_xml_file.php') &&
          response.request().method() === 'POST'
      ),
      submitFromModalWithPrivacyConsent(page),
    ]);

    expect(capturedBody.length).toBeGreaterThan(0);
    expect(capturedBody).not.toContain('name="submit_time_spent"');
    expect(capturedBody).toContain('name="csrf-token"');

    await page.unroute(SUBMIT_ENDPOINT);
  });
});
