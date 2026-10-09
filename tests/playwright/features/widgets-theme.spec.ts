import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { navigateToHome, waitForHomepageReady } from '../utils';

async function readable(page: Page, selector: string) {
  await page.locator(selector).evaluateAll(nodes => Promise.all(
    nodes.flatMap(node => node.getAnimations({ subtree: true }))
      .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {}))
  ));
  const result = await new AxeBuilder({ page }).include(selector).withRules(['color-contrast']).analyze();
  expect(result.violations.map(rule => rule.nodes.map(node => ({
    target: node.target, reason: node.failureSummary
  })))).toEqual([]);
}

test.describe('Widget theme', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark'] as const) {
    test.describe(theme, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(value => localStorage.setItem('theme', value), theme);
        await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({
          json: { science_keywords: { available: true, displayName: 'GCMD Science Keywords' } }
        }));
        const node = (id: string, text: string, children = []) => ({
          id, text, children, scheme: 'GCMD', language: 'en',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords'
        });
        await page.route('**/api/v2/vocabs/thesauri/gcmd-science-keywords', route => route.fulfill({
          json: { data: [node('science-root', 'Science Keywords', [
            node('https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa', 'GEODETICS', [
              node('theme-leaf', 'TEST KEYWORD')
            ])
          ])] }
        }));
        await page.route('**/api/v2/affiliations/search?*', route => route.fulfill({
          json: [{ id: '04z8jg394', name: 'Example Foundation' }]
        }));
        await navigateToHome(page);
        await waitForHomepageReady(page);
      });

      test('keeps tags and their dropdown readable when the theme changes', async ({ page }) => {
        await page.locator('#button-contributor-addperson').click();
        // Use the real Tagify instance with a small, deterministic vocabulary.
        await page.waitForFunction(() =>
          !!(document.querySelector('input[name="cbPersonRoles[]"]') as any)?._tagify);
        await page.evaluate(() => {
          const instance = (document.querySelector('input[name="cbPersonRoles[]"]') as any)._tagify;
          instance.settings.whitelist = ['Data Collector', 'Researcher', 'Contact Person'];
          instance.addTags(['Researcher']);
          instance.dropdown.show('');
        });
        await expect(page.locator('.tagify__tag').first()).toBeVisible();
        await expect(page.locator('.tagify__dropdown').first()).toBeVisible();
        await readable(page, '#formgroup-contributors');
        await readable(page, '.tagify__dropdown');
        await page.locator('.tagify__dropdown__item').first().hover();
        await readable(page, '.tagify__dropdown');
        await page.evaluate(() => window.elmoTheme.setChoice(
          document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark'
        ));
        await readable(page, '#formgroup-contributors');
        await readable(page, '.tagify__dropdown');
        expect(await page.evaluate(() =>
          (document.querySelector('input[name="cbPersonRoles[]"]') as any)._tagify.value.map(tag => tag.value)
        )).toContain('Researcher');
      });

      test('keeps funder autocomplete readable with mouse and keyboard', async ({ page }) => {
        await page.evaluate(() => {
          (window as any).fundersData = [{ name: 'Example Foundation', crossRefId: '10.13039/100000001' }];
        });
        const input = page.locator('#input-funder');
        await input.fill('Example');
        const dropdown = page.locator('.ui-autocomplete:visible');
        await expect(dropdown).toBeVisible();
        await readable(page, '.ui-autocomplete');
        await dropdown.locator('.ui-menu-item-wrapper').first().hover();
        await readable(page, '.ui-autocomplete');
        await input.press('Escape');
        await input.fill('Example');
        await expect(dropdown).toBeVisible();
        await input.press('ArrowDown');
        await expect(dropdown.locator('.ui-state-active')).toBeVisible();
        await readable(page, '.ui-autocomplete');
        await input.press('Enter');
        await expect(input).toHaveValue('Example Foundation');
      });

      test('keeps the thesaurus selection, search and focus readable', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'igsn', 'IGSN has no thesaurus fields.');
        const button = page.locator('#button-science_keywords-open');
        await expect(button).toBeVisible({ timeout: 15_000 });
        await button.click();
        const modal = page.locator('#modal-sciencekeyword');
        await expect(modal).toBeVisible();
        const anchors = modal.locator('.jstree-anchor:visible');
        await expect(anchors.first()).toBeVisible();
        await anchors.first().hover();
        await readable(page, '#modal-sciencekeyword');
        await modal.locator('.jstree-node').first().locator(':scope > .jstree-ocl').click();
        const selected = anchors.nth(1);
        await selected.locator('.jstree-checkbox').click();
        await expect(selected).toHaveClass(/jstree-clicked/);
        await selected.hover();
        await selected.focus();
        await readable(page, '#modal-sciencekeyword');
        const selectedId = await selected.getAttribute('id');
        await page.evaluate(() => window.elmoTheme.setChoice(
          document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark'
        ));
        await expect(modal.locator('[id="' + selectedId + '"]')).toHaveClass(/jstree-clicked/);
        await readable(page, '#modal-sciencekeyword');
        const search = modal.locator('input[type="text"]').first();
        await search.fill((await selected.innerText()).trim().slice(0, 8));
        await expect(modal.locator('.jstree-search').first()).toBeVisible();
        await readable(page, '#modal-sciencekeyword');
      });

      test('keeps shared dialogs and tooltips readable', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        for (const [button, selector] of [
          ['[data-help-section-id="help-resourceinformation-fg"]', '#helpModal'],
          ['#button-form-load', '#modal-uploadxml'],
          ['#button-changelog-show', '#modal-changelog'],
          ['#button-feedback-openmodalfooter', '#modal-feedback'],
          ['#button-add-csv', '#freeKeywordsCsvModal'],
          ['#button-stc-openmap', '#modal-stc-map']
        ]) {
          const trigger = page.locator(button);
          if (!(await trigger.isVisible())) continue; // Variant feature toggles.
          await trigger.click();
          await expect(page.locator(selector)).toBeVisible();
          await readable(page, selector);
          await page.locator(selector + ' [data-bs-dismiss="modal"]').first().click();
          await expect(page.locator(selector)).toBeHidden();
        }
        const action = page.locator('#button-form-save-jsonld');
        await action.hover();
        await expect(action).toHaveAttribute('aria-describedby', /\S+/);
        const tooltipId = await action.getAttribute('aria-describedby');
        const tooltip = page.locator('[id="' + tooltipId + '"]');
        await expect(tooltip).toBeVisible();
        await readable(page, '[id="' + tooltipId + '"]');
        if (theme === 'dark') {
          await expect(tooltip.locator('.tooltip-inner')).toHaveCSS('background-color', 'rgb(44, 51, 58)');
        }
      });
    });
  }
});
