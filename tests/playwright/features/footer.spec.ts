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
    await expect(elmoGuide).toHaveAttribute('href', 'doc/help.html');
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

  test('Verify footer buttons open correct links', async ({ page }) => {
    await page.goto('/');

    const legalNoticeButton = page.locator('#buttonLegalNotice');
    const privacyPolicyButton = page.locator('#buttonPrivacy');
    const elmoGuideButton = page.locator('#buttonHelp');

    const [legalNoticePage] = await Promise.all([
      page.context().waitForEvent('page'),
      legalNoticeButton.click(),
    ]);
    await expect(legalNoticePage).toHaveURL(/legal-notice/);
    await legalNoticePage.close();

    const [privacyPolicyPage] = await Promise.all([
      page.context().waitForEvent('page'),
      privacyPolicyButton.click(),
    ]);
    await expect(privacyPolicyPage).toHaveURL(/privacyPolicy.html/);
    await privacyPolicyPage.close(); 

    const [elmoGuidePage] = await Promise.all([
      page.context().waitForEvent('page'),
      elmoGuideButton.click(),
    ]);
    await expect(elmoGuidePage).toHaveURL(/help\.php/);
    await elmoGuidePage.close();
  });

})
