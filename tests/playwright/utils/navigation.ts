import { expect, type Locator, type Page } from '@playwright/test';
import { registerStaticAssetRoutes } from './assets';
import { SELECTORS } from './constants';

/**
 * Pages that already have static-asset & perf routes registered.
 * Prevents duplicate route handlers when navigateToHome is called
 * more than once on the same page instance.
 */
const pagesWithRoutes = new WeakSet<Page>();

export async function navigateToHome(page: Page) {
  if (!pagesWithRoutes.has(page)) {
    // Serve JS, CSS, JSON, images directly from disk so the
    // single-threaded PHP built-in server only handles API calls.
    await registerStaticAssetRoutes(page);

    // Suppress fire-and-forget logging POST – not needed in most tests.
    // Use fallback() to delegate to any prior handler (e.g. the mock in
    // page-event-logging.spec.ts) before the request reaches the server.
    // When no prior mock exists the request goes to the PHP server, but
    // that single small POST is negligible.
    await page.route('**/endpoints/log_page_event.php', route => route.fallback());

    pagesWithRoutes.add(page);
  }
  await page.goto('', { waitUntil: 'domcontentloaded' });
}

export async function expectNavbarVisible(page: Page) {
  await expect(page.locator(SELECTORS.navigation.navbar)).toBeVisible({ timeout: 10_000 });
}

export async function expectPrimaryHeading(page: Page) {
  const banner = page.locator('header[role="banner"]');
  await expect(banner).toHaveCount(1);

  const heading = banner.locator('h1');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(heading).toHaveCount(1);
  await expect(heading).toContainText(/ELMO/i);
}

export async function openLanguageMenu(page: Page): Promise<Locator> {
  const toggle = page.locator(SELECTORS.navigation.languageToggle);
  await toggle.click();
  const menu = page.locator(SELECTORS.navigation.languageMenu);
  await expect(menu).toBeVisible();
  return menu;
}

export async function enableHelp(page: Page) {
  await page.locator(SELECTORS.navigation.helpToggle).click();
  await page.locator(SELECTORS.navigation.helpOnButton).click();
}

export async function disableHelp(page: Page) {
  await page.locator(SELECTORS.navigation.helpToggle).click();
  await page.locator(SELECTORS.navigation.helpOffButton).click();
}

export async function reopenModal(page: Page, modalSelector: string, trigger: () => Promise<void>) {
  const modal = page.locator(modalSelector);
  await trigger();
  await expect(modal).toBeVisible();
}