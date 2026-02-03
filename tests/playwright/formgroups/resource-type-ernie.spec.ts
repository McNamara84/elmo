import { test, expect } from '@playwright/test';
import { navigateToHome, expectNavbarVisible } from '../utils';

test.describe('Resource Type Dropdown - ERNIE Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
  });

  test('Resource Type dropdown loads options from API', async ({ page }) => {
    const resourceTypeSelect = page.locator('#input-resourceinformation-resourcetype');
    await expect(resourceTypeSelect).toBeVisible();

    // Wait for options to be populated (beyond just the placeholder)
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-resourcetype');
      return select && select.querySelectorAll('option').length > 1;
    }, { timeout: 10000 });

    // Get all option values
    const options = await resourceTypeSelect.locator('option').allTextContents();
    
    // Should have more than just a placeholder
    expect(options.length).toBeGreaterThan(1);
  });

  test('Resource Type dropdown contains expected ELMO resource types', async ({ page }) => {
    const resourceTypeSelect = page.locator('#input-resourceinformation-resourcetype');
    await expect(resourceTypeSelect).toBeVisible();

    // Wait for options to load
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-resourcetype');
      return select && select.querySelectorAll('option').length > 1;
    }, { timeout: 10000 });

    // Get option texts
    const optionTexts = await resourceTypeSelect.locator('option').allTextContents();

    // These are the resource types enabled for ELMO in ERNIE
    // Should contain at least Dataset (most common type)
    const hasDataset = optionTexts.some(text => text.toLowerCase().includes('dataset'));
    expect(hasDataset).toBe(true);
  });

  test('Resource Type selection works correctly', async ({ page }) => {
    const resourceTypeSelect = page.locator('#input-resourceinformation-resourcetype');
    await expect(resourceTypeSelect).toBeVisible();

    // Wait for options to load
    await page.waitForFunction(() => {
      const select = document.querySelector('#input-resourceinformation-resourcetype');
      return select && select.querySelectorAll('option').length > 1;
    }, { timeout: 10000 });

    // Get available options (skip first placeholder if any)
    const options = await resourceTypeSelect.locator('option').all();
    
    // Find the first non-empty option
    let selectedValue = '';
    for (const option of options) {
      const value = await option.getAttribute('value');
      if (value && value !== '') {
        selectedValue = value;
        break;
      }
    }

    // Select an option
    if (selectedValue) {
      await resourceTypeSelect.selectOption(selectedValue);
      await expect(resourceTypeSelect).toHaveValue(selectedValue);
    }
  });

  test('Resource Type API endpoint returns valid data', async ({ page }) => {
    // Directly test the API endpoint
    const response = await page.request.get('/api/v2/vocabs/resourcetypes');
    
    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const data = await response.json();
    
    // Should be an array
    expect(Array.isArray(data)).toBe(true);
    
    // Should have at least one resource type
    expect(data.length).toBeGreaterThan(0);

    // Each item should have required fields
    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('resource_type_general');
    }
  });

  test('Resource Type API response does not expose ernie_id', async ({ page }) => {
    // Test the API endpoint - ernie_id should NOT be in the response
    const response = await page.request.get('/api/v2/vocabs/resourcetypes');
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    
    // ernie_id should not be exposed in API response (internal use only)
    if (data.length > 0) {
      for (const item of data) {
        expect(item).not.toHaveProperty('ernie_id');
      }
    }
  });
});

test.describe('Resource Type ERNIE Cache Admin Endpoints', () => {
  test('Cache status endpoint returns configuration info', async ({ page }) => {
    const response = await page.request.get('/api/v2/admin/cache/resourcetypes/status');
    
    // This endpoint may require auth in production, so we check for valid response structure
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
