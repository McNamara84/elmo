import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

test.describe('Issue #962 – Tagify not initiated in cloned rows after reorder', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('affiliation tagify is initialized in new rows after first author row is moved to the end', async ({ page }) => {
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
    // on its affiliation field. Tagify wraps the input in a .tagify element.
    const newRow = rows.nth(3);
    const tagifyWrapper = newRow.locator('.tagify');
    await expect(tagifyWrapper).toHaveCount(1, { timeout: 5000 });

    // Step 5: Verify tagify._tagify is set on the input element (functional check)
    const hasTagifyInstance = await newRow.locator('input[name="personAffiliation[]"]').evaluate(
      (el: HTMLInputElement) => !!(el as any)._tagify
    );
    expect(hasTagifyInstance).toBe(true);
  });

  test('affiliation tagify remains functional in existing rows after reorder', async ({ page }) => {
    const authorGroup = page.locator(SELECTORS.formGroups.authors);
    const addButton = page.locator('#button-author-add');

    // Add one extra row, then reorder
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

    // Now the 2nd row (originally added via "+") is the first child.
    // Verify its tagify is still present.
    const rows = authorGroup.locator('[data-creator-row]');
    const firstRow = rows.nth(0);
    const tagifyWrapper = firstRow.locator('.tagify');
    await expect(tagifyWrapper).toHaveCount(1);

    // Verify tagify._tagify is set
    const hasTagifyInstance = await firstRow.locator('input[name="personAffiliation[]"]').evaluate(
      (el: HTMLInputElement) => !!(el as any)._tagify
    );
    expect(hasTagifyInstance).toBe(true);
  });
});
