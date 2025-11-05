import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS, } from '../utils';

test.describe('EPOS Multi-Scale Laboratories Keywords (MSL)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await expect(page.locator(SELECTORS.formGroups.mslkeyword)).toBeVisible();
  });

  
});
