import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS, } from '../utils';

test.describe("EPOS Multi-Scale Laboratories Keywords (MSL)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator(SELECTORS.formGroups.mslkeyword)).toBeVisible();
  });

  test('MSL Keyword input and thesaurus modal open correctly', async ({ page }) => {
    const mslInput = page.locator('#input-mslkeyword');
    const thesaurusButton = page.locator('#button-mslkeyword-thesaurus');
    const modal = page.locator('#modal-mslkeyword');

    // Verify input field is empty and visible
    await expect(thesaurusButton).toBeEnabled({ timeout: 10000 });
    await expect(thesaurusButton).toBeVisible({ timeout: 10000 });

    await thesaurusButton.click();

    await expect(modal).toBeVisible({ timeout: 10000 });

    const tagifyInput = modal.locator('.tagify__input');
    await expect(tagifyInput).toBeVisible({ timeout: 10000 });

    await modal.locator('#jstree-mslkeyword-general .jstree-node').first().waitFor();
    await modal.locator('#jstree-mslkeyword-domain .jstree-node').first().waitFor();


    // Ensure search input is visible
    await expect(modal.locator('#input-mslkeyword-thesaurussearch')).toBeVisible();

    // Close modal
    await modal.locator('button.btn-primary:has-text("OK")').click();
    await expect(modal).toBeHidden();
  });

  test('Help button shows MSL help modal', async ({ page }) => {
    await enableHelp(page);
    await page.waitForTimeout(500);

    // Click help button inside the input group
    await page.locator('[data-help-section-id="help-mslKeywords-keyword"]').click();

    // Wait for modal to appear
    const helpModal = page.locator('#helpModal');
    await helpModal.waitFor({ state: 'visible', timeout: 20000 });

    await expect(helpModal).toBeVisible();
    await expect(helpModal.locator('.modal-body')).toContainText('EPOS Multi-Scale Laboratories Keywords');

  });

});
