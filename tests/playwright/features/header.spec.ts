import { test, expect } from '@playwright/test';

test.describe('Header Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
  });

  test('header contains GFZ and Data Services logos', async ({ page }) => {

    // Check GFZ logo
    const gfzLogo = page.locator('header img[alt="GFZ Logo"]');
    await expect(gfzLogo).toBeVisible();

    // Check Data Services logo
    const dataServicesLogo = page.locator('header img[alt="GFZ Data Services Logo"]');
    await expect(dataServicesLogo).toBeVisible();
  });

  test('header contains help, mode and language dropdowns', async ({ page }) => {

    const helpButton = page.locator('#bd-help');
    const modeButton = page.locator('#bd-theme');
    const langButton = page.locator('#bd-lang');

    await expect(helpButton).toBeVisible();
    await expect(modeButton).toBeVisible();
    await expect(langButton).toBeVisible();
  });

  test('subheader displays instance title', async ({ page }) => {

    // The subheader should contain the instance title
    const subheader = page.locator('section[aria-label="Page subheader"] .fs-5');
    await expect(subheader).toBeVisible();

    // Check that the title contains "ELMO" (common to all instances)
    await expect(subheader).toContainText('ELMO');
  });

  test('subheader title matches expected format', async ({ page }) => {

    const subheader = page.locator('section[aria-label="Page subheader"] .fs-5');
    const titleText = await subheader.textContent();

    // Title should match one of the valid instance titles
    const validTitles = [
      'ELMO – GFZ Metadata Editor 2.0',
      'ELMO MSL Edition – GFZ Metadata Editor 2.0',
      'ELMO ICGEM Edition – Alpha Version',
      'ELMO IGSN Edition – Alpha Version'
    ];

    expect(validTitles.some(title => titleText?.includes(title))).toBeTruthy();
  });

  test('GFZ logo links to gfz.de', async ({ page }) => {

    const gfzLogoLink = page.locator('header a[href="https://www.gfz.de/"]');
    await expect(gfzLogoLink).toBeVisible();
    await expect(gfzLogoLink).toHaveAttribute('target', '_blank');
  });

  test('Data Services logo links to dataservices.gfz.de', async ({ page }) => {

    const dataServicesLink = page.locator('header a[href="https://dataservices.gfz.de/web/"]');
    await expect(dataServicesLink).toBeVisible();
    await expect(dataServicesLink).toHaveAttribute('target', '_blank');
  });

});
