import { test, expect } from '@playwright/test';

test.describe('Affiliation Selection Debug', () => {
  test('should allow selecting an affiliation from dropdown', async ({ page }) => {
    await page.goto('http://localhost:8081');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Find all affiliation input fields
    const affiliationFields = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[id*="affiliation"]');
      return Array.from(inputs).map((input: any) => ({
        id: input.id,
        name: input.name,
        visible: input.offsetParent !== null
      }));
    });
    console.log('Available affiliation fields:', JSON.stringify(affiliationFields, null, 2));

    // Use the first available affiliation field
    const availableField = affiliationFields.find(f => f.id && f.visible);
    if (!availableField) {
      throw new Error('No affiliation field found');
    }
    
    const affiliationInputId = availableField.id;
    console.log('Using field:', affiliationInputId);
    
    // Wait for Tagify to be initialized (original input is hidden by Tagify)
    await page.waitForFunction((inputId) => {
      const input: any = document.querySelector(`#${inputId}`);
      return !!input?.tagify;
    }, affiliationInputId, { timeout: 10000 });
    
    console.log('Tagify initialized');

    // Check whitelist status
    const whitelistStatus = await page.evaluate((inputId) => {
      const input: any = document.querySelector(`#${inputId}`);
      return {
        hasTagify: !!input?.tagify,
        whitelistLength: input?.tagify?.whitelist?.length || 0,
        settingsWhitelistLength: input?.tagify?.settings?.whitelist?.length || 0
      };
    }, affiliationInputId);
    console.log('Whitelist status:', whitelistStatus);

    // If whitelist is empty, wait for affiliationsData to load
    if (whitelistStatus.whitelistLength === 0) {
      await page.waitForFunction(() => window.affiliationsData && window.affiliationsData.length > 0, { timeout: 30000 });
      console.log('affiliationsData loaded');
    }

    // Trigger dropdown programmatically with a search term
    await page.evaluate((inputId) => {
      const input: any = document.querySelector(`#${inputId}`);
      input.tagify.dropdown.show('University');
    }, affiliationInputId);

    // Wait for dropdown to appear
    const dropdown = page.locator('.tagify__dropdown.affiliation');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Get first dropdown item
    const firstItem = dropdown.locator('.tagify__dropdown__item').first();
    await expect(firstItem).toBeVisible();

    // Log the item's HTML structure for debugging
    const itemHTML = await firstItem.evaluate(el => el.outerHTML);
    console.log('First item HTML:', itemHTML);

    // Log the item's dataset
    const itemData = await firstItem.evaluate(el => ({
      dataset: el.dataset,
      attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value }))
    }));
    console.log('First item data:', JSON.stringify(itemData, null, 2));

    // Get the text content before clicking
    const itemText = await firstItem.textContent();
    console.log('Item text before click:', itemText);

    // Check current tag count
    const tagCountBefore = await page.evaluate((inputId) => {
      const input: any = document.querySelector(`#${inputId}`);
      return input.tagify.value.length;
    }, affiliationInputId);
    console.log('Tag count before click:', tagCountBefore);

    // Try clicking the item
    await firstItem.click();
    
    // Wait a bit for the tag to be added
    await page.waitForTimeout(1000);

    // Check tag count after clicking
    const tagCountAfter = await page.evaluate((inputId) => {
      const input: any = document.querySelector(`#${inputId}`);
      return input.tagify.value.length;
    }, affiliationInputId);
    console.log('Tag count after click:', tagCountAfter);

    // Get the actual tags
    const tags = await page.evaluate((inputId) => {
      const input: any = document.querySelector(`#${inputId}`);
      return input.tagify.value;
    }, affiliationInputId);
    console.log('Tags after click:', JSON.stringify(tags, null, 2));

    // The test assertion
    expect(tagCountAfter).toBeGreaterThan(tagCountBefore);
    expect(tags.length).toBeGreaterThan(0);
  });
});
