import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { navigateToHome } from '../utils';

async function expectReadable(page, selector: string) {
  const report = await new AxeBuilder({ page }).include(selector).withRules(['color-contrast']).analyze();
  expect(report.violations.map(rule => ({
    id: rule.id, nodes: rule.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
  }))).toEqual([]);
}

test.describe('Theme appearance', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark'] as const) {
    test.describe(theme, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(value => localStorage.setItem('theme', value), theme);
        await navigateToHome(page);
        await expect(page.locator('html')).toHaveAttribute('data-bs-theme', theme);
      });

      test('keeps the subheader, notice and JSON-LD action readable', async ({ page }) => {
        await expectReadable(page, '.elmo-subheader');
        await expectReadable(page, '.alert-info');
        await expectReadable(page, '#button-form-save-jsonld');
        if (theme === 'dark') {
          await expect(page.locator('.elmo-subheader')).toHaveCSS('background-color', 'rgb(44, 51, 58)');
          await expect(page.locator('.alert-info').first()).toHaveCSS('background-color', 'rgb(21, 50, 75)');
        }
        const button = page.locator('#button-form-save-jsonld');
        await button.hover();
        await expect(button).toHaveCSS('background-color', theme === 'dark' ? 'rgb(176, 186, 197)' : 'rgb(73, 80, 87)');
        await expectReadable(page, '#button-form-save-jsonld');
        await button.focus();
        await expectReadable(page, '#button-form-save-jsonld');
      });

      test('keeps the readonly DOI and its floating label readable', async ({ page }) => {
        const doi = page.locator('#input-resourceinformation-doi');
        await expect(doi).toHaveAttribute('readonly', '');
        await expectReadable(page, '.form-floating:has(#input-resourceinformation-doi)');
        await doi.focus();
        await expectReadable(page, '.form-floating:has(#input-resourceinformation-doi)');
      });

      for (const width of [390, 768, 1440]) {
        test('keeps the last fields above the footer at ' + width + 'px', async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          const footer = page.locator('footer.fixed-bottom');
          await expect.poll(async () => page.evaluate(() => {
            const footer = document.querySelector('footer.fixed-bottom')!;
            return parseFloat(getComputedStyle(document.body).paddingBottom) -
              footer.getBoundingClientRect().height;
          })).toBeGreaterThanOrEqual(15);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const lastField = page.locator('#form-mde input:visible, #form-mde textarea:visible, #form-mde select:visible').last();
          await expect(lastField).toBeVisible();
          expect((await lastField.boundingBox())!.y + (await lastField.boundingBox())!.height)
            .toBeLessThan((await footer.boundingBox())!.y);
          await expectReadable(page, 'footer.fixed-bottom');

          // Longer translations and status messages can add another footer row.
          await page.locator('#button-form-save-jsonld').evaluate(button => {
            button.textContent = 'Save metadata as JSON-LD / Metadaten als JSON-LD speichern';
          });
          await expect.poll(async () => page.evaluate(() =>
            parseFloat(getComputedStyle(document.body).paddingBottom) -
            document.querySelector('footer.fixed-bottom')!.getBoundingClientRect().height
          )).toBeGreaterThanOrEqual(15);
          expect(await page.evaluate(() =>
            document.querySelector('footer')!.scrollWidth <= window.innerWidth
          )).toBe(true);
        });
      }
    });
  }
});
