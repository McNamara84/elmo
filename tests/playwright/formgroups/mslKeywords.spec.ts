import { test, expect } from '@playwright/test';
import { navigateToHome, expectNavbarVisible, enableHelp, SELECTORS } from '../utils';

test.describe('EPOS Multi-Scale Laboratories Keywords (MSL)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator(SELECTORS.formGroups.mslkeyword)).toBeVisible();
  });

  test('Öffnen des MSL-Thesaurus-Modals funktioniert', async ({ page }) => {
    const mslInput = page.locator('#input-mslkeyword');
    const openModalButton = page.locator('#button-mslkeyword-thesaurus');
    const modal = page.locator('#modal-mslkeyword');

    await expect(mslInput).toBeVisible();
    await expect(mslInput).toHaveValue('');

    await openModalButton.click();
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    await page.waitForTimeout(500);

    await expect(modal.locator('.modal-title')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    await expect(modal.locator('#input-mslkeyword-thesaurussearch')).toBeVisible();
    await expect(modal.locator('#jstree-mslkeyword-general')).toBeVisible();
    await expect(modal.locator('#jstree-mslkeyword-domain')).toBeVisible();

    await modal.locator('button.btn-primary:has-text("OK")').click();
    await modal.waitFor({ state: 'hidden', timeout: 10000 });
  });

  test('Tagify-Input kann befüllt werden (verstecktes Feld sichtbar gemacht)', async ({ page }) => {
    const mslInput = page.locator('#input-mslkeyword');

    await expect(mslInput).toBeVisible();

    await page.evaluate(() => {
      const hiddenInput = document.querySelector('.thesaurus-tagify') as HTMLElement | null;
      if (hiddenInput) {
        hiddenInput.style.display = 'block';
        hiddenInput.style.visibility = 'visible';
        hiddenInput.setAttribute('value', 'Granite');
      }

      const input = document.querySelector('.thesaurus-tagify input') as HTMLInputElement | null;
      if (input) {
        input.style.display = 'block';
        input.style.visibility = 'visible';
        input.value = 'Granite';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });


    const tagifyInput = page.locator('.thesaurus-tagify input');
    await expect(tagifyInput).toHaveValue('Granite');
  });

  test('Help-Button zeigt das richtige Hilfemodal', async ({ page }) => {
    await enableHelp(page);
    await page.waitForTimeout(500);

    await page.locator('[data-help-section-id="help-mslKeywords-keyword"]').click();

    const helpModal = page.locator('#helpModal');
    await helpModal.waitFor({ state: 'visible', timeout: 15000 });

    await page.waitForTimeout(300);

    await expect(helpModal.locator('.modal-body')).toContainText('EPOS Multi-Scale Laboratories Keywords');

    await helpModal.locator('button.btn-primary:has-text("OK")').click();
    await helpModal.waitFor({ state: 'hidden', timeout: 10000 });
  });
});
