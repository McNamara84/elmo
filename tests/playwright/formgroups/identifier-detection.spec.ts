import { test, expect } from '@playwright/test';
import { APP_BASE_URL, registerStaticAssetRoutes } from '../utils';

const names = ['DOI', 'IGSN', 'RAiD', 'arXiv', 'ISBN', 'EAN13', 'Handle', 'URL'];
const types = names.map(name => ({ name, pattern: '.*' }));
const markup = `<!DOCTYPE html><html><head><base href="${APP_BASE_URL}"></head><body>
  <form>${['r', 'r', 'd'].map((prefix, i) => `<div class="row" ${prefix === 'r' ? 'data-related-work-entry' : ''}>
    <label for="identifier-${i}">Identifier ${i}</label><input id="identifier-${i}" name="${prefix}Identifier[]">
    <select aria-label="Identifier type ${i}" name="${prefix}IdentifierType[]"><option value=""></option>
    ${names.map(name => `<option value="${name}">${name}</option>`).join('')}</select></div>`).join('')}</form>
  <script src="node_modules/jquery/dist/jquery.min.js"></script>
  <script src="js/dropdownUtils.js"></script><script src="js/dropdownAjax.js"></script>
  <script src="js/services/identifierDetectionService.js"></script><script type="module" src="js/select.js"></script>
</body></html>`;

test.beforeEach(async ({ page }) => {
  await registerStaticAssetRoutes(page);
  await page.route('**/api/v2/**', route => {
    const url = new URL(route.request().url());
    let response: unknown = [];
    if (url.pathname.endsWith('/identifiertypes/active')) response = { identifierTypes: types };
    if (url.pathname.endsWith('/vocabs/relations')) response = { relations: [] };
    if (url.pathname.endsWith('/identifier-type')) {
      const doi = url.searchParams.get('doi') ?? '';
      const identifierType = doi.includes('gf1211s') ? 'IGSN' : doi.includes('162fda4d') ? 'RAiD' : 'DOI';
      response = { identifierType, status: 'detected', source: 'datacite' };
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.route('**/identifier-detection-harness', route => route.fulfill({ contentType: 'text/html', body: markup }));
  await page.goto(`${APP_BASE_URL}identifier-detection-harness`);
  await page.waitForFunction(() => Boolean((window as any).elmo?.dropdownsReady));
  await page.evaluate(() => (window as any).elmo.dropdownsReady);
});

for (const prefix of ['r', 'd']) {
  for (const [value, expected] of [
    ['10.60510/gf1211s-47', 'IGSN'], ['978-3-510-96872-5', 'ISBN'], ['9783831048069', ''],
    ['https://raid.org/10.82210/162fda4d', 'RAiD'], ['https://arxiv.org/abs/2507.21532', 'arXiv'],
    ['https://doi.org/10.82210/162fda4d', 'RAiD'], ['HTTPS://DOI.ORG/10.60510/gf1211s-47', 'IGSN'],
  ]) {
    test(`${prefix} identifier ${value} selects ${expected || 'no type'} and remains valid`, async ({ page }) => {
      const input = page.locator(`input[name="${prefix}Identifier[]"]`).first();
      const select = page.locator(`select[name="${prefix}IdentifierType[]"]`).first();
      await input.fill(value); await input.blur();
      await expect(select).toHaveValue(expected);
      expect(await input.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(true);
      if (!expected) await expect(page.locator('[data-identifier-detection-status]').first()).toContainText('manually');
    });
  }
}

test('independent rows both detect after simultaneous edits', async ({ page }) => {
  await page.locator('#identifier-0').fill('https://arxiv.org/abs/2507.21532');
  await page.locator('#identifier-1').fill('https://raid.org/10.82210/162fda4d');
  await expect(page.locator('select').nth(0)).toHaveValue('arXiv');
  await expect(page.locator('select').nth(1)).toHaveValue('RAiD');
});

for (const selection of ['RAiD', '']) {
  test(`manual selection ${selection || 'empty'} survives a late lookup`, async ({ page }) => {
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    await page.route('**/api/v2/validation/identifier-type?**', async route => {
      await waiting;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'detected', identifierType: 'IGSN', source: 'datacite' }) });
    });
    const sent = page.waitForRequest('**/api/v2/validation/identifier-type?**');
    await page.locator('#identifier-0').fill('10.60510/gf1211s-47'); await sent;
    await page.locator('select').first().selectOption(selection);
    const response = page.waitForResponse('**/api/v2/validation/identifier-type?**');
    finish(); await response;
    await expect(page.locator('select').first()).toHaveValue(selection);
    await expect(page.locator('[data-identifier-detection-status]').first()).toBeHidden();
  });
}

test('a failed required lookup never selects DOI or URL', async ({ page }) => {
  await page.route('**/api/v2/validation/identifier-type?**', route => route.fulfill({ status: 504, contentType: 'application/json', body: '{}' }));
  await page.locator('#identifier-0').fill('10.60510/gf1211s-47');
  await expect(page.locator('[data-identifier-detection-status]').first()).toContainText('manually');
  await expect(page.locator('select').first()).toHaveValue('');
});

test('manual EAN13 validates its checksum in an actual browser', async ({ page }) => {
  const input = page.locator('#identifier-0');
  await input.fill('9783831048069'); await page.locator('select').first().selectOption('EAN13');
  expect(await input.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(true);
  await input.fill('9783831048068');
  await page.locator('select').first().selectOption('EAN13');
  expect(await input.evaluate(element => (element as HTMLInputElement).validity.customError)).toBe(true);
});
