import { test, expect } from '@playwright/test';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { APP_BASE_URL, registerStaticAssetRoutes, REPO_ROOT, SELECTORS } from '../utils';
const TEST_ROUTE = 'funding-reference-harness';

const FUNDING_REFERENCE_TEMPLATE = fs.readFile(path.join(REPO_ROOT, 'formgroups/fundingreference.html'), 'utf8');

const FUNDERS_FIXTURE = [
  { crossRefId: '100000001', name: 'National Science Foundation' },
  { crossRefId: '100000010', name: 'Ford Foundation' },
  { crossRefId: '100000012', name: 'Gordon and Betty Moore Foundation' }
];

let fundersRequestCount = 0;
let fundersResponseStatus = 200;
let holdFundersResponse = false;
let fundersResponseGate: Promise<void>;
let releaseFundersResponse: () => void;

async function buildHarnessPage(): Promise<string> {
  const template = await FUNDING_REFERENCE_TEMPLATE;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Funding Reference Test Harness</title>
    <base href="${APP_BASE_URL}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.css">
    <link rel="stylesheet" href="node_modules/jquery-ui/dist/themes/base/jquery-ui.min.css">
    <link rel="stylesheet" href="css/gfz-cd.css">
  </head>
  <body>
    <main id="main-content" class="container-fluid my-3">
      <form id="form-mde">
        ${template}
      </form>
      <section id="help-fundingreference-funder" aria-live="polite">Funder help text</section>
      <section id="help-fundingreference-grantnumber" aria-live="polite">Grant Number help text</section>
      <section id="help-fundingreference-grantname" aria-live="polite">Grant Name help text</section>
      <section id="help-fundingreference-awarduri" aria-live="polite">Award URI help text</section>
    </main>
    <!-- Fixed Footer with action buttons (same as production footer.html) -->
    <footer class="footer mt-auto py-0 fixed-bottom">
      <div class="container">
        <div class="row">
          <div class="col d-flex flex-column flex-lg-row align-items-center justify-content-between gap-3 flex-wrap">
            <div class="d-flex align-items-center justify-content-center flex-wrap gap-2">
              <button type="button" class="btn btn-danger m-1" id="button-form-reset">Clear</button>
              <button class="btn btn-primary m-1" type="button" id="button-form-load">Load</button>
              <button type="submit" class="btn btn-warning m-1" id="button-form-save">Save</button>
              <button type="submit" class="btn btn-success m-1" id="button-form-submit">Submit</button>
            </div>
            <div class="autosave-status" id="autosave-status" role="status" aria-live="polite">
              <span class="autosave-status__indicator" aria-hidden="true"></span>
              <div class="autosave-status__text">
                <span class="autosave-status__heading">Autosave</span>
                <span id="autosave-status-text">Autosave ready.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
    <script>
      window.translations = { funding: { title: 'Funding Reference' }, general: {} };
    </script>
    <script src="node_modules/jquery/dist/jquery.min.js"></script>
    <script src="node_modules/jquery-ui/dist/jquery-ui.min.js"></script>
    <script src="js/checkMandatoryFields.js"></script>
    <script src="js/select.js"></script>
    <script type="module" src="js/eventhandlers/functions.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/fundingreference.js"></script>
  </body>
</html>`;
}

test.describe('Funding Reference form group', () => {
  test.beforeEach(async ({ page }) => {
    fundersRequestCount = 0;
    fundersResponseStatus = 200;
    holdFundersResponse = false;
    fundersResponseGate = new Promise(resolve => {
      releaseFundersResponse = resolve;
    });

    await registerStaticAssetRoutes(page);

    await page.route('**/json/funders.json', async route => {
      fundersRequestCount += 1;
      if (holdFundersResponse) {
        await fundersResponseGate;
      }

      await route.fulfill({
        status: fundersResponseStatus,
        contentType: 'application/json',
        body: fundersResponseStatus === 200 ? JSON.stringify(FUNDERS_FIXTURE) : JSON.stringify({ error: 'unavailable' })
      });
    });

    await page.route(`**/${TEST_ROUTE}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: await buildHarnessPage()
      });
    });

    await page.goto(`${APP_BASE_URL}${TEST_ROUTE}`, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => {
      const $ = (window as any).jQuery;
      const funderInput = document.querySelector('#input-funder');
      return Boolean($ && $.fn && $.fn.autocomplete && funderInput && $(funderInput).data('ui-autocomplete'));
    });

    await page.evaluate(() => {
      document.querySelectorAll('.input-group-text').forEach(element => {
        const el = element as HTMLElement;
        el.style.display = 'flex';
        el.style.visibility = 'visible';
      });
    });
  });

  test.afterEach(() => {
    releaseFundersResponse();
  });

  test('defers CFID funder data until first interaction and reuses one request', async ({ page }) => {
    expect(fundersRequestCount).toBe(0);

    holdFundersResponse = true;
    const rows = page.locator(`${SELECTORS.formGroups.fundingReference} [funding-reference-row]`);
    const firstFunderInput = rows.first().locator('.inputFunder');

    await firstFunderInput.focus();
    await expect.poll(() => fundersRequestCount).toBe(1);

    await firstFunderInput.fill('Gordon');
    releaseFundersResponse();

    const firstDropdown = page.locator('ul.ui-autocomplete')
      .filter({ hasText: 'Gordon and Betty Moore Foundation' })
      .first();
    await expect(firstDropdown).toBeVisible();
    await firstDropdown.locator('li', { hasText: 'Gordon and Betty Moore Foundation' }).first().click();

    await expect(firstFunderInput).toHaveValue('Gordon and Betty Moore Foundation');
    await expect(rows.first().locator('.inputFunderId')).toHaveValue('100000012');
    await expect(rows.first().locator('.inputFunderIdTyp')).toHaveValue('crossref');

    await page.locator('#button-fundingreference-add').click();
    await expect(rows).toHaveCount(2);

    const secondFunderInput = rows.nth(1).locator('.inputFunder');
    await secondFunderInput.fill('Ford');
    const secondDropdown = page.locator('ul.ui-autocomplete')
      .filter({ hasText: 'Ford Foundation' })
      .first();
    await expect(secondDropdown).toBeVisible();

    expect(fundersRequestCount).toBe(1);
  });

  test('handles an unavailable CFID funder file without an unhandled page error', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    fundersResponseStatus = 503;

    const funderInput = page.locator('#input-funder');
    await funderInput.focus();
    await expect.poll(() => fundersRequestCount).toBe(1);
    await funderInput.fill('Gordon');

    await page.waitForFunction(() => {
      const $ = (window as any).jQuery;
      const input = document.querySelector('#input-funder');
      const instance = $ && input ? $(input).autocomplete('instance') : null;
      return instance && instance.term === 'Gordon' && instance.pending === 0;
    });

    await expect(page.locator('ul.ui-autocomplete:visible')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('keeps local funder data unloaded in ROR mode', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).ELMO_FEATURES = { funderPidMode: 'ROR' };
    });
    await page.route('**/api/v2/affiliations/search**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'https://ror.org/04z8jg394', name: 'GFZ Helmholtz Centre for Geosciences' }
        ])
      });
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const $ = (window as any).jQuery;
      const input = document.querySelector('#input-funder');
      return Boolean($ && input && $(input).data('ui-autocomplete'));
    });

    const funderInput = page.locator('#input-funder');
    await funderInput.fill('Helmholtz');

    const dropdown = page.locator('ul.ui-autocomplete')
      .filter({ hasText: 'GFZ Helmholtz Centre for Geosciences' })
      .first();
    await expect(dropdown).toBeVisible();
    expect(fundersRequestCount).toBe(0);
  });

  test('renders accessible inputs, help affordances, and validation hooks', async ({ page }) => {
    await expect(page.locator('b[data-translate="funding.title"]')).toHaveText('Funding Reference');

    const rows = page.locator(`${SELECTORS.formGroups.fundingReference} [funding-reference-row]`);
    await expect(rows).toHaveCount(1);

    const funderInput = rows.first().locator('input.inputFunder');
    await expect(funderInput).toHaveAttribute('name', 'funder[]');
    await expect(funderInput).toHaveAttribute('autocomplete', 'off');

    const hiddenId = rows.first().locator('input.inputFunderId');
    await expect(hiddenId).toHaveAttribute('type', 'hidden');
    await expect(hiddenId).toHaveValue('');

    const hiddenIdType = rows.first().locator('input.inputFunderIdTyp');
    await expect(hiddenIdType).toHaveAttribute('type', 'hidden');
    await expect(hiddenIdType).toHaveValue('');

    await expect(rows.first().locator('#input-grantnumber')).toHaveAttribute('name', 'grantNummer[]');
    await expect(rows.first().locator('#input-grantname')).toHaveAttribute('name', 'grantName[]');

    const awardUriInput = rows.first().locator('#input-awarduri');
    await expect(awardUriInput).toHaveAttribute(
      'pattern',
      '^(http(s)?:\\/\\/)?(www\\.)?[a-zA-Z0-9\\-\\.]+(\\.[a-zA-Z]{2,})+(\\/[^\\s]*)?$'
    );

    await expect(rows.first().locator('.invalid-feedback')).toHaveCount(2);

    await expect(rows.first().locator('i.bi-question-circle-fill')).toHaveCount(4);
    await expect(rows.first().locator('button.addFundingReference')).toBeVisible();
  });

  test('supports autocomplete, dynamic row management, and award URI validation', async ({ page }) => {
    const rows = page.locator(`${SELECTORS.formGroups.fundingReference} [funding-reference-row]`);
    const firstRow = rows.first();
    const funderInput = firstRow.locator('.inputFunder');

    await funderInput.click();
    await funderInput.type('Gordon');
    const firstDropdown = page.locator('ul.ui-autocomplete').filter({ hasText: 'Gordon and Betty Moore Foundation' }).first();
    await expect(firstDropdown).toBeVisible();
    await firstDropdown.locator('li', { hasText: 'Gordon and Betty Moore Foundation' }).first().click();

    await expect(funderInput).toHaveValue('Gordon and Betty Moore Foundation');
    await expect(firstRow.locator('.inputFunderId')).toHaveValue('100000012');
    await expect(firstRow.locator('.inputFunderIdTyp')).toHaveValue('crossref');

    const awardUriInput = firstRow.locator('#input-awarduri');
    await awardUriInput.fill('not-a-valid-url');
    const isInvalid = await awardUriInput.evaluate(element => !(element as HTMLInputElement).checkValidity());
    expect(isInvalid).toBe(true);

    await awardUriInput.fill('https://example.org/grant/123');
    const isValid = await awardUriInput.evaluate(element => (element as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);

    await page.locator('#button-fundingreference-add').click();
    await expect(rows).toHaveCount(2);

    const secondRow = rows.nth(1);
    await expect(secondRow.locator('.removeButton')).toBeVisible();
    const placeholders = secondRow.locator('.help-placeholder i.bi-question-circle-fill');
    await expect(placeholders).toHaveCount(4);
    for (let idx = 0; idx < 4; idx++) {
      await expect(placeholders.nth(idx)).not.toBeVisible();
    }
    await expect(secondRow.locator('.help-placeholder')).toHaveCount(4);

    const secondFunderInput = secondRow.locator('.inputFunder');
    await secondFunderInput.click();
    await secondFunderInput.type('Ford');
    const secondDropdown = page.locator('ul.ui-autocomplete').filter({ hasText: 'Ford Foundation' }).first();
    await expect(secondDropdown).toBeVisible();
    await secondDropdown.locator('li', { hasText: 'Ford Foundation' }).first().click();
    await expect(secondRow.locator('.inputFunderId')).toHaveValue('100000010');
    await expect(secondRow.locator('.inputFunderIdTyp')).toHaveValue('crossref');

    const secondRowHasRequired = await secondRow.evaluate(row =>
      Array.from(row.querySelectorAll('input')).some(input => input.hasAttribute('required'))
    );
    expect(secondRowHasRequired).toBe(false);

    await secondRow.locator('.removeButton').click();
    await expect(rows).toHaveCount(1);
    await expect(firstRow.locator('.inputFunder')).toHaveValue('Gordon and Betty Moore Foundation');
  });

  test('add button is clickable and not obscured at all Bootstrap breakpoints', async ({ page }) => {
    // Bootstrap breakpoints to test
    const breakpoints = [
      { name: 'xs', width: 375, height: 667 },   // Mobile (iPhone SE)
      { name: 'sm', width: 576, height: 800 },   // Small tablets
      { name: 'md', width: 768, height: 1024 },  // Tablets
      { name: 'lg', width: 992, height: 800 },   // Small laptops
      { name: 'xl', width: 1200, height: 900 },  // Desktops
      { name: 'xxl', width: 1400, height: 900 }  // Large desktops
    ];

    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      // Scroll to the add button to ensure it's in view
      const addButton = page.locator('#button-fundingreference-add');
      await addButton.scrollIntoViewIfNeeded();

      // Verify the button is visible
      await expect(addButton, `Add button should be visible at ${bp.name} (${bp.width}px)`).toBeVisible();

      // Get the initial row count
      const rows = page.locator(`${SELECTORS.formGroups.fundingReference} [funding-reference-row]`);
      const initialCount = await rows.count();

      // Click the add button - this will fail if the button is obscured
      await addButton.click({ timeout: 5000 });

      // Verify a new row was added
      await expect(rows, `Row should be added after clicking at ${bp.name} (${bp.width}px)`).toHaveCount(initialCount + 1);

      // Clean up: remove the added row to reset state for next breakpoint
      // The remove button should always be visible on newly added rows (see fundingreference.js)
      const lastRow = rows.last();
      const removeButton = lastRow.locator('.removeButton');
      await expect(removeButton, `Remove button should be visible at ${bp.name} (${bp.width}px)`).toBeVisible();
      await removeButton.click();
      await expect(rows).toHaveCount(initialCount);
    }
  });

  test('clears hidden funder values when the visible funder input is cleared', async ({ page }) => {
    const firstRow = page.locator(`${SELECTORS.formGroups.fundingReference} [funding-reference-row]`).first();
    const funderInput = firstRow.locator('.inputFunder');
    const funderIdInput = firstRow.locator('.inputFunderId');
    const funderIdTypeInput = firstRow.locator('.inputFunderIdTyp');

    await funderInput.click();
    await funderInput.type('Gordon');

    const dropdown = page.locator('ul.ui-autocomplete').filter({ hasText: 'Gordon and Betty Moore Foundation' }).first();
    await expect(dropdown).toBeVisible();
    await dropdown.locator('li', { hasText: 'Gordon and Betty Moore Foundation' }).first().click();

    await expect(funderInput).toHaveValue('Gordon and Betty Moore Foundation');
    await expect(funderIdInput).toHaveValue('100000012');
    await expect(funderIdTypeInput).toHaveValue('crossref');

    await funderInput.fill('');

    await expect(funderInput).toHaveValue('');
    await expect(funderIdInput).toHaveValue('');
    await expect(funderIdTypeInput).toHaveValue('');
  });
});
