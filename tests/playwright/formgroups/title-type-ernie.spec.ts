import { test, expect } from '@playwright/test';
import { navigateToHome, expectNavbarVisible } from '../utils';

test.describe('Title Type Dropdown - ERNIE Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
  });

  test('Title Type dropdown loads options from API', async ({ page }) => {
    const titleTypeSelect = page.locator('#input-resourceinformation-titletype');
    await expect(titleTypeSelect).toBeVisible();

    // Wait for options to be populated (beyond just the placeholder)
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-titletype');
      return select && select.querySelectorAll('option').length > 1;
    }, { timeout: 10000 });

    // Get all option values
    const options = await titleTypeSelect.locator('option').allTextContents();

    // Should have more than just a placeholder
    expect(options.length).toBeGreaterThan(1);
  });

  test('Title Type dropdown contains Main Title', async ({ page }) => {
    const titleTypeSelect = page.locator('#input-resourceinformation-titletype');
    await expect(titleTypeSelect).toBeVisible();

    // Wait for options to load
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-titletype');
      return select && select.querySelectorAll('option').length > 1;
    }, { timeout: 10000 });

    const optionTexts = await titleTypeSelect.locator('option').allTextContents();

    // Must contain Main Title (always required)
    const hasMainTitle = optionTexts.some(text => text.includes('Main Title'));
    expect(hasMainTitle).toBe(true);
  });

  test('First title is always set to Main Title', async ({ page }) => {
    const titleTypeSelect = page.locator('#input-resourceinformation-titletype').first();
    await expect(titleTypeSelect).toBeVisible();

    // Wait for options to load
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-titletype');
      return select && select.querySelectorAll('option').length > 1;
    }, { timeout: 10000 });

    // First title should be set to Main Title
    const selectedText = await titleTypeSelect.locator('option:checked').textContent();
    expect(selectedText).toContain('Main Title');
  });

  test('Title Type API endpoint returns valid data', async ({ page }) => {
    // Directly test the API endpoint
    const response = await page.request.get('/api/v2/vocabs/titletypes');

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const data = await response.json();

    // Should be an array
    expect(Array.isArray(data)).toBe(true);

    // Should have at least one title type
    expect(data.length).toBeGreaterThan(0);

    // Each item should have required fields
    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
    }
  });

  test('Title Type API response does not expose ernie_id', async ({ page }) => {
    const response = await page.request.get('/api/v2/vocabs/titletypes');

    expect(response.ok()).toBe(true);
    const data = await response.json();

    // ernie_id should not be exposed in API response (internal use only)
    if (data.length > 0) {
      for (const item of data) {
        expect(item).not.toHaveProperty('ernie_id');
        expect(item).not.toHaveProperty('slug');
      }
    }
  });

  test('Title Type API response contains Main Title', async ({ page }) => {
    const response = await page.request.get('/api/v2/vocabs/titletypes');

    expect(response.ok()).toBe(true);
    const data = await response.json();

    const hasMainTitle = data.some((item: { name: string }) => item.name === 'Main Title');
    expect(hasMainTitle).toBe(true);
  });
});

test.describe('Title Type ERNIE Cache Admin Endpoints', () => {
  test('Cache status endpoint returns configuration info', async ({ page }) => {
    const response = await page.request.get('/api/v2/admin/cache/titletypes/status');

    // This endpoint may require auth in production
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('configured');
      expect(typeof data.configured).toBe('boolean');

      if (data.configured) {
        expect(data).toHaveProperty('cache');
        expect(data.cache).toHaveProperty('exists');
        expect(data.cache).toHaveProperty('valid');
      }
    }
  });
});
