/**
 * @jest-environment jsdom
 *
 * Unit tests for js/orcidSearch.js
 */

const fs = require('fs');
const path = require('path');

// Simple Tagify stub
class MockTagify {
  constructor(el) {
    this.el = el;
    this.value = [];
  }
  addTags(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach(item => {
      this.value.push(typeof item === 'string' ? { value: item } : item);
    });
  }
  removeAllTags() {
    this.value = [];
  }
}

const flushPromises = () => new Promise(res => setTimeout(res, 0));

function buildModalHtml() {
  return `
    <div class="modal fade" id="modal-orcid-search" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-body">
            <input type="hidden" id="orcid-search-context-group" value="">
            <input type="hidden" id="orcid-search-context-row-index" value="">
            <input type="text" id="input-orcid-search-firstname" />
            <input type="text" id="input-orcid-search-lastname" />
            <button type="button" id="button-orcid-search-execute">Search</button>
            <div id="orcid-search-alert" class="alert d-none"></div>
            <div id="orcid-search-spinner" class="d-none">
              <span data-translate="orcidSearch.searching">Searching...</span>
              <p data-translate="orcidSearch.searching">Searching...</p>
            </div>
            <div id="orcid-search-results" class="d-none">
              <h6 data-translate="orcidSearch.resultsHeading">Search Results</h6>
              <table id="orcid-search-results-table">
                <thead><tr>
                  <th data-translate="orcidSearch.columnOrcid">ORCID</th>
                  <th data-translate="orcidSearch.columnLastName">Last Name</th>
                  <th data-translate="orcidSearch.columnFirstName">First Name</th>
                  <th data-translate="orcidSearch.columnAffiliation">Affiliation(s)</th>
                  <th></th>
                </tr></thead>
                <tbody id="orcid-search-results-body"></tbody>
              </table>
            </div>
            <div id="orcid-search-no-results" class="d-none">
              <p data-translate="orcidSearch.noResults">No results found.</p>
            </div>
            <p data-translate="orcidSearch.inputRequired" style="display:none">Please enter at least a first or last name.</p>
            <p data-translate="orcidSearch.error" style="display:none">Error fetching results. Please try again.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildFormGroupsHtml() {
  return `
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
}

