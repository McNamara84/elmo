/**
 * @jest-environment jsdom
 *
 * Integration test for initializeAllDropdownsParallel():
 * mocks all parallel fetch endpoints and verifies dropdown fields are populated.
 */

const toArray = (record) => Object.values(record);

let timeZonesMockResponse = {
  400: { value: "Pacific/Marquesas", label: "UTC-10:30 (Pacific/Marquesas)" },
  401: { value: "Pacific/Midway", label: "UTC-11:00 (Pacific/Midway)" },
  402: { value: "Pacific/Nauru", label: "UTC+12:00 (Pacific/Nauru)" },
  403: { value: "Pacific/Niue", label: "UTC-11:00 (Pacific/Niue)" },
  404: { value: "Pacific/Norfolk", label: "UTC+11:00 (Pacific/Norfolk)" },
  405: { value: "Pacific/Noumea", label: "UTC+11:00 (Pacific/Noumea)" },
  406: { value: "Pacific/Pago_Pago", label: "UTC-11:00 (Pacific/Pago_Pago)" },
  407: { value: "Pacific/Palau", label: "UTC+09:00 (Pacific/Palau)" },
  408: { value: "Pacific/Pitcairn", label: "UTC-08:00 (Pacific/Pitcairn)" }
};

let titleTypesMockResponse = {
  0: { id: 1, name: "Alternative Title" },
  1: { id: 6, name: "Main Title" },
  2: { id: 9, name: "Other" },
  3: { id: 12, name: "Subtitle" },
  4: { id: 16, name: "Translated Title" }
};

let resourceTypesMockResponse = {
  0: { id: 5, resource_type_general: "Collection", description: "" },
  1: { id: 82, resource_type_general: "Computational Notebook", description: "" },
  2: { id: 83, resource_type_general: "Data Paper", description: "" },
  3: { id: 14, resource_type_general: "Dataset", description: "" },
  4: { id: 23, resource_type_general: "Image", description: "" },
  5: { id: 86, resource_type_general: "Interactive Resource", description: "" }
};

let languagesMockResponse = {
  0: { id: 1, name: "English", code: "en" },
  1: { id: 3, name: "French", code: "fr" },
  2: { id: 2, name: "German", code: "de" }
};

let licensesMockResponse = {
  0: { rights_id: "1", text: "Creative Commons Attribution 4.0 International", rightsIdentifier: "CC-BY-4.0", rightsURI: "https://creativecommons.org/licenses/by/4.0/legalcode", forSoftware: "0" },
  1: { rights_id: "4", text: "Creative Commons Zero v1.0 Universal", rightsIdentifier: "CC0-1.0", rightsURI: "https://creativecommons.org/publicdomain/zero/1.0/legalcode", forSoftware: "0" },
  2: { rights_id: "6", text: "GNU General Public License v3.0 or later", rightsIdentifier: "GPL-3.0-or-later", rightsURI: "https://www.gnu.org/licenses/gpl-3.0-standalone.html", forSoftware: "1" }
};

let relationsTypeMockResponse = {
  0: { id: 5, name: "Cites", description: "" },
  1: { id: 139, name: "Collects", description: "" },
  2: { id: 86, name: "Compiles", description: "" },
  3: { id: 20, name: "Continues", description: "" },
  4: { id: 26, name: "Describes", description: "" }
};

let identifierTypesMockResponse = {
  0: { name: "ARK", pattern: "", description: "" },
  1: { name: "arXiv", pattern: "", description: "" },
  2: { name: "bibcode", pattern: "", description: "" }
};

