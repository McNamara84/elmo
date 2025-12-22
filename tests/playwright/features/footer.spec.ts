import { test, expect } from '@playwright/test';

test.describe('Footer Tests', () => {

  test('footer contains all expected elements', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('.footer-info-nav');
    await expect(footer).toBeVisible();

    const legalNotice = footer.getByText('Legal Notice');
    const dataProtection = footer.getByText('Data Protection');
    const elmoGuide = footer.getByText('Elmo Guide');


    // Check visibility
    await expect(legalNotice).toBeVisible();
    await expect(dataProtection).toBeVisible();
    await expect(elmoGuide).toBeVisible();
    await expect(legalNotice).toHaveAttribute(
      'href',
      'https://dataservices.gfz.de/web/about-us/legal-notice'
    );
    await expect(dataProtection).toHaveAttribute('href', 'doc/privacyPolicy.html');
    await expect(elmoGuide).toHaveAttribute('href', 'doc/help.html');
  });

  test('Footer links are clickable', async ({ page }) => {
    await page.goto('/');

    const legalNotice = page.getByText('Legal Notice');
    const dataProtection = page.getByText('Data Protection');
    const elmoGuide = page.getByText('Elmo Guide');

    // Test clickability
    await expect(legalNotice).toBeVisible();
    await legalNotice.click();

    await expect(dataProtection).toBeVisible();
    await dataProtection.click();

    await expect(elmoGuide).toBeVisible();
    await elmoGuide.click();
  });

  test('Verify footer buttons open correct links', async ({ page }) => {
    await page.goto('/');

    const legalNoticeButton = page.getByText('Legal Notice');
    const dataProtectionButton = page.getByText('Data Protection');
    const elmoGuideButton = page.getByText('Elmo Guide');

    const [legalNoticePage] = await Promise.all([
      page.context().waitForEvent('page'),
      legalNoticeButton.click(),
    ]);
    await expect(legalNoticePage).toHaveURL(/legal-notice/);
    await legalNoticePage.close();

    const [dataProtectionPage] = await Promise.all([
      page.context().waitForEvent('page'),
      dataProtectionButton.click(),
    ]);
    await expect(dataProtectionPage).toHaveURL(/privacyPolicy.html/);
    await dataProtectionPage.close(); 

    const [elmoGuidePage] = await Promise.all([
      page.context().waitForEvent('page'),
      elmoGuideButton.click(),
    ]);
    await expect(elmoGuidePage).toHaveURL(/help\.php/);
    await elmoGuidePage.close();
  });

})
