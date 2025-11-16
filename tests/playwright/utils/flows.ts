import { expect, type Page } from '@playwright/test';

export async function completeMinimalDatasetForm(page: Page) {
  await page.getByRole('textbox', { name: 'Publication Year (YYYY)*' }).fill('2025');
  await page.getByLabel('Resource Type*').selectOption('5');
  await page.getByLabel('Language of dataset*').selectOption('1');
  await page.getByRole('textbox', { name: 'Title*' }).fill('A dataset');

  await page.locator('#input-author-orcid').fill('0000-0002-1825-0097');
  await page.getByRole('textbox', { name: 'Last Name*' }).fill('Alice');
  await page.getByRole('textbox', { name: 'First Name*' }).fill('Bob');

  await page
    .locator('#group-author tags')
    .getByRole('textbox')
    .fill('GFZ Helmholtz Centre for Geosciences');

  await page.getByText('ContactPerson?').click();

  const emailField = page.getByRole('textbox', { name: 'Email address*' });
  await expect(emailField).toBeVisible();
  await emailField.fill('example@gmail.com');

  await page.getByRole('textbox', { name: 'Abstract*' }).fill('Necessary abstract');
  await page.getByRole('textbox', { name: 'Date created*' }).fill('2025-01-01');
}