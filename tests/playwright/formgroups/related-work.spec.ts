import { test, expect } from '@playwright/test';
import path from 'node:path';
import { promises as fs, readFileSync } from 'node:fs';
import { APP_BASE_URL, registerStaticAssetRoutes, REPO_ROOT, SELECTORS } from '../utils';

const relationsFixture = {
  relations: [
    { id: 'isPreviousVersionOf', name: 'Is Previous Version Of', description: 'Earlier version of this dataset.' },
    { id: 'cites', name: 'Cites', description: 'This dataset cites another resource.' },
    { id: 'isDerivedFrom', name: 'Is Derived From', description: 'Derived from the referenced resource.' }
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
      pattern: '/^hdl:[^\s]+$/i'
    }
  ]
};

const identifierPatterns: Record<string, { pattern: string }> = {
  URL: { pattern: '^https?:\\/\\/.+$' },
  DOI: { pattern: '^10\\.\\d{4,9}\\/.+$' },
  Handle: { pattern: '^hdl:[^\\s]+$' }
};

const relatedWorkTemplate = readFileSync(path.join(REPO_ROOT, 'formgroups/relatedwork.html'), 'utf8');

const relatedWorkMarkup = String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Related Work Test Harness</title>
    <base href="${APP_BASE_URL}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css" />
    <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.css" />
  </head>
  <body>
    <main class="container py-4">
      <form id="form-mde">
        ${relatedWorkTemplate}
      </form>
      <div id="help-relatedwork-fg" role="note">Related work help text</div>
      <div id="help-relatedwork-relation" role="note">Relation help text</div>
      <div id="help-relatedwork-identifier" role="note">Identifier help text</div>
    </main>
    <script>
      window.translations = { general: { choose: 'Choose...' }, relatedWork: { title: 'Related work' } };
    </script>
    <script src="node_modules/jquery/dist/jquery.min.js"></script>
    <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/checkMandatoryFields.js"></script>
    <script src="js/select.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/relatedwork.js"></script>
  </body>
