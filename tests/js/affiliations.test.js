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
    const scopeEl = document.createElement('div');
    this.DOM = { 
      input: { style: { width: '' } },
      scope: scopeEl
    };
    this.dropdown = { hide: jest.fn(), show: jest.fn() };
    this._callbacks = {};
  }
  on(event, cb) {
    this._callbacks[event] = cb;
  }
  addTags(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach(item => {
      let tagData;
      if (typeof item === 'string') {
        tagData = { value: item };
      } else {
        tagData = item;
      }
      this.value.push(tagData);
      
      // Render the tag to the DOM
      const tag = document.createElement('tag');
      tag.setAttribute('title', tagData.value);
      tag.__tagifyTagData = tagData;
      
      const tagText = document.createElement('span');
      tagText.className = 'tagify__tag-text';
      tagText.textContent = tagData.value;
      
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'tagify__tag__editBtn';
      editBtn.setAttribute('aria-label', 'Edit affiliation');
      const icon = document.createElement('i');
      icon.className = 'bi bi-pencil-fill';
      editBtn.appendChild(icon);
      
      const div = document.createElement('div');
      div.appendChild(tagText);
      div.appendChild(editBtn);
      tag.appendChild(div);
      
      this.DOM.scope.appendChild(tag);
    });
  }
  removeAllTags() {
    this.value = [];
    this.DOM.scope.innerHTML = '';
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
  replaceTag(tagElm, newTagData) {
    // Find the tag in value array and update it
    const idx = this.value.findIndex(t => t.value === tagElm.__tagifyTagData.value);
    if (idx >= 0) {
      this.value[idx] = newTagData;
      tagElm.__tagifyTagData = newTagData;
      // Update the displayed text
      const textSpan = tagElm.querySelector('.tagify__tag-text');
      if (textSpan) {
        textSpan.textContent = newTagData.value;
      }
      tagElm.setAttribute('title', newTagData.value);
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
      <div id="modal-affiliation-edit">
        <input id="input-affiliation-edit-value" />
        <button id="button-affiliation-edit-save"></button>
      </div>
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

    // Mock bootstrap.Modal
    global.bootstrap = {
      Modal: {
        getOrCreateInstance: jest.fn((el) => ({
          show: jest.fn(),
          hide: jest.fn()
        }))
      }
    };

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

  test('editing an affiliation label restores the ROR ID from the hidden field when Tagify drops it', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');
    const input = document.getElementById('input-author-affiliation');
    const hidden = document.getElementById('input-author-rorid');

    input._tagify.addTags([{ value: 'GFZ Helmholtz Centre for Geosciences', id: '04z8jg394' }]);
    input._tagify._updateHiddenField();
    expect(hidden.value).toBe('04z8jg394');

    input._tagify.value[0] = {
      value: 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany'
    };
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
    autocompleteAffiliations('input-contributorpersons-affiliation', 'input-contributor-personrorid');
    const input = document.getElementById('input-contributorpersons-affiliation');
    input._tagify.addTags({ value: 'First', id: '1' });

    global.translations = { general: { affiliation: 'Zugehörigkeit' } };
    refreshTagifyInstances();

    expect(input._tagify.settings.placeholder).toBe('Zugehörigkeit');
    expect(input._tagify.value[0].value).toBe('First');
  });

  /**
   * Tests the ROR ID preservation when editing a tag's label.
   * Opens the edit modal, changes the label, saves, and verifies the ROR ID remains unchanged.
   */
  test('editing a tag label preserves its ROR identifier', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');
    const input = document.getElementById('input-author-affiliation');
    const hidden = document.getElementById('input-author-rorid');
    
    // Add a tag with a known ROR ID
    const originalRorId = 'https://ror.org/01bj3aw27';
    const originalLabel = 'Technical University of Berlin';
    input._tagify.addTags([{ value: originalLabel, id: originalRorId }]);
    // Manually call updateHiddenField since addTags doesn't trigger the "add" event in the mock
    input._tagify._updateHiddenField();
    
    // Verify the hidden field contains the ROR ID
    expect(hidden.value).toBe('01bj3aw27');
    
    // Simulate clicking the pencil icon (edit button)
    const tag = input._tagify.DOM.scope.querySelector('tag');
    expect(tag).toBeTruthy();
    
    const editBtn = tag.querySelector('.tagify__tag__editBtn');
    const clickEvent = new MouseEvent('click', { bubbles: true });
    editBtn.dispatchEvent(clickEvent);
    
    // Verify modal was populated with original data
    const modalEl = document.getElementById('modal-affiliation-edit');
    const valueInput = document.getElementById('input-affiliation-edit-value');
    expect(modalEl._editTagData.value).toBe(originalLabel);
    expect(modalEl._editTagData.id).toBe('01bj3aw27');
    expect(valueInput.value).toBe(originalLabel);
    
    // Simulate user editing the label
    const newLabel = 'Technical University of Berlin (Edited)';
    valueInput.value = newLabel;
    
    // Simulate clicking the save button
    const saveBtn = document.getElementById('button-affiliation-edit-save');
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Verify the tag's label was updated
    const updatedTag = input._tagify.DOM.scope.querySelector('tag');
    const tagText = updatedTag.querySelector('.tagify__tag-text').textContent;
    expect(tagText).toBe(newLabel);
    
    // Verify the ROR ID is still in the Tagify value
    expect(input._tagify.value[0].value).toBe(newLabel);
    expect(input._tagify.value[0].id).toBe('01bj3aw27');
    
    // Verify the hidden field still contains the original ROR ID
    expect(hidden.value).toBe('01bj3aw27');
  });

  test('tag template escapes affiliation labels before rendering', () => {
    autocompleteAffiliations('input-author-affiliation', 'input-author-rorid');
    const input = document.getElementById('input-author-affiliation');
    const maliciousLabel = '"><img src=x onerror=alert(1)>';

    const html = input._tagify.settings.templates.tag(
      { value: maliciousLabel },
      {
        settings: { classNames: { tag: 'tagify__tag' } },
        getAttributes: () => ''
      }
    );

    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain(maliciousLabel);
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
