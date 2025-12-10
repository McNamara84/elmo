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
      'https://dataservices.gfz-potsdam.de/web/about-us/legal-notice'
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
});
