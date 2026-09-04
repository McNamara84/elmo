import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS, } from '../../utils';

test.describe("EPOS Multi-Scale Laboratories Keywords (MSL)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator(SELECTORS.formGroups.mslkeyword)).toHaveCount(1);
  });

  test('MSL Keyword input and thesaurus modal open correctly', async ({ page }) => {
    const mslInput = page.locator('#input-mslkeyword');
    const thesaurusButton = page.locator('#button-mslkeyword-thesaurus');
    const modal = page.locator('#modal-mslkeyword');

    // Verify input field is empty and exists
    await expect(mslInput).toHaveCount(1);
    await expect(mslInput).toHaveValue('');

    // Tagify exists only after initMslKeywords binds the modal lazy-load
    // listener. Clicking before that misses show.bs.modal ({ once: true })
    // and leaves the empty jstree divs hidden.
    await page.waitForFunction(
      () => Boolean((document.querySelector('#input-mslkeyword') as { _tagify?: unknown } | null)?._tagify),
      { timeout: 15_000 },
    );

    // Click thesaurus button to open modal
    await thesaurusButton.click();

    // Wait for modal to appear
    await expect(modal).toBeVisible();

    // Check modal title
    await expect(modal.locator('.modal-title')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    // Empty jstree containers have zero height (Playwright: hidden) until
    // the local MSL vocab JSON is fetched and the trees are built.
    await expect(modal.locator('#jstree-mslkeyword-general .jstree-container-ul')).toBeVisible({ timeout: 15_000 });
    await expect(modal.locator('#jstree-mslkeyword-domain .jstree-container-ul')).toBeVisible({ timeout: 15_000 });

    // Ensure search input is visible
    await expect(modal.locator('#input-mslkeyword-thesaurussearch')).toBeVisible();

    // Close modal
    await modal.locator('button.btn-primary:has-text("OK")').click();
    await expect(modal).toBeHidden();
  });

  test('Help button shows MSL help modal', async ({ page }) => {
    await enableHelp(page);

    // Click help button inside the input group
    await page.locator('[data-help-section-id="help-mslKeywords-keyword"]').click();

    // Wait for modal to appear
    const helpModal = page.locator('#helpModal');
    await helpModal.waitFor({ state: 'visible', timeout: 20000 });

    await expect(helpModal).toBeVisible();
    await expect(helpModal.locator('.modal-body')).toContainText('EPOS Multi-Scale Laboratories Keywords');

  });

});
