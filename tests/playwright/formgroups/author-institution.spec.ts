import { expect, test } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

test.describe('Author Institution form group', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('renders base fields with accessible structure and help affordances', async ({ page }) => {
    const formGroup = page.locator(SELECTORS.formGroups.authorInstitution);
    const rows = formGroup.locator('[data-authorinstitution-row]');
    const firstRow = rows.first();

    await expect(rows).toHaveCount(1);

    const heading = page.locator('[data-translate="authorsInstitutions.title"]');
    await expect(heading).toContainText('Author Institution');

    const nameInput = formGroup.locator('input[name="authorinstitutionName[]"]');
    await expect(nameInput).toBeVisible();
    await expect(page.getByLabel('Author Institution name')).toBeVisible();

    const affiliationTagify = firstRow.locator('.tagify');
    const affiliationInteractiveInput = affiliationTagify.locator('.tagify__input');
    await expect(affiliationTagify).toBeVisible();
    await expect(affiliationInteractiveInput).toBeVisible();

    const affiliationLabel = formGroup.locator('label[for="input-authorinstitution-affiliation"]');
    await expect(affiliationLabel).toHaveClass(/visually-hidden/);

    const formHelpIcon = page.locator('[data-help-section-id="help-author-institution-fg"]');
    await expect(formHelpIcon).toBeVisible();

    const affiliationHelpIcon = formGroup.locator('[data-help-section-id="help-contributorinstitutions-affiliation"]');
    await expect(affiliationHelpIcon).toBeVisible();

    const dragHandle = formGroup.locator('.drag-handle');
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

    await expect(secondRow.locator('.tagify')).toBeVisible();

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
    await expect(secondRow.locator('.help-placeholder')).toHaveAttribute('data-help-section-id', 'help-contributorinstitutions-affiliation');

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
    const affiliationTagify = row.locator('.tagify');
    const affiliationInput = affiliationTagify.locator('.tagify__input');

    await expect(nameInput).not.toHaveAttribute('required', 'required');
    await expect(affiliationInput).toBeVisible();

    await affiliationInput.click();
    await affiliationInput.fill('Helmholtz Centre Potsdam - GFZ');
    await affiliationInput.press('Enter');
    await expect(affiliationTagify.locator('.tagify__tag')).toHaveCount(1);
    await affiliationInput.press('Tab');

    await expect(nameInput).toHaveAttribute('required', 'required');
    await expect(nameInput).toHaveAttribute('aria-required', 'true');

    await affiliationInput.click();
    await affiliationInput.press('Backspace');
    await expect(affiliationTagify.locator('.tagify__tag')).toHaveCount(0);
    await affiliationInput.press('Tab');

    await expect(nameInput).not.toHaveAttribute('required', 'required');
    await expect(nameInput).not.toHaveAttribute('aria-required', 'true');
  });
});