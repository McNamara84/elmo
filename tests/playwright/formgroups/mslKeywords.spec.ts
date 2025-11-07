import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../utils';

test.describe("EPOS Multi-Scale Laboratories Keywords (MSL)", () => {

  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);

    const thesaurusButton = page.locator('#button-mslkeyword-thesaurus');
    await thesaurusButton.click({ timeout: 100000 });

    const modal = page.locator('#modal-mslkeyword');
    await modal.waitFor({ state: 'visible', timeout: 100000 });

    const mslInput = page.locator('#input-mslkeyword');
    await expect(mslInput).toBeVisible({ timeout: 100000 });
  });

  test('MSL Keyword input and thesaurus modal open correctly', async ({ page }) => {
    const modal = page.locator('#modal-mslkeyword');
    const mslInput = modal.locator('#input-mslkeyword');
    const searchInput = modal.locator('#input-mslkeyword-thesaurussearch');

    // Verify input field is empty
    await expect(mslInput).toHaveValue('');

    // Check modal title
    await expect(modal.locator('.modal-title')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    // Ensure both trees (general + domain) are visible
    await expect(modal.locator('#jstree-mslkeyword-general')).toBeVisible();
    await expect(modal.locator('#jstree-mslkeyword-domain')).toBeVisible();

    // Ensure search input is visible
    await expect(searchInput).toBeVisible();

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
