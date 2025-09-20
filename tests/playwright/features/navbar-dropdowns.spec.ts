import { test, expect } from '@playwright/test';
import { expectNavbarVisible, expectPrimaryHeading, navigateToHome, runAxeAudit, SELECTORS } from '../utils';

test.describe('Navbar Dropdown Tests', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Axe audit covered in Chromium');
  test('Test Navbar Dropdown Functionality', async ({ page }) => {
    await navigateToHome(page);

    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-page.png', fullPage: true });

    // Wait for page to load completely - wait for navbar
    await expectNavbarVisible(page);
    await expectPrimaryHeading(page);

    await test.step('Validate accessibility of navbar in default state', async () => {
      await runAxeAudit(page);
    });
    
    // Test Help Dropdown
    console.log('Testing Help Dropdown...');
    
    // Click to open Help dropdown
    await page.locator(SELECTORS.navigation.helpToggle).click();
    
    // Verify Help dropdown menu is visible
    await expect(page.locator(`${SELECTORS.navigation.helpToggle} + ul.dropdown-menu`)).toBeVisible({ timeout: 2000 });
    
    // Assert Help dropdown is displayed with .show class
    await expect(page.locator(`${SELECTORS.navigation.helpToggle} + ul.dropdown-menu.show`)).toBeVisible();
    
    // Verify Privacy Policy link is present in Help dropdown
    await expect(page.locator('#buttonPrivacy')).toBeVisible();
    
    // Close Help dropdown by clicking elsewhere (navbar brand)
    await page.locator('.navbar-brand').click();
    
    // Wait for Help dropdown to close
    await expect(page.locator(`${SELECTORS.navigation.helpToggle} + ul.dropdown-menu.show`)).not.toBeVisible({ timeout: 2000 });
    
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
    await page.locator(SELECTORS.navigation.languageToggle).click();
    
    // Verify Language dropdown menu is visible
    await expect(page.locator(`${SELECTORS.navigation.languageToggle} + ul.dropdown-menu`)).toBeVisible({ timeout: 2000 });
    
    // Assert Language dropdown is displayed with .show class
    await expect(page.locator(`${SELECTORS.navigation.languageToggle} + ul.dropdown-menu.show`)).toBeVisible();
    
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
    await expect(page.locator(`${SELECTORS.navigation.languageToggle} + ul.dropdown-menu.show`)).not.toBeVisible({ timeout: 2000 });

    // Final verification - all dropdowns are closed
    await expect(page.locator('ul.dropdown-menu.show')).not.toBeVisible();

    await test.step('Verify Save As modal heading semantics', async () => {
      const saveAsModal = page.locator(SELECTORS.modals.saveAs);
      await expect(saveAsModal).toHaveAttribute('aria-labelledby', 'label-saveas-modal');
      await expect(page.locator('#label-saveas-modal')).toHaveJSProperty('tagName', 'H2');
    });
  });

  test('Test individual dropdown interactions', async ({ page }) => {
    // Additional test for more detailed dropdown behavior
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expectPrimaryHeading(page);

    await test.step('Validate accessibility of navbar in default state', async () => {
      await runAxeAudit(page);
    });

    // Test that clicking outside closes dropdowns
    await page.locator(SELECTORS.navigation.helpToggle).click();
    await expect(page.locator(`${SELECTORS.navigation.helpToggle} + ul.dropdown-menu.show`)).toBeVisible();
    
    // Click outside dropdown area
    await page.locator('body').click({ position: { x: 100, y: 100 } });
    await expect(page.locator(`${SELECTORS.navigation.helpToggle} + ul.dropdown-menu.show`)).not.toBeVisible();
    
    // Test that dropdowns don't interfere with each other
    await page.locator('#bd-theme').click();
    await expect(page.locator('#bd-theme + ul.dropdown-menu.show')).toBeVisible();
    
    // Click another dropdown - first should close, second should open
    await page.locator(SELECTORS.navigation.languageToggle).click();
    await expect(page.locator('#bd-theme + ul.dropdown-menu.show')).not.toBeVisible();
    await expect(page.locator(`${SELECTORS.navigation.languageToggle} + ul.dropdown-menu.show`)).toBeVisible();
  });

  test('Test dropdown accessibility', async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expectPrimaryHeading(page);

    await test.step('Validate accessibility of navbar keyboard interaction state', async () => {
      await runAxeAudit(page);
    });

    // Test keyboard navigation
    await page.locator(SELECTORS.navigation.helpToggle).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(`${SELECTORS.navigation.helpToggle} + ul.dropdown-menu.show`)).toBeVisible();
    
    // Test escape key closes dropdown
    await page.keyboard.press('Escape');
    await expect(page.locator(`${SELECTORS.navigation.helpToggle} + ul.dropdown-menu.show`)).not.toBeVisible();
  });
});