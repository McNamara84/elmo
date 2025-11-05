import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../utils';

test.describe('Originating Laboratory', () => {

test.beforeEach(async ({ page }) => {
  await navigateToHome(page);
  await expectNavbarVisible(page);
  await expect(page.locator(SELECTORS.formGroups.originatingLaboratory)).toBeVisible({ timeout: 20000 });
});

test('Laboratory select loads options from JSON', async ({ page }) => {
  // Warte bis Optionen geladen sind
  await page.waitForFunction(
    () => document.querySelectorAll('#input-originatinglaboratory-name option').length > 1,
    { timeout: 20000 }
  );

  const select = page.locator('#input-originatinglaboratory-name');
  const options = select.locator('option');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);

  const optionTexts = await options.allTextContents();
  expect(optionTexts.join(' ')).toContain('');
});

test('Selecting a lab fills hidden fields correctly', async ({ page }) => {
  await page.waitForFunction(
    () => document.querySelectorAll('#input-originatinglaboratory-name option').length > 1,
    { timeout: 20000 }
  );

  const select = page.locator('#input-originatinglaboratory-name');
  const firstVisibleOptionValue = await select.locator('option:nth-child(2)').getAttribute('value');

  await select.selectOption(firstVisibleOptionValue!, { timeout: 20000 });

  // Prüfe, ob hidden fields aktualisiert wurden
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

  await expect(group).toBeVisible({ timeout: 20000 });
  await expect(addButton).toBeVisible({ timeout: 20000 });

  const initialCount = await group.locator('.row[data-laboratory-row]').count();

  await addButton.click();
  await page.waitForTimeout(2000);

  const newCount = await group.locator('.row[data-laboratory-row]').count();
  expect(newCount).toBe(initialCount + 1);

  const removeButtons = group.locator('.removeButton');
  await expect(removeButtons.first()).toBeVisible({ timeout: 20000 });
});

test('Remove button deletes the corresponding row', async ({ page }) => {
  const group = page.locator('#group-originatinglaboratory');
  const addButton = page.locator('#button-originatinglaboratory-add');

  await expect(group).toBeVisible({ timeout: 20000 });
  await addButton.click();

  const before = await group.locator('.row[data-laboratory-row]').count();

  await group.locator('.removeButton').first().click();
  await page.waitForTimeout(2000);

  const after = await group.locator('.row[data-laboratory-row]').count();
  expect(after).toBe(before - 1);
});

test('Help button displays Originating Laboratory help modal', async ({ page }) => {
  await enableHelp(page);
  await page.waitForTimeout(500);

  await page.locator('[data-help-section-id="help-originatinglaboratory-fg"]').click();
  const modal = page.locator(SELECTORS.modals.help);

  await expect(modal).toBeVisible({ timeout: 20000 });
  await expect(modal.locator('.modal-body')).toContainText('Originating Laboratory', { timeout: 20000 });
});

});
