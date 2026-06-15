import { expect, test } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';
import { getTranslations } from '../utils';

test.describe('Author institution entries in the Authors form group', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);

    await page.waitForSelector('[data-authorinstitution-row] [data-author-affiliation-editor]', { timeout: 10000 });
  });

  let translations: ReturnType<typeof getTranslations>;

  test.beforeAll(() => {
    // Load translations for assertions
    translations = getTranslations();
  });

  test('renders base fields with accessible structure and help affordances', async ({ page }) => {
    const formGroup = page.locator(SELECTORS.formGroups.authorInstitution);
    const rows = formGroup.locator('[data-authorinstitution-row]');
    const firstRow = rows.first();

    await expect(rows).toHaveCount(1);

    const heading = page.locator('[data-translate="authors.stackTitle"]');
    const properName = translations.authors.stackTitle;
    await expect(heading).toContainText(properName);

    const nameInput = formGroup.locator('input[name="authorinstitutionName[]"]');
    await expect(nameInput).toBeVisible();
    await expect(page.getByLabel('Author Institution name')).toBeVisible();

    const affiliationEditor = firstRow.locator('[data-author-affiliation-editor]');
    await expect(affiliationEditor).toBeVisible();
    await expect(affiliationEditor.locator('[data-author-affiliation-input]')).toBeVisible();
    await expect(affiliationEditor.locator('[data-author-affiliation-add]')).toBeVisible();

    const affiliationLabel = formGroup.locator('label[for="input-authorinstitution-affiliation"]');
    await expect(affiliationLabel).toHaveClass(/visually-hidden/);

    const formHelpIcon = page.locator('[data-help-section-id="help-authors-fg"]');
    await expect(formHelpIcon).toBeVisible();

    const affiliationHelpIcon = firstRow.locator('[data-help-section-id="help-author-affiliation"]');
    await expect(affiliationHelpIcon).toBeVisible();

    const dragHandle = firstRow.locator('.drag-handle');
    await expect(dragHandle).toHaveAttribute('aria-label', 'Drag & drop to change order');
  });

  test('adds uniquely identified rows and restores the base row when removed', async ({ page }) => {
    const formGroup = page.locator(SELECTORS.formGroups.authorInstitution);
    const addButton = page.locator('#button-authorinstitution-add');

    await addButton.click();

    const rows = formGroup.locator('[data-authorinstitution-row]');
    await expect(rows).toHaveCount(2);

    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);

    await expect(secondRow.locator('[data-author-affiliation-editor]')).toBeVisible();

    const firstNameId = await firstRow.locator('input[name="authorinstitutionName[]"]').getAttribute('id');
    const secondNameInput = secondRow.locator('input[name="authorinstitutionName[]"]');
    const secondNameId = await secondNameInput.getAttribute('id');

    expect(firstNameId).not.toBeNull();
    expect(secondNameId).not.toBeNull();
    expect(secondNameId).not.toBe(firstNameId);

    const secondNameLabel = secondRow.locator("label[for^='input-authorinstitution-name']");
    await expect(secondNameLabel).toHaveAttribute('for', secondNameId!);

    const secondAffiliationInput = secondRow.locator('input[name="institutionAffiliation[]"]');
    const secondAffiliationId = await secondAffiliationInput.getAttribute('id');
    const secondAffiliationLabel = secondRow.locator("label[for^='input-authorinstitution-affiliation']");
    await expect(secondAffiliationLabel).toHaveAttribute('for', secondAffiliationId!);

    await expect(secondRow.locator('.removeButton')).toBeVisible();
    await expect(secondRow.locator('.help-placeholder')).toHaveAttribute('data-help-section-id', 'help-author-affiliation');

    const firstRorId = await firstRow.locator('input[name="authorInstitutionRorIds[]"]').getAttribute('id');
    const secondRorId = await secondRow.locator('input[name="authorInstitutionRorIds[]"]').getAttribute('id');
    expect(firstRorId).not.toBeNull();
    expect(secondRorId).not.toBeNull();
    expect(secondRorId).not.toBe(firstRorId);

    await secondRow.locator('.removeButton').click();
    await expect(rows).toHaveCount(1);
    await expect(addButton).toBeVisible();
  });

  test('enforces institution name when affiliation is provided', async ({ page }) => {
    const formGroup = page.locator(SELECTORS.formGroups.authorInstitution);
    const row = formGroup.locator('[data-authorinstitution-row]').first();

    const nameInput = row.locator('input[name="authorinstitutionName[]"]');
    const affiliationEditor = row.locator('[data-author-affiliation-editor]');

    await expect(nameInput).not.toHaveAttribute('required', 'required');

    await affiliationEditor.locator('[data-author-affiliation-input]').fill('Helmholtz Centre Potsdam - GFZ');
    await affiliationEditor.locator('[data-author-affiliation-add]').click();
    await expect(affiliationEditor.locator('[data-author-affiliation-chip]')).toHaveCount(1, { timeout: 5000 });

    await expect(nameInput).toHaveAttribute('required', 'required');
    await expect(nameInput).toHaveAttribute('aria-required', 'true');

    await affiliationEditor.locator('[data-author-affiliation-remove]').click();
    await expect(affiliationEditor.locator('[data-author-affiliation-chip]')).toHaveCount(0, { timeout: 5000 });

    await expect(nameInput).not.toHaveAttribute('required', 'required');
    await expect(nameInput).not.toHaveAttribute('aria-required', 'true');
  });
});