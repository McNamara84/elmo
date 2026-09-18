import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { APP_BASE_URL, registerStaticAssetRoutes, REPO_ROOT } from '../utils';

type ApiRequestCounts = {
  relations: number;
  identifierTypes: number;
  patterns: number;
};

const apiRequestCounts = new WeakMap<Page, ApiRequestCounts>();

const relationsFixture = {
  relations: [
    {
      id: 'isPreviousVersionOf',
      name: 'IsPreviousVersionOf',
      label: 'Is Previous Version Of',
      description: 'Earlier version of this dataset.'
    },
    {
      id: 'cites',
      name: 'Cites',
      label: 'Cites',
      description: 'This dataset cites another resource.'
    },
    {
      id: 'isDerivedFrom',
      name: 'IsDerivedFrom',
      label: 'Is Derived From',
      description: 'Derived from the referenced resource.'
    }
  ]
};

const identifierTypesFixture = {
  identifierTypes: [
    {
      name: 'URL',
      description: 'Uniform Resource Locator',
      pattern: '/^https?:\\/\\/.+$/i'
    },
    {
      name: 'DOI',
      description: 'Digital Object Identifier',
      pattern: '/^10\\.\\d{4,9}\\/.+$/i'
    },
    {
      name: 'Handle',
      description: 'Handle identifier',
      pattern: '/^hdl:[^\\s]+$/i'
    }
  ]
};

const identifierPatterns: Record<string, { pattern: string }> = {
  URL: { pattern: '^https?:\\/\\/.+$' },
  DOI: { pattern: '^10\\.\\d{4,9}\\/.+$' },
  Handle: { pattern: '^hdl:[^\\s]+$' }
};

const relatedWorkTemplate = readFileSync(path.join(REPO_ROOT, 'formgroups/relatedwork.html'), 'utf8');
const issue769Fixture = readFileSync(
  path.join(REPO_ROOT, 'tests/playwright/related-work-issue-769-digis-e-2024-007.xml'),
  'utf8'
);

const relatedWorkMarkup = String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Related Work Test Harness</title>
    <base href="${APP_BASE_URL}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css" />
    <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.css" />
    <link rel="stylesheet" href="node_modules/jquery-ui/dist/themes/base/jquery-ui.min.css" />
  </head>
  <body>
    <main class="container py-4">
      <form id="form-mde">
        ${relatedWorkTemplate}
      </form>
      <div id="help-relatedwork-fg" role="note">Related work help text</div>
      <div id="help-relatedwork-relation" role="note">Relation help text</div>
      <div id="help-relatedwork-identifier" role="note">Identifier help text</div>
      <div id="help-relatedwork-identifiertype" role="note">Identifier type help text</div>

      <div id="modal-uploadxml" class="modal" tabindex="-1">
        <input id="input-uploadxml-file" type="file" />
        <div id="panel-uploadxml-dropfile">
          <div id="upload-spinner-overlay" class="d-none">Loading</div>
        </div>
        <div id="xml-upload-status" class="d-none"></div>
      </div>
      <div id="toast-upload-feedback" class="toast">
        <i id="toast-upload-feedback-icon"></i>
        <span id="toast-upload-feedback-message"></span>
      </div>
    </main>
    <script>
      window.translations = {
        general: { choose: 'Choose...' },
        relatedWork: {
          title: 'Related work',
          addEntry: 'Add related work',
          entrySingular: 'entry',
          entryPlural: 'entries',
          entriesSummary: '{count} {label}',
          incompleteEntry: 'Incomplete related work'
        },
        modals: { upload: { relatedWorksProgress: 'Related works {processed}/{total}' } }
      };
      window.ELMO_FEATURES = { showUsedInstruments: false };
    </script>
    <script src="node_modules/jquery/dist/jquery.min.js"></script>
    <script src="node_modules/jquery-ui/dist/jquery-ui.min.js"></script>
    <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/checkMandatoryFields.js"></script>
    <script src="js/dropdownUtils.js"></script>
    <script src="js/dropdownAjax.js"></script>
    <script src="js/select.js"></script>
    <script src="js/resourceTypeUtils.js"></script>
    <script src="js/mappingXmlToInputFields.js"></script>
    <script src="js/upload.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/relatedwork.js"></script>
  </body>
