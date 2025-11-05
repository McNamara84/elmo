import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS, } from '../utils';

test.describe('EPOS Multi-Scale Laboratories Keywords (MSL)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    // Explicitly wait until the input field is visible
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.locator(SELECTORS.formGroups.mslkeyword).waitFor({ state: 'visible', timeout: 30000 });
    await expect(page.locator(SELECTORS.formGroups.mslkeyword)).toBeVisible({ timeout: 30000 });
  });

  test('MSL Keyword input and thesaurus modal open correctly', async ({ page }) => {
    const mslInput = page.locator('#input-mslkeyword');
    const thesaurusButton = page.locator('#button-mslkeyword-thesaurus');
    const modal = page.locator('#modal-mslkeyword');

    // Wait until mslInput is visible
    await mslInput.waitFor({ state: 'visible', timeout: 10000 });
    await expect(mslInput).toBeVisible();
    await expect(mslInput).toHaveValue('');

    // Click thesaurus button to open modal
    await thesaurusButton.click();

    // Wait for modal to appear
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    await expect(modal).toBeVisible();

    // Check modal title
    await expect(modal.locator('.modal-title')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    // Explicitly wait until the General tree is visible
    await modal.locator('#jstree-mslkeyword-general').waitFor({ state: 'visible', timeout: 15000 });
    await expect(modal.locator('#jstree-mslkeyword-general')).toBeVisible();

    // Same for the Domain tree
    await modal.locator('#jstree-mslkeyword-domain').waitFor({ state: 'visible', timeout: 15000 });
    await expect(modal.locator('#jstree-mslkeyword-domain')).toBeVisible();

    // Ensure search input is visible
    await expect(modal.locator('#input-mslkeyword-thesaurussearch')).toBeVisible();

    // Close modal
    await modal.locator('button.btn-primary:has-text("OK")').click();
    await expect(modal).toBeHidden();
  });

});
