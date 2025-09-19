import { test, expect, type Page } from '@playwright/test';

const SUBMISSION_ENDPOINT = '**/send_xml_file.php';
const MOCK_DATA_DESCRIPTION_FILE = {
  name: 'data-description.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('Minimal dataset description for automated testing.'),
};

test.describe('Minimal Valid Dataset Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await completeMinimalDatasetForm(page);

    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.locator('.is-invalid')).toHaveCount(0);
    await expect(page.locator('#modal-submit')).toBeVisible();
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

    await Promise.all([
      page.waitForRequest(SUBMISSION_ENDPOINT),
      modalSubmitButton.click(),
    ]);

    await expect(page.locator('#modal-submit')).toBeHidden();

    const notificationModal = page.locator('#modal-notification');
    await expect(notificationModal).toBeVisible();
    await expect(notificationModal.locator('.alert-success')).toContainText('Submitted successfully');

    await expect(page.locator('#selected-file-name')).toHaveText(/^[\s\n]*$/);
    await expect(page.locator('#remove-file-btn')).toBeHidden();

    expect(capturedRequestBody).toContain('filename="data-description.txt"');
    expect(capturedRequestBody).toContain('name="dataUrl"');

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

    const notificationModal = page.locator('#modal-notification');
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
    await expect(page.locator('#modal-submit')).toBeVisible();
    await expect(removeFileButton).toBeVisible();

    await page.unroute(SUBMISSION_ENDPOINT);
  });
});

async function completeMinimalDatasetForm(page: Page) {
  await page.getByRole('textbox', { name: 'Publication Year (YYYY)*' }).fill('2025');
  await page.getByLabel('Resource Type*').selectOption('5');
  await page.getByLabel('Language of dataset*').selectOption('1');
  await page.getByRole('textbox', { name: 'Title*' }).fill('A dataset');

  await page.locator('#input-author-orcid').fill('0000-0002-1825-0097');
  await page.getByRole('textbox', { name: 'Last Name*' }).fill('Alice');
  await page.getByRole('textbox', { name: 'First Name*' }).fill('Bob');

  await page.locator('#group-author tags').getByRole('textbox').fill('GFZ Helmholtz Centre for Geosciences');
  await page.getByText('ContactPerson?').click();

  await expect(page.getByRole('textbox', { name: 'Email address*' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email address*' }).fill('example@gmail.com');

  await page.getByRole('textbox', { name: 'Abstract*' }).fill('Necessary abstract');
  await page.getByRole('textbox', { name: 'Date created*' }).fill('2025-01-01');
}

async function attachSupportingSubmissionData(page: Page) {
  await page.setInputFiles('#input-submit-datadescription', MOCK_DATA_DESCRIPTION_FILE);
  await expect(page.locator('#selected-file-name')).toContainText(MOCK_DATA_DESCRIPTION_FILE.name);
  await expect(page.locator('#remove-file-btn')).toBeVisible();

  await page.fill('#input-submit-dataurl', 'https://example.com/dataset');
}