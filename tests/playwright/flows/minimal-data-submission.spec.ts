import { test, expect, type Page } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome, SELECTORS } from '../utils';

const SUBMISSION_ENDPOINT = '**/send_xml_file.php';
const MOCK_DATA_DESCRIPTION_FILE = {
  name: 'data-description.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('Minimal dataset description for automated testing.'),
};

test.describe('Minimal Valid Dataset Test', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await completeMinimalDatasetForm(page);

    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.locator('.is-invalid')).toHaveCount(0);
    await expect(page.locator(SELECTORS.modals.submit)).toBeVisible();
  });

  test('submits dataset successfully via AJAX', async ({ page }) => {
    const modalSubmitButton = page.locator('#button-submit-submit');
    await expect(modalSubmitButton).toBeDisabled();

    await attachSupportingSubmissionData(page);

    let capturedRequestBody = '';
    await page.route(SUBMISSION_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      capturedRequestBody = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Submitted successfully' }),
      });
    });

    await page.check('#input-submit-privacycheck');
    await expect(modalSubmitButton).toBeEnabled();

    // Wait 3+ seconds to meet backend minimum interaction time for submit
    await page.waitForTimeout(3100);

    await Promise.all([
      page.waitForRequest(SUBMISSION_ENDPOINT),
      modalSubmitButton.click(),
    ]);

    await expect(page.locator(SELECTORS.modals.submit)).toBeHidden();

    const notificationModal = page.locator(SELECTORS.modals.notification);
    await expect(notificationModal).toBeVisible();
    await expect(notificationModal.locator('.alert-success')).toContainText('Thank you for cooperating with us');
    await expect(page.locator('#selected-file-name')).toHaveText(/^[\s\n]*$/);
    await expect(page.locator('#remove-file-btn')).toBeHidden();

    expect(capturedRequestBody).toContain('filename="data-description.txt"');
    expect(capturedRequestBody).toContain('name="dataUrl"');

    await page.unroute(SUBMISSION_ENDPOINT);
  });

  test('shows primary data upload hint when DATA_UPLOAD_URL is configured', async ({ page }) => {
    const testUploadUrl = 'https://nextcloud.gfz.de/s/test123';

    // Set DATA_UPLOAD_URL before submit
    await page.evaluate((url) => {
      (window as any).ELMO_FEATURES = (window as any).ELMO_FEATURES || {};
      (window as any).ELMO_FEATURES.dataUploadUrl = url;
    }, testUploadUrl);

    await attachSupportingSubmissionData(page);

    await page.route(SUBMISSION_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Submitted successfully' }),
      });
    });

    await page.check('#input-submit-privacycheck');
    const modalSubmitButton = page.locator('#button-submit-submit');

    // Wait 3+ seconds to meet backend minimum interaction time for submit
    await page.waitForTimeout(3100);

    await Promise.all([
      page.waitForRequest(SUBMISSION_ENDPOINT),
      modalSubmitButton.click(),
    ]);

    const notificationModal = page.locator(SELECTORS.modals.notification);
    await expect(notificationModal).toBeVisible();

    // Success alert should still be present
    await expect(notificationModal.locator('.alert-success')).toBeVisible();

    // Data upload warning hint should be visible
    const uploadHint = notificationModal.locator('.alert-warning');
    await expect(uploadHint).toBeVisible();

    // Check link opens in new tab
    const uploadLink = uploadHint.locator(`a[href="${testUploadUrl}"]`);
    await expect(uploadLink).toBeVisible();
    await expect(uploadLink).toHaveAttribute('target', '_blank');
    await expect(uploadLink).toHaveAttribute('rel', /noopener/);

    // Check main title is displayed as filename suggestion
    const mainTitle = await page.locator('#input-resourceinformation-title').inputValue();
    expect(mainTitle).toBeTruthy();
    await expect(uploadHint).toContainText(mainTitle);

    // Modal should be enlarged
    await expect(notificationModal.locator('.modal-dialog')).toHaveClass(/modal-lg/);

    await page.unroute(SUBMISSION_ENDPOINT);
  });

  test('does not show data upload hint when DATA_UPLOAD_URL is empty', async ({ page }) => {
    // Ensure DATA_UPLOAD_URL is empty
    await page.evaluate(() => {
      (window as any).ELMO_FEATURES = (window as any).ELMO_FEATURES || {};
      (window as any).ELMO_FEATURES.dataUploadUrl = '';
    });

    await attachSupportingSubmissionData(page);

    await page.route(SUBMISSION_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Submitted successfully' }),
      });
    });

    await page.check('#input-submit-privacycheck');
    const modalSubmitButton = page.locator('#button-submit-submit');

    // Wait 3+ seconds to meet backend minimum interaction time for submit
    await page.waitForTimeout(3100);

    await Promise.all([
      page.waitForRequest(SUBMISSION_ENDPOINT),
      modalSubmitButton.click(),
    ]);

    const notificationModal = page.locator(SELECTORS.modals.notification);
    await expect(notificationModal).toBeVisible();
    await expect(notificationModal.locator('.alert-success')).toBeVisible();

    // Data upload hint should NOT be present
    await expect(notificationModal.locator('.alert-warning')).toHaveCount(0);

    // Modal should NOT have modal-lg class (no hint appended)
    await expect(notificationModal.locator('.modal-dialog')).not.toHaveClass(/modal-lg/);

    await page.unroute(SUBMISSION_ENDPOINT);
  });

  test('shows an error notification when the AJAX submission fails', async ({ page }) => {
    const modalSubmitButton = page.locator('#button-submit-submit');
    await expect(modalSubmitButton).toBeDisabled();

    await attachSupportingSubmissionData(page);

    await page.route(SUBMISSION_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Dataset submission failed' }),
      });
    });

    await page.check('#input-submit-privacycheck');
    await expect(modalSubmitButton).toBeEnabled();

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_xml_file.php')
    );
    await modalSubmitButton.click();
    const submissionResponse = await responsePromise;
    expect(submissionResponse.status()).toBe(500);

    const notificationModal = page.locator(SELECTORS.modals.notification);
    await expect(notificationModal).toBeVisible();
    const notificationAlert = notificationModal.locator('.alert');
    await expect(notificationAlert).toHaveClass(/alert-danger/);
    const translatedSubmitError = await page.evaluate(() => {
      const alerts = (window as any).translations?.alerts;
      return alerts?.submitError ?? null;
    });

    if (translatedSubmitError) {
      await expect(notificationAlert).toContainText(translatedSubmitError);
    } else {
      await expect(notificationAlert).toContainText(/Dataset submission failed|Submit Error/);
    }

    await expect(page.locator('#selected-file-name')).toContainText(MOCK_DATA_DESCRIPTION_FILE.name);
    
    const removeFileButton = page.locator('#remove-file-btn');
    const removeButtonDisplay = await removeFileButton.evaluate((element) =>
      window.getComputedStyle(element as HTMLElement).display
    );
    expect(removeButtonDisplay).not.toBe('none');

    await notificationModal.getByRole('button', { name: 'OK' }).click();
    await expect(notificationModal).toBeHidden();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator(SELECTORS.modals.submit)).toBeVisible();
    await expect(removeFileButton).toBeVisible();

    await page.unroute(SUBMISSION_ENDPOINT);
  });
});

async function attachSupportingSubmissionData(page: Page) {
  await page.setInputFiles('#input-submit-datadescription', MOCK_DATA_DESCRIPTION_FILE);
  await expect(page.locator('#selected-file-name')).toContainText(MOCK_DATA_DESCRIPTION_FILE.name);
  await expect(page.locator('#remove-file-btn')).toBeVisible();

  await page.fill('#input-submit-dataurl', 'https://example.com/dataset');
}