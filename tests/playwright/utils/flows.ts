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

export async function completeExtendedDatasetForm(page: Page) {
  // Start with minimal dataset form (includes author, contact person, and abstract)
  await completeMinimalDatasetForm(page);

  // Add Related Work (first entry)
  await page.locator('#input-relatedwork-relation').selectOption({ index: 1 });
  await page.locator('#input-relatedwork-identifier').fill('https://doi.org/10.5880/GFZ.DMJQ.2025.007');
  await page.locator('#input-relatedwork-identifiertype').selectOption({ index: 1 });

  // Add Free Keywords (first keyword)
  await page.locator('#input-freekeyword').fill('seismic data');

  // Add Descriptions - Abstract already filled by completeMinimalDatasetForm
  // Fill Methods section
  await page.locator('#input-methods').fill('Data was collected using seismic stations');

  // Fill Technical Information section
  await page.locator('#input-technicalinfo').fill('Sampling rate: 100 Hz.');

  // Fill Other section
  await page.locator('#input-other').fill('Additional processing applied');

  // Add Funding Reference (first entry)
  await page.locator('#input-funder').fill('DFG');
  await page.locator('#input-grantnumber').fill('DFG-12345');
  await page.locator('#input-grantname').fill('Seismic Monitoring Network');
  await page.locator('#input-awarduri').fill('https://gepris.dfg.de/gepris/project/12345');
}