/**
 * @jest-environment jsdom
 */

describe('select.js lazy CFID funder loading', () => {
  let $;
  let originalReady;
  let selectModule;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <select id="input-stc-timezone"></select>
      <select id="input-resourceinformation-resourcetype"></select>
      <select id="input-resourceinformation-language"></select>
      <select id="input-resourceinformation-titletype"></select>
      <select id="input-rights-license"></select>
      <select id="input-relatedwork-relation"></select>
      <select id="input-relatedwork-identifiertype"></select>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    originalReady = $.fn.ready;
    $.fn.ready = jest.fn();

    delete window.fundersData;
    global.fetch = jest.fn();

    selectModule = require('../../js/select.js');
  });

  afterEach(() => {
    $.fn.ready = originalReady;
    document.body.innerHTML = '';
    delete window.fundersData;
    delete window.$;
    delete window.jQuery;
    delete global.$;
    delete global.jQuery;
    delete global.fetch;
    jest.clearAllMocks();
  });

  test('does not include funders in initial dropdown requests or gate dropdownsReady', async () => {
    global.fetch.mockImplementation(async url => ({
      ok: true,
      json: async () => {
        if (String(url).includes('/relations')) return { relations: [] };
        if (String(url).includes('/identifiertypes')) return { identifierTypes: [] };
        return [];
      },
    }));
    const dropdownsReady = jest.fn();
    document.addEventListener('dropdownsReady', dropdownsReady, { once: true });

    await selectModule.initializeAllDropdownsParallel();

    const requestedUrls = global.fetch.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).not.toContain('json/funders.json');
    expect(dropdownsReady).toHaveBeenCalledTimes(1);
  });

  test('shares one in-flight request and caches successful funder data', async () => {
    const fixture = [
      { crossRefId: '100000001', name: 'National Science Foundation' },
      { crossRefId: '100000010', name: 'Ford Foundation' },
    ];
    let resolveJson;
    const jsonResponse = new Promise(resolve => {
      resolveJson = resolve;
    });
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => jsonResponse,
    });

    const firstLoad = selectModule.loadFundersData();
    const concurrentLoad = selectModule.loadFundersData();

    expect(firstLoad).toBe(concurrentLoad);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('json/funders.json');

    resolveJson(fixture);
    await expect(firstLoad).resolves.toEqual(fixture);
    expect(window.fundersData).toEqual(fixture);

    await expect(selectModule.loadFundersData()).resolves.toEqual(fixture);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['an HTTP error', { ok: false, json: jest.fn() }],
    ['invalid JSON', { ok: true, json: jest.fn().mockRejectedValue(new Error('invalid JSON')) }],
    ['a non-array response', { ok: true, json: jest.fn().mockResolvedValue({ funders: [] }) }],
  ])('falls back to an empty list for %s', async (_caseName, response) => {
    global.fetch.mockResolvedValue(response);

    await expect(selectModule.loadFundersData()).resolves.toEqual([]);
    expect(window.fundersData).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
