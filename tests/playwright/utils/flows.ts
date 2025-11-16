import { expect, type Page } from '@playwright/test';

export async function completeMinimalDatasetForm(page: Page) {
  await page.getByRole('textbox', { name: 'Publication Year (YYYY)*' }).fill('2025', { timeout: 10000 });
  await page.getByLabel('Resource Type*').selectOption('5', { timeout: 10000 });
  await page.getByLabel('Language of dataset*').selectOption('1', { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Title*' }).fill('A dataset', { timeout: 10000 });

  await page.locator('#input-author-orcid').fill('0000-0002-1825-0097', { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Last Name*' }).fill('Alice', { timeout: 10000 });
  await page.getByRole('textbox', { name: 'First Name*' }).fill('Bob', { timeout: 10000 });

  await page
    .locator('#group-author tags')
    .getByRole('textbox')
    .fill('GFZ Helmholtz Centre for Geosciences', { timeout: 10000 });

  await page.getByText('ContactPerson?').click({ timeout: 10000 });

  const emailField = page.getByRole('textbox', { name: 'Email address*' });
  await expect(emailField).toBeVisible({ timeout: 10000 });
  await emailField.fill('example@gmail.com', { timeout: 10000 });

  await page.getByRole('textbox', { name: 'Abstract*' }).fill('Necessary abstract', { timeout: 10000  });
  await page.getByRole('textbox', { name: 'Date created*' }).fill('2025-01-01', { timeout: 10000  });
}