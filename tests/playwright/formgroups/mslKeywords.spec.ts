import { test, expect } from '@playwright/test';
import { navigateToHome, expectNavbarVisible, enableHelp } from '../utils';

test.describe("EPOS Multi-Scale Laboratories Keywords (MSL)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
  });

  test('Thesaurus modal opens and displays jsTrees', async ({ page }) => {
    const tagifyContainer = page.locator('.thesaurus-tagify').first();
    const thesaurusButton = page.locator('#button-mslkeyword-thesaurus');
    const modal = page.locator('#modal-mslkeyword');

    // Verify input field is empty and visible
    await expect(tagifyContainer).toBeVisible();

    // Click thesaurus button to open modal
    await thesaurusButton.click();

    // Wait for modal to appear
    await expect(modal).toBeVisible();

    await expect(modal.locator('.modal-title')).toHaveText(/EPOS Multi-Scale Laboratories Keywords/);

    // Ensure both trees (general + domain) are visible
    await expect(modal.locator('#jstree-mslkeyword-general')).toBeVisible();
    await expect(modal.locator('#jstree-mslkeyword-domain')).toBeVisible();

    // Ensure search input is visible
    await expect(modal.locator('#input-mslkeyword-thesaurussearch')).toBeVisible();

    await modal.locator('button.btn-primary:has-text("OK")').click();
    await expect(modal).toBeHidden();
  });

  test('Add and remove a keyword via Tagify and jsTree', async ({ page }) => {
    const tagifyInput = page.locator('.thesaurus-tagify input').first();
    const thesaurusButton = page.locator('#button-mslkeyword-thesaurus');
    const modal = page.locator('#modal-mslkeyword');
    const selectedList = page.locator('#selected-keywords-msl');

    await thesaurusButton.click();
    await expect(modal).toBeVisible();

    const generalTreeFirstNode = modal.locator('#jstree-mslkeyword-general li:first-child');
    await generalTreeFirstNode.click();

    await expect(tagifyInput).toHaveValue(/.+/);

    await expect(selectedList.locator('li')).toHaveCount(1);

    await selectedList.locator('li button').click();
    await expect(selectedList.locator('li')).toHaveCount(0);

    await modal.locator('button.btn-primary:has-text("OK")').click();
    await expect(modal).toBeHidden();
  });

  test('Help button shows MSL help modal', async ({ page }) => {
    await enableHelp(page);
    const helpButton = page.locator('[data-help-section-id="help-mslKeywords-keyword"]');
    await helpButton.click();

    // Wait for modal to appear
    const helpModal = page.locator('#helpModal');
    await expect(helpModal).toBeVisible();
    await expect(helpModal.locator('.modal-body')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    await helpModal.locator('button.btn-primary:has-text("OK")').click();
    await expect(helpModal).toBeHidden();
  });
});
