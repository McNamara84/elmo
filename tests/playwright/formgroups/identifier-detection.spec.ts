import { test, expect, type Page } from '@playwright/test';
import { APP_BASE_URL, registerStaticAssetRoutes } from '../utils';
import types from '../../fixtures/identifier-types.json';

const names = ['DOI', 'IGSN', 'RAiD', 'arXiv', 'ISBN', 'EAN13', 'Handle', 'URL'];
const diagnostics = new WeakMap<Page, string[]>();
const markup = `<!DOCTYPE html><html><head><base href="${APP_BASE_URL}"><link rel="icon" href="data:,"></head><body>
  <form>${['r', 'r', 'd'].map((prefix, i) => `<div class="row" ${prefix === 'r' ? 'data-related-work-entry' : ''}>
    <label for="identifier-${i}">Identifier ${i}</label><input id="identifier-${i}" name="${prefix}Identifier[]">
    <select aria-label="Identifier type ${i}" name="${prefix}IdentifierType[]"><option value=""></option>
    ${names.map(name => `<option value="${name}">${name}</option>`).join('')}</select></div>`).join('')}</form>
  <script src="node_modules/jquery/dist/jquery.min.js"></script>
  <script src="js/dropdownUtils.js"></script><script src="js/dropdownAjax.js"></script>
  <script src="js/checkMandatoryFields.js"></script>
  <script src="js/services/identifierDetectionService.js"></script><script type="module" src="js/select.js"></script>
</body></html>`;

