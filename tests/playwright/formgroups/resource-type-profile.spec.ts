import { test, expect } from '@playwright/test';
import { registerStaticAssetRoutes } from '../utils';

// Browser compatibility with the unchanged ELMO API shape. Profile selection
// and the separate server-side caches are covered by ErnieServiceTest.
const profileResponses = {
  elmo: [
    { id: 4, resource_type_general: 'Dataset', description: 'Research data' },
    { id: 9, resource_type_general: 'Computational Notebook', description: null },
  ],
  'elmo-msl': [
    { id: 14, resource_type_general: 'Dataset', description: 'Research data' },
    { id: 33, resource_type_general: 'Physical Object', description: 'A sample or specimen' },
  ],
};

for (const [profile, response] of Object.entries(profileResponses)) {
  test('resource types render and reload without console warnings for ' + profile, async ({ page }, testInfo) => {
    const messages: string[] = [];
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) {
        messages.push(message.type() + ': ' + message.text());
      }
    });
    page.on('pageerror', error => messages.push('pageerror: ' + error.message));

    const baseURL = new URL(testInfo.project.use.baseURL ?? 'http://localhost:8080/').href;
    await registerStaticAssetRoutes(page);
    await page.route('**/api/v2/**', route => route.fulfill({ json: [] }));
    await page.route('**/json/timezones.json', route => route.fulfill({ json: [] }));
    await page.route('**/api/v2/vocabs/resourcetypes', route => route.fulfill({ json: response }));
    await page.route('**/__resource_type_profile__', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: [
        '<!doctype html><html lang="en"><head><meta charset="utf-8">',
        '<base href="' + baseURL + '"><link rel="icon" href="data:,"></head><body>',
        '<label for="input-resourceinformation-resourcetype">Resource Type</label>',
        '<select id="input-resourceinformation-resourcetype"></select>',
        '<script src="node_modules/jquery/dist/jquery.min.js"></script>',
        '<script src="js/dropdownUtils.js"></script>',
        '<script src="js/dropdownAjax.js"></script>',
        '<script src="js/services/identifierDetectionService.js"></script>',
        '<script type="module" src="js/select.js"></script>',
        '</body></html>',
      ].join(''),
    }));
    await page.goto(new URL('__resource_type_profile__', baseURL).href);
    await page.waitForFunction(() => Boolean(
      (window as Window & { elmo?: { dropdownsReady?: Promise<void> } }).elmo?.dropdownsReady
    ));
    await page.evaluate(() => (window as Window & { elmo: { dropdownsReady: Promise<void> } }).elmo.dropdownsReady);

    const select = page.locator('#input-resourceinformation-resourcetype');
    // The first pass checks normal parallel initialization; the second checks
    // reloading through the existing AJAX path without accumulating options.
    for (let load = 0; load < 2; load++) {
      if (load > 0) {
        await page.evaluate(() => {
          (window as Window & { setupResourceTypeDropdownAjax: () => void }).setupResourceTypeDropdownAjax();
        });
      }
      await expect(select).toBeEnabled();
      await expect(select.locator('option')).toHaveText(['Choose...', ...response.map(type => type.resource_type_general)]);
      await select.selectOption(String(response[1].id));
      await expect(select).toHaveValue(String(response[1].id));
      await expect(select.locator('option:checked')).toHaveText(response[1].resource_type_general);
    }

    await page.waitForFunction(() => (window as Window & { jQuery: { active: number } }).jQuery.active === 0);
    expect(messages, 'Unexpected browser diagnostics for ' + profile).toEqual([]);
  });
}
