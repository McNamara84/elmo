import { test, expect } from '@playwright/test';
import { registerStaticAssetRoutes } from '../utils';

for (const profile of ['elmo', 'elmo-msl']) {
  test('license selection, revocation and recovery for ' + profile, async ({ page }, testInfo) => {
    const diagnostics: string[] = [];
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) diagnostics.push(message.text());
    });
    page.on('pageerror', error => diagnostics.push(error.message));
    const base = new URL(testInfo.project.use.baseURL ?? 'http://localhost:8080/');
    const cc = { rights_id: profile === 'elmo' ? 81 : 182, text: 'CC BY', rightsIdentifier: 'CC-BY-4.0', rightsURI: 'https://creativecommons.org/licenses/by/4.0/', schemeURI: 'https://spdx.org/licenses/' };
    const custom = { rights_id: 99, text: 'Custom terms', rightsIdentifier: 'Terms-2.0', rightsURI: null, schemeURI: 'urn:example:terms' };
    await registerStaticAssetRoutes(page);
    await page.route('**/api/v2/**', route => route.fulfill({ json: [] }));
    await page.route('**/json/timezones.json', route => route.fulfill({ json: [] }));
    await page.route('**/api/v2/vocabs/resourcetypes', route => route.fulfill({ json: [
      { id: 3, resource_type_general: 'Dataset' }, { id: 8, resource_type_general: 'Software' },
    ] }));
    await page.route('**/api/v2/vocabs/licenses/resource-type/*', route => {
      const rows = route.request().url().endsWith('/3') ? [custom, cc] : [custom];
      return route.fulfill({ json: { licenses: rows, availability: 'available', profile, source: 'cache' } });
    });
    await page.route('**/__license_selection__', route => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><base href="${base.href}"><link rel="icon" href="data:,"></head><body>
        <select id="input-resourceinformation-resourcetype"></select>
        <select id="input-rights-license" required></select><div id="license-availability" role="status"></div>
        <script src="node_modules/jquery/dist/jquery.min.js"></script>
        <script src="js/dropdownUtils.js"></script><script src="js/dropdownAjax.js"></script>
        <script src="js/services/identifierDetectionService.js"></script><script src="js/services/licenseService.js"></script>
        <script type="module" src="js/select.js"></script></body></html>`,
    }));
    await page.goto(new URL('__license_selection__', base).href);
    const type = page.locator('#input-resourceinformation-resourcetype');
    const license = page.locator('#input-rights-license');
    await expect(type).toBeEnabled();
    await expect(license).toBeDisabled();
    await type.selectOption('3');
    await expect(license).toHaveValue(String(cc.rights_id));
    await expect(license.locator('option')).toHaveText(['Choose a license...', 'Custom terms (Terms-2.0)', 'CC BY (CC-BY-4.0)']);
    await type.selectOption('8');
    await expect(license).toHaveValue('__retained__');
    await expect(page.locator('#license-availability')).toContainText('not currently allowed');
    expect(await license.evaluate((element: HTMLSelectElement) => element.checkValidity())).toBe(false);
    await license.selectOption('99');
    await expect(license).toHaveValue('99');
    expect(await license.evaluate((element: HTMLSelectElement) => element.checkValidity())).toBe(true);
    await type.selectOption('3');
    await expect(license).toHaveValue('99');
    await expect(license.locator('option')).toHaveCount(3);
    const payload = await page.locator('[name="licensePayload"]').inputValue();
    expect(JSON.parse(payload).license).toMatchObject({ identifier: 'Terms-2.0', uri: null, scheme_uri: 'urn:example:terms' });
    expect(diagnostics).toEqual([]);
  });
}
