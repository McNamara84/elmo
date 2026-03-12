import { test, expect } from '@playwright/test';
import { completeMinimalDatasetForm, navigateToHome } from '../utils';

test.describe('Validation Failed Modal (#968)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
    // Wait for JS modules to be fully loaded and initialized
    await page.waitForFunction(() =>
      document.getElementById('modal-validation-failed') !== null
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

    // Close via header X button
    const xButton = modal.locator('.btn-close');
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

  test('validation-failed modal does NOT appear when all mandatory fields are filled', async ({ page }) => {
    // Use the shared helper that fills ALL mandatory fields reliably
    await completeMinimalDatasetForm(page);

    // Click Submit
    const submitButton = page.locator('#button-form-submit');
    await submitButton.click();

    // The validation-failed modal should NOT appear
    const modal = page.locator('#modal-validation-failed');
    await expect(modal).not.toBeVisible({ timeout: 2000 });

    // Instead the submit modal should appear
    const submitModal = page.locator('#modal-submit');
    await expect(submitModal).toBeVisible();
  });
});
