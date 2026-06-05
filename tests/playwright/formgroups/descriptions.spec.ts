import { test, expect, Locator, Page } from '@playwright/test';
import { navigateToHome, openLanguageMenu, SELECTORS } from '../utils';

/**
 * Waits until the dynamic description types have been loaded from the ERNIE API
 * and rendered into the accordion. Checks for at least one dynamic accordion item.
 */
async function waitForDynamicDescriptionTypes(page: Page) {
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('#accordion-description .accordion-item[data-description-slug]');
    return items.length > 0;
  }, { timeout: 15000 });
}

test.describe('Descriptions Form Group', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator(SELECTORS.formGroups.descriptions)).toBeVisible();
    await waitForDynamicDescriptionTypes(page);
  });

  test('renders static Abstract and dynamic description types from ERNIE', async ({ page }) => {
    const header = page.locator('b[data-translate="descriptions.title"]');
    await expect(header).toBeVisible();
    await expect(page.locator('[data-help-section-id="help-descriptions-fg"]')).toBeVisible();

    // Abstract is always the first accordion item (static HTML)
    const abstractButton = page.locator('#accordion-description .accordion-button').first();
    await expect(abstractButton).toHaveAttribute('data-bs-target', '#collapse-abstract');
    await expect(abstractButton).toHaveAttribute('data-translate', 'descriptions.abstract');
    await expect(abstractButton).toHaveAttribute('aria-expanded', 'true');
    const abstractHelp = page.locator('#collapse-abstract i.bi-question-circle-fill');
    await expect(abstractHelp).toHaveAttribute('data-help-section-id', 'help-description-abstract');
    await expect(abstractHelp).toBeVisible();

    // Dynamic types are loaded from ERNIE – at least one should exist
    const dynamicItems = page.locator('#accordion-description .accordion-item[data-description-slug]');
    const count = await dynamicItems.count();
    expect(count).toBeGreaterThan(0);

    // Each dynamic item should have a collapsed accordion button and a help icon
    for (let i = 0; i < count; i++) {
      const item = dynamicItems.nth(i);
      const button = item.locator('.accordion-button');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      const helpIcon = item.locator('i.bi-question-circle-fill');
      await expect(helpIcon).toBeAttached();
    }
  });

  test('description types API returns valid data', async ({ page }) => {
    const response = await page.request.get('/api/v2/vocabs/descriptiontypes');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Every type should have id, name, slug
    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('slug');
    }

    // Abstract must always be present
    const hasAbstract = data.some((item: { slug: string }) => item.slug === 'Abstract');
    expect(hasAbstract).toBe(true);
  });

  test('allows entering descriptions and maintains accessibility metadata', async ({ page }) => {
    // Abstract is always required
    const abstractField = page.locator('#input-abstract');
    await expect(abstractField).toHaveJSProperty('required', true);
    await expect(abstractField).toHaveAttribute('aria-describedby', 'abstract-help');
    await abstractField.fill('Comprehensive overview of the dataset.');
    await expect(abstractField).toHaveValue('Comprehensive overview of the dataset.');

    const expandSection = async (target: string) => {
      const button = page.locator(`button[data-bs-target="${target}"]`);
      const panel = page.locator(target);
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(panel).toHaveClass(/show/);
      await expect(panel).toBeVisible();
      return { button, panel };
    };

    const collapseSection = async (button: Locator, panel: Locator) => {
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(panel).not.toBeVisible();
      await expect(panel).not.toHaveClass(/show/);
      await expect(panel).toHaveClass(/collapse/);
    };

    // Expand and fill all dynamic description types
    const dynamicItems = page.locator('#accordion-description .accordion-item[data-description-slug]');
    const count = await dynamicItems.count();
    expect(count).toBeGreaterThan(0);

    const firstItem = dynamicItems.first();
    const firstSlug = await firstItem.getAttribute('data-description-slug');
    const firstCollapseId = `#collapse-description-${firstSlug}`;
    const firstInputId = `#input-description-${firstSlug}`;

    const { button: firstButton, panel: firstPanel } = await expandSection(firstCollapseId);
    const firstField = page.locator(firstInputId);
    await firstField.fill('Test description text.');
    await expect(firstField).toHaveValue('Test description text.');

    // Check aria-describedby on dynamic textarea
    const ariaDescribedBy = await firstField.getAttribute('aria-describedby');
    expect(ariaDescribedBy).toBeTruthy();

    // Collapse and verify it stays collapsed
    await collapseSection(firstButton, firstPanel);
  });

  test('supports expanding dynamic sections via mouse and keyboard', async ({ page }) => {
    const dynamicItems = page.locator('#accordion-description .accordion-item[data-description-slug]');
    const count = await dynamicItems.count();
    expect(count).toBeGreaterThan(0);

    // Test click on first dynamic item
    const firstSlug = await dynamicItems.first().getAttribute('data-description-slug');
    const firstButton = page.locator(`button[data-bs-target="#collapse-description-${firstSlug}"]`);
    await expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    await firstButton.click();
    await expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#collapse-description-${firstSlug}`)).toHaveClass(/show/);

    // Test keyboard Enter on second dynamic item (if available)
    if (count > 1) {
      const secondSlug = await dynamicItems.nth(1).getAttribute('data-description-slug');
      const secondButton = page.locator(`button[data-bs-target="#collapse-description-${secondSlug}"]`);
      await expect(secondButton).toHaveAttribute('aria-expanded', 'false');
      await secondButton.focus();
      await secondButton.press('Enter');
      await expect(secondButton).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(`#collapse-description-${secondSlug}`)).toHaveClass(/show/);
    }
  });

  test('updates placeholders according to selected language', async ({ page }) => {
    const abstractField = page.locator('#input-abstract');
    await expect(abstractField).toHaveAttribute(
      'placeholder',
      'Please enter an abstract of the data. Please do not repeat the abstract of a paper, but describe the data itself.'
    );

    // Find a dynamic textarea with a placeholder
    const dynamicTextarea = page.locator('#accordion-description .accordion-item[data-description-slug] textarea[data-translate-placeholder]').first();
    const enPlaceholder = await dynamicTextarea.getAttribute('placeholder');
    expect(enPlaceholder).toBeTruthy();

    await openLanguageMenu(page);
    await page.locator('[data-bs-language-value="de"]').click();

    // Wait for translation to be applied
    await expect(abstractField).toHaveAttribute(
      'placeholder',
      'Bitte ein Abstract zu den Daten einreichen. Bitte nicht das Abstract der dazugehörigen Publikation wiederholen, sondern die Daten an sich beschreiben.'
    );
    // Dynamic placeholder should have changed to German
    const dePlaceholder = await dynamicTextarea.getAttribute('placeholder');
    expect(dePlaceholder).toBeTruthy();
    expect(dePlaceholder).not.toBe(enPlaceholder);

    await openLanguageMenu(page);
    await page.locator('[data-bs-language-value="en"]').click();
    // Wait for language switch to complete
    await expect(abstractField).toHaveAttribute(
      'placeholder',
      'Please enter an abstract of the data. Please do not repeat the abstract of a paper, but describe the data itself.'
    );
  });
});