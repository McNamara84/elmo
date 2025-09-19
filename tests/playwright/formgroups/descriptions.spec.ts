import { test, expect, Locator } from '@playwright/test';
import { navigateToHome, openLanguageMenu, SELECTORS } from '../utils';

test.describe('Descriptions Form Group', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator(SELECTORS.formGroups.descriptions)).toBeVisible();
  });

  test('renders descriptions accordion with accessible sections and help icons', async ({ page }) => {
    const header = page.locator('b[data-translate="descriptions.title"]');
    await expect(header).toBeVisible();
    await expect(page.locator('[data-help-section-id="help-descriptions-fg"]')).toBeVisible();

    const accordionButtons = page.locator('#accordion-description .accordion-button');
    await expect(accordionButtons).toHaveCount(4);

    const sectionConfigs = [
      {
        index: 0,
        target: '#collapse-abstract',
        translateKey: 'descriptions.abstract',
        expanded: 'true',
        helpId: 'help-description-abstract',
        visible: true,
      },
      {
        index: 1,
        target: '#collapse-methods',
        translateKey: 'descriptions.methods',
        expanded: 'false',
        helpId: 'help-description-methods',
        visible: false,
      },
      {
        index: 2,
        target: '#collapse-technicalinfo',
        translateKey: 'descriptions.technicalInfo',
        expanded: 'false',
        helpId: 'help-description-technicalinfo',
        visible: false,
      },
      {
        index: 3,
        target: '#collapse-other',
        translateKey: 'descriptions.other',
        expanded: 'false',
        helpId: 'help-description-other',
        visible: false,
      },
    ] as const;

    for (const config of sectionConfigs) {
      const button = accordionButtons.nth(config.index);
      await expect(button).toHaveAttribute('data-bs-target', config.target);
      await expect(button).toHaveAttribute('data-translate', config.translateKey);
      await expect(button).toHaveAttribute('aria-expanded', config.expanded);
      const helpIcon = page.locator(`${config.target} i.bi-question-circle-fill`);
      await expect(helpIcon).toHaveAttribute('data-help-section-id', config.helpId);
      await expect(helpIcon).toBeAttached();
      if (config.visible) {
        await expect(helpIcon).toBeVisible();
      }
    }
  });

  test('allows entering descriptions data and maintains accessibility metadata', async ({ page }) => {
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

    const { button: methodsButton, panel: methodsPanel } = await expandSection('#collapse-methods');
    const methodsField = page.locator('#input-methods');
    await methodsField.fill('Detailed methodology description.');
    await expect(methodsField).toHaveValue('Detailed methodology description.');

    const { button: technicalButton, panel: technicalPanel } = await expandSection('#collapse-technicalinfo');
    const technicalField = page.locator('#input-technicalinfo');
    await technicalField.fill('Technical specs and processing information.');
    await expect(technicalField).toHaveValue('Technical specs and processing information.');

    const { button: otherButton, panel: otherPanel } = await expandSection('#collapse-other');
    const otherField = page.locator('#input-other');
    await otherField.fill('Supplementary notes and related information.');
    await expect(otherField).toHaveValue('Supplementary notes and related information.');

    await collapseSection(otherButton, otherPanel);

    await otherButton.click();
    await expect(otherButton).toHaveAttribute('aria-expanded', 'true');
    await expect(otherPanel).toHaveClass(/show/);
    await expect(otherPanel).toBeVisible();
    await expect(otherField).toHaveValue('Supplementary notes and related information.');

    // Close previously opened sections to keep the UI state tidy for following tests
    const closeSectionIfExpanded = async (sectionButton: Locator, panel: Locator) => {
      if ((await sectionButton.getAttribute('aria-expanded')) === 'true') {
        await collapseSection(sectionButton, panel);
        return;
      }

      await expect(panel).not.toBeVisible();
      await expect(panel).toHaveClass(/collapse/);
      await expect(sectionButton).toHaveAttribute('aria-expanded', 'false');
    };

    // Close previously opened sections to keep the UI state tidy for following tests
    await closeSectionIfExpanded(technicalButton, technicalPanel);
    await closeSectionIfExpanded(methodsButton, methodsPanel);
  });

  test('supports expanding sections via mouse and keyboard interactions', async ({ page }) => {
    const methodsButton = page.locator('button[data-bs-target="#collapse-methods"]');
    await expect(methodsButton).toHaveAttribute('aria-expanded', 'false');
    await methodsButton.click();
    await expect(methodsButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#collapse-methods')).toHaveClass(/show/);

    const technicalButton = page.locator('button[data-bs-target="#collapse-technicalinfo"]');
    await expect(technicalButton).toHaveAttribute('aria-expanded', 'false');
    await technicalButton.focus();
    await technicalButton.press('Enter');
    await expect(technicalButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#collapse-technicalinfo')).toHaveClass(/show/);

    const otherButton = page.locator('button[data-bs-target="#collapse-other"]');
    await expect(otherButton).toHaveAttribute('aria-expanded', 'false');
    await otherButton.focus();
    await otherButton.press(' ');
    await expect(otherButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#collapse-other')).toHaveClass(/show/);
  });

  test('updates placeholders according to selected language', async ({ page }) => {
    const abstractField = page.locator('#input-abstract');
    await expect(abstractField).toHaveAttribute(
      'placeholder',
      'Please enter an abstract of the data. Please do not repeat the abstract of a paper, but describe the data itself.'
    );

    const methodsField = page.locator('#input-methods');
    await expect(methodsField).toHaveAttribute(
      'placeholder',
      'Please enter a description of the methodology employed for the study or research.'
    );

    await openLanguageMenu(page);
    await page.locator('[data-bs-language-value="de"]').click();
    await page.waitForTimeout(1000);

    await expect(abstractField).toHaveAttribute(
      'placeholder',
      'Bitte ein Abstract zu den Daten einreichen. Bitte nicht das Abstract der dazugehörigen Publikation wiederholen, sondern die Daten an sich beschreiben.'
    );
    await expect(methodsField).toHaveAttribute(
      'placeholder',
      'Bitte eine Beschreibung der für die Studie oder Forschung verwendeten Methodik eingeben.'
    );

    await openLanguageMenu(page);
    await page.locator('[data-bs-language-value="en"]').click();
    await page.waitForTimeout(500);
  });
});