import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const navigateToHome = async ({ page }: { page: Page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
};

/**
 * Check if GGM Properties are enabled in this instance
 * @param page - Playwright page object
 * @returns boolean - true if GGM is enabled, false otherwise
 */
const isGGMEnabled = async (page: Page): Promise<boolean> => {
  const hasGGMCard = await page.locator('#group-ggmspropertiesessential').isVisible().catch(() => false);
  return hasGGMCard;
};

test.describe('GGM Descriptions (ICGEM Edition)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome({ page });
    const ggmEnabled = await isGGMEnabled(page);
    test.skip(!ggmEnabled,'GGM Properties not enabled in this environment');
    });

  test('Descriptions form group is visible', async ({ page }) => {
    const descriptionGroup = page.locator('#group-description');
    await expect(descriptionGroup).toBeVisible();
  });

  test('All description accordion items exist with correct labels', async ({ page }) => {
    const expectedLabels = [
      'Abstract',
      'General Model Description',
      'Input Data',
      'Processing Procedures',
      'Specific Features of Resulting Gravity Field',
      'Other'
    ];

    for (const label of expectedLabels) {
      const button = page.locator(`button[data-bs-toggle="collapse"]`).filter({ hasText: label });
      await expect(button).toBeVisible();
    }
  });

  test('Each description field has a corresponding textarea input', async ({ page }) => {
    const inputFields = [
      { id: '#input-abstract', name: 'descriptionAbstract' },
      { id: '#input-general-model-description', name: 'descriptionGeneralModelDescription' },
      { id: '#input-input-data', name: 'descriptionInputData' },
      { id: '#input-processing-procedures', name: 'descriptionProcessingProcedures' },
      { id: '#input-specific-features', name: 'descriptionSpecificFeaturesOfResultingGravityField' },
      { id: '#input-other', name: 'descriptionOther' }
    ];

    for (const field of inputFields) {
      const textarea = page.locator(`textarea[name="${field.name}"]`);
      // Textareas exist in DOM (some may be hidden in collapsed accordions)
      await expect(textarea).toBeAttached();
    }
  });

  test('Abstract field is required on submit', async ({ page }) => {
    const abstractTextarea = page.locator('#input-abstract');
    await expect(abstractTextarea).toHaveAttribute('required');
    await expect(abstractTextarea).toHaveClass(/js-required-on-submit/);
  });

  test('Can expand and collapse accordion items', async ({ page }) => {
    const generalModelButton = page.locator('button').filter({ hasText: 'General Model Description' });
    const generalModelCollapse = page.locator('#collapse-general-model-description');

    // Initially collapsed
    await expect(generalModelCollapse).toHaveClass(/collapse(?!d)/);

    // Click to expand
    await generalModelButton.click();
    await expect(generalModelCollapse).toHaveClass(/show/);

    // Click to collapse
    await generalModelButton.click();
  });

  test('Can enter text in description fields', async ({ page }) => {
    const abstractInput = page.locator('#input-abstract');
    const testText = 'Test description content';

    await abstractInput.fill(testText);
    await expect(abstractInput).toHaveValue(testText);
  });
});

