import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../utils';

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
    await expect(mslInput, 'MSL input field should be visible').toBeVisible();
    await expect(mslInput, 'MSL input field should be empty').toHaveValue('');

    // Click thesaurus button to open modal
    await thesaurusButton.click();

    // Wait until the modal becomes visible (support both "show" and "modal-visible")
    await expect(
      modal.locator('.modal-dialog'),
      'Modal dialog should become visible after click'
    ).toBeVisible({ timeout: 10000 });

    // Ensure the modal itself has the correct visibility class
    const modalClass = await modal.getAttribute('class');
    expect(
      modalClass?.includes('show') || modalClass?.includes('modal-visible'),
      `Expected modal class to include "show" or "modal-visible", but got: ${modalClass}`
    ).toBeTruthy();

    // Check modal title
    await expect(modal.locator('.modal-title')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    // Ensure both trees (general + domain) are visible
    await expect(modal.locator('#jstree-mslkeyword-general')).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('#jstree-mslkeyword-domain')).toBeVisible({ timeout: 10000 });

    // Ensure search input is visible
    await expect(modal.locator('#input-mslkeyword-thesaurussearch')).toBeVisible();

    // Close modal
    await modal.locator('button.btn-primary:has-text("OK")').click();

    // Wait for modal to fully hide (Bootstrap fade-out transition)
    await modal.waitFor({ state: 'hidden', timeout: 10000 });
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

    // Close help modal
    const closeBtn = helpModal.locator('button.btn-primary:has-text("OK"), button.btn-close');
    if (await closeBtn.isVisible()) await closeBtn.click();
  });

});
