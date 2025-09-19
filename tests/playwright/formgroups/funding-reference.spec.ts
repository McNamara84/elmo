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
  </head>
  <body>
    <main class="container py-4">
      <form id="form-mde">
        ${template}
      </form>
      <section id="help-fundingreference-funder" aria-live="polite">Funder help text</section>
      <section id="help-fundingreference-grantnumber" aria-live="polite">Grant Number help text</section>
      <section id="help-fundingreference-grantname" aria-live="polite">Grant Name help text</section>
      <section id="help-fundingreference-awarduri" aria-live="polite">Award URI help text</section>
    </main>
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
    await registerStaticAssetRoutes(page);

    await page.route('**/json/funders.json', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FUNDERS_FIXTURE)
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
    await page.waitForLoadState('networkidle');

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
    await expect(secondRow.locator('i.bi-question-circle-fill')).toHaveCount(0);
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
});