function buildFetchMock() {
  const bodies = {
    'json/timezones.json': toArray(timeZonesMockResponse),
    'api/v2/vocabs/resourcetypes': toArray(resourceTypesMockResponse),
    'api/v2/vocabs/languages': toArray(languagesMockResponse),
    'api/v2/vocabs/titletypes': toArray(titleTypesMockResponse),
    'api/v2/vocabs/licenses/all': toArray(licensesMockResponse),
    'api/v2/vocabs/relations': { relations: toArray(relationsTypeMockResponse) },
    'api/v2/validation/identifiertypes/active': { identifierTypes: toArray(identifierTypesMockResponse) },
    'json/funders.json': [],
  };

  return jest.fn((url) => {
    const endpoint = Object.keys(bodies).find((key) => url.includes(key));
    if (!endpoint) {
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    }
    return Promise.resolve({
      ok: true,
      json: async () => bodies[endpoint],
    });
  });
}

function buildPageDom() {
  document.body.innerHTML = `
    <select id="input-stc-timezone"></select>
    <select id="input-resourceinformation-resourcetype"></select>
    <select id="input-resourceinformation-language"></select>
    <select id="input-resourceinformation-titletype"></select>
    <select id="input-rights-license"></select>
    <select id="input-relatedwork-relation"></select>
    <select id="input-relatedwork-identifiertype"></select>
  `;
}

