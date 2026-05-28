const { requireFresh } = require('./utils');

let $;
let autocompleteAffiliations;
let refreshTagifyInstances;
let searchAffiliationsFromServer;

/**
 * Mock implementation of Tagify used for testing.
 */
class MockTagify {
  constructor(el, options) {
    this.el = el;
    this.settings = options;
    this.whitelist = options.whitelist || [];
    this.value = [];
    this.DOM = { input: { style: { width: '' } } };
    this.dropdown = { hide: jest.fn(), show: jest.fn() };
    this._callbacks = {};
  }
  on(event, cb) {
    this._callbacks[event] = cb;
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
  loading(state) {
    this._loading = state;
  }
  trigger(event, detail) {
    if (event === 'add' && detail?.data) {
      this.addTags({ value: detail.data.value, id: detail.data.id });
    }
    if (event === 'remove') {
      this.removeAllTags();
    }
    if (this._callbacks[event]) {
      this._callbacks[event]({ detail });
    }
  }
}

/**
 * Tests for the affiliations.js module.
 */
describe('affiliations.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-authorinstitution-row>
        <input id="input-authorinstitution-name" name="authorinstitutionName[]" />
        <input id="input-authorinstitution-affiliation" name="institutionAffiliation[]" />
        <input id="input-author-institutionrorid" name="authorInstitutionRorIds[]" />
      </div>
      <input id="input-author-affiliation" />
      <input id="input-author-rorid" />
      <input id="input-contactperson-affiliation" />
      <input id="input-contactperson-rorid" />
      <input id="input-contributorpersons-affiliation" />
      <input id="input-contributor-personrorid" />
      <input id="input-contributor-organisationaffiliation" />
      <input id="input-contributor-organisationrorid" />
      <input id="contact-person-field" />
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    global.Tagify = MockTagify;
    global.translations = { general: { affiliation: 'affiliation' } };

    // Mock fetch for server-side search
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    );

    window.applyTagifyAccessibilityAttributes = jest.fn();

