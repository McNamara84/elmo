import { test, expect } from '@playwright/test';

// Test header responsiveness across all screen widths
// Validates that 2 logos and 4 buttons are visible at all breakpoints

test.describe('Header Responsive Design', () => {
  // Test configurations for different screen sizes
  const viewports = [
    { name: 'Mobile (XS)', width: 375, height: 667 },
    { name: 'Tablet (SM)', width: 640, height: 800 },
    { name: 'Tablet (MD)', width: 768, height: 1024 },
    { name: 'Laptop (LG)', width: 1024, height: 768 },
    { name: 'Desktop (XL)', width: 1440, height: 900 }
  ];

  viewports.forEach(viewport => {
    test(`should display all header elements on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      // Set viewport size
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Navigate to the page
      await page.goto('/');

      // Wait for header to be loaded
      await page.waitForSelector('header.navbar', { timeout: 5000 });

      // ===== TEST LOGO VISIBILITY =====
      
      // Test 1: GFZ Logo (left) should be visible
      const gfzLogo = page.locator('header a[href="https://www.gfz.de/"] img[alt="GFZ Logo"]');
      await expect(gfzLogo).toBeVisible();
      
      // Test 2: GFZ Data Services Logo (center) should be visible
      const gfzDataServicesLogo = page.locator('header a[href="https://dataservices.gfz.de/web/"] img[alt="GFZ Data Services Logo"]');
      await expect(gfzDataServicesLogo).toBeVisible();

      // ===== TEST BUTTON VISIBILITY =====
      
      // On mobile, buttons are in collapsed menu - need to open it first
      if (viewport.width < 992) {
        // Open the menu toggle
        const toggler = page.locator('button.navbar-toggler');
        await expect(toggler).toBeVisible();
        await toggler.click();
        
        // Wait for menu to expand
        await page.waitForSelector('#headerMenuContent[class*="show"]', { timeout: 2000 });
      }

      // Test 3: Guide button should be visible
      const guideButton = page.locator('#buttonHelpheader');
      await expect(guideButton).toBeVisible();
      
      // Test 4: Help button should be visible
      const helpButton = page.locator('#bd-help');
      await expect(helpButton).toBeVisible();
      
      // Test 5: Mode button should be visible
      const modeButton = page.locator('#bd-theme');
      await expect(modeButton).toBeVisible();
      
      // Test 6: Language button should be visible
      const languageButton = page.locator('#bd-lang');
      await expect(languageButton).toBeVisible();

      // Close menu if it was opened
      if (viewport.width < 992) {
        const toggler = page.locator('button.navbar-toggler');
        await toggler.click();
      }
    });
  });

  // Test logo centering on small screens
  test('should center GFZ Data Services logo on small screens (< 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('header.navbar', { timeout: 5000 });

    const logo = page.locator('header .logo-center-wrapper');
    
    // Check that logo is positioned centrally
    const boundingBox = await logo.boundingBox();
    const headerBoundingBox = await page.locator('header.navbar').boundingBox();

    if (boundingBox && headerBoundingBox) {
      const logoCenterX = boundingBox.x + boundingBox.width / 2;
      const headerCenterX = headerBoundingBox.x + headerBoundingBox.width / 2;
      
      // Allow 10px tolerance for centering
      const tolerance = 10;
      expect(Math.abs(logoCenterX - headerCenterX)).toBeLessThan(tolerance);
    }
  });
});
