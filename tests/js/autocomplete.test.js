const fs = require('fs');
const path = require('path');

// Simple Tagify stub from existing tests
class MockTagify {
  constructor(el, options = {}) {
    this.el = el;
    this.settings = options;
    this.whitelist = options.whitelist || [];
    this.value = [];
    this.DOM = { input: { style: { width: '' } } };
    this.dropdown = { hide: jest.fn() };
  }
  addTags(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach(item => {
      if (typeof item === 'string') {
        this.value.push({ value: item });
      } else {
        this.value.push(item);
      }
    });
  }
  removeAllTags() {
    this.value = [];
  }
}

const flushPromises = () => new Promise(res => setTimeout(res, 0));

function createAffiliationSummary(type, name, rorId, endDate = null) {
  const summary = {
    organization: {
      name,
      'disambiguated-organization': {
        'disambiguation-source': 'ROR',
        'disambiguated-organization-identifier': rorId
      }
    }
  };

  if (endDate) {
    summary['end-date'] = endDate;
  }

  return {
    summaries: [
      {
        [`${type}-summary`]: summary
      }
    ]
  };
}

describe('autocomplete.js', () => {
  let $;
  beforeEach(async () => {
    document.body.innerHTML = `
      <select id="input-rights-license">
        <option>MIT License</option>
        <option>Apache License 2.0</option>
        <option>GPL</option>
      </select>
      <select id="input-resourceinformation-resourcetype">
        <option value="Article">Article</option>
        <option value="Software">Software</option>
      </select>
      <div id="group-author">
        <div data-creator-row>
          <input name="orcids[]" />
          <input name="familynames[]" />
          <input name="givennames[]" />
          <input id="input-author-affiliation" />
          <input id="input-author-rorid" />
        </div>
      </div>
      <div id="group-contributorperson">
        <div contributor-person-row>
          <input name="cbORCID[]" />
          <input name="cbPersonLastname[]" />
          <input name="cbPersonFirstname[]" />
          <input id="input-contributorpersons-affiliation" />
          <input id="input-contributor-personrorid" />
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    global.Tagify = MockTagify;
    global.fetch = jest.fn();

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/autocomplete.js'), 'utf8');
    window.eval(script);
    await flushPromises();
    await flushPromises();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('normalizeRorId utility', () => {
    expect(window.normalizeRorId('https://ror.org/05rrcem69')).toBe('https://ror.org/05rrcem69');
    expect(window.normalizeRorId('05rrcem69')).toBe('https://ror.org/05rrcem69');
    expect(window.normalizeRorId('')).toBe('');
  });

  test('getAffiliationEndDate normalizes partial ORCID end dates to period end', () => {
    const yearOnly = window.getAffiliationEndDate({ 'end-date': { year: { value: '2026' } } });
    const yearMonth = window.getAffiliationEndDate({ 'end-date': { year: { value: '2026' }, month: { value: '3' } } });
    const fullDate = window.getAffiliationEndDate({ 'end-date': { year: { value: '2026' }, month: { value: '3' }, day: { value: '24' } } });

    expect(yearOnly.getFullYear()).toBe(2026);
    expect(yearOnly.getMonth()).toBe(11);
    expect(yearOnly.getDate()).toBe(31);

    expect(yearMonth.getFullYear()).toBe(2026);
    expect(yearMonth.getMonth()).toBe(2);
    expect(yearMonth.getDate()).toBe(31);

    expect(fullDate.getFullYear()).toBe(2026);
    expect(fullDate.getMonth()).toBe(2);
    expect(fullDate.getDate()).toBe(24);
  });

  test('isCurrentAffiliation treats missing, future and partial end dates as current', () => {
    const referenceDate = new Date('2026-03-24T12:00:00.000Z');

    expect(window.isCurrentAffiliation({}, referenceDate)).toBe(true);
    expect(window.isCurrentAffiliation({ 'end-date': { year: { value: '2099' } } }, referenceDate)).toBe(true);
    expect(window.isCurrentAffiliation({ 'end-date': { year: { value: '2026' }, month: { value: '3' } } }, referenceDate)).toBe(true);
    expect(window.isCurrentAffiliation({ 'end-date': { year: { value: '2019' } } }, referenceDate)).toBe(false);
  });

  test('author ORCID blur keeps one current affiliation', async () => {
    const data = {
      person: {
        name: {
          'family-name': { value: 'Doe' },
          'given-names': { value: 'John' }
        }
      },
      'activities-summary': {
        employments: {
          'affiliation-group': [
            createAffiliationSummary('employment', 'Current Lab', '05rrcem69')
          ]
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-author-affiliation');
    affInput._tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-author input[name="orcids[]"]');
    orcidInput.val('1111-1111-1111-1111').trigger('blur');
    await flushPromises();
    await flushPromises();

    expect(fetch).toHaveBeenCalled();
    expect($('#group-author input[name="familynames[]"]').val()).toBe('Doe');
    expect($('#group-author input[name="givennames[]"]').val()).toBe('John');
    expect(affInput._tagify.value).toEqual([{ value: 'Current Lab' }]);
    expect(document.getElementById('input-author-rorid').value).toBe('https://ror.org/05rrcem69');
  });

  test('author ORCID 0000-0001-5140-8602 keeps one current affiliation', async () => {
    const data = {
      person: {
        name: {
          'family-name': { value: 'Reference' },
          'given-names': { value: 'Case' }
        }
      },
      'activities-summary': {
        employments: {
          'affiliation-group': [
            createAffiliationSummary('employment', 'Expected Current Affiliation', '0arefcase1')
          ]
        },
        educations: {
          'affiliation-group': []
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-author-affiliation');
    affInput._tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-author input[name="orcids[]"]');
    orcidInput.val('0000-0001-5140-8602').trigger('blur');
    await flushPromises();
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('https://pub.orcid.org/v3.0/0000-0001-5140-8602/record', {
      headers: {
        Accept: 'application/vnd.orcid+json'
      }
    });
    expect($('#group-author input[name="familynames[]"]').val()).toBe('Reference');
    expect($('#group-author input[name="givennames[]"]').val()).toBe('Case');
    expect(affInput._tagify.value).toEqual([{ value: 'Expected Current Affiliation' }]);
    expect(document.getElementById('input-author-rorid').value).toBe('https://ror.org/0arefcase1');
  });

  test('author ORCID blur keeps two current affiliations', async () => {
    const data = {
      person: {
        name: {
          'family-name': { value: 'Miller' },
          'given-names': { value: 'Chris' }
        }
      },
      'activities-summary': {
        employments: {
          'affiliation-group': [
            createAffiliationSummary('employment', 'Institute One', '01aaa1111')
          ]
        },
        educations: {
          'affiliation-group': [
            createAffiliationSummary('education', 'Institute Two', '02bbb2222', {
              year: { value: '2099' },
              month: { value: '12' },
              day: { value: '31' }
            })
          ]
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-author-affiliation');
    affInput._tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-author input[name="orcids[]"]');
    orcidInput.val('2222-2222-2222-2222').trigger('blur');
    await flushPromises();
    await flushPromises();

    expect(affInput._tagify.value).toEqual([
      { value: 'Institute One' },
      { value: 'Institute Two' }
    ]);
    expect(document.getElementById('input-author-rorid').value).toBe('https://ror.org/01aaa1111,https://ror.org/02bbb2222');
  });

  test('author ORCID blur filters ended affiliations and keeps current employment and education affiliations', async () => {
    const data = {
      person: {
        name: {
          'family-name': { value: 'Example' },
          'given-names': { value: 'Pat' }
        }
      },
      'activities-summary': {
        employments: {
          'affiliation-group': [
            createAffiliationSummary('employment', 'Bundeswehr', '03ccc3333', {
              year: { value: '2019' }
            }),
            createAffiliationSummary('employment', 'Current Institute', '05eee5555')
          ]
        },
        educations: {
          'affiliation-group': [
            createAffiliationSummary('education', 'Current University', '04ddd4444', {
              year: { value: '2099' },
              month: { value: '6' }
            })
          ]
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-author-affiliation');
    affInput._tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-author input[name="orcids[]"]');
    orcidInput.val('3333-3333-3333-3333').trigger('blur');
    await flushPromises();
    await flushPromises();

    expect(affInput._tagify.value).toEqual([
      { value: 'Current Institute' },
      { value: 'Current University' }
    ]);
    expect(document.getElementById('input-author-rorid').value).toBe('https://ror.org/05eee5555,https://ror.org/04ddd4444');
  });

  test('author ORCID blur filters multiple ended affiliations and keeps one current affiliation', async () => {
    const data = {
      person: {
        name: {
          'family-name': { value: 'Taylor' },
          'given-names': { value: 'Alex' }
        }
      },
      'activities-summary': {
        employments: {
          'affiliation-group': [
            createAffiliationSummary('employment', 'Legacy Org One', '06fff6666', {
              year: { value: '2015' }
            }),
            createAffiliationSummary('employment', 'Legacy Org Two', '07ggg7777', {
              year: { value: '2018' },
              month: { value: '5' }
            }),
            createAffiliationSummary('employment', 'Legacy Org Three', '08hhh8888', {
              year: { value: '2021' },
              month: { value: '11' },
              day: { value: '15' }
            }),
            createAffiliationSummary('employment', 'Current Org', '09iii9999')
          ]
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-author-affiliation');
    affInput._tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-author input[name="orcids[]"]');
    orcidInput.val('4444-4444-4444-4444').trigger('blur');
    await flushPromises();
    await flushPromises();

    expect(affInput._tagify.value).toEqual([{ value: 'Current Org' }]);
    expect(document.getElementById('input-author-rorid').value).toBe('https://ror.org/09iii9999');
  });

  test('author ORCID blur clears previous data when no affiliations returned', async () => {
    const affInput = document.getElementById('input-author-affiliation');
    affInput._tagify = new MockTagify(affInput, {});
    affInput._tagify.addTags([{ value: 'Existing Org' }]);
    document.getElementById('input-author-rorid').value = 'https://ror.org/existing';

    const data = {
      person: {
        name: {
          'family-name': { value: 'Roe' },
          'given-names': { value: 'Jane' }
        }
      },
      'activities-summary': {}
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const orcidInput = $('#group-author input[name="orcids[]"]');
    orcidInput.val('0000-0000-0000-0000').trigger('blur');
    await flushPromises();
    await flushPromises();

    expect(fetch).toHaveBeenCalled();
    expect($('#group-author input[name="familynames[]"]').val()).toBe('Roe');
    expect($('#group-author input[name="givennames[]"]').val()).toBe('Jane');
    expect(affInput._tagify.value).toHaveLength(0);
    expect(document.getElementById('input-author-rorid').value).toBe('');
  });

  test('contributor ORCID filters ended affiliations and keeps current ones', async () => {
    const data = {
      person: {
        name: {
          'family-name': { value: 'Smith' },
          'given-names': { value: 'Anna' }
        }
      },
      'activities-summary': {
        employments: {
          'affiliation-group': [
            createAffiliationSummary('employment', 'Old Lab', '0aoldlab0', {
              year: { value: '2017' }
            }),
            createAffiliationSummary('employment', 'Lab B', '0anewlab1')
          ]
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-contributorpersons-affiliation');
    affInput._tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-contributorperson input[name="cbORCID[]"]');
    orcidInput.val('5555-5555-5555-5555').trigger('blur');
    await flushPromises();
    await flushPromises();

    expect($('#group-contributorperson input[name="cbPersonLastname[]"]').val()).toBe('Smith');
    expect($('#group-contributorperson input[name="cbPersonFirstname[]"]').val()).toBe('Anna');
    expect(affInput._tagify.value).toEqual([{ value: 'Lab B' }]);
    expect(document.getElementById('input-contributor-personrorid').value).toBe('https://ror.org/0anewlab1');
  });
});