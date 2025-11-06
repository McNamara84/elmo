import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../utils';

test.describe("EPOS Multi-Scale Laboratories Keywords (MSL)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([{
      name: 'modal-mslkeyword',
      value: 'true',
      domain: 'localhost',
      path: '/'
    }]);
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator(SELECTORS.formGroups.mslkeyword)).toBeVisible();
  });

  test('MSL Keyword input and thesaurus modal open correctly', async ({ page }) => {
    const mslInput = page.locator('#input-mslkeyword');
    const thesaurusButton = page.locator('#button-mslkeyword-thesaurus');
    const modal = page.locator('#modal-mslkeyword');

    // Verify input field is empty and visible
    await expect(mslInput).toBeVisible();
    await expect(mslInput).toHaveValue('');

    // Click thesaurus button to explicitly open modal
    await thesaurusButton.click();

    // Wait for modal to appear with reasonable timeout (e.g., 15s)
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Check modal title
    await expect(modal.locator('.modal-title')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    // Ensure both trees (general + domain) are visible
    await expect(modal.locator('#jstree-mslkeyword-general')).toBeVisible();
    await expect(modal.locator('#jstree-mslkeyword-domain')).toBeVisible();

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

    // Wait for help modal to appear
    const helpModal = page.locator('#helpModal');
    await helpModal.waitFor({ state: 'visible', timeout: 20000 });

    await expect(helpModal).toBeVisible();
    await expect(helpModal.locator('.modal-body')).toContainText('EPOS Multi-Scale Laboratories Keywords');
  });
});