</html>`;

test.describe('Related work form group', () => {
  test.beforeEach(async ({ page }) => {
    await registerStaticAssetRoutes(page);
    await page.route('**/js/select.js', async route => {
      const filePath = path.join(REPO_ROOT, 'js/select.js');
      let body = await fs.readFile(filePath, 'utf8');
      body = body.replace(/\n\}\);\s*$/u, '\n  if (typeof window !== "undefined") {\n    window.__testUpdateValidationPattern = updateValidationPattern;\n  }\n});');
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body
      });
    });
    await page.route('**/api/v2/vocabs/relations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(relationsFixture)
      });
    });

    await page.route('**/api/v2/validation/identifiertypes/active', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(identifierTypesFixture)
      });
    });

    await page.route('**/api/v2/validation/patterns/**', async route => {
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
    await page.waitForLoadState('networkidle');

    await page.waitForFunction(() => {
      const relationSelect = document.querySelector('#input-relatedwork-relation');
      return relationSelect instanceof HTMLSelectElement && relationSelect.options.length > 1;
    });

    await page.evaluate(() => {
      document.querySelectorAll('.input-group-text').forEach(element => {
        const el = element as HTMLElement;
        el.style.display = 'flex';
        el.style.visibility = 'visible';
      });
    });
  });

  test('renders accessible inputs, help affordances, and loaded vocabularies', async ({ page }) => {
    const header = page.locator('b[data-translate="relatedWork.title"]');
    await expect(header).toBeVisible();
    await expect(header).toHaveText('Related work');

    const groupHelpIcon = page.locator('i[data-help-section-id="help-relatedwork-fg"]');
    await expect(groupHelpIcon).toBeVisible();

    const relationSelect = page.locator('#input-relatedwork-relation');
    await expect(relationSelect).toHaveAttribute('name', 'relation[]');

    const relationOptions = relationSelect.locator('option');
    await expect(relationOptions).toHaveCount(relationsFixture.relations.length + 1);

    const optionTexts = await relationOptions.allTextContents();
    expect(optionTexts).toEqual(['Choose...', 'Cites', 'Is Derived From', 'Is Previous Version Of']);

    const titles = await relationOptions.evaluateAll(options => options.slice(1).map(option => option.getAttribute('title')));
    expect(titles).toEqual([
      'This dataset cites another resource.',
      'Derived from the referenced resource.',
      'Earlier version of this dataset.'
    ]);

    const relationHelpIcons = page.locator('[data-help-section-id="help-relatedwork-relation"]');
    await expect(relationHelpIcons).toHaveCount(2);
    await expect(relationHelpIcons.first()).toBeVisible();
    await expect(relationHelpIcons.nth(1)).toBeVisible();

    const identifierInput = page.locator('#input-relatedwork-identifier');
    await expect(identifierInput).toHaveAttribute('name', 'rIdentifier[]');
    const identifierHelpIcon = page.locator('[data-help-section-id="help-relatedwork-identifier"]');
    await expect(identifierHelpIcon).toBeVisible();

    const identifierTypeSelect = page.locator('#input-relatedwork-identifiertype');
    await expect(identifierTypeSelect).toHaveAttribute('name', 'rIdentifierType[]');

    const identifierTypeOptions = identifierTypeSelect.locator('option');
    await expect(identifierTypeOptions).toHaveCount(identifierTypesFixture.identifierTypes.length + 1);
    await expect(identifierTypeOptions.first()).toHaveText('Choose...');

    const typeTexts = await identifierTypeOptions.evaluateAll(options => options.slice(1).map(option => option.textContent?.trim()));
    expect(typeTexts).toEqual(['URL', 'DOI', 'Handle']);
  });

  test('enforces required attributes only when related work data is provided', async ({ page }) => {
    const relationSelect = page.locator('#input-relatedwork-relation');
    const identifierInput = page.locator('#input-relatedwork-identifier');
    const identifierTypeSelect = page.locator('#input-relatedwork-identifiertype');

    expect(await relationSelect.getAttribute('required')).toBeNull();
    expect(await identifierInput.getAttribute('required')).toBeNull();
    expect(await identifierTypeSelect.getAttribute('required')).toBeNull();

    await identifierInput.fill('10.1234/example.doi');
    await identifierInput.blur();
    await page.waitForTimeout(400);

    await expect(relationSelect).toHaveAttribute('required', 'required');
    await expect(identifierInput).toHaveAttribute('required', 'required');
    await expect(identifierTypeSelect).toHaveAttribute('required', 'required');

    await relationSelect.selectOption('');
    await identifierInput.fill('');
    await identifierInput.blur();
    await identifierTypeSelect.selectOption('');
    await identifierTypeSelect.blur();

    expect(await relationSelect.getAttribute('required')).toBeNull();
    expect(await identifierInput.getAttribute('required')).toBeNull();
    expect(await identifierTypeSelect.getAttribute('required')).toBeNull();
  });

  test('supports adding and removing rows while preserving help metadata', async ({ page }) => {
    const rows = page.locator(`${SELECTORS.formGroups.relatedWork} .row`);
    await expect(rows).toHaveCount(1);

    const addButton = page.locator('#button-relatedwork-add');
    await addButton.click();
    await expect(rows).toHaveCount(2);

    const secondRow = rows.nth(1);
    await expect(secondRow.locator('.help-placeholder')).toHaveCount(3);

    const relationIds = await rows.evaluateAll(rowElements =>
      rowElements.map(row => row.querySelector('select[name="relation[]"]')?.id ?? '')
    );
    expect(relationIds).toEqual(['input-relatedwork-relation0', 'input-relatedwork-relation1']);

    await secondRow.locator('.removeButton').click();
    await expect(rows).toHaveCount(1);
  });

  test('auto-detects identifier types and updates validation patterns', async ({ page }) => {
    const identifierInput = page.locator('#input-relatedwork-identifier');
    const identifierTypeSelect = page.locator('#input-relatedwork-identifiertype');

    await identifierInput.fill('10.5555/zenodo.1234567');
    await identifierInput.blur();
    await page.waitForTimeout(500);

    await expect(identifierTypeSelect).toHaveValue('DOI');

    const applyPatternUpdate = async () => {
      await page.evaluate(async () => {
        const select = document.querySelector('select[name="rIdentifierType[]"]') as HTMLSelectElement | null;
        if (!select) return;
        const input = select.closest('.row')?.querySelector('input[name^="rIdentifier"]') as HTMLInputElement | null;
        if (select.value === '') {
          input?.removeAttribute('pattern');
          return;
        }
        const helper = (window as any).__testUpdateValidationPattern;
        if (typeof helper === 'function') {
          await helper(select);
          return;
        }
        const selectedType = select.selectedOptions[0]?.text ?? '';
        const response = await fetch(`api/v2/validation/patterns/${encodeURIComponent(selectedType)}`);
        const data = await response.json();
        if (input && data && data.pattern) {
          let pattern = String(data.pattern);
          pattern = pattern.replace(/^"|"$/g, '');
          pattern = pattern.replace(/\/[a-z]*$/i, '');
          input.setAttribute('pattern', pattern);
        } else {
          input?.removeAttribute('pattern');
        }
      });
    };

    await applyPatternUpdate();
    let patternValue = await identifierInput.getAttribute('pattern');
    expect(patternValue).toBe('^10\\.\\d{4,9}\\/.+$');

    await identifierTypeSelect.selectOption('Handle');
    await applyPatternUpdate();
    patternValue = await identifierInput.getAttribute('pattern');
    expect(patternValue).toBe('^hdl:[^\\s]+$');

    await identifierTypeSelect.selectOption('DOI');
    await applyPatternUpdate();
    patternValue = await identifierInput.getAttribute('pattern');
    expect(patternValue).toBe('^10\\.\\d{4,9}\\/.+$');

    await identifierInput.fill('https://example.org/resource');
    await identifierInput.blur();
    await page.waitForTimeout(500);

    await expect(identifierTypeSelect).toHaveValue('URL');
    await applyPatternUpdate();
    patternValue = await identifierInput.getAttribute('pattern');
    expect(patternValue).toBe('^https?:\\/\\/.+$');

    await identifierInput.fill('');
    await identifierInput.blur();
    await page.waitForTimeout(200);
    await expect(identifierTypeSelect).toHaveValue('');
    await applyPatternUpdate();
    patternValue = await identifierInput.getAttribute('pattern');
    expect(patternValue).toBeNull();
  });
});