</html>`;

function buildRelatedWorksXml(count: number): string {
  const identifiers = Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    return `<relatedIdentifier relatedIdentifierType="DOI" relationType="References">10.1234/generated-${number}</relatedIdentifier>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
    <resource xmlns="http://datacite.org/schema/kernel-4">
      <relatedIdentifiers>${identifiers}</relatedIdentifiers>
    </resource>`;
}

async function importRelatedWorksXml(page: Page, xml: string) {
  return page.evaluate(async source => {
    const xmlDocument = new DOMParser().parseFromString(source, 'application/xml');
    const importer = (window as any).processRelatedWorks;
    if (typeof importer !== 'function') {
      throw new Error('processRelatedWorks is unavailable in the browser harness');
    }
    return importer(xmlDocument, null, { batchSize: 50 });
  }, xml);
}

async function payloadOrder(page: Page): Promise<string[]> {
  return page.locator('input[name="relatedWorksPayload"]').evaluate((element: HTMLInputElement) => {
    return JSON.parse(element.value).map((entry: { identifier: string }) => entry.identifier);
  });
}

test.describe('Related work form group', () => {
  test.beforeEach(async ({ page }) => {
    const counts = { relations: 0, identifierTypes: 0, patterns: 0 };
    apiRequestCounts.set(page, counts);

    await registerStaticAssetRoutes(page);
    await page.route('**/api/v2/vocabs/relations', async route => {
      counts.relations += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(relationsFixture)
      });
    });

    await page.route('**/api/v2/validation/identifiertypes/active', async route => {
      counts.identifierTypes += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(identifierTypesFixture)
      });
    });

    await page.route('**/api/v2/validation/patterns/**', async route => {
      counts.patterns += 1;
      const url = new URL(route.request().url());
      const type = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      const body = identifierPatterns[type] ?? { pattern: '' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });

    await page.route('**/related-work-harness', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: relatedWorkMarkup
      });
    });

    await page.goto(`${APP_BASE_URL}related-work-harness`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).relatedWorkStack));
    await page.evaluate(async () => {
      if ((window as any).elmo?.dropdownsReady) {
        await (window as any).elmo.dropdownsReady;
      }
    });
  });

  test('starts with no card and only the add action', async ({ page }) => {
    await expect(page.locator('b[data-translate="relatedWork.title"]')).toHaveText('Related work');
    await expect(page.locator('[data-help-section-id="help-relatedwork-fg"]')).toBeVisible();
    await expect(page.locator('[data-related-work-entry]')).toHaveCount(0);
    await expect(page.locator('[data-related-work-summary-count]')).toHaveText('0 entries');
    await expect(page.getByRole('button', { name: 'Add related work' })).toHaveCount(1);
    await expect(page.locator('[data-related-work-stack] input, [data-related-work-stack] select')).toHaveCount(0);
  });

  test('adds accessible cards with cached vocabularies, unique ids, and non-duplicated help icons', async ({ page }) => {
    const addButton = page.getByRole('button', { name: 'Add related work' });
    await addButton.click();
    await addButton.click();

    const cards = page.locator('[data-related-work-entry]');
    await expect(cards).toHaveCount(2);
    const firstRelation = cards.nth(0).locator('select[name="relation[]"]');
    await expect(firstRelation.locator('option')).toHaveCount(relationsFixture.relations.length + 1);
    await expect(firstRelation.locator('option')).toHaveText([
      'Choose...',
      'Cites',
      'Is Derived From',
      'Is Previous Version Of'
    ]);
    await expect(firstRelation.locator('option').nth(2)).toHaveAttribute('data-relation-name', 'IsDerivedFrom');

    const firstType = cards.nth(0).locator('select[name="rIdentifierType[]"]');
    await expect(firstType.locator('option')).toHaveText(['Choose...', 'URL', 'DOI', 'Handle']);

    const relationIds = await cards.evaluateAll(cardElements => cardElements.map(card => ({
      id: card.querySelector<HTMLSelectElement>('select[name="relation[]"]')?.id,
      labelFor: card.querySelector<HTMLLabelElement>('label[for^="input-relatedwork-relation"]')?.htmlFor
    })));
    expect(relationIds[0].id).not.toBe(relationIds[1].id);
    expect(relationIds.every(pair => pair.id === pair.labelFor)).toBe(true);
    await expect(page.locator('span.input-group-text:not(.help-placeholder) i[data-help-section-id="help-relatedwork-relation"]')).toHaveCount(1);
    await expect(page.locator('span.input-group-text:not(.help-placeholder) i[data-help-section-id="help-relatedwork-identifier"]')).toHaveCount(1);
    await expect(page.locator('span.input-group-text:not(.help-placeholder) i[data-help-section-id="help-relatedwork-identifiertype"]')).toHaveCount(1);
    await expect(page.locator('span.help-placeholder[data-help-section-id="help-relatedwork-relation"]')).toHaveCount(1);
    await expect(page.locator('span.help-placeholder[data-help-section-id="help-relatedwork-identifier"]')).toHaveCount(1);
    await expect(page.locator('span.help-placeholder[data-help-section-id="help-relatedwork-identifiertype"]')).toHaveCount(1);
    await expect(cards.nth(1).locator('select[name="relation[]"]')).toBeFocused();
  });

  test('fills, summarizes, collapses, edits, and clears every card for issue 812', async ({ page }) => {
    const addButton = page.getByRole('button', { name: 'Add related work' });
    await addButton.click();
    await addButton.click();
    const cards = page.locator('[data-related-work-entry]');

    await cards.nth(0).locator('select[name="relation[]"]').selectOption('cites');
    await cards.nth(0).locator('input[name="rIdentifier[]"]').fill('10.5555/first');
    await cards.nth(0).locator('select[name="rIdentifierType[]"]').selectOption('DOI');
    await cards.nth(1).locator('select[name="relation[]"]').selectOption('isDerivedFrom');
    await cards.nth(1).locator('input[name="rIdentifier[]"]').fill('https://example.org/second');
    await cards.nth(1).locator('select[name="rIdentifierType[]"]').selectOption('URL');

    await expect(cards.nth(0).locator('[data-related-work-summary-identifier]')).toHaveText('10.5555/first');
    await expect(cards.nth(0).locator('[data-related-work-summary-relation]')).toHaveText('Cites');
    await expect(page.locator('[data-related-work-summary-count]')).toHaveText('2 entries');

    const firstToggle = cards.nth(0).locator('[data-related-work-toggle-edit]');
    await firstToggle.click();
    await expect(cards.nth(0).locator('[data-related-work-edit-panel]')).not.toHaveClass(/show/);
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await firstToggle.click();
    await expect(cards.nth(0).locator('[data-related-work-edit-panel]')).toHaveClass(/show/);

    await cards.nth(1).locator('[data-related-work-remove]').click();
    await expect(cards).toHaveCount(1);
    await expect(cards.nth(0).locator('[data-related-work-summary-identifier]')).toHaveText('10.5555/first');
    await cards.nth(0).locator('[data-related-work-remove]').click();
    await expect(cards).toHaveCount(0);
    await expect(page.locator('[data-related-work-summary-count]')).toHaveText('0 entries');
    await expect(addButton).toBeFocused();

    await addButton.click();
    await expect(cards).toHaveCount(1);
    await expect(cards.nth(0).locator('select[name="relation[]"]')).toBeFocused();
  });

  test('reorders cards with move buttons and the drag handle for issue 1009', async ({ page }) => {
    await page.evaluate(() => (window as any).relatedWorkStack.setRelatedWorks([
      { entryKey: 'first', identifier: 'first', relation: 'Cites', relationId: 'cites', identifierType: 'DOI' },
      { entryKey: 'second', identifier: 'second', relation: 'IsDerivedFrom', relationId: 'isDerivedFrom', identifierType: 'URL' },
      { entryKey: 'third', identifier: 'third', relation: 'IsPreviousVersionOf', relationId: 'isPreviousVersionOf', identifierType: 'Handle' }
    ]));

    const cards = page.locator('[data-related-work-entry]');
    await cards.nth(0).locator('[data-related-work-move-down]').click();
    expect(await payloadOrder(page)).toEqual(['second', 'first', 'third']);
    await expect(page.locator('[data-related-work-summary-identifier]')).toHaveText(['second', 'first', 'third']);

    await page.evaluate(() => (window as any).relatedWorkStack.setRelatedWorks([
      { entryKey: 'first', identifier: 'first', relation: 'Cites', relationId: 'cites', identifierType: 'DOI' },
      { entryKey: 'second', identifier: 'second', relation: 'IsDerivedFrom', relationId: 'isDerivedFrom', identifierType: 'URL' },
      { entryKey: 'third', identifier: 'third', relation: 'IsPreviousVersionOf', relationId: 'isPreviousVersionOf', identifierType: 'Handle' }
    ]));

    const sourceBox = await cards.nth(0).locator('[data-related-work-drag]').boundingBox();
    const targetBox = await cards.nth(2).boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height, { steps: 4 });
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height - 4, { steps: 12 });
    await page.mouse.up();

    await expect.poll(() => payloadOrder(page)).toEqual(['second', 'third', 'first']);
    await expect(page.locator('[data-related-work-summary-identifier]')).toHaveText(['second', 'third', 'first']);
  });

  test('auto-detects identifier types, applies patterns, and reveals partial cards on submit validation', async ({ page }) => {
    await page.getByRole('button', { name: 'Add related work' }).click();
    const card = page.locator('[data-related-work-entry]').first();
    const identifier = card.locator('input[name="rIdentifier[]"]');
    const identifierType = card.locator('select[name="rIdentifierType[]"]');

    await identifier.fill('10.5555/zenodo.1234567');
    await identifier.blur();
    await expect(identifierType).toHaveValue('DOI');
    await expect(identifier).toHaveAttribute('pattern', '^10\\.\\d{4,9}\\/.+$');

    await identifier.fill('');
    await identifierType.selectOption('');
    await card.locator('select[name="relation[]"]').selectOption('cites');
    await card.locator('[data-related-work-toggle-edit]').click();
    await page.evaluate(() => {
      (window as any).validateRelatedWorkRequirements({ revealIncomplete: true });
      document.querySelectorAll('.js-required-on-submit').forEach(element => {
        element.setAttribute('required', 'required');
      });
    });

    await expect(card).toHaveAttribute('data-related-work-validation-incomplete', 'true');
    await expect(card.locator('[data-related-work-edit-panel]')).toHaveClass(/show/);
    await expect(card.locator('select[name="relation[]"]')).toHaveAttribute('required', 'required');
    await expect(identifier).toHaveAttribute('required', 'required');
    await expect(identifierType).toHaveAttribute('required', 'required');
  });

  test('imports a generated 101-entry DataCite document in exact order', async ({ page }) => {
    await importRelatedWorksXml(page, buildRelatedWorksXml(101));

    await expect(page.locator('[data-related-work-entry]')).toHaveCount(101);
    const identifiers = await payloadOrder(page);
    expect(identifiers).toHaveLength(101);
    expect(identifiers[0]).toBe('10.1234/generated-001');
    expect(identifiers[100]).toBe('10.1234/generated-101');
    expect(new Set(identifiers).size).toBe(101);
  });

  test('uploads all 401 issue-769 entries with visible progress and no request storm', async ({ page }, testInfo) => {
    const countsBefore = { ...apiRequestCounts.get(page)! };

    await page.evaluate(() => {
      const browserWindow = window as any;
      browserWindow.__issue769Progress = [];
      browserWindow.__issue769StartedAt = 0;
      browserWindow.__issue769ElapsedMs = 0;
      browserWindow.__issue769MemoryBefore = browserWindow.performance?.memory?.usedJSHeapSize ?? null;
      browserWindow.__issue769MemoryAfter = null;
      const relatedWorksImporter = browserWindow.processRelatedWorks;
      browserWindow.loadXmlToForm = async (xmlDocument: Document, options: any) => {
        browserWindow.__issue769StartedAt = performance.now();
        const result = await relatedWorksImporter(xmlDocument, null, {
          batchSize: 50,
          onProgress: (progress: { processed: number; total: number }) => {
            options.onRelatedWorksProgress(progress);
            browserWindow.__issue769Progress.push({
              ...progress,
              spinnerVisible: !document.querySelector('#upload-spinner-overlay')?.classList.contains('d-none'),
              statusVisible: !document.querySelector('#xml-upload-status')?.classList.contains('d-none')
            });
          }
        });
        browserWindow.__issue769ElapsedMs = performance.now() - browserWindow.__issue769StartedAt;
        browserWindow.__issue769MemoryAfter = browserWindow.performance?.memory?.usedJSHeapSize ?? null;
        return result;
      };
    });

    await page.setInputFiles('#input-uploadxml-file', {
      name: 'related-work-issue-769-digis-e-2024-007.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from(issue769Fixture, 'utf8')
    });

    await expect(page.locator('[data-related-work-entry]')).toHaveCount(401, { timeout: 15000 });
    await expect(page.locator('#upload-spinner-overlay')).toHaveClass(/d-none/);

    const result = await page.evaluate(() => {
      const browserWindow = window as any;
      return {
        elapsedMs: browserWindow.__issue769ElapsedMs,
        memoryBefore: browserWindow.__issue769MemoryBefore,
        memoryAfter: browserWindow.__issue769MemoryAfter,
        progress: browserWindow.__issue769Progress,
        identifiers: JSON.parse(
          document.querySelector<HTMLInputElement>('input[name="relatedWorksPayload"]')!.value
        ).map((entry: { identifier: string }) => entry.identifier)
      };
    });

    expect(result.elapsedMs).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeLessThan(15000);
    expect(result.identifiers).toHaveLength(401);
    expect(result.identifiers[0]).toBe('10.5880/digis.e.2024.007.related-001');
    expect(result.identifiers[400]).toBe('10.5880/digis.e.2024.007.related-401');
    expect(new Set(result.identifiers).size).toBe(401);
    expect(result.progress[0]).toEqual(expect.objectContaining({ processed: 0, total: 401 }));
    expect(result.progress.at(-1)).toEqual(expect.objectContaining({ processed: 401, total: 401 }));
    expect(result.progress.some((entry: any) => (
      entry.processed > 0 && entry.processed < 401 && entry.spinnerVisible && entry.statusVisible
    ))).toBe(true);

    const countsAfter = apiRequestCounts.get(page)!;
    expect(countsAfter.relations).toBe(countsBefore.relations);
    expect(countsAfter.identifierTypes).toBe(countsBefore.identifierTypes);
    expect(countsAfter.patterns).toBe(countsBefore.patterns);

    await page.locator('#modal-uploadxml').evaluate(element => {
      (window as any).jQuery(element).trigger('hidden.bs.modal');
    });
    await expect(page.locator('#xml-upload-status')).toHaveClass(/d-none/);

    testInfo.annotations.push({
      type: 'issue-769-baseline',
      description: `401 cards in ${Math.round(result.elapsedMs)} ms; JS heap ${result.memoryBefore ?? 'n/a'} -> ${result.memoryAfter ?? 'n/a'} bytes; no PHP endpoint participates in card rendering`
    });
  });
});
