import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const stateFile = process.env.ERNIE_LICENSE_TEST_STATE;
const cacheDirectory = process.env.ERNIE_LICENSE_TEST_CACHE;
let previousState = '';
test.describe.configure({ mode: 'serial' });
test.skip(!stateFile || !cacheDirectory, 'Requires a dedicated ERNIE fixture, ERNIE_LICENSE_TEST_STATE and ERNIE_LICENSE_TEST_CACHE.');
test.beforeAll(() => {
  previousState = readFileSync(stateFile!, 'utf8');
  // This explicitly supplied directory belongs to the isolated test instance.
  for (const file of readdirSync(cacheDirectory!)) {
    if (/^ernie_licenses_[a-f0-9]{64}_elmo(?:-msl)?_[a-z-]+\.json(?:\.lock)?$/.test(file)) {
      unlinkSync(join(cacheDirectory!, file));
    }
  }
});
test.afterAll(() => { if (stateFile) writeFileSync(stateFile, previousState); });
test.beforeEach(() => { writeFileSync(stateFile!, 'ready'); });

async function prepare(request: APIRequestContext, resourceType = 'Dataset') {
  await request.get('');
  const token = (await (await request.get('api/csrf_token.php')).json()).token;
  const types = await (await request.get('api/v2/vocabs/resourcetypes')).json();
  const type = types.find((row: { resource_type_general: string }) => row.resource_type_general === resourceType);
  expect(type).toBeTruthy();
  const languages = await (await request.get('api/v2/vocabs/languages')).json();
  const titles = await (await request.get('api/v2/vocabs/titletypes')).json();
  // Respect the real server-side interaction timer; never bypass request security.
  await delay(3100);
  return {
    csrf_token: token, action: 'save_and_download', year: '2026', resourcetype: String(type.id),
    language: String(languages[0].id), 'title[]': 'License HTTP integration',
    'titleType[]': String(titles[0].id), descriptionAbstract: 'A deterministic license integration test.',
    authorsPayload: JSON.stringify([{ type: 'person', familyname: 'Tester', givenname: 'License', isContact: true, email: 'license@example.org', affiliations: [] }]),
  };
}

const payload = (license: unknown) => JSON.stringify({ version: 1, license });
const cc = { identifier: 'CC-BY-4.0', name: 'Untrusted browser text', uri: 'https://creativecommons.org/licenses/by/4.0/', scheme_uri: 'https://spdx.org/licenses/' };

test('valid direct POST uses server grants despite a forged action and browser name', async ({ request }) => {
  const form = await prepare(request);
  const response = await request.post('endpoints/send_xml_file.php', { form: { ...form, Rights: '999999', licensePayload: payload(cc) } });
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body.success).toBe(true);
  expect(body.simulated).toBe(true);
  expect(body.resource_id).toBeGreaterThan(0);
  const exported = await (await request.get('api/v2/dataset/export/' + body.resource_id + '/datacite')).text();
  expect(exported).toContain('Creative Commons Attribution 4.0 International');
  expect(exported).not.toContain('Untrusted browser text');
});

test('outage with a matching cached grant still permits submission', async ({ request }) => {
  const form = await prepare(request);
  writeFileSync(stateFile!, 'offline');
  const response = await request.post('endpoints/send_xml_file.php', { form: { ...form, licensePayload: payload(cc) } });
  expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).simulated).toBe(true);
});

test('successful empty grants reject direct submission and cannot be bypassed by flags', async ({ request }) => {
  const form = await prepare(request);
  writeFileSync(stateFile!, 'empty');
  await request.post('api/v2/admin/cache/refresh', { headers: { 'X-API-KEY': '1234-1234-1234-1234' } });
  const response = await request.post('endpoints/send_xml_file.php', { form: { ...form, licenseAllowed: 'true', licenseImported: 'true', licensePayload: payload(cc) } });
  expect(response.status(), await response.text()).toBe(422);
  expect((await response.json()).resource_id).toBeUndefined();
});

test('outage without a matching type cache returns 503', async ({ request }) => {
  const form = await prepare(request, 'Event');
  writeFileSync(stateFile!, 'offline');
  const response = await request.post('endpoints/send_xml_file.php', { form: { ...form, licensePayload: payload(cc) } });
  expect(response.status(), await response.text()).toBe(503);
  expect((await response.json()).resource_id).toBeUndefined();
});

test('inactive imported rights remain exportable through the real save endpoint', async ({ request }) => {
  const form = await prepare(request);
  const response = await request.post('save/save_data.php', { form: {
    ...form, action: 'submit', filename: 'custom-license', download_format: 'jsonld',
    licensePayload: payload({ identifier: 'Custom-4.0', name: 'Original custom terms', uri: null, scheme_uri: 'urn:example:terms', scheme_name: 'Local' }),
  } });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.rightsList.rights.attrs).toMatchObject({ rightsIdentifier: 'Custom-4.0', schemeURI: 'urn:example:terms', rightsIdentifierScheme: 'Local' });
  expect(body.rightsList.rights.attrs.rightsURI).toBeUndefined();
});
