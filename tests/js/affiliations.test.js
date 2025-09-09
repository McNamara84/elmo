const { requireFresh } = require('./utils');

let $;
let autocompleteAffiliations;
let refreshTagifyInstances;

/**
 * Mock implementation of Tagify used for testing.
 */
class MockTagify {
  constructor(el, options) {
    this.el = el;
    this.settings = options;
    this.whitelist = options.whitelist;
    this.value = [];
    this.DOM = { input: { style: { width: '' } } };
    this.dropdown = { hide: jest.fn() };
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
    $.getJSON = jest.fn((file, cb) => cb([]));
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    global.Tagify = MockTagify;
    global.translations = { general: { affiliation: 'affiliation' } };

    ({ autocompleteAffiliations, refreshTagifyInstances } = requireFresh('../../js/affiliations.js'));
  });

  /**
   * Ensures a Tagify instance is created with the provided whitelist.
   */
  test('autocompleteAffiliations creates Tagify instance with whitelist', () => {
    const data = [ { id: '1', name: 'TestOrg', other: ['Alias1', 'Alias2'] } ];
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid', data);

    const input = document.getElementById('input-author-affiliation');
    expect(input.tagify).toBeInstanceOf(MockTagify);
    expect(input.tagify.whitelist).toEqual([
      { value: 'TestOrg', id: '1', other: ['Alias1', 'Alias2'] }
    ]);
  });

  /**
   * Verifies that adding tags updates the hidden field and hides the dropdown for unknown values.
   */
  test('adding a tag updates hidden field and closes dropdown for non-whitelist', () => {
    const data = [ { id: '1', name: 'Allowed' } ];
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid', data);
    const input = document.getElementById('input-author-affiliation');
    const hidden = document.getElementById('input-author-rorid');

    input.tagify.trigger('add', { data: { value: 'Allowed', id: '1' } });
    expect(hidden.value).toBe('1');

    input.tagify.trigger('add', { data: { value: 'Unknown' } });
    expect(input.tagify.dropdown.hide).toHaveBeenCalled();
  });

  /**
   * Checks that the remove event clears tags when no contact person is specified.
   */
  test('remove event clears tags when contact person empty', () => {
    const data = [ { id: '1', name: 'Org' } ];
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid', data);
    const input = document.getElementById('input-author-affiliation');

    input.tagify.addTags('Org');
    expect(input.tagify.value.length).toBe(1);

    input.tagify.trigger('remove');
    expect(input.tagify.value.length).toBe(0);
  });

  /**
   * Confirms that input events resize the tagify input width.
   */
  test('input event resizes input width', () => {
    const data = [];
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid', data);
    const input = document.getElementById('input-author-affiliation');

    input.tagify.trigger('input', { value: 'abcd' });
    expect(input.tagify.DOM.input.style.width).toBe('40px');
  });

  /**
   * Ensures refreshTagifyInstances updates the whitelist while retaining existing tags.
   */
  test('refreshTagifyInstances updates whitelist and keeps tags', () => {
    const data = [ { id: '1', name: 'First', other: ['Alt1'] } ];
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid', data);
    const input = document.getElementById('input-author-affiliation');
    input.tagify.addTags('First');

    window.affiliationsData = [ { id: '2', name: 'Second', other: ['Alt2'] } ];
    refreshTagifyInstances();

     expect(input.tagify.settings.whitelist).toEqual([
      { value: 'Second', id: '2', other: ['Alt2'] }
    ]);
    expect(input.tagify.value[0].value).toBe('First');
  });
});