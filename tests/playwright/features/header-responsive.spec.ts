import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Mobile (XS)', width: 375, height: 667 },
  { name: 'Tablet (SM)', width: 640, height: 800 },
  { name: 'Tablet (MD)', width: 768, height: 1024 },
  { name: 'Laptop (LG)', width: 1024, height: 768 },
  { name: 'Desktop (XL)', width: 1440, height: 900 },
];

test.describe('Header Responsive Design', () => {
  for (const viewport of viewports) {
    test(`should display all header elements on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForSelector('header.navbar', { timeout: 5000 });

      const gfzLogo = page.locator('header a[href="https://www.gfz.de/"] img[alt="GFZ Logo"]');
      await expect(gfzLogo).toBeVisible();

      const gfzDataServicesLogo = page.locator('header a[href="https://dataservices.gfz.de/web/"] img[alt="GFZ Data Services Logo"]');
      await expect(gfzDataServicesLogo).toBeVisible();

      if (viewport.width < 992) {
        const toggler = page.locator('button.navbar-toggler');
        await expect(toggler).toBeVisible();
        await toggler.click();
        await page.waitForSelector('#headerMenuContent[class*="show"]', { timeout: 2000 });
      }

      await expect(page.locator('#buttonHelpheader')).toBeVisible();
      await expect(page.locator('#bd-help')).toBeVisible();
      await expect(page.locator('#bd-theme')).toBeVisible();
      await expect(page.locator('#bd-lang')).toBeVisible();

      if (viewport.width < 992) {
        await page.locator('button.navbar-toggler').click();
      }
    });
  }

  test('should center GFZ Data Services logo on small screens (< 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('header.navbar', { timeout: 5000 });

    const logo = page.locator('header .logo-center-wrapper');
    const boundingBox = await logo.boundingBox();
    const headerBoundingBox = await page.locator('header.navbar').boundingBox();

    if (boundingBox && headerBoundingBox) {
      const logoCenterX = boundingBox.x + boundingBox.width / 2;
      const headerCenterX = headerBoundingBox.x + headerBoundingBox.width / 2;
      expect(Math.abs(logoCenterX - headerCenterX)).toBeLessThan(10);
    }
  });
});
