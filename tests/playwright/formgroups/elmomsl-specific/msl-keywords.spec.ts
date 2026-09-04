import { test, expect, type Page } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../../utils';

/**
 * Same readiness as GCMD thesaurus specs:
 *   translationsLoaded (homepage) → Tagify on the keyword input → tree after Open.
 * MSL is not a special production path; the vocab is local JSON loaded on modal show.
 */
async function waitForMslKeywordField(page: Page) {
  await page.waitForFunction(
    () => Boolean((document.querySelector('#input-mslkeyword') as { _tagify?: unknown } | null)?._tagify),
    { timeout: 15_000 },
  );
}

async function openMslThesaurusModal(page: Page) {
  await page.locator('#button-mslkeyword-thesaurus').click();
  const modal = page.locator('#modal-mslkeyword');
  await expect(modal).toBeVisible();

  const generalTree = modal.locator('#jstree-mslkeyword-general');
  const domainTree = modal.locator('#jstree-mslkeyword-domain');
  await expect(generalTree.locator('.thesaurus-loading-spinner')).toHaveCount(0, { timeout: 15_000 });
  await expect(generalTree.locator('.jstree-container-ul')).toBeVisible({ timeout: 15_000 });
  await expect(domainTree.locator('.jstree-container-ul')).toBeVisible({ timeout: 15_000 });
  return modal;
}

test.describe("EPOS Multi-Scale Laboratories Keywords (MSL)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator(SELECTORS.formGroups.mslkeyword)).toHaveCount(1);
    await page.waitForFunction(() => Boolean((window as any).elmo?.translations?.general));
    await waitForMslKeywordField(page);
  });

  test('MSL Keyword input and thesaurus modal open correctly', async ({ page }) => {
    const mslInput = page.locator('#input-mslkeyword');

    // Verify input field is empty and exists
    await expect(mslInput).toHaveCount(1);
    await expect(mslInput).toHaveValue('');

    const modal = await openMslThesaurusModal(page);

    await expect(modal.locator('.modal-title')).toContainText('EPOS Multi-Scale Laboratories Keywords');

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