    ({ autocompleteAffiliations, refreshTagifyInstances, searchAffiliationsFromServer } = requireFresh('../../js/affiliations.js'));
  });

  afterEach(() => {
    jest.resetModules();
    delete global.Tagify;
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete window.applyTagifyAccessibilityAttributes;
    delete global.fetch;
  });

  /**
   * Ensures a Tagify instance is created with empty whitelist (server search mode).
   */
  test('autocompleteAffiliations creates Tagify instance with empty whitelist', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');

    const input = document.getElementById('input-author-affiliation');
    expect(input._tagify).toBeInstanceOf(MockTagify);
    // Whitelist should be empty initially as data comes from server
    expect(input._tagify.whitelist).toEqual([]);
  });

  /**
   * Verifies that adding tags updates the hidden field and hides the dropdown for unknown values.
   */
  test('adding a tag updates hidden field and closes dropdown for non-whitelist', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');
    const input = document.getElementById('input-author-affiliation');
    const hidden = document.getElementById('input-author-rorid');

    // Simulate adding a tag from whitelist
    input._tagify.whitelist = [{ value: 'Allowed', id: '1' }];
    input._tagify.trigger('add', { data: { value: 'Allowed', id: '1' } });
    expect(hidden.value).toBe('1');

    // Adding unknown value should close dropdown
    input._tagify.trigger('add', { data: { value: 'Unknown' } });
    expect(input._tagify.dropdown.hide).toHaveBeenCalled();
  });

  test('editing an affiliation label keeps the structured ROR ID', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');
    const input = document.getElementById('input-author-affiliation');
    const hidden = document.getElementById('input-author-rorid');

    input._tagify.whitelist = [{ value: 'GFZ Helmholtz Centre for Geosciences', id: '04z8jg394' }];
    input._tagify.trigger('add', {
      data: { value: 'GFZ Helmholtz Centre for Geosciences', id: '04z8jg394' }
    });

    input._tagify.value[0].value = 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany';
    input._tagify.trigger('edit:updated', { data: input._tagify.value[0] });

    expect(hidden.value).toBe('04z8jg394');
    expect(JSON.parse(input.value)).toEqual([
      {
        value: 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
        label: 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
        rorId: '04z8jg394',
        id: '04z8jg394'
      }
    ]);
  });

  /**
   * Checks that the remove event clears tags when no contact person is specified.
   */
  test('remove event clears tags when contact person empty', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');
    const input = document.getElementById('input-author-affiliation');

    input._tagify.addTags('Org');
    expect(input._tagify.value.length).toBe(1);

    input._tagify.trigger('remove');
    expect(input._tagify.value.length).toBe(0);
  });

  /**
   * Tests the server-side search function.
   */
  test('searchAffiliationsFromServer returns empty array for short query', async () => {
    const result = await searchAffiliationsFromServer('a');
    expect(result).toEqual([]);
    // fetch should not be called for queries shorter than 2 chars
    expect(global.fetch).not.toHaveBeenCalled();
  });

  /**
   * Tests the server-side search function with valid query.
   */
  test('searchAffiliationsFromServer fetches from server for valid query', async () => {
    const mockResults = [
      { id: 'https://ror.org/123', name: 'Test University', other: ['TU'] }
    ];
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })
    );

    const result = await searchAffiliationsFromServer('Test');
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api/v2/affiliations/search?q=Test')
    );
    expect(result).toEqual(mockResults);
  });

  /**
   * Tests server-side search handles errors gracefully.
   */
  test('searchAffiliationsFromServer returns empty array on error', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500
      })
    );

    const result = await searchAffiliationsFromServer('Test');
    expect(result).toEqual([]);
  });

  /**
   * Ensures refreshTagifyInstances updates placeholder and keeps tags.
   */
  test('refreshTagifyInstances updates placeholder and keeps tags', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');
    const input = document.getElementById('input-author-affiliation');
    input._tagify.addTags({ value: 'First', id: '1' });

    global.translations = { general: { affiliation: 'Zugehörigkeit' } };
    refreshTagifyInstances();

    expect(input._tagify.settings.placeholder).toBe('Zugehörigkeit');
    expect(input._tagify.value[0].value).toBe('First');
  });

  /**
   * Verifies that author institution name becomes required when affiliations are present.
   */
  test('author institution requirement syncs with Tagify selections', async () => {
    autocompleteAffiliations('input-authorinstitution-affiliation', 'input-author-institutionrorid');

    const affiliationInput = document.getElementById('input-authorinstitution-affiliation');
    const nameInput = document.getElementById('input-authorinstitution-name');

    expect(nameInput.hasAttribute('required')).toBe(false);
    expect(nameInput.hasAttribute('aria-required')).toBe(false);

    affiliationInput._tagify.trigger('add', { data: { value: 'Helmholtz', id: '1' } });
    nameInput.required = true;
    await Promise.resolve();

    expect(nameInput.getAttribute('required')).toBe('required');
    expect(nameInput.getAttribute('aria-required')).toBe('true');

    const addCall = window.applyTagifyAccessibilityAttributes.mock.calls.at(-1);
    expect(addCall[0]).toBe(affiliationInput._tagify);
    expect(addCall[1]).toBe(affiliationInput);
    expect(addCall[2]).toMatchObject({ isRequired: true });

    window.applyTagifyAccessibilityAttributes.mockClear();

    affiliationInput._tagify.trigger('remove');
    await Promise.resolve();

    expect(nameInput.hasAttribute('required')).toBe(false);
    expect(nameInput.hasAttribute('aria-required')).toBe(false);

    const removeCall = window.applyTagifyAccessibilityAttributes.mock.calls.at(-1);
    expect(removeCall[2]).toMatchObject({ isRequired: false });
  });
});
