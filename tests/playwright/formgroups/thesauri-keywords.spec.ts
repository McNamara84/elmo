import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, SELECTORS } from '../utils';
import { injectModuleScript, injectScript, injectStylesheet } from '../utils/assets';

declare const translations: any;

const SCIENCE_PATH = 'Science Keywords > EARTH SCIENCE > AGRICULTURE > AGRICULTURAL AQUATIC SCIENCES > AQUACULTURE';
const PLATFORMS_PATH = 'Platforms > Air-based Platforms > BALLOONS';

const THESAURI_TEMPLATE = readFileSync(path.join(REPO_ROOT, 'formgroups/thesaurusKeywords.html'), 'utf8').replace(/<\?php[\s\S]*?\?>/g, '');

/**
 * Minimal mock vocabulary data used instead of large production JSON files.
 * Contains exactly the hierarchical paths the tests exercise.
 */
const MOCK_SCIENCE_KEYWORDS = {
  data: [
    {
      id: 'sk-1', text: 'Science Keywords', scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
      language: 'en',
      children: [
        {
          id: 'sk-2', text: 'EARTH SCIENCE', scheme: 'GCMD',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
          language: 'en',
          children: [
            {
              id: 'sk-3', text: 'AGRICULTURE', scheme: 'GCMD',
              schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
              language: 'en',
              children: [
                {
                  id: 'sk-4', text: 'AGRICULTURAL AQUATIC SCIENCES', scheme: 'GCMD',
                  schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
                  language: 'en',
                  children: [
                    {
                      id: 'sk-5', text: 'AQUACULTURE', scheme: 'GCMD',
                      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
                      language: 'en',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const MOCK_PLATFORMS = {
  data: [
    {
      id: 'pl-1', text: 'Platforms', scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
      language: 'en',
      children: [
        {
          id: 'pl-2', text: 'Air-based Platforms', scheme: 'GCMD',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
          language: 'en',
          children: [
            {
              id: 'pl-3', text: 'BALLOONS', scheme: 'GCMD',
              schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
              language: 'en',
            },
          ],
        },
      ],
    },
  ],
};

const MOCK_INSTRUMENTS = {
  data: [
    {
      id: 'in-1', text: 'Instruments', scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments',
      language: 'en',
      children: [
        {
          id: 'in-2', text: 'Spectrometers', scheme: 'GCMD',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments',
          language: 'en',
          description: 'Instruments that measure spectra',
          children: [
            {
              id: 'in-3', text: 'Infrared Spectrometer', scheme: 'GCMD',
              schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments',
              language: 'en',
            },
          ],
        },
      ],
    },
  ],
};
const TEST_ROUTE_PATH = '/thesauri-keywords-test';
const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Thesauri Keywords Playground</title>
  </head>
  <body>
    <nav class="p-2 border-bottom">
      <button id="bd-lang" type="button" class="btn btn-link">Language</button>
      <div class="d-flex gap-2 mt-2" role="group" aria-label="Language selection">
        <button type="button" data-bs-language-value="en" class="btn btn-outline-primary">English</button>
        <button type="button" data-bs-language-value="de" class="btn btn-outline-primary">Deutsch</button>
      </div>
    </nav>
    <main class="container p-3">
      ${THESAURI_TEMPLATE}
      <div id="help-scienceKeywords-keyword" role="note">Science Keywords Help</div>
      <div id="help-gcmd-platforms-keyword" role="note">Platforms Help</div>
      <div id="help-gcmd-instruments-keyword" role="note">Instruments Help</div>
      <div id="help-keywords-keywordviewer" role="note">Keyword Viewer Help</div>
    </main>
  </body>
</html>`;

/**
 * Mock availability response — science_keywords and platforms are available,
 * instruments are available. chronostratigraphy and gemet are disabled.
 */
const MOCK_AVAILABILITY = {
  science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
  platforms: { available: true, displayName: 'GCMD Platforms' },
  instruments: { available: true, displayName: 'GCMD Instruments' },
  chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
  gemet: { available: false, displayName: 'GEMET' },
};

async function waitForThesauriInit(page: import('@playwright/test').Page) {
  await expect(page.locator('.thesaurus-input-item').first()).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(
    () => Boolean((document.querySelector('#input-sciencekeyword') as any)?._tagify),
    { timeout: 15000 }
  );
}

test.describe('Thesauri Keywords Form Group', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**${TEST_ROUTE_PATH}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: TEST_PAGE_HTML,
      });
    });

    // Mock the ERNIE-backed availability endpoint
    await page.route('**/api/v2/vocabs/thesauri/availability', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_AVAILABILITY),
      });
    });

    // Mock vocabulary API endpoints with inline test data
    await page.route('**/api/v2/vocabs/thesauri/gcmd-science-keywords', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCIENCE_KEYWORDS) });
    });
    await page.route('**/api/v2/vocabs/thesauri/gcmd-platforms', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLATFORMS) });
    });
    await page.route('**/api/v2/vocabs/thesauri/gcmd-instruments', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUMENTS) });
    });

    await page.goto(TEST_ROUTE_PATH);

    await injectStylesheet(page, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
    await injectStylesheet(page, 'node_modules/@yaireo/tagify/dist/tagify.css');
    await injectStylesheet(page, 'node_modules/jstree/dist/themes/default/style.min.css');

    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
    await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');
    await injectScript(page, 'node_modules/jstree/dist/jstree.min.js');
    await injectScript(page, 'node_modules/@yaireo/tagify/dist/tagify.js');

    await page.evaluate(() => {
      (window as any).ELMO_FEATURES = { showThesauri: true };

      (window as any).translations = {
        keywords: {
          thesaurus: {
            label: 'Open thesaurus to choose keywords or start typing...',
            name: 'Thesauri Keywords',
          },
          searchPlaceholder: 'Search for keywords...',
          selectedKeywords: 'Selected Keywords',
        },
      };

      (window as any).__setupLanguageHandlers = () => {
        document.querySelectorAll('[data-bs-language-value]').forEach(element => {
          element.addEventListener('click', event => {
            event.preventDefault();
            const value = (event.currentTarget as HTMLElement).getAttribute('data-bs-language-value');
            const label = value === 'de'
              ? 'Öffnen Sie den Thesaurus zur Auswahl von Schlagworten oder beginnen Sie mit der Eingabe...'
              : 'Open thesaurus to choose keywords or start typing...';
            (window as any).translations.keywords.thesaurus.label = label;
            document.dispatchEvent(new Event('translationsLoaded'));
          });
        });
      };
    });

    await injectModuleScript(page, 'js/thesauri.js');

    // Set up language handlers and fire translationsLoaded to trigger dynamic init
    await page.evaluate(() => {
      if (typeof (window as any).__setupLanguageHandlers === 'function') {
        (window as any).__setupLanguageHandlers();
      }
      // Fill the static data-translate header
      const header = document.querySelector('[data-translate="keywords.thesaurus.name"]');
      if (header) header.textContent = 'Thesauri Keywords';

      document.dispatchEvent(new Event('translationsLoaded'));
    });

    await waitForThesauriInit(page);
  });

  test('renders accessible thesaurus input sections and controls', async ({ page }) => {
    const header = page.locator('b[data-translate="keywords.thesaurus.name"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Thesauri Keywords');

    const thesaurusItems = page.locator('.thesaurus-input-item');
    await expect(thesaurusItems).toHaveCount(3);

    const sectionConfigs = [
      {
        name: 'GCMD Science Keywords',
        helpId: 'help-scienceKeywords-keyword',
        inputId: '#input-sciencekeyword',
        expectedName: 'gcmdScienceKeywords',
        modalTarget: '#modal-sciencekeyword',
      },
      {
        name: 'GCMD Platforms',
        helpId: 'help-gcmd-platforms-keyword',
        inputId: '#input-platforms',
        expectedName: 'platforms',
        modalTarget: '#modal-platforms',
      },
      {
        name: 'GCMD Instruments',
        helpId: 'help-gcmd-instruments-keyword',
        inputId: '#input-instruments',
        expectedName: 'instruments',
        modalTarget: '#modal-instruments',
      },
    ] as const;

    for (const config of sectionConfigs) {
      const input = page.locator(config.inputId);
      const item = input.locator('xpath=ancestor::div[contains(@class,"thesaurus-input-item")]');

      await expect(item).toBeVisible();
      await expect(item.locator('.thesaurus-input-label')).toHaveText(config.name);

      const helpIcon = item.locator('i.bi-question-circle-fill');
      await expect(helpIcon).toHaveAttribute('data-help-section-id', config.helpId);

      await expect(input).toHaveAttribute('name', config.expectedName);

      const modalButton = item.locator('button[data-bs-toggle="modal"]');
      await expect(modalButton).toBeVisible();
      await expect(modalButton).toHaveAttribute('data-bs-target', config.modalTarget);
    }
  });

  test('populates Tagify autocomplete when input is focused without opening modal first', async ({ page }) => {
    // Verify the modal has NOT been opened yet
    const scienceModal = page.locator('#modal-sciencekeyword');
    await expect(scienceModal).toBeHidden();

    // Click on the Tagify input to trigger focus-based lazy loading
    const tagifyInput = page.locator('#input-sciencekeyword').locator('..').locator('.tagify__input');
    await tagifyInput.click();

    // Wait for the API call to complete and whitelist to be populated
    await page.waitForFunction(() => {
      const input = document.getElementById('input-sciencekeyword') as any;
      return input?.tagify?.settings?.whitelist?.length > 0 || input?._tagify?.settings?.whitelist?.length > 0;
    }, { timeout: 10000 });

    // Type enough characters to trigger the dropdown (dropdown.enabled: 3)
    await tagifyInput.pressSequentially('AQU', { delay: 100 });

    // Verify the autocomplete dropdown appears with matching suggestions
    const dropdown = page.locator('.tagify__dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    const suggestion = dropdown.locator('.tagify__dropdown__item');
    await expect(suggestion.first()).toContainText('AQUATIC');

    // Verify the modal was never opened
    await expect(scienceModal).toBeHidden();
  });

  test('synchronises science keyword selections between tree, summary list, and Tagify input', async ({ page }) => {
    await page
      .locator('#input-sciencekeyword')
      .locator('xpath=ancestor::div[contains(@class,"thesaurus-input-item")]')
      .locator('button[data-bs-toggle="modal"]')
      .click();

    const scienceModal = page.locator('#modal-sciencekeyword');
    await expect(scienceModal).toBeVisible();

    await page.waitForFunction(() => Boolean((window as any).jQuery?.fn?.jstree));
    await page.waitForFunction(() => {
      const tree = (window as any).jQuery?.('#jstree-sciencekeyword').jstree(true);
      return Boolean(tree && tree.get_json('#', { flat: true }).length);
    });
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

    const selectedItems = page.locator('#selected-keywords-sciencekeyword li');
    await expect(selectedItems).toHaveCount(1);
    await expect(selectedItems.first()).toContainText(SCIENCE_PATH);

    const scienceTags = page.locator('#input-sciencekeyword').locator('..').locator('.tagify__tag');
    await expect(scienceTags).toHaveCount(1);
    await expect(scienceTags.first()).toContainText('AQUACULTURE');

    await selectedItems.first().locator('button').click();
    await expect(page.locator('#selected-keywords-sciencekeyword li')).toHaveCount(0);
    await expect(scienceTags).toHaveCount(0);
    await expect(page.locator('#jstree-sciencekeyword .jstree-clicked')).toHaveCount(0);
  });

  test('supports searching, keyboard access, and persistence across thesauri modals', async ({ page }) => {
    const openPlatformsModal = page.locator('#button-platforms-open');
    await openPlatformsModal.focus();
    await openPlatformsModal.press('Enter');

    const platformsModal = page.locator('#modal-platforms');
    await expect(platformsModal).toBeVisible();

    await page.waitForFunction(() => {
      const tree = (window as any).jQuery?.('#jstree-platforms').jstree(true);
      return Boolean(tree && tree.get_json('#', { flat: true }).length);
    });

    const searchInput = page.locator('#input-platforms-thesaurussearch');
    await expect(searchInput).toHaveAttribute('aria-label', 'Search for keywords...');
    await searchInput.fill('BALLOONS');

    const highlighted = page.locator('#jstree-platforms .jstree-search');
    await expect(highlighted).not.toHaveCount(0);
    const uppercaseResult = highlighted.filter({ hasText: 'BALLOONS' });
    await expect(uppercaseResult).not.toHaveCount(0);

    await searchInput.press('Enter');
    await expect(platformsModal).toBeVisible();

    await page.waitForFunction(() => document.querySelectorAll('#jstree-platforms .jstree-search').length > 0);

    await page.evaluate(() => {
      const tree = (window as any).jQuery?.('#jstree-platforms').jstree(true);
      tree?.open_all();
    });

    await page.evaluate((targetPath) => {
      const tree = (window as any).jQuery?.('#jstree-platforms').jstree(true);
      if (!tree) {
        throw new Error('Platforms tree is not ready');
      }
      const match = tree
        .get_json('#', { flat: true })
        .find((node: any) => tree.get_path(node, ' > ') === targetPath || node.text === 'BALLOONS');
      if (!match) {
        throw new Error(`Could not find node with path ${targetPath}`);
      }
      tree.deselect_all();
      tree.select_node(match.id);
    }, PLATFORMS_PATH);

    const selectedNode = page.locator('#jstree-platforms .jstree-clicked');
    await expect(selectedNode).toHaveText(/BALLOONS/);

    const selectedPlatforms = page.locator('#selected-keywords-platforms li');
    await expect(selectedPlatforms).toHaveCount(1);
    await expect(selectedPlatforms.first()).toContainText('BALLOONS');

    await platformsModal.locator('.modal-footer button.btn-primary').click();
    await expect(platformsModal).toBeHidden();

    const platformTags = page.locator('#input-platforms').locator('..').locator('.tagify__tag');
    await expect(platformTags).toHaveCount(1);
    await expect(page.locator('#input-platforms')).toHaveValue(/BALLOONS/);

    const instrumentsModalButton = page.locator('#button-instruments-open');
    await instrumentsModalButton.focus();
    await instrumentsModalButton.press('Enter');

    const instrumentsModal = page.locator('#modal-instruments');
    await expect(instrumentsModal).toBeVisible();

    await page.waitForFunction(() => {
      const tree = (window as any).jQuery?.('#jstree-instruments').jstree(true);
      return Boolean(tree && tree.get_json('#', { flat: true }).length);
    });

    const instrumentsSearch = page.locator('#input-instruments-thesaurussearch');
    await instrumentsSearch.fill('spectrometer');
    await expect(page.locator('#jstree-instruments .jstree-search')).not.toHaveCount(0);
    await instrumentsModal.locator('.modal-footer button.btn-primary').click();
  });

  test('updates Tagify placeholders when switching languages', async ({ page }) => {
    const getPlaceholders = async () => {
      return page.evaluate(() => {
        const ids = ['#input-sciencekeyword', '#input-platforms', '#input-instruments'];
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

    await page.locator(SELECTORS.navigation.languageToggle).click();
    await page.locator('[data-bs-language-value="de"]').click();

    await expect.poll(async () => {
      const placeholders = await getPlaceholders();
      return placeholders.every((value) => value.placeholder === 'Öffnen Sie den Thesaurus zur Auswahl von Schlagworten oder beginnen Sie mit der Eingabe...' && value.dataPlaceholder === 'Öffnen Sie den Thesaurus zur Auswahl von Schlagworten oder beginnen Sie mit der Eingabe...');
    }).toBeTruthy();

    await page.locator(SELECTORS.navigation.languageToggle).click();
    await page.locator('[data-bs-language-value="en"]').click();

    await expect.poll(async () => {
      const placeholders = await getPlaceholders();
      return placeholders.every((value) => value.placeholder === 'Open thesaurus to choose keywords or start typing...' && value.dataPlaceholder === 'Open thesaurus to choose keywords or start typing...');
    }).toBeTruthy();
  });
});