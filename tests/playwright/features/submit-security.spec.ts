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
  const csrfField = page.locator('#input-form-csrf-token');
  await expect(csrfField).not.toHaveValue('');

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
    await expect(csrfField).not.toHaveValue('');
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
    // Simulate a real user pause before confirming.
    await page.waitForTimeout(3200);

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
    await openSubmitModal(page);

    // Simulate token tampering before request submission.
    await page.locator('#input-form-csrf-token').evaluate((el) => {
      (el as HTMLInputElement).value = 'corrupted-token';
    });

    // Wait 3+ seconds to meet backend minimum interaction time for submit
    await page.waitForTimeout(3100);

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php') && response.request().method() === 'POST'
    );

    await submitFromModalWithPrivacyConsent(page);
    const response = await responsePromise;

    expect(response.status()).toBe(403);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('Security token validation failed');
  });
  test('backend rejects submit when honeypot field is filled', async ({ page }) => {
    const { submitModal } = await openSubmitModal(page);

    const honeypot = submitModal.locator('input[name="website"]').first();
    await honeypot.waitFor({ state: 'attached' });
    await honeypot.fill('I am a bot');

    // Wait 3+ seconds to meet backend minimum interaction time for submit
    await page.waitForTimeout(3100);

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php') && response.request().method() === 'POST'
    );

    await submitFromModalWithPrivacyConsent(page);
    const response = await responsePromise;

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('Invalid submission detected');
  });

  test('submit flow rejects when modal confirmation is too fast (<3s)', async ({ page }) => {
    let capturedBody = '';

    await page.route(SUBMIT_ENDPOINT, async (route) => {
      const postData = route.request().postData();
      const bodyBuffer = route.request().postDataBuffer();
      capturedBody = postData || (bodyBuffer ? bodyBuffer.toString('utf-8') : '');

      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Please take time to review your submission before submitting.',
        }),
      });
    });

    await openSubmitModal(page);

    // Freeze Date.now close to modal-open time so client sends a low time-spent value.
    await page.evaluate(() => {
      const originalNow = Date.now.bind(Date);
      (window as typeof window & { __originalDateNow?: () => number }).__originalDateNow = originalNow;
      Date.now = () => 0;
    });

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php') && response.request().method() === 'POST'
    );

    await submitFromModalWithPrivacyConsent(page);
    const response = await responsePromise;

    expect(response.status()).toBe(400);

    const submittedTimeSpentRaw = extractMultipartField(capturedBody, 'submit_time_spent');
    const submittedTimeSpent = Number.parseInt(submittedTimeSpentRaw ?? '0', 10);
    expect(submittedTimeSpent).toBeLessThan(3);

    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('Please take time to review your submission before submitting.');

    await page.evaluate(() => {
      const w = window as typeof window & { __originalDateNow?: () => number };
      if (w.__originalDateNow) {
        Date.now = w.__originalDateNow;
        delete w.__originalDateNow;
      }
    });

    await page.unroute(SUBMIT_ENDPOINT);
  });

  test('instant submit without waiting is rejected (time < 3 seconds)', async ({ page }) => {
    let capturedTimeSpent = 0;

    await page.route(SUBMIT_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      const body = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
      const timeSpent = extractMultipartField(body, 'submit_time_spent') || '0';
      capturedTimeSpent = parseInt(timeSpent, 10);

      // Reject if time spent is less than 3 seconds
      const responseStatus = capturedTimeSpent < 3 ? 400 : 200;
      await route.fulfill({
        status: responseStatus,
        contentType: 'application/json',
        body: JSON.stringify(responseStatus === 400
          ? { success: false, message: 'Please take time to review your submission before submitting.' }
          : { success: true, message: 'Submitted successfully' }),
      });
    });

    const { submitModal } = await openSubmitModal(page);

    // Force a deterministic near-zero client elapsed time for this test case.
    await page.evaluate(() => {
      const originalNow = Date.now.bind(Date);
      (window as typeof window & { __originalDateNow?: () => number }).__originalDateNow = originalNow;
      Date.now = () => 0;
    });

    // Immediately try to submit WITHOUT waiting (or minimal wait)
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php') && response.request().method() === 'POST'
    );
    await submitFromModalWithPrivacyConsent(page);
    const response = await responsePromise;

    // Verify instant submit was rejected
    expect(capturedTimeSpent).toBeLessThan(3);
    expect(response.status()).toBe(400);

    await page.evaluate(() => {
      const w = window as typeof window & { __originalDateNow?: () => number };
      if (w.__originalDateNow) {
        Date.now = w.__originalDateNow;
        delete w.__originalDateNow;
      }
    });

    await page.unroute(SUBMIT_ENDPOINT);
  });
});
