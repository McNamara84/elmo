import { test, expect } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome, waitForHomepageReady } from '../utils';

test.describe('Validation Failed Modal (#968)', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await waitForHomepageReady(page);
    // The modal template exists before its translated links are ready.
    await page.waitForFunction(() =>
      Boolean(window.elmo?.translations?.modals?.validationFailed?.saveHint)
    );
  });

  test('shows validation-failed modal when submitting with empty mandatory fields', async ({ page }) => {
    // Click Submit without filling in any mandatory fields
    const submitButton = page.locator('#button-form-submit');
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // The validation-failed modal should appear
    const modal = page.locator('#modal-validation-failed');
    await expect(modal).toBeVisible({ timeout: 10000 });
  });

  test('validation-failed modal can be closed via close button', async ({ page }) => {
    // Trigger the modal
    const submitButton = page.locator('#button-form-submit');
    await submitButton.click();

    const modal = page.locator('#modal-validation-failed');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Close it
    const closeButton = modal.locator('.btn-primary[data-bs-dismiss="modal"]');
    await closeButton.click();

    // Modal should be hidden (allow time for Bootstrap fade-out animation)
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });

  test('validation-failed modal can be closed via X button', async ({ page }) => {
    const submitButton = page.locator('#button-form-submit');
    await submitButton.click();

    const modal = page.locator('#modal-validation-failed');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Close via header X button – wait for Bootstrap transition to fully complete
    const xButton = modal.locator('.btn-close');
    await page.waitForFunction(() => {
      const m = document.getElementById('modal-validation-failed');
      return m?.classList.contains('show') && getComputedStyle(m).opacity === '1';
    }, { timeout: 5000 });
    await xButton.click();

    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });

  test('validation-failed modal contains expected text elements', async ({ page }) => {
    const submitButton = page.locator('#button-form-submit');
    await submitButton.click();

    const modal = page.locator('#modal-validation-failed');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Check that the modal has a title
    const title = modal.locator('#modal-validation-failed-label');
    await expect(title).not.toBeEmpty();

    // Check that the save hint contains a mailto link
    const saveHint = modal.locator('#modal-validation-failed-save-hint');
    const saveHintHtml = await saveHint.innerHTML();
    expect(saveHintHtml).toContain('mailto:');

    // Check that the ELMO Guide link is present
    const guideLink = modal.locator('a[href*="help.php"]');
    await expect(guideLink).toBeVisible();
  });

  test('validation-failed modal does NOT appear when all mandatory fields are filled', async ({ page }, testInfo) => {
    testInfo.setTimeout(90_000);
    // Use the shared helper that fills ALL mandatory fields reliably
    await completeMinimalDatasetForm(page);
    if (await page.locator('#input-model-type').isVisible()) {
      // GEM also requires the model definition and physical parameters.
      await page.locator('#input-model-type').selectOption({ label: 'Static' });
      await page.locator('#input-mathematical-representation').selectOption({ label: 'Spherical harmonics' });
      await page.locator('#input-file-format').selectOption({ label: 'icgem1.0' });
      await page.locator('#input-model-name').fill('TestModel');
      await page.locator('#input-tide-system').selectOption({ label: 'Zero-tide' });
      await page.locator('#input-degree').fill('2');
      await page.locator('#input-errors').selectOption({ label: 'no' });
      await page.locator('#input-radius').fill('6.371E+06');
      await page.locator('#input-earth-gravity-constant').fill('3.986E+14');
    }

    // Click Submit
    const submitButton = page.locator('#button-form-submit');
    await submitButton.click();

    // The validation-failed modal should NOT appear
    const modal = page.locator('#modal-validation-failed');
    // Wait for the async draft flush and DOI checks before checking the result.
    const submitModal = page.locator('#modal-submit');
    await expect(submitModal).toBeVisible({ timeout: 20_000 });
    await expect(modal).not.toBeVisible();
  });
});
