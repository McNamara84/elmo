import { test, expect } from '@playwright/test';

test.describe('Footer Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
  });

  test('footer contains all expected elements', async ({ page }) => {

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
    await expect(privacyPolicy).toHaveAttribute('href', 'doc/privacy-policy.html');
    await expect(elmoGuide).toHaveAttribute('href', 'doc/help.php');
  });

  test('Footer links are clickable', async ({ page }) => {

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

  test('Verify legal notice button opens correct link', async ({ page, context }) => {

    
    const legalNoticeButton = page.locator('#buttonLegalNotice');
    
    // For external links, we verify the href attribute instead of navigating
    await expect(legalNoticeButton).toHaveAttribute('href', /https:\/\/dataservices\.gfz\.de.*legal-notice/);
    await expect(legalNoticeButton).toHaveAttribute('target', '_blank');
  });

  test('Verify privacy policy button opens correct link', async ({ page }) => {
    
    const privacyPolicyButton = page.locator('#buttonPrivacy');
    
    const pagePromise = page.context().waitForEvent('page');
    await privacyPolicyButton.click();
    const privacyPolicyPage = await pagePromise;
    
    await privacyPolicyPage.waitForLoadState('domcontentloaded');
    await expect(privacyPolicyPage).toHaveURL(/privacy-policy.html/);
    await privacyPolicyPage.close();
  });

  test('Verify ELMO guide button opens correct link', async ({ page }) => {
    
    const elmoGuideButton = page.locator('#buttonHelp');
    
    const pagePromise = page.context().waitForEvent('page');
    await elmoGuideButton.click();
    const elmoGuidePage = await pagePromise;
    
    await elmoGuidePage.waitForLoadState('domcontentloaded');
    await expect(elmoGuidePage).toHaveURL(/help\.php/);
    await elmoGuidePage.close();
  })

  test('mobile fixed footer remains visible at page bottom', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // is the same size as the iPhone 11/12/13
    await page.goto('', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const footer = page.locator('footer.fixed-bottom');
    await expect(footer).toBeVisible();
  });
});