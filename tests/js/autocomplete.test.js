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

  test('license options filtered based on resource type', () => {
    $('#input-resourceinformation-resourcetype').val('Software').trigger('change');
    let options = $('#input-rights-license option').map((i, el) => $(el).text()).get();
    expect(options).toEqual(['MIT License', 'Apache License 2.0']);

    $('#input-resourceinformation-resourcetype').val('Article').trigger('change');
    options = $('#input-rights-license option').map((i, el) => $(el).text()).get();
    expect(options).toEqual(['MIT License', 'Apache License 2.0', 'GPL']);
  });

  test('normalizeRorId utility', () => {
    expect(window.normalizeRorId('https://ror.org/05rrcem69')).toBe('https://ror.org/05rrcem69');
    expect(window.normalizeRorId('05rrcem69')).toBe('https://ror.org/05rrcem69');
    expect(window.normalizeRorId('')).toBe('');
  });

  test('author ORCID blur fills data including past affiliations', async () => {
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
            { summaries: [ { 'employment-summary': { organization: { name: 'Uni A', 'disambiguated-organization': { 'disambiguation-source': 'ROR', 'disambiguated-organization-identifier': '123' } }, 'end-date': { year: 2015 } } } ] }
          ]
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-author-affiliation');
    affInput.tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-author input[name="orcids[]"]');
    orcidInput.val('0000-0000-0000-0000').trigger('blur');
    await flushPromises();

    expect(fetch).toHaveBeenCalled();
    expect($('#group-author input[name="familynames[]"]').val()).toBe('Doe');
    expect($('#group-author input[name="givennames[]"]').val()).toBe('John');
    expect(affInput.tagify.value[0].value).toBe('Uni A');
    expect(document.getElementById('input-author-rorid').value).toBe('https://ror.org/123');
  });

  test('author ORCID blur clears previous data when no affiliations returned', async () => {
    const affInput = document.getElementById('input-author-affiliation');
    affInput.tagify = new MockTagify(affInput, {});
    affInput.tagify.addTags([{ value: 'Existing Org' }]);
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

    expect(fetch).toHaveBeenCalled();
    expect($('#group-author input[name="familynames[]"]').val()).toBe('Roe');
    expect($('#group-author input[name="givennames[]"]').val()).toBe('Jane');
    expect(affInput.tagify.value).toHaveLength(0);
    expect(document.getElementById('input-author-rorid').value).toBe('');
  });

  test('contributor ORCID blur fills data', async () => {
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
            { summaries: [ { 'employment-summary': { organization: { name: 'Lab B', 'disambiguated-organization': { 'disambiguation-source': 'ROR', 'disambiguated-organization-identifier': 'XYZ' } } } } ] }
          ]
        }
      }
    };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(data) });

    const affInput = document.getElementById('input-contributorpersons-affiliation');
    affInput.tagify = new MockTagify(affInput, {});

    const orcidInput = $('#group-contributorperson input[name="cbORCID[]"]');
    orcidInput.val('1111-2222-3333-4444').trigger('blur');
    await flushPromises();

    expect($('#group-contributorperson input[name="cbPersonLastname[]"]').val()).toBe('Smith');
    expect($('#group-contributorperson input[name="cbPersonFirstname[]"]').val()).toBe('Anna');
    expect(affInput.tagify.value[0].value).toBe('Lab B');
    expect(document.getElementById('input-contributor-personrorid').value).toBe('https://ror.org/XYZ');
  });
});