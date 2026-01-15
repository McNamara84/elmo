import { test, expect } from '@playwright/test';

test.describe('Footer Tests', () => {

  test('footer contains all expected elements', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('.footer-info-nav');
    await expect(footer).toBeVisible();

    const legalNotice = footer.locator('#buttonLegalNotice');
    const privacyPolicy = footer.locator('#buttonPrivacy');
    const elmoGuide = footer.locator('#buttonHelp');


    // Check visibility
    await expect(legalNotice).toBeVisible();
    await expect(privacyPolicy).toBeVisible();
    await expect(elmoGuide).toBeVisible();
    await expect(legalNotice).toHaveAttribute(
      'href',
      'https://dataservices.gfz.de/web/about-us/legal-notice'
    );
    await expect(privacyPolicy).toHaveAttribute('href', 'doc/privacyPolicy.html');
    await expect(elmoGuide).toHaveAttribute('href', 'doc/help.php');
  });

  test('Footer links are clickable', async ({ page }) => {
    await page.goto('/');

    const legalNotice = page.locator('#buttonLegalNotice');
    const privacyPolicy = page.locator('#buttonPrivacy');
    const elmoGuide = page.locator('#buttonHelp');

    // Test clickability
    await expect(legalNotice).toBeVisible();
    await legalNotice.click();

    await expect(privacyPolicy).toBeVisible();
    await privacyPolicy.click();

    await expect(elmoGuide).toBeVisible();
    await elmoGuide.click();
  });

  test('Verify legal notice button opens correct link', async ({ page }) => {
    await page.goto('/');
    
    const legalNoticeButton = page.locator('#buttonLegalNotice');
    
    const pagePromise = page.context().waitForEvent('page');
    await legalNoticeButton.click();
    const legalNoticePage = await pagePromise;
    
    await legalNoticePage.waitForLoadState('domcontentloaded');
    await expect(legalNoticePage).toHaveURL(/legal-notice/);
    await legalNoticePage.close();
  });

  test('Verify privacy policy button opens correct link', async ({ page }) => {
    await page.goto('/');
    
    const privacyPolicyButton = page.locator('#buttonPrivacy');
    
    const pagePromise = page.context().waitForEvent('page');
    await privacyPolicyButton.click();
    const privacyPolicyPage = await pagePromise;
    
    await privacyPolicyPage.waitForLoadState('domcontentloaded');
    await expect(privacyPolicyPage).toHaveURL(/privacyPolicy.html/);
    await privacyPolicyPage.close();
  });

  test('Verify ELMO guide button opens correct link', async ({ page }) => {
    await page.goto('/');
    
    const elmoGuideButton = page.locator('#buttonHelp');
    
    const pagePromise = page.context().waitForEvent('page');
    await elmoGuideButton.click();
    const elmoGuidePage = await pagePromise;
    
    await elmoGuidePage.waitForLoadState('domcontentloaded');
    await expect(elmoGuidePage).toHaveURL(/help\.php/);
    await elmoGuidePage.close();
  })
});