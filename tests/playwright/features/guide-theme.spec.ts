import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { navigateToHome } from '../utils';

declare global {
  interface Window {
    elmoTheme: { getChoice(): string; setChoice(choice: string): void };
  }
}

test.describe('Guide theme', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark'] as const) {
    test('inherits ' + theme + ' and keeps navigation and search readable', async ({ page, context }) => {
      await page.addInitScript(value => localStorage.setItem('theme', value), theme);
      await navigateToHome(page);
      const guide = await context.newPage();
      await guide.goto('doc/help.php', { waitUntil: 'domcontentloaded' });
      await expect(guide.locator('html')).toHaveAttribute('data-bs-theme', theme);
      const report = await new AxeBuilder({ page: guide }).withRules(['color-contrast']).analyze();
      expect(report.violations.map(rule => rule.nodes.map(node => node.failureSummary))).toEqual([]);
      await guide.locator('.navbar-toggler').click();
      const menu = guide.locator('#offcanvasNavbar');
      await expect(menu).toBeVisible();
      const menuReport = await new AxeBuilder({ page: guide }).include('#offcanvasNavbar')
        .withRules(['color-contrast']).analyze();
      expect(menuReport.violations).toEqual([]);
      await menu.locator('.nav-link').nth(1).hover();
      await menu.locator('.nav-link').nth(1).focus();
      const focusedMenuReport = await new AxeBuilder({ page: guide }).include('#offcanvasNavbar')
        .withRules(['color-contrast']).analyze();
      expect(focusedMenuReport.violations).toEqual([]);
      await menu.locator('.btn-close').click();
      await expect(menu).toBeHidden();
      await guide.locator('#help-search').fill('metadata');
      await guide.locator('#help-search-btn').click();
      await expect(guide.locator('mark:visible').first()).toBeVisible();
      await expect(guide.locator('#help-search-next')).toBeVisible();
      const searchReport = await new AxeBuilder({ page: guide }).include('.navbar').withRules(['color-contrast']).analyze();
      expect(searchReport.violations).toEqual([]);
      await guide.close();
    });
  }

  test('follows editor changes in an already open guide', async ({ page, context }) => {
    await navigateToHome(page);
    await page.evaluate(() => window.elmoTheme.setChoice('light'));
    const guide = await context.newPage();
    await guide.goto('doc/help.php', { waitUntil: 'domcontentloaded' });
    await expect(guide.locator('html')).toHaveAttribute('data-bs-theme', 'light');
    await page.locator('#bd-theme').click();
    await page.locator('#bd-theme + ul [data-bs-theme-value="dark"]').click();
    await expect(guide.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await guide.reload({ waitUntil: 'domcontentloaded' });
    await expect(guide.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await page.locator('#bd-theme').click();
    await page.locator('#bd-theme + ul [data-bs-theme-value="auto"]').click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await guide.emulateMedia({ colorScheme: 'dark' });
    await expect(guide.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await guide.emulateMedia({ colorScheme: 'light' });
    await expect(guide.locator('html')).toHaveAttribute('data-bs-theme', 'light');
    expect(await guide.evaluate(() => localStorage.getItem('theme'))).toBe('auto');
    await guide.close();
  });
});
