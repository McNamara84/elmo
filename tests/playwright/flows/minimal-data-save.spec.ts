import { test, expect, type Page } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome, SELECTORS } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';
const MOCK_XML_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>\n<dataset>Automated test dataset</dataset>`;

const CUSTOM_FILENAME = 'automated_test_dataset';

const API_DROPDOWNS = [
  {
    selector: '#input-resourceinformation-resourcetype',
    description: 'Resource Type',
    shouldBeVisible: true,
  },
  {
    selector: '#input-resourceinformation-language',
    description: 'Language',
    shouldBeVisible: true,
  },
  {
    selector: '#input-resourceinformation-titletype',
    description: 'Title Type',
    shouldBeVisible: false,
  },
  {
    selector: '#input-rights-license',
    description: 'License',
    shouldBeVisible: true,
  },
] as const;

async function expectApiDropdownsToBePopulated(page: Page) {
  for (const dropdownConfig of API_DROPDOWNS) {
    const { selector, description, shouldBeVisible } = dropdownConfig;
    const dropdownLocator = page.locator(selector);
    await expect(
      dropdownLocator,
      `${description} dropdown should exist in the DOM`,
    ).not.toHaveCount(0);

    const dropdown = dropdownLocator.first();

    if (shouldBeVisible) {
      await expect(dropdown, `${description} dropdown should be visible for the user`).toBeVisible();
    }

    await expect(async () => {
      const dropdownState = await dropdown.evaluate((element) => {
        const selectElement = element as HTMLSelectElement;
        const options = Array.from(selectElement.options).map((option) => ({
          value: option.value.trim(),
          text: (option.textContent || '').trim(),
        }));

        return {
          disabled: selectElement.disabled,
          options,
        };
      });

      expect(dropdownState.disabled, `${description} dropdown should be enabled`).toBeFalsy();

      const meaningfulOptions = dropdownState.options.filter((option) => option.value !== '');
      expect(
        meaningfulOptions.length,
        `${description} dropdown should contain selectable options loaded from the API`,
      ).toBeGreaterThan(0);

      const disallowedLabels = new Set(['Loading...', 'Error loading data']);
      const hasDisallowedLabel = dropdownState.options.some((option) =>
        disallowedLabels.has(option.text),
      );
      expect(
        hasDisallowedLabel,
        `${description} dropdown should not show loading or error placeholders after initialization`,
      ).toBeFalsy();
    }).toPass({ timeout: 10_000 });
  }
}

async function closeNotificationModalIfVisible(page: Page) {
  const notificationModal = page.locator(SELECTORS.modals.notification);
  await notificationModal.locator('.btn-primary').click({ timeout: 2000 }).catch(() => {});
  await page.evaluate(() => {
    const modalElement = document.getElementById('modal-notification');
    const modal = modalElement ? (window as any).bootstrap?.Modal?.getInstance(modalElement) : null;
    modal?.hide();
    if (modalElement) {
      modalElement.classList.remove('show');
      modalElement.setAttribute('aria-hidden', 'true');
      (modalElement as HTMLElement).style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
  });
  await expect(notificationModal).toBeHidden({ timeout: 3000 });
}

test.describe('Minimal dataset save-as flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await completeMinimalDatasetForm(page);

    await expectApiDropdownsToBePopulated(page);

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

    // Wait 2+ seconds to meet backend minimum interaction time for save
    await page.waitForTimeout(2100);

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

    const successAlert = notificationModal.locator('.alert-success');

    if (translatedSuccessMessage) {
      await expect(successAlert).toContainText(translatedSuccessMessage);
    } else {
      await expect(successAlert).toContainText(
        /Dataset saved successfully|successfully saved/
      );
    }

    await closeNotificationModalIfVisible(page);
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
    // Wait 2+ seconds to meet backend minimum interaction time for save
    await page.waitForTimeout(2100);
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('save/save_data.php')
    );

    await saveAsModal.getByRole('button', { name: 'Save' }).click();
    const failedResponse = await responsePromise;
    expect(failedResponse.status()).toBe(500);

    const notificationAlert = notificationModal.locator('.alert-danger');

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

    await closeNotificationModalIfVisible(page);

    // The user should be able to attempt saving again after an error.
    await page.unroute(SAVE_ENDPOINT);

    await page.locator('#button-form-save').click();
    await expect(saveAsModal).toBeVisible();
  });
});