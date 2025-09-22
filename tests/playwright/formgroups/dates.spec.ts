import { test, expect } from '@playwright/test';
import { navigateToHome, openLanguageMenu, SELECTORS } from '../utils';

const selectors = {
  createdInput: '#input-date-created',
  createdLabel: 'label[for="input-date-created"]',
  embargoInput: '#input-date-embargo',
  embargoLabel: 'label[for="input-date-embargo"]',
  cardHeader: 'b[data-translate="dates.title"]',
  cardHelpIcon: '[data-help-section-id="help-dates-fg"]',
  createdHelpIcon: '[data-help-section-id="help-date-created"]',
  embargoHelpIcon: '[data-help-section-id="help-date-embargo"]',
  languageToggle: SELECTORS.navigation.languageToggle,
  germanLanguageOption: '[data-bs-language-value="de"]',
  englishLanguageOption: '[data-bs-language-value="en"]',
};

test.describe('Dates form group', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator(selectors.createdInput)).toBeVisible();
  });

  test('renders inputs with accessibility metadata, constraints, and help icons', async ({ page }) => {
    const createdInput = page.locator(selectors.createdInput);
    const embargoInput = page.locator(selectors.embargoInput);

    await expect(page.locator(selectors.cardHelpIcon)).toBeVisible();
    await expect(page.locator(selectors.createdHelpIcon)).toBeVisible();
    await expect(page.locator(selectors.embargoHelpIcon)).toBeVisible();

    await expect(createdInput).toHaveAttribute('type', 'date');
    await expect(createdInput).toHaveJSProperty('required', true);
    await expect(createdInput).toHaveAttribute('min', '1900-01-01');
    await expect(createdInput).toHaveAttribute('max', '2100-12-31');

    const createdLabel = page.locator(selectors.createdLabel);
    await expect(createdLabel).toContainText('Date created');
    await expect(createdLabel.locator('.red-star')).toHaveText('*');

    const createdFeedback = page.locator(`${selectors.createdInput} ~ .invalid-feedback`);
    await expect(createdFeedback).toBeHidden();

    await expect(embargoInput).toHaveAttribute('type', 'date');
    await expect(embargoInput).toHaveAttribute('min', '1900-01-01');
    await expect(embargoInput).toHaveAttribute('max', '2100-12-31');

    const embargoLabel = page.locator(selectors.embargoLabel);
    await expect(embargoLabel).toContainText('Embargo until');

    const embargoFeedback = page.locator(`${selectors.embargoInput} ~ .embargo-invalid`);
    await expect(embargoFeedback).toBeHidden();
  });

  test('validates embargo date relative to creation date and resets after clearing', async ({ page }) => {
    const createdInput = page.locator(selectors.createdInput);
    const embargoInput = page.locator(selectors.embargoInput);
    const embargoFeedback = page.locator(`${selectors.embargoInput} ~ .embargo-invalid`);

    await createdInput.fill('2024-03-15');
    await embargoInput.fill('2024-03-10');
    await embargoInput.dispatchEvent('change');

    await expect(embargoInput).toHaveClass(/is-invalid/);
    await expect(embargoFeedback).toHaveText('Embargo date must be after or equal to the creation date.');
    await expect(embargoInput).toHaveJSProperty('validationMessage', 'Embargo date must be after or equal to the creation date.');

    await embargoInput.fill('2024-03-18');
    await embargoInput.dispatchEvent('change');

    await expect(embargoInput).toHaveClass(/is-valid/);
    await expect(embargoFeedback).toHaveText('');
    await expect(embargoInput).toHaveJSProperty('validationMessage', '');

    await embargoInput.evaluate((element: HTMLInputElement) => {
      element.value = '';
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(embargoInput).not.toHaveClass(/is-invalid/);
    await expect(embargoInput).not.toHaveClass(/is-valid/);
    await expect(embargoFeedback).toHaveText('');
    await expect(embargoInput).toHaveJSProperty('validationMessage', '');
  });

  test('updates labels and validation messages when changing languages', async ({ page }) => {
    const createdLabel = page.locator(selectors.createdLabel);
    const embargoLabel = page.locator(selectors.embargoLabel);
    const createdInput = page.locator(selectors.createdInput);
    const embargoInput = page.locator(selectors.embargoInput);
    const embargoFeedback = page.locator(`${selectors.embargoInput} ~ .embargo-invalid`);

    await expect(createdLabel).toHaveText(/Date created/);
    await expect(embargoLabel).toHaveText(/Embargo until/);

    await openLanguageMenu(page);
    await page.locator(selectors.germanLanguageOption).click();
    await expect(createdLabel).toHaveText(/Erstellungsdatum/);
    await expect(embargoLabel).toHaveText(/Embargo bis \(nur nach Absprache\)/);

    await createdInput.fill('2024-04-05');
    await embargoInput.fill('2024-04-01');
    await embargoInput.dispatchEvent('change');

    await expect(embargoFeedback).toHaveText('Das Embargodatum muss nach oder gleich dem Erstellungsdatum sein.');
    await expect(embargoInput).toHaveJSProperty('validationMessage', 'Das Embargodatum muss nach oder gleich dem Erstellungsdatum sein.');

    await openLanguageMenu(page);
    await page.locator(selectors.englishLanguageOption).click();
    await expect(createdLabel).toHaveText(/Date created/);
  });
});