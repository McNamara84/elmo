import { test, expect } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome, SELECTORS } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';
const MOCK_XML_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>\n<dataset>Automated test dataset</dataset>`;

const CUSTOM_FILENAME = 'automated_test_dataset';

test.describe('Minimal dataset save-as flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await completeMinimalDatasetForm(page);

    const saveButton = page.locator('#button-form-save');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    const notificationModal = page.locator(SELECTORS.modals.notification);
    await expect(notificationModal).toBeVisible();
    await expect(notificationModal.locator('.alert-info')).toHaveCount(1);

    const saveAsModal = page.locator(SELECTORS.modals.saveAs);
    await expect(saveAsModal).toBeVisible();
  });

  test('saves the dataset and triggers an XML download', async ({ page }) => {
    const saveAsModal = page.locator(SELECTORS.modals.saveAs);
    const notificationModal = page.locator(SELECTORS.modals.notification);

    await page.fill('#input-saveas-filename', CUSTOM_FILENAME);

    let capturedRequestBody = '';
    await page.route(SAVE_ENDPOINT, async (route) => {
      const bodyBuffer = route.request().postDataBuffer();
      capturedRequestBody = bodyBuffer ? bodyBuffer.toString('utf-8') : '';
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        headers: {
          'Content-Disposition': `attachment; filename="${CUSTOM_FILENAME}.xml"`,
        },
        body: MOCK_XML_RESPONSE,
      });
    });

    const downloadPromise = page.waitForEvent('download');
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('save/save_data.php')
    );

    await saveAsModal.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    await expect(saveAsModal).toBeHidden();

    expect(capturedRequestBody).toContain('name="filename"');
    expect(capturedRequestBody).toContain(CUSTOM_FILENAME);
    expect(capturedRequestBody).toContain('name="action"');
    expect(capturedRequestBody).toContain('save_and_download');
    expect(capturedRequestBody).toContain('name="title[]"');

    expect(await download.suggestedFilename()).toBe(`${CUSTOM_FILENAME}.xml`);

    const translatedSuccessMessage = await page.evaluate(() => {
      const alerts = (window as any).translations?.alerts;
      return alerts?.savingSuccess ?? null;
    });

    await expect(notificationModal).toBeVisible();
    const successAlert = notificationModal.locator('.alert-success');
    await expect(successAlert).toBeVisible();

    if (translatedSuccessMessage) {
      await expect(successAlert).toContainText(translatedSuccessMessage);
    } else {
      await expect(successAlert).toContainText(
        /Dataset saved successfully|successfully saved/
      );
    }

    await page.evaluate(() => {
      const modalElement = document.getElementById('modal-notification');
      const instance = (window as any).bootstrap?.Modal.getInstance(modalElement);
      instance?.hide();
    });

    await expect(notificationModal).toBeHidden();
    await page.unroute(SAVE_ENDPOINT);
  });

  test('shows an error notification when saving the dataset fails', async ({ page }) => {
    const saveAsModal = page.locator(SELECTORS.modals.saveAs);
    const notificationModal = page.locator(SELECTORS.modals.notification);

    await page.fill('#input-saveas-filename', `${CUSTOM_FILENAME}_error_case`);

    await page.route(SAVE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Internal Server Error',
      });
    });

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('save/save_data.php')
    );

    await saveAsModal.getByRole('button', { name: 'Save' }).click();
    const failedResponse = await responsePromise;
    expect(failedResponse.status()).toBe(500);

    await expect(notificationModal).toBeVisible();
    const notificationAlert = notificationModal.locator('.alert-danger');
    await expect(notificationAlert).toBeVisible();

    const translatedErrorMessage = await page.evaluate(() => {
      const alerts = (window as any).translations?.alerts;
      return alerts?.saveError ?? null;
    });

    if (translatedErrorMessage) {
      await expect(notificationAlert).toContainText(translatedErrorMessage);
    } else {
      await expect(notificationAlert).toContainText(
        /Save Error|saving failed|Failed to save dataset\.?/
      );
    }

    await page.evaluate(() => {
      const modalElement = document.getElementById('modal-notification');
      const instance = (window as any).bootstrap?.Modal.getInstance(modalElement);
      instance?.hide();
    });
    await expect(notificationModal).toBeHidden();

    // The user should be able to attempt saving again after an error.
    await page.unroute(SAVE_ENDPOINT);

    await page.locator('#button-form-save').click();
    await expect(saveAsModal).toBeVisible();
  });
});