describe('initializeAllDropdownsParallel populate integration', () => {
  let selectModule;
  let $;

  beforeAll(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    $.ajax = jest.fn(() => ({ fail: jest.fn() }));
    $.getJSON = jest.fn(() => ({ fail: jest.fn() }));

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    delete global.fetch;
    selectModule = require('../../js/select.js');
  });

  beforeEach(async () => {
    buildPageDom();

    window.ELMO_FEATURES = {};
    window.setUpAutocompleteFunder = jest.fn();
    delete window.mainTitleTypeId;
    delete window.alternativeTitleTypeId;
    delete window.titleTypeOptionsHtml;
    delete window.fundersData;

    global.fetch = buildFetchMock();

    const dropdownsReady = new Promise((resolve) => {
      document.addEventListener('dropdownsReady', resolve, { once: true });
    });

    await selectModule.initializeAllDropdownsParallel();
    await dropdownsReady;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('calls all parallel fetch endpoints', () => {
    const urls = global.fetch.mock.calls.map(([url]) => url);
    expect(urls.some((url) => url.includes('json/timezones.json'))).toBe(true);
    expect(urls.some((url) => url.includes('api/v2/vocabs/resourcetypes'))).toBe(true);
    expect(urls.some((url) => url.includes('api/v2/vocabs/languages'))).toBe(true);
    expect(urls.some((url) => url.includes('api/v2/vocabs/titletypes'))).toBe(true);
    expect(urls.some((url) => url.includes('api/v2/vocabs/licenses/all'))).toBe(true);
    expect(urls.some((url) => url.includes('api/v2/vocabs/relations'))).toBe(true);
    expect(urls.some((url) => url.includes('api/v2/validation/identifiertypes/active'))).toBe(true);
    expect(urls.some((url) => url.includes('json/funders.json'))).toBe(true);
  });

  test('does not fall back to sequential AJAX initialization on success', () => {
    expect(console.warn).not.toHaveBeenCalledWith(
      'Falling back to legacy sequential dropdown initialization.'
    );
    expect($.ajax).not.toHaveBeenCalled();
  });

  test('populates timezone dropdown from fetched data', () => {
    const $timezone = $('#input-stc-timezone');
    const labels = $timezone.find('option').map((_, el) => $(el).text()).get();
    const values = $timezone.find('option').map((_, el) => $(el).val()).get();

    expect(labels).toContain('UTC-10:30 (Pacific/Marquesas)');
    expect(values).toContain('-10:30');
    expect(labels).toContain('UTC+09:00 (Pacific/Palau)');
  });

  test('populates resource type dropdown with placeholder and all types', () => {
    const $resourceType = $('#input-resourceinformation-resourcetype');
    const options = $resourceType.find('option').map((_, el) => $(el).text()).get();

    expect($resourceType.prop('disabled')).toBe(false);
    expect(options[0]).toBe('Choose...');
    expect(options).toContain('Dataset');
    expect(options).toContain('Collection');
    expect(options).toHaveLength(1 + toArray(resourceTypesMockResponse).length);
  });

  test('populates language dropdown and pre-selects English', () => {
    const $language = $('#input-resourceinformation-language');
    const options = $language.find('option').map((_, el) => $(el).text()).get();

    expect($language.prop('disabled')).toBe(false);
    expect($language.val()).toBe('1');
    expect(options).toContain('English');
    expect(options).toContain('German');
    expect(options).toContain('French');
  });

  test('populates title type dropdown with sparse IDs and sets globals', () => {
    const $titleType = $('#input-resourceinformation-titletype');
    const options = $titleType.find('option').map((_, el) => ({
      value: $(el).val(),
      text: $(el).text(),
    })).get();

    expect($titleType.prop('disabled')).toBe(false);
    expect($titleType.val()).toBe('6');
    expect(window.mainTitleTypeId).toBe('6');
    expect(window.alternativeTitleTypeId).toBe('1');
    expect(window.titleTypeOptionsHtml).toContain('Main Title');
    expect(window.titleTypeOptionsHtml).toContain('Subtitle');
    expect(options).toEqual(
      expect.arrayContaining([
        { value: '', text: 'Choose...' },
        { value: '1', text: 'Alternative Title' },
        { value: '6', text: 'Main Title' },
        { value: '9', text: 'Other' },
        { value: '12', text: 'Subtitle' },
        { value: '16', text: 'Translated Title' },
      ])
    );
  });

  test('populates license dropdown and selects CC-BY-4.0', () => {
    const $license = $('#input-rights-license');
    const selectedText = $license.find('option:selected').text();

    expect($license.prop('disabled')).toBe(false);
    expect(selectedText).toContain('CC-BY-4.0');
    expect($license.find('option').map((_, el) => $(el).text()).get()).toEqual(
      expect.arrayContaining([
        'Creative Commons Attribution 4.0 International (CC-BY-4.0)',
        'Creative Commons Zero v1.0 Universal (CC0-1.0)',
        'GNU General Public License v3.0 or later (GPL-3.0-or-later)',
      ])
    );
  });

  test('populates relations dropdown sorted alphabetically', () => {
    const $relation = $('#input-relatedwork-relation');
    const options = $relation.find('option').map((_, el) => $(el).text()).get();

    expect($relation.prop('disabled')).toBe(false);
    expect(options[0]).toBe('Choose...');
    expect(options.slice(1)).toEqual([
      'Cites',
      'Collects',
      'Compiles',
      'Continues',
      'Describes',
    ]);
  });

  test('populates identifier types dropdown', () => {
    const $identifierType = $('#input-relatedwork-identifiertype');
    const options = $identifierType.find('option').map((_, el) => $(el).text()).get();

    expect($identifierType.prop('disabled')).toBe(false);
    expect(options[0]).toBe('Choose...');
    expect(options.slice(1)).toEqual(['ARK', 'arXiv', 'bibcode']);
  });

  test('stores funders data for autocomplete setup', () => {
    expect(window.fundersData).toEqual([]);
    expect(window.setUpAutocompleteFunder).not.toHaveBeenCalled();
  });
});

describe('initializeAllDropdownsParallel failure handling', () => {
  let selectModule;
  let $;

  beforeAll(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    $.ajax = jest.fn((opts) => {
      if (opts?.complete) opts.complete();
      return { fail: jest.fn() };
    });
    $.getJSON = jest.fn(() => ({ fail: jest.fn() }));

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    selectModule = require('../../js/select.js');
  });

  beforeEach(() => {
    buildPageDom();
    window.ELMO_FEATURES = {};
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('falls back to sequential AJAX when a critical fetch fails', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('api/v2/vocabs/titletypes')) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    await selectModule.initializeAllDropdownsParallel();

    expect(console.warn).toHaveBeenCalledWith(
      'Falling back to legacy sequential dropdown initialization.'
    );
    expect($.ajax).toHaveBeenCalled();
  });
});
