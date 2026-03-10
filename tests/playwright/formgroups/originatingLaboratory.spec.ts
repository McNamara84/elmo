import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../utils';

test.describe('Originating Laboratory', () => {
    test.beforeEach(async ({ page }) => {
        await navigateToHome(page);
        await expectNavbarVisible(page);
        await expect(page.locator(SELECTORS.formGroups.originatingLaboratory)).toBeVisible();
    });


  test('Laboratory select loads options from JSON', async ({ page }) => {
  // Warte hier auf das Laden der Optionen
  await page.waitForFunction(() =>
    document.querySelectorAll('#input-originatinglaboratory-name option').length > 1
  );

  const select = page.locator('#input-originatinglaboratory-name');
  const options = select.locator('option');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);

  const optionTexts = await options.allTextContents();
  expect(optionTexts.join(' ')).toContain('');
});


  test('Selecting a lab fills hidden fields correctly', async ({ page }) => {
    // Wait until options are loaded
    await page.waitForFunction(() =>
      document.querySelectorAll('#input-originatinglaboratory-name option').length > 1
    );

    const select = page.locator('#input-originatinglaboratory-name');
    const firstVisibleOptionValue = await select.locator('option:nth-child(2)').getAttribute('value');

    // Select first actual lab
    await select.selectOption(firstVisibleOptionValue!);

    // Check that hidden fields were updated
    const labId = await page.locator('input[name="LabId[]"]').inputValue();
    const affiliation = await page.locator('input[name="laboratoryAffiliation[]"]').inputValue();
    const rorId = await page.locator('input[name="laboratoryRorIds[]"]').inputValue();

    expect(labId).not.toBe('');
    expect(affiliation).not.toBe('');
    expect(rorId).not.toBe('');
  });

  test('Add Laboratory button clones a new row', async ({ page }) => {
    const group = page.locator('#group-originatinglaboratory');
    const addButton = page.locator('#button-originatinglaboratory-add');

    const initialCount = await group.locator('.row[data-laboratory-row]').count();

    await addButton.click();

    const newCount = await group.locator('.row[data-laboratory-row]').count();
    expect(newCount).toBe(initialCount + 1);

    // The new row should contain a remove button
    const removeButtons = group.locator('.removeButton');
    await expect(removeButtons.first()).toBeVisible();
  });

  test('Remove button deletes the corresponding row', async ({ page }) => {
    const group = page.locator('#group-originatinglaboratory');
    const addButton = page.locator('#button-originatinglaboratory-add');

    await addButton.click(); // create one clone
    const before = await group.locator('.row[data-laboratory-row]').count();

    // Remove the cloned row
    await group.locator('.removeButton').first().click();
    const after = await group.locator('.row[data-laboratory-row]').count();

    expect(after).toBe(before - 1);
  });

  test('Help button displays Originating Laboratory help modal', async ({ page }) => {
    await enableHelp(page);

    // Open help for originating laboratory
    await page.locator('[data-help-section-id="help-originatinglaboratory-fg"]').click();
    const modal = page.locator(SELECTORS.modals.help);

    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-body')).toContainText('Originating Laboratory');
  });
});