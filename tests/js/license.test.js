/** @jest-environment jsdom */
const $ = require('jquery');
global.$ = global.jQuery = $;
const { LicenseSelection, matches } = require('../../js/services/licenseService.js');

const cc = { rights_id: 81, text: 'CC BY', rightsIdentifier: 'CC-BY-4.0', rightsURI: 'https://creativecommons.org/licenses/by/4.0/', schemeURI: 'https://spdx.org/licenses/' };
const mit = { rights_id: 17, text: 'MIT', rightsIdentifier: 'MIT', rightsURI: 'https://opensource.org/license/mit/', schemeURI: 'https://spdx.org/licenses/' };
const response = rows => ({ ok: true, json: async () => ({ licenses: rows, availability: rows.length ? 'available' : 'empty' }) });
let service;
beforeEach(() => {
  document.body.innerHTML = '<select id="input-resourceinformation-resourcetype"><option value="">Choose</option><option value="3">Dataset</option></select><select id="input-rights-license" required></select><div id="license-availability"></div>';
  service = new LicenseSelection();
  window.elmo.licenses = service;
  global.fetch = jest.fn().mockResolvedValue(response([mit, cc]));
});
const select = () => document.getElementById('input-rights-license');
const payload = () => JSON.parse(document.querySelector('[name="licensePayload"]').value).license;

test('waits for resource type without fetching or inventing a default', async () => {
  await service.load();
  expect(fetch).not.toHaveBeenCalled();
  expect(select().value).toBe('');
  expect(select().disabled).toBe(true);
  expect(payload()).toBeNull();
});

test('uses scoped endpoint, ERNIE order and allowed default with arbitrary local IDs', async () => {
  await service.load('3');
  expect(fetch).toHaveBeenCalledWith('api/v2/vocabs/licenses/resource-type/3');
  expect([...select().options].map(o => o.value)).toEqual(['', '17', '81']);
  expect(select().value).toBe('81');
  expect(payload().identifier).toBe('CC-BY-4.0');
  await service.load('3');
  expect(select().options).toHaveLength(3);
});

test('requires explicit selection without an allowed default and ignores legacy filters', async () => {
  fetch.mockResolvedValue(response([{ ...mit, forSoftware: '0' }]));
  await service.load('3');
  expect(select().value).toBe('');
  $(select()).val('17').trigger('change');
  expect(payload().identifier).toBe('MIT');
  expect(select().validity.valid).toBe(true);
});

test('preserves valid choices and visibly retains a revoked choice without replacement', async () => {
  await service.load('3');
  $(select()).val('17').trigger('change');
  await service.load('3');
  expect(select().value).toBe('17');
  fetch.mockResolvedValue(response([cc]));
  await service.load('4');
  expect(select().value).toBe('__retained__');
  expect(payload().identifier).toBe('MIT');
  expect(select().validity.valid).toBe(false);
  expect(document.getElementById('license-availability').textContent).toContain('not currently allowed');
});

test.each(['empty', 'offline', 'malformed'])('%s cannot restore local seed licenses', async state => {
  fetch.mockImplementation(async () => {
    if (state === 'offline') throw new Error('timeout');
    return state === 'empty' ? response([]) : { ok: true, json: async () => ({}) };
  });
  await service.load('3');
  expect(select().value).toBe('');
  expect(select().options).toHaveLength(1);
  expect(payload()).toBeNull();
  expect(select().validity.valid).toBe(false);
});

test('ignores an earlier response after a rapid resource type change', async () => {
  let resolveOld;
  fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const old = service.load('3');
  fetch.mockResolvedValueOnce(response([mit]));
  await service.load('4');
  resolveOld(response([cc]));
  await old;
  expect([...select().options].map(o => o.value)).toEqual(['', '17']);
  expect(payload()).toBeNull();
});

test('retains imported custom rights and full identifier versions in portable payload', async () => {
  document.getElementById('input-resourceinformation-resourcetype').value = '3';
  const imported = { identifier: 'custom-4.0', name: 'Original rights', uri: null, scheme_uri: 'urn:example:licenses', scheme_name: 'Example' };
  await service.setMetadata(imported);
  expect(payload()).toEqual(imported);
  expect(select().value).toBe('__retained__');
});

test('schema identity controls matching and custom identifiers retain case', () => {
  expect(matches({ identifier: 'MIT', scheme_uri: null }, { identifier: 'MIT', scheme_uri: 'https://spdx.org/licenses/' })).toBe(false);
  expect(matches({ identifier: 'Custom', scheme_uri: null }, { identifier: 'custom', scheme_uri: null })).toBe(false);
  expect(matches({ identifier: 'cc-by-4.0', scheme_uri: 'https://spdx.org/licenses' }, { identifier: 'CC-BY-4.0', scheme_uri: 'https://spdx.org/licenses/' })).toBe(true);
});

test('an imported empty license stays empty even when CC BY is allowed', async () => {
  document.getElementById('input-resourceinformation-resourcetype').value = '3';
  await service.setMetadata(null);
  expect(select().value).toBe('');
  expect(payload()).toBeNull();
  await service.reset();
  expect(select().value).toBe('81');
});
