import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

test.describe('Issue #962 – Tagify not initiated in cloned rows after reorder', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('author persons: tagify initialized in new rows after first row moved to end', async ({ page }) => {
    const authorGroup = page.locator(SELECTORS.formGroups.authors);
    const addButton = page.locator('#button-author-add');

    // Step 1: Add two more author rows (total: 3 rows)
    await addButton.click();
    await addButton.click();
    await expect(authorGroup.locator('[data-creator-row]')).toHaveCount(3);

    // Step 2: Simulate jQuery UI Sortable reorder –
    // move the first row (with the "+" button) to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-author');
      const firstRow = group?.querySelector('[data-creator-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    // Verify: the last row now contains the "+" button
    const rows = authorGroup.locator('[data-creator-row]');
    await expect(rows).toHaveCount(3);
    const lastRow = rows.nth(2);
    await expect(lastRow.locator('#button-author-add')).toBeVisible();

    // Step 3: Click "+" to add a 4th row
    await addButton.click();
    await expect(rows).toHaveCount(4);

    // Step 4: The newly added 4th row should have a tagify instance
    const newRow = rows.nth(3);
    const tagifyWrapper = newRow.locator('.tagify');
    await expect(tagifyWrapper).toHaveCount(1, { timeout: 5000 });

    // Step 5: Verify tagify._tagify is set on the input element
    const hasTagifyInstance = await newRow.locator('input[name="personAffiliation[]"]').evaluate(
      (el: HTMLInputElement) => !!(el as any)._tagify
    );
    expect(hasTagifyInstance).toBe(true);
  });

  test('author persons: tagify remains functional in existing rows after reorder', async ({ page }) => {
    const authorGroup = page.locator(SELECTORS.formGroups.authors);
    const addButton = page.locator('#button-author-add');

    await addButton.click();
    await expect(authorGroup.locator('[data-creator-row]')).toHaveCount(2);

    // Move first row to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-author');
      const firstRow = group?.querySelector('[data-creator-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    const rows = authorGroup.locator('[data-creator-row]');
    const firstRow = rows.nth(0);
    const tagifyWrapper = firstRow.locator('.tagify');
    await expect(tagifyWrapper).toHaveCount(1);

    const hasTagifyInstance = await firstRow.locator('input[name="personAffiliation[]"]').evaluate(
      (el: HTMLInputElement) => !!(el as any)._tagify
    );
    expect(hasTagifyInstance).toBe(true);
  });

  test('author institutions: tagify initialized in new rows after first row moved to end', async ({ page }) => {
    const instGroup = page.locator(SELECTORS.formGroups.authorInstitution);
    const addButton = page.locator('#button-authorinstitution-add');

    // Wait for tagify to initialize on the original row
    await page.waitForSelector('[data-authorinstitution-row] .tagify', { timeout: 10000 });

    // Add a second row, then reorder
    await addButton.click();
    await expect(instGroup.locator('[data-authorinstitution-row]')).toHaveCount(2);

    // Move first row to the end
    await page.evaluate(() => {
      const group = document.querySelector('#group-authorinstitution');
      const firstRow = group?.querySelector('[data-authorinstitution-row]');
      if (group && firstRow) {
        group.appendChild(firstRow);
      }
    });

    // Add a new row after reorder
    await addButton.click();
    const rows = instGroup.locator('[data-authorinstitution-row]');
    await expect(rows).toHaveCount(3);

    // The newest row (last) should have tagify
    const newRow = rows.nth(2);
    const tagifyWrapper = newRow.locator('.tagify');
    await expect(tagifyWrapper).toHaveCount(1, { timeout: 5000 });

    const hasTagifyInstance = await newRow.locator('input[name="institutionAffiliation[]"]').evaluate(
      (el: HTMLInputElement) => !!(el as any)._tagify
    );
    expect(hasTagifyInstance).toBe(true);
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

    // The newest row should have affiliation tagify
    const newRow = rows.nth(2);
    const tagifyWrappers = newRow.locator('.tagify');
    // Contributor persons have 2 tagify instances: role + affiliation
    const tagifyCount = await tagifyWrappers.count();
    expect(tagifyCount).toBeGreaterThanOrEqual(1);

    const hasAffiliationTagify = await newRow.locator('input[name="cbAffiliation[]"]').evaluate(
      (el: HTMLInputElement) => !!(el as any)._tagify
    );
    expect(hasAffiliationTagify).toBe(true);
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

    // The newest row should have affiliation tagify
    const newRow = rows.nth(2);
    const tagifyWrappers = newRow.locator('.tagify');
    const tagifyCount = await tagifyWrappers.count();
    expect(tagifyCount).toBeGreaterThanOrEqual(1);
  });
});
