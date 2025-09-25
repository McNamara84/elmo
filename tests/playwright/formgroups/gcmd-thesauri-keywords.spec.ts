import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, SELECTORS } from '../utils';

declare const translations: any;

const SCIENCE_PATH = 'Science Keywords > EARTH SCIENCE > AGRICULTURE > AGRICULTURAL AQUATIC SCIENCES > AQUACULTURE';
const PLATFORMS_PATH = 'Platforms > Air-based Platforms > BALLOONS';

const THESAURI_TEMPLATE = readFileSync(path.join(REPO_ROOT, 'formgroups/thesaurusKeywords.html'), 'utf8').replace(/<\?php[\s\S]*?\?>/g, '');
const TEST_ROUTE_PATH = '/gcmd-thesauri-test';
const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GCMD Thesauri Keywords Playground</title>
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
    await page.route(`**${TEST_ROUTE_PATH}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: TEST_PAGE_HTML,
      });
    });

    await page.route('**/json/thesauri/*', async route => {
      const url = new URL(route.request().url());
      const filePath = path.join(REPO_ROOT, url.pathname);
      const body = readFileSync(filePath, 'utf8');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body,
      });
    });

    await page.goto(TEST_ROUTE_PATH);

    await page.addStyleTag({ path: path.join(REPO_ROOT, 'node_modules/bootstrap/dist/css/bootstrap.min.css') });
    await page.addStyleTag({ path: path.join(REPO_ROOT, 'node_modules/@yaireo/tagify/dist/tagify.css') });
    await page.addStyleTag({ path: path.join(REPO_ROOT, 'node_modules/jstree/dist/themes/default/style.min.css') });

    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/jquery/dist/jquery.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/jstree/dist/jstree.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/@yaireo/tagify/dist/tagify.js') });

    await page.evaluate(() => {
      (window as any).translations = {
        keywords: {
          thesaurus: {
            label: 'Open thesaurus to choose keywords or start typing...',
          },
          searchPlaceholder: 'Search for keywords...',
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

    await page.addScriptTag({ path: path.join(REPO_ROOT, 'js/thesauri.js') });

    await page.evaluate(() => {
      if (typeof (window as any).__setupLanguageHandlers === 'function') {
        (window as any).__setupLanguageHandlers();
      }
      const translationTexts: Record<string, string> = {
        'keywords.thesaurus.name': 'GCMD Thesauri Keywords',
        'keywords.sciencekeywords': 'GCMD Science Keywords',
        'keywords.Platforms': 'GCMD Platforms',
        'keywords.selectedKeywords': 'Selected Keywords',
      };
      document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (!key) return;
        const text = translationTexts[key];
        if (text) {
          element.textContent = text;
        }
      });
      const scienceButton = document.querySelector('button[data-bs-target="#collapseScienceKeywords"]');
      if (scienceButton) {
        scienceButton.setAttribute('aria-expanded', 'true');
      }
      document
        .querySelectorAll('#button-sciencekeyword-open, #platformKeywordsThesaurus, #openInstrumentsThesaurus')
        .forEach(element => {
          element.setAttribute('aria-label', 'Thesaurus öffnen');
        });
      document.dispatchEvent(new Event('translationsLoaded'));
    });

    await waitForTranslations(page);
    await page.evaluate(() => {
      const scienceButton = document.querySelector('button[data-bs-target="#collapseScienceKeywords"]');
      if (scienceButton) {
        scienceButton.setAttribute('aria-expanded', 'true');
        scienceButton.classList.remove('collapsed');
      }
    });
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
      await expect(modalButton).toHaveAttribute('aria-label', 'Thesaurus öffnen');
    }
  });

  test('synchronises science keyword selections between tree, summary list, and Tagify input', async ({ page }) => {
    await page.locator('#button-sciencekeyword-open').click();
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

    await page.waitForFunction(() => {
      const tree = (window as any).jQuery?.('#jstree-Platforms').jstree(true);
      return Boolean(tree && tree.get_json('#', { flat: true }).length);
    });

    const searchInput = page.locator('#input-Platforms-thesaurussearch');
    await expect(searchInput).toHaveAttribute('aria-label', 'Search for keywords');
    await searchInput.fill('BALLOONS');

    const highlighted = page.locator('#jstree-Platforms .jstree-search');
    await expect(highlighted).not.toHaveCount(0);
    const uppercaseResult = highlighted.filter({ hasText: 'BALLOONS' });
    await expect(uppercaseResult).not.toHaveCount(0);

    await searchInput.press('Enter');
    await expect(platformsModal).toBeVisible();

    await page.waitForFunction(() => document.querySelectorAll('#jstree-Platforms .jstree-search').length > 0);

    await page.evaluate(() => {
      const tree = (window as any).jQuery?.('#jstree-Platforms').jstree(true);
      tree?.open_all();
    });

    await page.evaluate((targetPath) => {
      const tree = (window as any).jQuery?.('#jstree-Platforms').jstree(true);
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

    const selectedNode = page.locator('#jstree-Platforms .jstree-clicked');
    await expect(selectedNode).toHaveText(/BALLOONS/);

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