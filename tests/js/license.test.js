// plan: 1. mock response from getJson, 2. trigger the function 3. check filtering and cc-by-4.0 at the top of the list. 

/**
 * @jest-environment jsdom
 */
const $ = require('jquery');

describe('setupLicenseDropdown', () => {
  beforeAll(() => {
    global.$ = $;
    global.jQuery = $;

    // Stub fetch used by initializeTimezoneDropdown
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => [],
    });

    // Stub $.ajax used by other dropdowns to avoid network in tests
    jest.spyOn($, 'ajax').mockImplementation((opts) => {
      if (typeof opts?.beforeSend === 'function') opts.beforeSend();
      if (typeof opts?.success === 'function') opts.success([]);
      if (typeof opts?.complete === 'function') opts.complete();
      return { fail: jest.fn(), always: jest.fn() };
    });

    // Load select.js once (document.ready will run)
    require('../../..//js/select.js');
  });

  beforeEach(() => {
    // Fresh DOM per test
    document.body.innerHTML = `
      <select id="input-rights-license"></select>
      <select id="input-resourceinformation-resourcetype"></select>
    `;
    jest.clearAllMocks();
  });

  function mockGetJSONForBothEndpoints({ allData, softwareData }) {
    jest.spyOn($, 'getJSON').mockImplementation((url, success) => {
      if (url.includes('/vocabs/licenses/all')) {
        success(allData);
      } else if (url.includes('/vocabs/licenses/software')) {
        success(softwareData);
      } else {
        success([]);
      }
      return { fail: jest.fn() };
    });
  }

  test('non-software licenses: filters out software-only, sorts by rightsIdentifier with CC-BY-4.0 on top and selects it', () => {
    const allData = [
      // software-only (should be filtered out)
      { rights_id: 'rid-apache', rightsIdentifier: 'Apache-2.0', text: 'Apache License 2.0', forSoftware: '1' },
      { rights_id: 'rid-mit', rightsIdentifier: 'MIT', text: 'MIT License', forSoftware: '1' },

      // non-software (should remain)
      {
        rights_id: 'rid-ccb4',
        rightsIdentifier: 'CC-BY-4.0',
        text: 'Creative Commons Attribution 4.0 International',
        forSoftware: '0',
      },
      {
        rights_id: 'rid-cc0',
        rightsIdentifier: 'CC0-1.0',
        text: 'Creative Commons Zero v1.0 Universal',
        forSoftware: '0',
      },
      {
        rights_id: 'rid-ccbysa4',
        rightsIdentifier: 'CC-BY-SA-4.0',
        text: 'Creative Commons Attribution-ShareAlike 4.0 International',
        forSoftware: '0',
      },
    ];

    mockGetJSONForBothEndpoints({ allData, softwareData: [] });

    // Call the function under test
    window.setupLicenseDropdown(false);

    const $select = $('#input-rights-license');
    const options = $select.find('option').toArray();

    // No "Choose..." placeholder
    expect(options.some(o => o.textContent.includes('Choose'))).toBe(false);

    // Ensure only non-software remain
    const texts = options.map(o => o.textContent.trim());
    expect(texts).toEqual([
      'Creative Commons Attribution 4.0 International (CC-BY-4.0)',
      'Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA-4.0)',
      'Creative Commons Zero v1.0 Universal (CC0-1.0)',
    ]);

    // CC-BY-4.0 is selected and is the first
    expect($select.val()).toBe('rid-ccb4');

    // Sorting: CC-BY-4.0 forced top; remaining are alphabetical by rightsIdentifier
    const remainingRightsIds = options.slice(1).map(o => {
      const m = o.textContent.match(/\(([^)]+)\)$/);
      return m ? m[1] : '';
    });
    const sortedRemaining = [...remainingRightsIds].sort((a, b) => a.localeCompare(b));
    expect(remainingRightsIds).toEqual(sortedRemaining);
  });

  test('software licenses: sorted alphabetically by rightsIdentifier, no CC-BY-4.0 required', () => {
    const softwareData = [
      { rights_id: 'rid-mit', rightsIdentifier: 'MIT', text: 'MIT License' },
      { rights_id: 'rid-apache', rightsIdentifier: 'Apache-2.0', text: 'Apache License 2.0' },
      { rights_id: 'rid-gpl3', rightsIdentifier: 'GPL-3.0-only', text: 'GNU General Public License v3.0 only' },
    ];

    mockGetJSONForBothEndpoints({ allData: [], softwareData });

    // Call the function under test
    window.setupLicenseDropdown(true);

    const $select = $('#input-rights-license');
    const options = $select.find('option').toArray();
    const texts = options.map(o => o.textContent.trim());

    // No "Choose..." placeholder
    expect(texts.some(t => t.includes('Choose'))).toBe(false);

    // Sorted by rightsIdentifier
    expect(texts).toEqual([
      'Apache License 2.0 (Apache-2.0)',
      'GNU General Public License v3.0 only (GPL-3.0-only)',
      'MIT License (MIT)',
    ]);

    // No CC-BY in software list
    expect(texts.join(' ')).not.toContain('CC-BY-4.0');
  });
});