describe('orcidSearch.js', () => {
  let $;

  // We load both scripts via window.eval() so globals are shared,
  // and capture exports from orcidSearch.js via module.exports.
  let orcidSearchModule;

  beforeEach(async () => {
    // Set up jQuery
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    global.Tagify = MockTagify;
    global.fetch = jest.fn();

    // Mock bootstrap.Modal
    global.bootstrap = {
      Modal: {
        getInstance: jest.fn(() => ({ hide: jest.fn() }))
      }
    };

    document.body.innerHTML = buildModalHtml() + buildFormGroupsHtml();

    // Load autocomplete.js first via eval to set up shared globals
    const autocompleteScript = fs.readFileSync(path.resolve(__dirname, '../../js/autocomplete.js'), 'utf8');
    window.eval(autocompleteScript);

    // Load orcidSearch.js also via eval to keep shared scope
    const orcidSearchScript = fs.readFileSync(path.resolve(__dirname, '../../js/orcidSearch.js'), 'utf8');
    window.eval(orcidSearchScript);

    // Allow $(document).ready() handlers to execute
    await flushPromises();

    // Grab exported functions from global scope (set by function declarations in eval)
    orcidSearchModule = {
      escapeSolrQuery: window.escapeSolrQuery,
      buildOrcidSearchQuery: window.buildOrcidSearchQuery,
      searchOrcid: window.searchOrcid,
      renderOrcidSearchResults: window.renderOrcidSearchResults,
      resetOrcidSearchModal: window.resetOrcidSearchModal,
      getModalContext: window.getModalContext,
      showOrcidSearchAlert: window.showOrcidSearchAlert,
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.resetAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete global.bootstrap;
  });

  describe('escapeSolrQuery', () => {
    test('escapes Solr special characters', () => {
      expect(orcidSearchModule.escapeSolrQuery('hello+world')).toBe('hello\\+world');
      expect(orcidSearchModule.escapeSolrQuery('test:value')).toBe('test\\:value');
      expect(orcidSearchModule.escapeSolrQuery('a&b|c!d')).toBe('a\\&b\\|c\\!d');
      expect(orcidSearchModule.escapeSolrQuery('(parens)[brackets]{braces}')).toBe('\\(parens\\)\\[brackets\\]\\{braces\\}');
      expect(orcidSearchModule.escapeSolrQuery('quote"mark')).toBe('quote\\"mark');
      expect(orcidSearchModule.escapeSolrQuery('tilde~caret^')).toBe('tilde\\~caret\\^');
      expect(orcidSearchModule.escapeSolrQuery('star*question?')).toBe('star\\*question\\?');
      expect(orcidSearchModule.escapeSolrQuery('back\\slash')).toBe('back\\\\slash');
      expect(orcidSearchModule.escapeSolrQuery('forward/slash')).toBe('forward\\/slash');
    });

    test('leaves normal text unchanged', () => {
      expect(orcidSearchModule.escapeSolrQuery('John')).toBe('John');
      expect(orcidSearchModule.escapeSolrQuery('Müller')).toBe('Müller');
      expect(orcidSearchModule.escapeSolrQuery("O'Brien")).toBe("O'Brien");
    });

    test('handles empty string', () => {
      expect(orcidSearchModule.escapeSolrQuery('')).toBe('');
    });
  });

  describe('buildOrcidSearchQuery', () => {
    test('builds query with both first and last name', () => {
      const query = orcidSearchModule.buildOrcidSearchQuery('John', 'Doe');
      expect(query).toBe('given-names:John+AND+family-name:Doe');
    });

    test('builds query with only last name', () => {
      const query = orcidSearchModule.buildOrcidSearchQuery('', 'Smith');
      expect(query).toBe('family-name:Smith');
    });

    test('builds query with only first name', () => {
      const query = orcidSearchModule.buildOrcidSearchQuery('Jane', '');
      expect(query).toBe('given-names:Jane');
    });

    test('trims whitespace from inputs', () => {
      const query = orcidSearchModule.buildOrcidSearchQuery('  Max  ', '  Mustermann  ');
      expect(query).toBe('given-names:Max+AND+family-name:Mustermann');
    });

    test('escapes Solr special characters in names', () => {
      const query = orcidSearchModule.buildOrcidSearchQuery('O+Brien', 'Smith');
      expect(query).toBe('given-names:O\\+Brien+AND+family-name:Smith');
    });

    test('returns empty string when both fields are empty', () => {
      const query = orcidSearchModule.buildOrcidSearchQuery('', '');
      expect(query).toBe('');
    });

    test('returns empty string when both fields are whitespace', () => {
      const query = orcidSearchModule.buildOrcidSearchQuery('   ', '  ');
      expect(query).toBe('');
    });
  });

  describe('searchOrcid', () => {
    test('calls ORCID expanded-search API with correct URL and headers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 'expanded-result': [] })
      });

      await orcidSearchModule.searchOrcid('given-names:John+AND+family-name:Doe');

      expect(fetch).toHaveBeenCalledWith(
        'https://pub.orcid.org/v3.0/expanded-search/?q=given-names:John+AND+family-name:Doe&rows=10',
        { headers: { 'Accept': 'application/vnd.orcid+json' } }
      );
    });

    test('returns expanded-result array', async () => {
      const mockResults = [
        { 'orcid-id': '0000-0001-1234-5678', 'given-names': 'John', 'family-names': 'Doe', 'institution-name': ['MIT'] }
      ];
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 'expanded-result': mockResults })
      });

      const results = await orcidSearchModule.searchOrcid('family-name:Doe');
      expect(results).toEqual(mockResults);
    });

    test('returns empty array when no expanded-result key', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const results = await orcidSearchModule.searchOrcid('family-name:Nobody');
      expect(results).toEqual([]);
    });

    test('throws on non-ok response', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(orcidSearchModule.searchOrcid('test')).rejects.toThrow('ORCID API returned 500');
    });

    test('returns empty array on 400 client error', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const results = await orcidSearchModule.searchOrcid('test');
      expect(results).toEqual([]);
    });

    test('respects custom rows parameter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 'expanded-result': [] })
      });

      await orcidSearchModule.searchOrcid('family-name:Test', 5);

      expect(fetch).toHaveBeenCalledWith(
        'https://pub.orcid.org/v3.0/expanded-search/?q=family-name:Test&rows=5',
        { headers: { 'Accept': 'application/vnd.orcid+json' } }
      );
    });
  });

  describe('renderOrcidSearchResults', () => {
    test('renders results into table body', () => {
      const results = [
        {
          'orcid-id': '0000-0001-1111-2222',
          'given-names': 'Alice',
          'family-names': 'Wonderland',
          'institution-name': ['Oxford University']
        },
        {
          'orcid-id': '0000-0002-3333-4444',
          'given-names': 'Bob',
          'family-names': 'Builder',
          'institution-name': ['MIT', 'Harvard']
        }
      ];

      orcidSearchModule.renderOrcidSearchResults(results);

      const tbody = document.getElementById('orcid-search-results-body');
      expect(tbody.children.length).toBe(2);
      expect(document.getElementById('orcid-search-results').classList.contains('d-none')).toBe(false);
      expect(document.getElementById('orcid-search-no-results').classList.contains('d-none')).toBe(true);

      // First row
      const firstRow = tbody.children[0];
      expect(firstRow.querySelector('a').textContent).toBe('0000-0001-1111-2222');
      expect(firstRow.querySelector('a').href).toContain('orcid.org/0000-0001-1111-2222');
      expect(firstRow.children[1].textContent).toBe('Wonderland');
      expect(firstRow.children[2].textContent).toBe('Alice');
      expect(firstRow.querySelector('small').textContent).toBe('Oxford University');

      // Second row affiliations
      const secondRow = tbody.children[1];
      expect(secondRow.querySelector('small').textContent).toBe('MIT, Harvard');
    });

    test('shows no-results message for empty array', () => {
      orcidSearchModule.renderOrcidSearchResults([]);

      expect(document.getElementById('orcid-search-results').classList.contains('d-none')).toBe(true);
      expect(document.getElementById('orcid-search-no-results').classList.contains('d-none')).toBe(false);
    });

    test('shows no-results message for null input', () => {
      orcidSearchModule.renderOrcidSearchResults(null);

      expect(document.getElementById('orcid-search-results').classList.contains('d-none')).toBe(true);
      expect(document.getElementById('orcid-search-no-results').classList.contains('d-none')).toBe(false);
    });

    test('handles results with missing institution-name', () => {
      const results = [
        {
          'orcid-id': '0000-0001-1111-2222',
          'given-names': 'Solo',
          'family-names': 'Artist'
        }
      ];

      orcidSearchModule.renderOrcidSearchResults(results);

      const tbody = document.getElementById('orcid-search-results-body');
      expect(tbody.children.length).toBe(1);
      expect(tbody.children[0].querySelector('small').textContent).toBe('');
    });

    test('handles results with missing given/family names', () => {
      const results = [
        {
          'orcid-id': '0000-0001-1111-2222'
        }
      ];

      orcidSearchModule.renderOrcidSearchResults(results);

      const tbody = document.getElementById('orcid-search-results-body');
      expect(tbody.children.length).toBe(1);
      expect(tbody.children[0].children[1].textContent).toBe('');
      expect(tbody.children[0].children[2].textContent).toBe('');
    });

    test('renders accept button with correct data-orcid attribute', () => {
      const results = [
        { 'orcid-id': '0000-0001-9999-8888', 'given-names': 'Test', 'family-names': 'User', 'institution-name': [] }
      ];

      orcidSearchModule.renderOrcidSearchResults(results);

      const btn = document.querySelector('.orcid-search-accept-btn');
      expect(btn).not.toBeNull();
      expect(btn.dataset.orcid).toBe('0000-0001-9999-8888');
    });

    test('clears previous results before rendering new ones', () => {
      orcidSearchModule.renderOrcidSearchResults([
        { 'orcid-id': '0000-0001-0000-0001', 'given-names': 'A', 'family-names': 'B', 'institution-name': [] }
      ]);

      let tbody = document.getElementById('orcid-search-results-body');
      expect(tbody.children.length).toBe(1);

      orcidSearchModule.renderOrcidSearchResults([
        { 'orcid-id': '0000-0002-0000-0002', 'given-names': 'C', 'family-names': 'D', 'institution-name': [] },
        { 'orcid-id': '0000-0003-0000-0003', 'given-names': 'E', 'family-names': 'F', 'institution-name': [] }
      ]);

      tbody = document.getElementById('orcid-search-results-body');
      expect(tbody.children.length).toBe(2);
    });
  });

  describe('resetOrcidSearchModal', () => {
    test('clears all input fields and hides result areas', () => {
      document.getElementById('input-orcid-search-firstname').value = 'Max';
      document.getElementById('input-orcid-search-lastname').value = 'Mustermann';
      document.getElementById('orcid-search-results').classList.remove('d-none');
      document.getElementById('orcid-search-no-results').classList.remove('d-none');
      document.getElementById('orcid-search-spinner').classList.remove('d-none');
      const alertEl = document.getElementById('orcid-search-alert');
      alertEl.classList.remove('d-none');
      alertEl.textContent = 'Some error';
      document.getElementById('orcid-search-results-body').innerHTML = '<tr><td>test</td></tr>';

      orcidSearchModule.resetOrcidSearchModal();

      expect(document.getElementById('input-orcid-search-firstname').value).toBe('');
      expect(document.getElementById('input-orcid-search-lastname').value).toBe('');
      expect(document.getElementById('orcid-search-results').classList.contains('d-none')).toBe(true);
      expect(document.getElementById('orcid-search-no-results').classList.contains('d-none')).toBe(true);
      expect(document.getElementById('orcid-search-spinner').classList.contains('d-none')).toBe(true);
      expect(alertEl.classList.contains('d-none')).toBe(true);
      expect(alertEl.textContent).toBe('');
      expect(document.getElementById('orcid-search-results-body').innerHTML).toBe('');
    });
  });

  describe('getModalContext', () => {
    test('returns author context with correct row and field mapping', () => {
      document.getElementById('orcid-search-context-group').value = 'author';
      document.getElementById('orcid-search-context-row-index').value = '0';

      const context = orcidSearchModule.getModalContext();

      expect(context).not.toBeNull();
      expect(context.row.length).toBe(1);
      expect(context.fieldMapping).toBe(AUTHOR_FIELD_MAPPING);
      expect(context.orcidField).toBe('input[name="orcids[]"]');
    });

    test('returns contributor context with correct row and field mapping', () => {
      document.getElementById('orcid-search-context-group').value = 'contributor';
      document.getElementById('orcid-search-context-row-index').value = '0';

      const context = orcidSearchModule.getModalContext();

      expect(context).not.toBeNull();
      expect(context.row.length).toBe(1);
      expect(context.fieldMapping).toBe(CONTRIBUTOR_FIELD_MAPPING);
      expect(context.orcidField).toBe('input[name="cbORCID[]"]');
    });

    test('returns null for unknown group type', () => {
      document.getElementById('orcid-search-context-group').value = 'unknown';
      document.getElementById('orcid-search-context-row-index').value = '0';

      expect(orcidSearchModule.getModalContext()).toBeNull();
    });

    test('returns null for out-of-range row index', () => {
      document.getElementById('orcid-search-context-group').value = 'author';
      document.getElementById('orcid-search-context-row-index').value = '99';

      expect(orcidSearchModule.getModalContext()).toBeNull();
    });

    test('returns null for empty context', () => {
      document.getElementById('orcid-search-context-group').value = '';
      document.getElementById('orcid-search-context-row-index').value = '';

      expect(orcidSearchModule.getModalContext()).toBeNull();
    });
  });

  describe('showOrcidSearchAlert', () => {
    test('shows alert with warning style by default', () => {
      orcidSearchModule.showOrcidSearchAlert('Test warning');

      const alertEl = document.getElementById('orcid-search-alert');
      expect(alertEl.textContent).toBe('Test warning');
      expect(alertEl.className).toBe('alert alert-warning');
    });

    test('shows alert with danger style', () => {
      orcidSearchModule.showOrcidSearchAlert('Error happened', 'danger');

      const alertEl = document.getElementById('orcid-search-alert');
      expect(alertEl.textContent).toBe('Error happened');
      expect(alertEl.className).toBe('alert alert-danger');
    });
  });

  describe('click event on .orcid-search-btn', () => {
    test('stores author context when button in author row is clicked', () => {
      // Add search button to author row
      const authorRow = document.querySelector('[data-creator-row]');
      const btn = document.createElement('button');
      btn.className = 'orcid-search-btn';
      authorRow.appendChild(btn);

      // Trigger click
      $(btn).trigger('click');

      expect(document.getElementById('orcid-search-context-group').value).toBe('author');
      expect(document.getElementById('orcid-search-context-row-index').value).toBe('0');
    });

    test('stores contributor context when button in contributor row is clicked', () => {
      const contribRow = document.querySelector('[contributor-person-row]');
      const btn = document.createElement('button');
      btn.className = 'orcid-search-btn';
      contribRow.appendChild(btn);

      $(btn).trigger('click');

      expect(document.getElementById('orcid-search-context-group').value).toBe('contributor');
      expect(document.getElementById('orcid-search-context-row-index').value).toBe('0');
    });
  });

  describe('Enter key triggers search', () => {
    test('pressing Enter in firstname field triggers search', async () => {
      document.getElementById('input-orcid-search-firstname').value = 'John';
      document.getElementById('input-orcid-search-lastname').value = 'Doe';

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 'expanded-result': [] })
      });

      const event = $.Event('keydown', { key: 'Enter' });
      $('#input-orcid-search-firstname').trigger(event);

      await flushPromises();
      await flushPromises();

      expect(fetch).toHaveBeenCalled();
    });

    test('pressing Enter in lastname field triggers search', async () => {
      document.getElementById('input-orcid-search-firstname').value = '';
      document.getElementById('input-orcid-search-lastname').value = 'Smith';

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 'expanded-result': [] })
      });

      const event = $.Event('keydown', { key: 'Enter' });
      $('#input-orcid-search-lastname').trigger(event);

      await flushPromises();
      await flushPromises();

      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('search execution integration', () => {
    test('shows validation alert when both fields are empty', async () => {
      document.getElementById('input-orcid-search-firstname').value = '';
      document.getElementById('input-orcid-search-lastname').value = '';

      $('#button-orcid-search-execute').trigger('click');
      await flushPromises();

      const alertEl = document.getElementById('orcid-search-alert');
      expect(alertEl.classList.contains('d-none')).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    test('executes search and renders results', async () => {
      document.getElementById('input-orcid-search-firstname').value = 'John';
      document.getElementById('input-orcid-search-lastname').value = 'Doe';

      const mockResults = [
        { 'orcid-id': '0000-0001-1111-2222', 'given-names': 'John', 'family-names': 'Doe', 'institution-name': ['MIT'] }
      ];
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 'expanded-result': mockResults })
      });

      $('#button-orcid-search-execute').trigger('click');
      await flushPromises();
      await flushPromises();

      expect(fetch).toHaveBeenCalled();
      const tbody = document.getElementById('orcid-search-results-body');
      expect(tbody.children.length).toBe(1);
      expect(document.getElementById('orcid-search-spinner').classList.contains('d-none')).toBe(true);
    });

    test('shows error alert on API failure', async () => {
      document.getElementById('input-orcid-search-firstname').value = 'Fail';
      document.getElementById('input-orcid-search-lastname').value = 'Test';

      fetch.mockResolvedValueOnce({ ok: false, status: 503 });

      $('#button-orcid-search-execute').trigger('click');
      await flushPromises();
      await flushPromises();

      const alertEl = document.getElementById('orcid-search-alert');
      expect(alertEl.classList.contains('d-none')).toBe(false);
      expect(alertEl.className).toContain('alert-danger');
    });
  });

  describe('result selection integration', () => {
    test('selecting a result fills author row and ORCID field', async () => {
      // Set context for author row
      document.getElementById('orcid-search-context-group').value = 'author';
      document.getElementById('orcid-search-context-row-index').value = '0';

      // Set up tagify on affiliation field
      const affInput = document.getElementById('input-author-affiliation');
      affInput._tagify = new MockTagify(affInput);

      // Render a result
      orcidSearchModule.renderOrcidSearchResults([
        { 'orcid-id': '0000-0001-5555-6666', 'given-names': 'Marie', 'family-names': 'Curie', 'institution-name': ['Sorbonne'] }
      ]);

      // Mock the record fetch
      const mockRecord = {
        person: {
          name: {
            'family-name': { value: 'Curie' },
            'given-names': { value: 'Marie' }
          }
        },
        'activities-summary': {
          employments: {
            'affiliation-group': [{
              summaries: [{
                'employment-summary': {
                  organization: {
                    name: 'Sorbonne University',
                    'disambiguated-organization': {
                      'disambiguation-source': 'ROR',
                      'disambiguated-organization-identifier': 'https://ror.org/02en5vm52'
                    }
                  }
                }
              }]
            }]
          }
        }
      };
      fetch.mockResolvedValueOnce({ json: () => Promise.resolve(mockRecord) });

      // Click accept button
      const acceptBtn = document.querySelector('.orcid-search-accept-btn');
      $(acceptBtn).trigger('click');
      await flushPromises();
      await flushPromises();

      // Check that ORCID field is filled
      expect($('input[name="orcids[]"]').val()).toBe('0000-0001-5555-6666');
      // Check name fields
      expect($('input[name="familynames[]"]').val()).toBe('Curie');
      expect($('input[name="givennames[]"]').val()).toBe('Marie');
      // Check affiliations
      expect(affInput._tagify.value).toEqual([{ value: 'Sorbonne University' }]);
      expect(document.getElementById('input-author-rorid').value).toBe('https://ror.org/02en5vm52');
    });

    test('selecting a result fills contributor row and ORCID field', async () => {
      document.getElementById('orcid-search-context-group').value = 'contributor';
      document.getElementById('orcid-search-context-row-index').value = '0';

      const affInput = document.getElementById('input-contributorpersons-affiliation');
      affInput._tagify = new MockTagify(affInput);

      orcidSearchModule.renderOrcidSearchResults([
        { 'orcid-id': '0000-0002-7777-8888', 'given-names': 'Alan', 'family-names': 'Turing', 'institution-name': ['Cambridge'] }
      ]);

      const mockRecord = {
        person: {
          name: {
            'family-name': { value: 'Turing' },
            'given-names': { value: 'Alan' }
          }
        },
        'activities-summary': {
          employments: {
            'affiliation-group': [{
              summaries: [{
                'employment-summary': {
                  organization: {
                    name: 'University of Cambridge',
                    'disambiguated-organization': {
                      'disambiguation-source': 'ROR',
                      'disambiguated-organization-identifier': '01aaaa111'
                    }
                  }
                }
              }]
            }]
          }
        }
      };
      fetch.mockResolvedValueOnce({ json: () => Promise.resolve(mockRecord) });

      const acceptBtn = document.querySelector('.orcid-search-accept-btn');
      $(acceptBtn).trigger('click');
      await flushPromises();
      await flushPromises();

      expect($('input[name="cbORCID[]"]').val()).toBe('0000-0002-7777-8888');
      expect($('input[name="cbPersonLastname[]"]').val()).toBe('Turing');
      expect($('input[name="cbPersonFirstname[]"]').val()).toBe('Alan');
      expect(affInput._tagify.value).toEqual([{ value: 'University of Cambridge' }]);
      expect(document.getElementById('input-contributor-personrorid').value).toBe('https://ror.org/01aaaa111');
    });

    test('shows error when record fetch fails during selection', async () => {
      document.getElementById('orcid-search-context-group').value = 'author';
      document.getElementById('orcid-search-context-row-index').value = '0';

      orcidSearchModule.renderOrcidSearchResults([
        { 'orcid-id': '0000-0000-0000-0000', 'given-names': 'Err', 'family-names': 'Or', 'institution-name': [] }
      ]);

      fetch.mockRejectedValueOnce(new Error('Network error'));

      const acceptBtn = document.querySelector('.orcid-search-accept-btn');
      $(acceptBtn).trigger('click');
      await flushPromises();
      await flushPromises();

      const alertEl = document.getElementById('orcid-search-alert');
      expect(alertEl.classList.contains('d-none')).toBe(false);
    });
  });
});
