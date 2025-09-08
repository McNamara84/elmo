import { test, expect } from '@playwright/test';
test.describe('Minimal Valid Dataset Test', () => {
  test('test', async ({ page }) => {
  // This test creates a dataset without any ICGEM   
  // -> meaning that you'll need to set $showGGMsProperties to false in your configuration test
  // -> and run docker-compose up before the test.
  await page.goto('');
  // fill the year
  await page.getByRole('textbox', { name: 'Publication Year (YYYY)*' }).click();
  await page.getByRole('textbox', { name: 'Publication Year (YYYY)*' }).fill('2025');
  // fill the resource type
  await page.getByLabel('Resource Type*').selectOption('5');
  // fill the language
  await page.getByLabel('Language of dataset*').selectOption('1');
  // fill the title
  await page.getByRole('textbox', { name: 'Title*' }).click();
  await page.getByRole('textbox', { name: 'Title*' }).fill('A dataset');
  // fill the author ORCID
  await page.locator('#input-author-orcid').click();
  await page.locator('#input-author-orcid').fill('0000-0002-1825-0097');
  // click on the last name to trigger the API call
  await page.getByRole('textbox', { name: 'Last Name*' }).fill('Alice');
  await page.getByRole('textbox', { name: 'First Name*' }).fill('Bob');

  // type in the affiliation -- only 3 letters
  await page.locator('#group-author tags').getByRole('textbox').click();
  await page.locator('#group-author tags').getByRole('textbox').fill('gfz');
  // choose an option from dropdown
  await page.getByRole('option', { name: 'GFZ Helmholtz Centre for Geosciences' }).click();
  // full name of our Centre should be displayed
  await expect(page.locator('#group-author tag')).toHaveText('GFZ Helmholtz Centre for Geosciences');
  // select the author as contact person
  await page.getByText('ContactPerson?').click();
  await page.getByRole('textbox', { name: 'Email address*' }).click();
  // email input field should be visible
  await expect(page.getByRole('textbox', { name: 'Email address*' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email address*' }).fill('example@gmail.com');

  // fill the abstract
  await page.getByRole('textbox', { name: 'Abstract*' }).fill('Necessary abstract');
  // fill the date created
  await page.getByRole('textbox', { name: 'Date created*' }).fill('2025-01-01');
      // --- 2. ACTION: Click the main submit button ---
    await page.getByRole('button', { name: 'Submit' }).click();

    // --- 3. ASSERTION: Verify the form passed client-side validation ---
    // Assert that no input field has the 'is-invalid' class.
    await expect(page.locator('.is-invalid')).toHaveCount(0);

    // Assert that the submission modal is now visible. This confirms the
    // success path in `handleSubmit` was taken.
    const submitDialog = page.locator('#modal-submit');
    await expect(submitDialog).toBeVisible();

    // --- 4. ACTION: Complete the submission from the modal ---
    await expect(submitDialog.getByRole('checkbox', { name: 'I have read the privacy' })).toBeVisible();
    await expect(submitDialog.getByRole('button', { name: 'Submit' })).toBeVisible();
  });
});