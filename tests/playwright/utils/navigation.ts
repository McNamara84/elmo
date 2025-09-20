import { expect, type Locator, type Page } from '@playwright/test';
import { SELECTORS } from './constants';

export async function navigateToHome(page: Page) {
  await page.goto('');
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