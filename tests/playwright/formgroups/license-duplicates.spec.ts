import { test, expect } from '@playwright/test';
import { expectNavbarVisible, navigateToHome } from '../utils';

/**
 * Test to verify that licenses are not duplicated in the dropdown.
 * This test runs against localhost:8081 to check the current state.
 */
test.describe("License Dropdown - No Duplicates", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator('#input-rights-license')).toBeVisible();
  });

  test("License dropdown should not contain duplicate entries", async ({ page }) => {
    const licenseSelect = page.locator('#input-rights-license');

    // Wait for licenses to load (at least one option should be present)
    await page.waitForFunction(
      () => document.querySelectorAll('#input-rights-license option').length > 0,
      { timeout: 10_000 }
    );

    // Get all option texts
    const options = licenseSelect.locator('option');
    const count = await options.count();
    const texts = await options.allTextContents();
    const values = await options.evaluateAll(opts => 
      opts.map(opt => (opt as HTMLOptionElement).value)
    );

    console.log(`Found ${count} license options:`);
    texts.forEach((text, i) => {
      console.log(`  ${i + 1}. [value=${values[i]}] ${text}`);
    });

    // Check for duplicate texts
    const uniqueTexts = new Set(texts);
    const duplicateTexts = texts.filter((text, index) => texts.indexOf(text) !== index);
    
    if (duplicateTexts.length > 0) {
      console.log('DUPLICATE TEXTS FOUND:', duplicateTexts);
    }

    // Check for duplicate values
    const uniqueValues = new Set(values);
    const duplicateValues = values.filter((value, index) => values.indexOf(value) !== index);
    
    if (duplicateValues.length > 0) {
      console.log('DUPLICATE VALUES FOUND:', duplicateValues);
    }

    // Assert no duplicates
    expect(uniqueTexts.size, `Expected no duplicate license texts, but found: ${duplicateTexts.join(', ')}`).toBe(count);
    expect(uniqueValues.size, `Expected no duplicate license values, but found: ${duplicateValues.join(', ')}`).toBe(count);

    // Also verify we have a reasonable number of licenses (not doubled)
    // Based on existing test, we expect more than 4 licenses for non-software
    expect(count).toBeGreaterThan(4);
    expect(count).toBeLessThan(30); // Sanity check - shouldn't have too many
  });

  test("License dropdown shows expected licenses", async ({ page }) => {
    const licenseSelect = page.locator('#input-rights-license');

    // Wait for licenses to load
    await page.waitForFunction(
      () => document.querySelectorAll('#input-rights-license option').length > 0,
      { timeout: 10_000 }
    );

    const options = licenseSelect.locator('option');
    const texts = await options.allTextContents();
    const allText = texts.join(' | ');

    console.log('All licenses:', allText);

    // Verify expected licenses are present
    expect(allText).toContain('CC-BY-4.0');
    expect(allText).toContain('Creative Commons');

    // Verify CC-BY-4.0 is selected by default
    const selectedValue = await licenseSelect.inputValue();
    const selectedOption = licenseSelect.locator('option:checked');
    const selectedText = await selectedOption.textContent();
    
    console.log(`Selected license: ${selectedText} (value: ${selectedValue})`);
    expect(selectedText).toContain('CC-BY-4.0');
  });
});
