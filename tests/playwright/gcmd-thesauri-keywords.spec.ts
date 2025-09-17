import { test, expect } from '@playwright/test';

declare const translations: any;

const SCIENCE_PATH = 'Science Keywords > EARTH SCIENCE > AGRICULTURE > AGRICULTURAL AQUATIC SCIENCES > AQUACULTURE';

async function waitForTranslations(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const globalTranslations = (window as any).translations;
    const lexicalTranslations = typeof translations !== 'undefined' ? (translations as any) : undefined;
    const label = globalTranslations?.keywords?.thesaurus?.label ?? lexicalTranslations?.keywords?.thesaurus?.label;
    if (label) {
      (window as any).__translationsReady = true;
      return true;
    }
    if (!(window as any).__waitingForTranslations) {
      (window as any).__waitingForTranslations = true;
      document.addEventListener(
        'translationsLoaded',
        () => {
          (window as any).__translationsReady = true;
        },
        { once: true }
      );
    }
    return Boolean((window as any).__translationsReady);
  });
}

test.describe('GCMD Thesauri Keywords Form Group', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await waitForTranslations(page);
    await expect(page.locator('#accordionThesauri')).toBeVisible();
    await page.waitForSelector('#input-sciencekeyword', { state: 'attached' });
    await page.waitForFunction(() => Boolean((document.querySelector('#input-sciencekeyword') as any)?._tagify));
  });

  test('renders accessible accordion sections and controls', async ({ page }) => {
    const header = page.locator('b[data-translate="keywords.thesaurus.name"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText('GCMD Thesauri Keywords');

    const accordionItems = page.locator('#accordionThesauri .accordion-item');
    await expect(accordionItems).toHaveCount(3);

    const sectionConfigs = [
      {
        name: 'GCMD Science Keywords',
        target: '#collapseScienceKeywords',
        buttonSelector: 'button[data-bs-target="#collapseScienceKeywords"]',
        expanded: 'true',
        helpId: 'help-scienceKeywords-keyword',
        inputId: '#input-sciencekeyword',
        expectedName: 'gcmdScienceKeywords',
        modalButton: '#button-sciencekeyword-open',
        modalTarget: '#modal-sciencekeyword',
      },
      {
        name: 'GCMD Platforms',
        target: '#collapsePlatforms',
        buttonSelector: 'button[data-bs-target="#collapsePlatforms"]',
        expanded: 'false',
        helpId: 'help-gcmd-platforms-keyword',
        inputId: '#input-Platforms',
        expectedName: 'platforms',
        modalButton: '#platformKeywordsThesaurus',
        modalTarget: '#modal-Platforms',
      },
      {
        name: 'GCMD Instruments',
        target: '#collapseInstruments',
        buttonSelector: 'button[data-bs-target="#collapseInstruments"]',
        expanded: 'false',
        helpId: 'help-gcmd-instruments-keyword',
        inputId: '#input-Instruments',
        expectedName: 'instruments',
        modalButton: '#openInstrumentsThesaurus',
        modalTarget: '#modal-instruments',
      },
    ] as const;

    for (const config of sectionConfigs) {
      const button = page.locator(config.buttonSelector);
      await expect(button).toHaveAttribute('aria-controls', config.target.slice(1));
      await expect(button).toHaveAttribute('aria-expanded', config.expanded);
      await expect(button).toHaveText(config.name);

      const helpIcon = page.locator(`${config.target} i.bi-question-circle-fill`);
      await expect(helpIcon).toHaveAttribute('data-help-section-id', config.helpId);

      const input = page.locator(config.inputId);
      await expect(input).toHaveAttribute('name', config.expectedName);

      const modalButton = page.locator(config.modalButton);
      await expect(modalButton).toHaveAttribute('data-bs-target', config.modalTarget);
      await expect(modalButton).toHaveAccessibleName('Thesaurus öffnen');
    }
  });

  test('synchronises science keyword selections between tree, summary list, and Tagify input', async ({ page }) => {
    await page.locator('#button-sciencekeyword-open').click();
    const scienceModal = page.locator('#modal-sciencekeyword');
    await expect(scienceModal).toBeVisible();

    await page.waitForFunction(() => Boolean((window as any).jQuery?.fn?.jstree));
    await page.evaluate(() => {
      const tree = (window as any).jQuery?.('#jstree-sciencekeyword').jstree(true);
      tree?.open_all();
    });

    await page.evaluate((targetPath) => {
      const tree = (window as any).jQuery?.('#jstree-sciencekeyword').jstree(true);
      if (!tree) {
        throw new Error('Science keyword tree is not ready');
      }
      const match = tree
        .get_json('#', { flat: true })
        .find((node: any) => tree.get_path(node, ' > ') === targetPath);
      if (!match) {
        throw new Error(`Could not find node with path ${targetPath}`);
      }
      tree.deselect_all();
      tree.select_node(match.id);
    }, SCIENCE_PATH);

    const selectedItems = page.locator('#selected-keywords-gcmd li');
    await expect(selectedItems).toHaveCount(1);
    await expect(selectedItems.first()).toContainText(SCIENCE_PATH);

    const scienceTags = page.locator('#thesaurusKeywordsGroup #collapseScienceKeywords .tagify__tag');
    await expect(scienceTags).toHaveCount(1);
    await expect(scienceTags.first()).toContainText('AQUACULTURE');

    await selectedItems.first().locator('button').click();
    await expect(page.locator('#selected-keywords-gcmd li')).toHaveCount(0);
    await expect(scienceTags).toHaveCount(0);
    await expect(page.locator('#jstree-sciencekeyword .jstree-clicked')).toHaveCount(0);
  });

  test('supports searching, keyboard access, and persistence across GCMD thesauri modals', async ({ page }) => {
    const platformsButton = page.locator('button[data-bs-target="#collapsePlatforms"]');
    await platformsButton.press(' ');
    await expect(platformsButton).toHaveAttribute('aria-expanded', 'true');

    const openPlatformsModal = page.locator('#platformKeywordsThesaurus');
    await openPlatformsModal.focus();
    await openPlatformsModal.press('Enter');

    const platformsModal = page.locator('#modal-Platforms');
    await expect(platformsModal).toBeVisible();

    const searchInput = page.locator('#input-Platforms-thesaurussearch');
    await expect(searchInput).toHaveAttribute('aria-label', 'Search for keywords');
    await searchInput.fill('BALLOONS');

    const highlighted = page.locator('#jstree-Platforms .jstree-search');
    await expect(highlighted).not.toHaveCount(0);

    await searchInput.press('Enter');
    await expect(platformsModal).toBeVisible();

    const firstResult = highlighted.first();
    await firstResult.click();
    await expect(firstResult).toHaveClass(/jstree-clicked/);

    const selectedPlatforms = page.locator('#selected-keywords-Platforms-gcmd li');
    await expect(selectedPlatforms).toHaveCount(1);
    await expect(selectedPlatforms.first()).toContainText('BALLOONS');

    await platformsModal.locator('.modal-footer button.btn-primary').click();
    await expect(platformsModal).toBeHidden();

    const platformTags = page.locator('#collapsePlatforms .tagify__tag');
    await expect(platformTags).toHaveCount(1);
    await expect(page.locator('#input-Platforms')).toHaveValue(/BALLOONS/);

    const instrumentsButton = page.locator('button[data-bs-target="#collapseInstruments"]');
    await instrumentsButton.press('Enter');
    await expect(instrumentsButton).toHaveAttribute('aria-expanded', 'true');

    const instrumentsModalButton = page.locator('#openInstrumentsThesaurus');
    await instrumentsModalButton.click();
    const instrumentsModal = page.locator('#modal-instruments');
    await expect(instrumentsModal).toBeVisible();

    const instrumentsSearch = page.locator('#input-instruments-thesaurussearch');
    await instrumentsSearch.fill('spectrometer');
    await expect(page.locator('#jstree-instruments .jstree-search')).not.toHaveCount(0);
    await instrumentsModal.locator('.modal-footer button.btn-primary').click();
  });

  test('updates Tagify placeholders when switching languages', async ({ page }) => {
    const getPlaceholders = async () => {
      return page.evaluate(() => {
        const ids = ['#input-sciencekeyword', '#input-Platforms', '#input-Instruments'];
        return ids.map((selector) => {
          const element = document.querySelector(selector) as any;
          const tagifyInput = element?._tagify;
          const placeholder = tagifyInput?.settings?.placeholder ?? null;
          const dataPlaceholder = tagifyInput?.DOM?.input?.getAttribute('data-placeholder') ?? null;
          return { placeholder, dataPlaceholder };
        });
      });
    };

    const initialPlaceholders = await getPlaceholders();
    for (const value of initialPlaceholders) {
      expect(value.placeholder).toBe('Open thesaurus to choose keywords or start typing...');
      expect(value.dataPlaceholder).toBe('Open thesaurus to choose keywords or start typing...');
    }

    await page.locator('#bd-lang').click();
    await page.locator('[data-bs-language-value="de"]').click();

    await expect.poll(async () => {
      const placeholders = await getPlaceholders();
      return placeholders.every((value) => value.placeholder === 'Öffnen Sie den Thesaurus zur Auswahl von Schlagworten oder beginnen Sie mit der Eingabe...' && value.dataPlaceholder === 'Öffnen Sie den Thesaurus zur Auswahl von Schlagworten oder beginnen Sie mit der Eingabe...');
    }).toBeTruthy();

    await page.locator('#bd-lang').click();
    await page.locator('[data-bs-language-value="en"]').click();

    await expect.poll(async () => {
      const placeholders = await getPlaceholders();
      return placeholders.every((value) => value.placeholder === 'Open thesaurus to choose keywords or start typing...' && value.dataPlaceholder === 'Open thesaurus to choose keywords or start typing...');
    }).toBeTruthy();
  });
});