import { test, expect } from '@playwright/test';

test.describe('Save vs Submit – required fields', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
  });

  test('Save makes js-required-on-submit field optional', async ({ page }) => {
    const form = page.locator('#form-mde');
    const field = form.locator('.js-required-on-submit').first();

    // Ensure that field exists
    await expect(field).toBeVisible();

    // field empty
    await field.fill('');

    // Click Save
    const saveButton = page.locator('#button-form-save');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Expectation: required attribute is NOT set after saving
    const requiredAttr = await field.getAttribute('required');
    expect(requiredAttr).toBeNull();
  });

  test('Submit sets js-required-on-submit field to required', async ({ page }) => {
    const form = page.locator('#form-mde');
    const field = form.locator('.js-required-on-submit').first();

    await expect(field).toBeVisible();

    // field empty
    await field.fill('');

    const submitButton = page.locator('#button-form-submit');
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Expectation: required attribute is set after submit
    const requiredAttr = await field.getAttribute('required');
    expect(requiredAttr).not.toBeNull();
  });

});
