import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

test.describe('Issue #962 – affiliation controls stay initialized after reorder', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('author persons: affiliation editor initialized in new rows after first row moved to end', async ({ page }) => {
    const authorGroup = page.locator(SELECTORS.formGroups.authors);
    const addButton = page.locator('#button-author-add');

    // Step 1: Add three author rows
    await addButton.click();
    await addButton.click();
    await addButton.click();
    await expect(authorGroup.locator('[data-creator-row]')).toHaveCount(3);

    // Step 2: Simulate jQuery UI Sortable reorder –
    // move the first row (with the "+" button) to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-author-stack');
      const firstRow = group?.querySelector('[data-creator-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    const rows = authorGroup.locator('[data-creator-row]');
    await expect(rows).toHaveCount(3);

    // Step 3: Click "+" to add a 4th row
    await addButton.click();
    await expect(rows).toHaveCount(4);

    // Step 4: The newly added 4th row should have the dedicated affiliation editor
    const newRow = rows.nth(3);
    await expect(newRow.locator('[data-author-affiliation-editor]')).toBeVisible({ timeout: 5000 });
    await expect(newRow.locator('[data-author-affiliation-input]')).toBeVisible();
    await expect(newRow.locator('.tagify')).toHaveCount(0);
    await expect.poll(
      () => newRow.locator('input[name="personAffiliation[]"]').evaluate(
        (el: HTMLInputElement) => !!(el as any)._tagify
      ),
      { timeout: 5000 }
    ).toBe(false);
  });

  test('author persons: affiliation editor remains functional in existing rows after reorder', async ({ page }) => {
    const authorGroup = page.locator(SELECTORS.formGroups.authors);
    const addButton = page.locator('#button-author-add');

    await addButton.click();
    await addButton.click();
    await expect(authorGroup.locator('[data-creator-row]')).toHaveCount(2);

    // Move first row to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-author-stack');
      const firstRow = group?.querySelector('[data-creator-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    const rows = authorGroup.locator('[data-creator-row]');
    const firstRow = rows.nth(0);
    const editor = firstRow.locator('[data-author-affiliation-editor]');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.locator('[data-author-affiliation-input]').fill('Institute after reorder');
    await editor.locator('[data-author-affiliation-add]').click();
    await expect(editor.locator('[data-author-affiliation-chip] [data-author-affiliation-label]')).toHaveValue('Institute after reorder');
  });

  test('author institutions: affiliation editor initialized in new rows after first row moved to end', async ({ page }) => {
    const instGroup = page.locator(SELECTORS.formGroups.authorInstitution);
    const addButton = page.locator('#button-authorinstitution-add');

    await addButton.click();
    await expect(instGroup.locator('[data-authorinstitution-row] [data-author-affiliation-editor]').first()).toBeVisible({ timeout: 10000 });

    // Add a second row, then reorder
    await addButton.click();
    await expect(instGroup.locator('[data-authorinstitution-row]')).toHaveCount(2);

    // Move first row to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-author-stack');
      const firstRow = group?.querySelector('[data-authorinstitution-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    // Add a new row after reorder
    await addButton.click();
    const rows = instGroup.locator('[data-authorinstitution-row]');
    await expect(rows).toHaveCount(3);

    // The newest row (last) should have the dedicated affiliation editor
    const newRow = rows.nth(2);
    await expect(newRow.locator('[data-author-affiliation-editor]')).toBeVisible({ timeout: 5000 });
    await expect(newRow.locator('[data-author-affiliation-input]')).toBeVisible();
    await expect(newRow.locator('.tagify')).toHaveCount(0);
    await expect.poll(
      () => newRow.locator('input[name="institutionAffiliation[]"]').evaluate(
        (el: HTMLInputElement) => !!(el as any)._tagify
      ),
      { timeout: 5000 }
    ).toBe(false);
  });

  test('contributor persons: tagify initialized in new rows after first row moved to end', async ({ page }) => {
    const contribGroup = page.locator(SELECTORS.formGroups.contributorPersons);
    const addButton = page.locator('#button-contributor-addperson');

    // Add a second row, then reorder
    await addButton.click();
    await expect(contribGroup.locator('[contributor-person-row]')).toHaveCount(2);

    // Move first row to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-contributorperson');
      const firstRow = group?.querySelector('[contributor-person-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    // Add a new row after reorder
    await addButton.click();
    const rows = contribGroup.locator('[contributor-person-row]');
    await expect(rows).toHaveCount(3);

    // The newest row should have affiliation tagify (wait for async init)
    const newRow = rows.nth(2);
    const tagifyWrappers = newRow.locator('.tagify');
    // Contributor persons have 2 tagify instances: role + affiliation
    await expect.poll(() => tagifyWrappers.count(), { timeout: 5000 }).toBeGreaterThanOrEqual(1);

    await expect.poll(
      () => newRow.locator('input[name="cbAffiliation[]"]').evaluate(
        (el: HTMLInputElement) => !!(el as any)._tagify
      ),
      { timeout: 5000 }
    ).toBe(true);
  });

  test('contributor organisations: tagify initialized in new rows after first row moved to end', async ({ page }) => {
    const contribGroup = page.locator(SELECTORS.formGroups.contributorInstitutions);
    const addButton = page.locator('#button-contributor-addorganisation');

    // Add a second row, then reorder
    await addButton.click();
    await expect(contribGroup.locator('[contributors-row]')).toHaveCount(2);

    // Move first row to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-contributororganisation');
      const firstRow = group?.querySelector('[contributors-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    // Add a new row after reorder
    await addButton.click();
    const rows = contribGroup.locator('[contributors-row]');
    await expect(rows).toHaveCount(3);

    // The newest row should have affiliation tagify (wait for async init)
    const newRow = rows.nth(2);
    const tagifyWrappers = newRow.locator('.tagify');
    await expect.poll(() => tagifyWrappers.count(), { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  });
});
