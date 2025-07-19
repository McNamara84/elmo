import { test, expect } from '@playwright/test';

test.describe('Navbar Dropdown Tests', () => {
  test('Test Navbar Dropdown Functionality', async ({ page }) => {
    // Debug: Log what we're trying to access
    console.log('Navigating to base URL...');
    await page.goto('');

    // Debug: Check what page we actually got
    const title = await page.title();
    console.log('Page title:', title);
    
    const url = page.url();
    console.log('Current URL:', url);
    
    // Debug: Check page content
    const body = await page.locator('body').textContent();
    console.log('Page body (first 200 chars):', body?.substring(0, 200));
    
    // Debug: Check if any HTML structure exists
    const htmlContent = await page.content();
    console.log('HTML contains navbar:', htmlContent.includes('navbar'));
    console.log('HTML contains body:', htmlContent.includes('<body'));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-page.png', fullPage: true });
    
    // Wait for page to load completely - wait for navbar
    await expect(page.locator('.navbar')).toBeVisible({ timeout: 10000 });
    
    // Test Help Dropdown
    console.log('Testing Help Dropdown...');
    
    // Click to open Help dropdown
    await page.locator('#bd-help').click();
    
    // Verify Help dropdown menu is visible
    await expect(page.locator('#bd-help + ul.dropdown-menu')).toBeVisible({ timeout: 2000 });
    
    // Assert Help dropdown is displayed with .show class
    await expect(page.locator('#bd-help + ul.dropdown-menu.show')).toBeVisible();
    
    // Verify Privacy Policy link is present in Help dropdown
    await expect(page.locator('#buttonPrivacy')).toBeVisible();
    
    // Close Help dropdown by clicking elsewhere (navbar brand)
    await page.locator('.navbar-brand').click();
    
    // Wait for Help dropdown to close
    await expect(page.locator('#bd-help + ul.dropdown-menu.show')).not.toBeVisible({ timeout: 2000 });
    
    // Test Mode/Theme Dropdown
    console.log('Testing Mode Dropdown...');
    
    // Click to open Mode dropdown
    await page.locator('#bd-theme').click();
    
    // Verify Mode dropdown menu is visible
    await expect(page.locator('#bd-theme + ul.dropdown-menu')).toBeVisible({ timeout: 2000 });
    
    // Assert Mode dropdown is displayed with .show class
    await expect(page.locator('#bd-theme + ul.dropdown-menu.show')).toBeVisible();
    
    // Verify Auto mode option is present
    await expect(page.locator('[data-bs-theme-value="auto"]')).toBeVisible();
    
    // Verify Light mode option is present
    await expect(page.locator('[data-bs-theme-value="light"]')).toBeVisible();
    
    // Verify Dark mode option is present
    await expect(page.locator('[data-bs-theme-value="dark"]')).toBeVisible();
    
    // Close Mode dropdown by clicking elsewhere
    await page.locator('.navbar-brand').click();
    
    // Wait for Mode dropdown to close
    await expect(page.locator('#bd-theme + ul.dropdown-menu.show')).not.toBeVisible({ timeout: 2000 });
    
    // Test Language Dropdown
    console.log('Testing Language Dropdown...');
    
    // Click to open Language dropdown
    await page.locator('#bd-lang').click();
    
    // Verify Language dropdown menu is visible
    await expect(page.locator('#bd-lang + ul.dropdown-menu')).toBeVisible({ timeout: 2000 });
    
    // Assert Language dropdown is displayed with .show class
    await expect(page.locator('#bd-lang + ul.dropdown-menu.show')).toBeVisible();
    
    // Verify Auto language option is present
    await expect(page.locator('[data-bs-language-value="auto"]')).toBeVisible();
    
    // Verify English language option is present
    await expect(page.locator('[data-bs-language-value="en"]')).toBeVisible();
    
    // Verify German language option is present
    await expect(page.locator('[data-bs-language-value="de"]')).toBeVisible();
    
    // Verify French language option is present
    await expect(page.locator('[data-bs-language-value="fr"]')).toBeVisible();
    
    // Close Language dropdown by clicking elsewhere
    await page.locator('.navbar-brand').click();
    
    // Wait for Language dropdown to close
    await expect(page.locator('#bd-lang + ul.dropdown-menu.show')).not.toBeVisible({ timeout: 2000 });
    
    // Final verification - all dropdowns are closed
    await expect(page.locator('ul.dropdown-menu.show')).not.toBeVisible();
    
    console.log('All dropdown tests completed successfully!');
  });

  test('Test individual dropdown interactions', async ({ page }) => {
    // Additional test for more detailed dropdown behavior
    await page.goto('');
    await expect(page.locator('.navbar')).toBeVisible({ timeout: 10000 });
    
    // Test that clicking outside closes dropdowns
    await page.locator('#bd-help').click();
    await expect(page.locator('#bd-help + ul.dropdown-menu.show')).toBeVisible();
    
    // Click outside dropdown area
    await page.locator('body').click({ position: { x: 100, y: 100 } });
    await expect(page.locator('#bd-help + ul.dropdown-menu.show')).not.toBeVisible();
    
    // Test that dropdowns don't interfere with each other
    await page.locator('#bd-theme').click();
    await expect(page.locator('#bd-theme + ul.dropdown-menu.show')).toBeVisible();
    
    // Click another dropdown - first should close, second should open
    await page.locator('#bd-lang').click();
    await expect(page.locator('#bd-theme + ul.dropdown-menu.show')).not.toBeVisible();
    await expect(page.locator('#bd-lang + ul.dropdown-menu.show')).toBeVisible();
  });

  test('Test dropdown accessibility', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('.navbar')).toBeVisible({ timeout: 10000 });
    
    // Test keyboard navigation
    await page.locator('#bd-help').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#bd-help + ul.dropdown-menu.show')).toBeVisible();
    
    // Test escape key closes dropdown
    await page.keyboard.press('Escape');
    await expect(page.locator('#bd-help + ul.dropdown-menu.show')).not.toBeVisible();
  });
});