test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  diagnostics.set(page, messages);
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => messages.push(`pageerror: ${error.message}`));
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
  for (const grouped of [false, true]) {
    test(`${prefix} manual selection rejects ${grouped ? 'grouped' : 'flat'} empty ERNIE definitions`, async ({ page }) => {
      const definition = grouped ? {name: 'IGSN', pattern: '^.*$', patterns: {validation: []}}
        : {name: 'IGSN', pattern: ''};
      await page.route('**/api/v2/validation/identifiertypes/active', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify({identifierTypes: types.map(type => type.name === 'IGSN' ? definition : type)}),
      }));
      await page.evaluate(() => (window as any).initializeAllDropdownsParallel());
      const input = page.locator(`input[name="${prefix}Identifier[]"]`).first();
      const dropdown = page.locator(`select[name="${prefix}IdentifierType[]"]`).first();
      await input.fill('arbitrary-identifier'); await dropdown.selectOption('IGSN');
      expect(await input.evaluate(element => (element as HTMLInputElement).validity.customError)).toBe(true);
      expect(await input.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(false);
      await page.unroute('**/api/v2/validation/identifiertypes/active');
      await page.evaluate(() => (window as any).initializeAllDropdownsParallel());
      await input.fill('GFZABC123'); await dropdown.selectOption('IGSN');
      expect(await input.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(true);
    });
  }

  test(`${prefix} a missing legacy pattern cannot validate a manually selected type`, async ({ page }) => {
    await page.route('**/api/v2/validation/identifiertypes/active', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({identifierTypes: types.filter(type => type.name !== 'IGSN')}),
    }));
    await page.route('**/api/v2/validation/patterns/IGSN', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({pattern: ''}),
    }));
    await page.evaluate(() => (window as any).initializeAllDropdownsParallel());
    const input = page.locator(`input[name="${prefix}Identifier[]"]`).first();
    const dropdown = page.locator(`select[name="${prefix}IdentifierType[]"]`).first();
    await dropdown.evaluate(element => {
      const select = element as HTMLSelectElement;
      if (![...select.options].some(option => option.value === 'IGSN')) select.add(new Option('IGSN', 'IGSN'));
    });
    await input.fill('arbitrary-identifier');
    const response = page.waitForResponse('**/api/v2/validation/patterns/IGSN');
    await dropdown.selectOption('IGSN'); await response;
    await expect.poll(() => input.evaluate(element => (element as HTMLInputElement).validity.customError)).toBe(true);
    expect(await input.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(false);
  });

  test(`${prefix} fields follow changed ERNIE patterns after vocabulary reload`, async ({ page }) => {
    const input = page.locator(`input[name="${prefix}Identifier[]"]`).first();
    const dropdown = page.locator(`select[name="${prefix}IdentifierType[]"]`).first();
    await input.fill('https://arxiv.org/abs/2507.21532'); await input.blur();
    await expect(dropdown).toHaveValue('arXiv');
    const changed = types.map(type => type.name === 'arXiv'
      ? {name: type.name, pattern: '^central-new-format$'} : type);
    await page.route('**/api/v2/validation/identifiertypes/active', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({identifierTypes: changed}),
    }));
    await page.evaluate(() => (window as any).initializeAllDropdownsParallel());
    await expect(dropdown).toHaveValue('arXiv');
    expect(await input.evaluate(element => (element as HTMLInputElement).validity.customError)).toBe(true);
    await page.unroute('**/api/v2/validation/identifiertypes/active');
    await page.evaluate(() => (window as any).initializeAllDropdownsParallel());
    expect(await input.evaluate(element => (element as HTMLInputElement).validity.customError)).toBe(false);
    await page.route('**/api/v2/validation/identifiertypes/active', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({identifierTypes: changed}),
    }));
    await page.evaluate(() => (window as any).initializeAllDropdownsParallel());
    await input.fill('central-new-format'); await input.blur();
    await expect(dropdown).toHaveValue('arXiv');
    expect(await input.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(true);
  });

  test(`${prefix} whitespace validity survives blur of another field`, async ({ page }) => {
    const input = page.locator(`input[name="${prefix}Identifier[]"]`).first();
    const dropdown = page.locator(`select[name="${prefix}IdentifierType[]"]`).first();
    await input.fill('   '); await dropdown.selectOption('IGSN');
    expect(await input.evaluate(element => (element as HTMLInputElement).validity.customError)).toBe(true);
    await page.evaluate(() => {
      const other = document.createElement('input'); other.name = 'title[]';
      document.body.append(other); other.focus(); other.blur();
    });
    expect(await input.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(false);
  });

  for (const change of ['disabled', 'narrowed']) {
    test(`${prefix} pending registry lookup respects ${change} ERNIE type after reload`, async ({ page }) => {
      let finish!: () => void;
      const waiting = new Promise<void>(resolve => { finish = resolve; });
      await page.route('**/api/v2/validation/identifier-type?**', async route => {
        await waiting;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({status: 'detected', identifierType: 'IGSN', source: 'datacite'}) });
      });
      const input = page.locator(`input[name="${prefix}Identifier[]"]`).first();
      const dropdown = page.locator(`select[name="${prefix}IdentifierType[]"]`).first();
      const sent = page.waitForRequest('**/api/v2/validation/identifier-type?**');
      await input.fill('10.60510/gf1211s-47'); await sent;
      const changed = change === 'disabled' ? types.filter(type => type.name !== 'IGSN')
        : types.map(type => type.name === 'IGSN' ? {name: type.name, pattern: '^legacy-only$'} : type);
      await page.route('**/api/v2/validation/identifiertypes/active', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify({identifierTypes: changed}),
      }));
      await page.evaluate(() => (window as any).initializeAllDropdownsParallel());
      const response = page.waitForResponse('**/api/v2/validation/identifier-type?**');
      finish(); await response;
      await expect(input.locator('..').locator('[data-identifier-detection-status]')).toContainText('manually');
      await expect(dropdown).toHaveValue('');
      if (change === 'disabled' && prefix === 'r') await expect(dropdown.locator('option[value="IGSN"]')).toHaveCount(0);
    });
  }

  test(`${prefix} detection and manual choices produce no browser warnings or errors`, async ({ page }) => {
    const input = page.locator(`input[name="${prefix}Identifier[]"]`).first();
    const select = page.locator(`select[name="${prefix}IdentifierType[]"]`).first();
    for (const [value, expected] of [
      ['https://arxiv.org/abs/2507.21532', 'arXiv'],
      ['10.60510/gf1211s-47', 'IGSN'],
      ['9783831048069', ''],
    ]) {
      await input.fill(value); await input.blur();
      await expect(select).toHaveValue(expected);
    }
    await select.selectOption('EAN13');
    await expect(select).toHaveValue('EAN13');

    // An unknown registry record has a successful HTTP response and a manual-choice hint.
    await page.route('**/api/v2/validation/identifier-type?**', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'unknown', identifierType: null, source: null }),
    }));
    await input.fill('10.9999/unconfirmed'); await input.blur();
    await expect(input.locator('..').locator('[data-identifier-detection-status]')).toContainText('manually');
    await expect(select).toHaveValue('');
    expect(diagnostics.get(page)).toEqual([]);
  });
}

for (const prefix of ['r', 'd']) {
  for (const [value, expected] of [
    ['10.60510/gf1211s-47', 'IGSN'], ['978-3-510-96872-5', 'ISBN'], ['9783831048069', ''],
    ['https://raid.org/10.82210/162fda4d', 'RAiD'], ['https://arxiv.org/abs/2507.21532', 'arXiv'],
    ['https://doi.org/10.82210/162fda4d', 'RAiD'], ['HTTPS://DOI.ORG/10.60510/gf1211s-47', 'IGSN'],
    ['https://doi.org/10.60510/gf1211s%2D47', 'IGSN'],
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
