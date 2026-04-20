const fs = require('fs');
const path = require('path');

class MockTagify {
  constructor(el, settings) {
    this.el = el;
    this.settings = settings;
    this.value = [];
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
  removeTag(tag) {
    this.value = this.value.filter(v => v.value !== tag);
  }
  trigger(event, detail) {
    if (event === 'add' && detail?.data) {
      this.addTags(detail.data.value || detail.data);
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
 * Mock availability response from ERNIE API.
 * Enables science_keywords and platforms, disables instruments.
 */
const mockAvailability = {
  science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
  platforms: { available: true, displayName: 'GCMD Platforms' },
  instruments: { available: false, displayName: 'GCMD Instruments' },
  chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
  gemet: { available: false, displayName: 'GEMET Thesaurus' },
};

const mockVocabularyData = {
  data: [
    { id: 'root', text: 'Root', scheme: 'Test', schemeURI: 'http://test', language: 'en', description: '', children: [
      { id: 'child', text: 'Child', scheme: 'Test', schemeURI: 'http://test', language: 'en', description: '' }
    ] }
  ]
};

function transformThesauriScript(source) {
  let script = source;
  script = script.replace('export function filterTreeByRoot', 'function filterTreeByRoot');
  script = script.replace('export const THESAURUS_CONFIG =', 'const THESAURUS_CONFIG =');
  script = script.replace('export let currentActiveInput = null;', 'let currentActiveInput = null;');
  script = script.replace('export function cleanupTagifyForInput', 'function cleanupTagifyForInput');
  script = script.replace('export function initTagifyForInput', 'function initTagifyForInput');
  script += '\nwindow.__thesauriTestExports = { filterTreeByRoot, THESAURUS_CONFIG, initTagifyForInput };';
  return script;
}

describe('thesauri.js', () => {
  let $;

  beforeEach((done) => {
    // Minimal HTML containers (thesauri.js generates accordion items + modals dynamically)
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" class="card mb-2" style="display: none;">
        <div class="card-header"><b data-translate="keywords.thesaurus.name"></b></div>
        <div id="thesaurusKeywordsGroup">
          <div class="accordion p-2" id="accordionThesauri"></div>
        </div>
      </div>
      <div id="thesaurusModalsContainer"></div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    // Mock jstree plugin
    (function ($) {
      class JsTreeMock {
        constructor($el, opts) {
          this.$el = $el;
          this.data = opts.core.data;
          this.map = {};
          const build = (nodes, parent) => {
            nodes.forEach(node => {
              const n = { id: node.id, text: node.text, parent, children: [] };
              this.map[node.id] = n;
              if (node.children) {
                n.children = build(node.children, n);
              }
            });
          };
          build(this.data, null);
          this.selected = [];
        }
        get_selected(full) {
          return full ? this.selected : this.selected.map(n => n.id);
        }
        get_path(node, sep) {
          let cur = node;
          const parts = [];
          while (cur) {
            parts.unshift(cur.text);
            cur = cur.parent;
          }
          return parts.join(sep);
        }
        get_json(root, opts) {
          if (opts && opts.flat) {
            return Object.values(this.map);
          }
          return this.data;
        }
        select_node(id) {
          const node = this.map[id];
          if (node && !this.selected.includes(node)) {
            this.selected.push(node);
            this.$el.trigger('changed.jstree', [{ instance: this }]);
          }
        }
        deselect_node(id) {
          const node = this.map[id];
          this.selected = this.selected.filter(n => n !== node);
          this.$el.trigger('changed.jstree', [{ instance: this }]);
        }
        search(str) {
          this.lastSearch = str;
        }
      }
      $.fn.jstree = function(arg, arg2) {
        if (arg === undefined || arg === true) {
          return this.data('jstree');
        }
        if (typeof arg === 'string') {
          const inst = this.data('jstree');
          if (arg === 'get_selected') return inst.get_selected(arg2);
          if (arg === 'deselect_node') { inst.deselect_node(arg2); return this; }
          if (arg === 'select_node') { inst.select_node(arg2); return this; }
        } else if (typeof arg === 'object') {
          const inst = new JsTreeMock(this, arg);
          this.data('jstree', inst);
          return this;
        }
        return this;
      };
    })($);

    global.Tagify = MockTagify;
    global.translations = {
      keywords: {
        thesaurus: { label: 'initial', name: 'Thesauri Keywords', unavailable: 'Unavailable' },
        searchPlaceholder: 'Search for keywords...',
        selectedKeywords: 'Selected Keywords'
      },
      general: { loading: 'Loading...' }
    };
    window.ELMO_FEATURES = {
      showThesauri: true,
      showMslVocabs: false
    };

    // Mock $.getJSON: availability endpoint returns mock, vocabulary endpoints return data
    $.getJSON = jest.fn((url, cb) => {
      const mockDeferred = {
        done: jest.fn(function(fn) { fn(this._data); return this; }),
        fail: jest.fn().mockReturnThis(),
        _data: null,
      };

      if (url === 'api/v2/vocabs/thesauri/availability') {
        // Async-like: call done callback via deferred
        mockDeferred._data = mockAvailability;
        return mockDeferred;
      } else if (url.startsWith('api/v2/vocabs/thesauri/')) {
        // Vocabulary data endpoint — called synchronously with callback
        if (typeof cb === 'function') cb(mockVocabularyData);
        return { fail: jest.fn().mockReturnThis() };
      }

      if (typeof cb === 'function') cb({ data: [] });
      return { fail: jest.fn().mockReturnThis() };
    });

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(transformThesauriScript(script));

    $(document).ready(() => {
      document.dispatchEvent(new Event('translationsLoaded'));
      done();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.Tagify;
    delete global.translations;
    delete window.ELMO_FEATURES;
  });

  /**
   * Helper function to simulate opening a modal and trigger lazy loading
   */
  function openModal(modalId) {
    const modal = document.querySelector(modalId);
    if (modal) {
      modal.dispatchEvent(new Event('show.bs.modal'));
    }
  }

  test('fetches availability and generates accordion items for available thesauri', () => {
    // availability was called
    expect($.getJSON).toHaveBeenCalledWith('api/v2/vocabs/thesauri/availability');

    // Should generate accordion items only for available thesauri (science_keywords and platforms)
    const accordionItems = document.querySelectorAll('#accordionThesauri .accordion-item');
    expect(accordionItems.length).toBe(2);

    // Should generate modals
    const modals = document.querySelectorAll('#thesaurusModalsContainer .modal');
    expect(modals.length).toBe(2);

    // Form group should be visible
    const formGroup = document.getElementById('thesaurusKeywordsFormGroup');
    expect(formGroup.style.display).toBe('');
  });

  test('generates input fields with correct IDs and names', () => {
    const scienceInput = document.getElementById('input-sciencekeyword');
    expect(scienceInput).not.toBeNull();
    expect(scienceInput.getAttribute('name')).toBe('gcmdScienceKeywords');

    const platformsInput = document.getElementById('input-platforms');
    expect(platformsInput).not.toBeNull();
    expect(platformsInput.getAttribute('name')).toBe('platforms');

    // instruments should NOT be generated (available: false)
    const instrumentsInput = document.getElementById('input-instruments');
    expect(instrumentsInput).toBeNull();
  });

  test('initializes Tagify on generated inputs', () => {
    const scienceInput = document.getElementById('input-sciencekeyword');
    expect(scienceInput._tagify).toBeInstanceOf(MockTagify);
    expect(scienceInput._tagify.settings.placeholder).toBe('initial');
    expect(scienceInput._tagify.settings.enforceWhitelist).toBe(false);
  });

  test('updates placeholder on translationsLoaded', () => {
    const input = document.getElementById('input-sciencekeyword');
    expect(input._tagify.settings.placeholder).toBe('initial');

    global.translations.keywords.thesaurus.label = 'updated';
    document.dispatchEvent(new Event('translationsLoaded'));
    expect(input._tagify.settings.placeholder).toBe('updated');
  });

  test('loads thesaurus data when Tagify input receives focus without opening modal', () => {
    // Before any interaction, jsTree should NOT be initialized
    const treeBefore = $('#jstree-sciencekeyword').jstree(true);
    expect(treeBefore).toBeUndefined();

    // Tagify whitelist should be empty
    const input = document.getElementById('input-sciencekeyword');
    expect(input._tagify.settings.whitelist).toHaveLength(0);
    expect(input._tagify.settings.enforceWhitelist).toBe(false);

    // Simulate focus on the Tagify wrapper / input (capture phase)
    const tagifyWrapper = input.closest('.tagify') || input.parentElement.querySelector('.tagify') || input;
    tagifyWrapper.dispatchEvent(new Event('focus', { bubbles: false }));

    // After focus trigger, the whitelist should be populated
    expect(input._tagify.settings.whitelist.length).toBeGreaterThan(0);
    expect(input._tagify.settings.enforceWhitelist).toBe(true);

    // jsTree should also be initialized
    const treeAfter = $('#jstree-sciencekeyword').jstree(true);
    expect(treeAfter).toBeDefined();
  });

  test('loads thesaurus data only when modal is opened (lazy loading)', () => {
    // Before opening modal, jsTree should not be initialized
    const tree = $('#jstree-sciencekeyword').jstree(true);
    expect(tree).toBeUndefined();

    // Open the modal to trigger lazy loading
    openModal('#modal-sciencekeyword');

    // After opening modal, jsTree should be initialized
    const treeAfter = $('#jstree-sciencekeyword').jstree(true);
    expect(treeAfter).toBeDefined();

    // Tagify should now have enforceWhitelist enabled
    const input = document.getElementById('input-sciencekeyword');
    expect(input._tagify.settings.enforceWhitelist).toBe(true);
  });

  test('syncs selections between jsTree and Tagify after modal is opened', () => {
    const input = document.getElementById('input-sciencekeyword');

    // Open modal to load thesaurus
    openModal('#modal-sciencekeyword');

    const tree = $('#jstree-sciencekeyword').jstree(true);

    expect(input._tagify.value).toHaveLength(0);

    tree.select_node('child');
    expect(input._tagify.value[0].value).toBe('Root > Child');
    expect($('#selected-keywords-sciencekeyword li').text()).toContain('Root > Child');

    tree.deselect_node('child');
    expect(input._tagify.value).toHaveLength(0);

    input._tagify.trigger('add', { data: { value: 'Root > Child' } });
    expect(tree.get_selected()).toEqual(['child']);

    input._tagify.trigger('remove', { data: { value: 'Root > Child' } });
    expect(tree.get_selected()).toHaveLength(0);
  });

  test('does not reload thesaurus data on subsequent modal opens', () => {
    openModal('#modal-sciencekeyword');

    const callCountAfterFirst = $.getJSON.mock.calls.length;

    // Re-dispatch (but listener was set with { once: true })
    const modal = document.querySelector('#modal-sciencekeyword');
    modal.dispatchEvent(new Event('show.bs.modal'));

    expect($.getJSON.mock.calls.length).toBe(callCountAfterFirst);
  });

  test('hides form group when showThesauri is false', (done) => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" class="card mb-2" style="display: none;">
        <div class="card-header"><b></b></div>
        <div id="thesaurusKeywordsGroup">
          <div class="accordion p-2" id="accordionThesauri"></div>
        </div>
      </div>
      <div id="thesaurusModalsContainer"></div>
    `;

    window.ELMO_FEATURES = { showThesauri: false, showMslVocabs: false };
    $.getJSON.mockClear();

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(transformThesauriScript(script));

    $(document).ready(() => {
      document.dispatchEvent(new Event('translationsLoaded'));

      // Availability should NOT be fetched when master toggle is off
      const availabilityCalls = $.getJSON.mock.calls.filter(c => c[0] === 'api/v2/vocabs/thesauri/availability');
      expect(availabilityCalls.length).toBe(0);

      // Form group stays hidden
      const formGroup = document.getElementById('thesaurusKeywordsFormGroup');
      expect(formGroup.style.display).toBe('none');

      done();
    });
  });

  test('hides form group when no thesauri are available', (done) => {
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" class="card mb-2" style="display: none;">
        <div id="thesaurusKeywordsGroup">
          <div class="accordion p-2" id="accordionThesauri"></div>
        </div>
      </div>
      <div id="thesaurusModalsContainer"></div>
    `;

    window.ELMO_FEATURES = { showThesauri: true, showMslVocabs: false };

    const allDisabledAvailability = {
      science_keywords: { available: false, displayName: 'GCMD Science Keywords' },
      platforms: { available: false, displayName: 'GCMD Platforms' },
      instruments: { available: false, displayName: 'GCMD Instruments' },
      chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
      gemet: { available: false, displayName: 'GEMET Thesaurus' },
    };

    $.getJSON = jest.fn((url) => {
      if (url === 'api/v2/vocabs/thesauri/availability') {
        return {
          done: jest.fn(function(fn) { fn(allDisabledAvailability); return this; }),
          fail: jest.fn().mockReturnThis(),
        };
      }
      return { fail: jest.fn().mockReturnThis() };
    });

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(transformThesauriScript(script));

    $(document).ready(() => {
      document.dispatchEvent(new Event('translationsLoaded'));

      // Form group stays hidden when all thesauri disabled
      const formGroup = document.getElementById('thesaurusKeywordsFormGroup');
      expect(formGroup.style.display).toBe('none');

      // No accordion items generated
      expect(document.querySelectorAll('#accordionThesauri .accordion-item').length).toBe(0);

      done();
    });
  });

});

describe('thesauri.js — showLoadingSpinner / hideLoadingSpinner / loadThesaurusOnDemand / loadKeywordsForConfig', () => {
  let $;
  let exports;

  beforeEach((done) => {
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" class="card mb-2" style="display: none;">
        <div class="card-header"><b data-translate="keywords.thesaurus.name"></b></div>
        <div id="thesaurusKeywordsGroup">
          <div class="accordion p-2" id="accordionThesauri"></div>
        </div>
      </div>
      <div id="thesaurusModalsContainer"></div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    (function ($) {
      class JsTreeMock {
        constructor($el, opts) {
          this.$el = $el;
          this.data = opts.core.data;
          this.selected = [];
          this.map = {};
          const build = (nodes) => nodes && nodes.forEach(n => {
            this.map[n.id] = n;
            if (n.children) build(n.children);
          });
          build(this.data);
        }
        get_selected(full) { return full ? this.selected : this.selected.map(n => n.id); }
        get_path(node, sep) { return node.text; }
        get_json(root, opts) { return opts && opts.flat ? Object.values(this.map) : this.data; }
        select_node(id) { const n = this.map[id]; if (n && !this.selected.includes(n)) this.selected.push(n); }
        deselect_node(id) { this.selected = this.selected.filter(n => n.id !== id); }
        search(str) {}
      }
      $.fn.jstree = function(arg) {
        if (arg === undefined || arg === true) return this.data('jstree');
        if (typeof arg === 'object') { this.data('jstree', new JsTreeMock(this, arg)); return this; }
        return this;
      };
    })($);

    global.Tagify = MockTagify;
    global.translations = {
      keywords: {
        thesaurus: { label: 'Thesaurus keywords', name: 'Thesauri Keywords', unavailable: 'Unavailable' },
        searchPlaceholder: 'Search...',
        selectedKeywords: 'Selected Keywords',
      },
      general: { loading: 'Loading...' },
    };
    window.ELMO_FEATURES = { showThesauri: true, showMslVocabs: false };

    $.getJSON = jest.fn((url, cb) => {
      const mockDeferred = {
        done: jest.fn(function(fn) { fn(this._data); return this; }),
        fail: jest.fn().mockReturnThis(),
        _data: null,
      };
      if (url === 'api/v2/vocabs/thesauri/availability') {
        mockDeferred._data = {
          science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
          platforms: { available: true, displayName: 'GCMD Platforms' },
          instruments: { available: false, displayName: 'GCMD Instruments' },
          chronostratigraphy: { available: false },
          gemet: { available: false },
        };
        return mockDeferred;
      } else if (url.startsWith('api/v2/vocabs/thesauri/')) {
        const data = { data: [{ id: 'root', text: 'Root', children: [{ id: 'child1', text: 'Child1' }] }] };
        if (typeof cb === 'function') cb(data);
        return { fail: jest.fn().mockReturnThis() };
      }
      if (typeof cb === 'function') cb({ data: [] });
      return { fail: jest.fn().mockReturnThis() };
    });

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(transformThesauriScript(script));

    $(document).ready(() => {
      document.dispatchEvent(new Event('translationsLoaded'));
      exports = window.__thesauriTestExports;
      done();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.Tagify;
    delete global.translations;
    delete window.ELMO_FEATURES;
  });

  // ── showLoadingSpinner ────────────────────────────────────────────────────

  test('showLoadingSpinner inserts spinner markup into container', () => {
    document.body.innerHTML += '<div id="jstree-test-spinner"></div>';
    exports.showLoadingSpinner('#jstree-test-spinner');
    const spinner = document.querySelector('#jstree-test-spinner .thesaurus-loading-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner.querySelector('.spinner-border')).not.toBeNull();
  });

  test('showLoadingSpinner does nothing when container does not exist', () => {
    expect(() => exports.showLoadingSpinner('#does-not-exist')).not.toThrow();
  });

  test('showLoadingSpinner does not insert duplicate spinners on repeated calls', () => {
    document.body.innerHTML += '<div id="jstree-test-nodupe"></div>';
    exports.showLoadingSpinner('#jstree-test-nodupe');
    exports.showLoadingSpinner('#jstree-test-nodupe');
    expect(document.querySelectorAll('#jstree-test-nodupe .thesaurus-loading-spinner').length).toBe(1);
  });

  // ── hideLoadingSpinner ────────────────────────────────────────────────────

  test('hideLoadingSpinner removes spinner element', () => {
    document.body.innerHTML += '<div id="jstree-test-hide"><div class="thesaurus-loading-spinner">x</div></div>';
    exports.hideLoadingSpinner('#jstree-test-hide');
    expect(document.querySelector('#jstree-test-hide .thesaurus-loading-spinner')).toBeNull();
  });

  test('hideLoadingSpinner does nothing when no spinner is present', () => {
    document.body.innerHTML += '<div id="jstree-test-hide-empty"></div>';
    expect(() => exports.hideLoadingSpinner('#jstree-test-hide-empty')).not.toThrow();
  });

  // ── loadThesaurusOnDemand ─────────────────────────────────────────────────

  test('loadThesaurusOnDemand fetches data and initialises jstree', () => {
    const config = {
      jsTreeId: '#jstree-sciencekeyword',
      apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
      modalId: '#modal-sciencekeyword',
      inputId: '#input-sciencekeyword',
      searchInputId: '#input-sciencekeyword-thesaurussearch',
      selectedListId: 'selected-keywords-sciencekeyword',
      stateKey: 'input-sciencekeyword',
    };

    const callsBefore = $.getJSON.mock.calls.length;
    // Reset state so loadThesaurusOnDemand treats it as fresh
    exports.loadedConfigs.delete(config.jsTreeId);
    exports.loadThesaurusOnDemand(config);

    expect($.getJSON.mock.calls.length).toBe(callsBefore + 1);
    expect(exports.loadedConfigs.get(config.jsTreeId)).toBe('loaded');
  });

  test('loadThesaurusOnDemand does not re-fetch while loading is in progress', () => {
    const config = {
      jsTreeId: '#jstree-sciencekeyword',
      apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
      stateKey: 'input-sciencekeyword',
    };

    exports.loadedConfigs.set(config.jsTreeId, 'loading');
    const callsBefore = $.getJSON.mock.calls.length;
    exports.loadThesaurusOnDemand(config);
    expect($.getJSON.mock.calls.length).toBe(callsBefore);
  });

  test('loadThesaurusOnDemand does not re-fetch when already loaded', () => {
    const config = {
      jsTreeId: '#jstree-sciencekeyword',
      apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
      stateKey: 'input-sciencekeyword',
    };

    exports.loadedConfigs.set(config.jsTreeId, 'loaded');
    const callsBefore = $.getJSON.mock.calls.length;
    exports.loadThesaurusOnDemand(config);
    expect($.getJSON.mock.calls.length).toBe(callsBefore);
  });

  test('loadThesaurusOnDemand retries after a previous error (race condition fix)', () => {
    const config = {
      jsTreeId: '#jstree-sciencekeyword',
      apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
      stateKey: 'input-sciencekeyword',
    };

    // Simulate a prior failed attempt
    exports.loadedConfigs.set(config.jsTreeId, 'error');
    const callsBefore = $.getJSON.mock.calls.length;
    exports.loadThesaurusOnDemand(config);
    // Must attempt a new fetch rather than bailing out
    expect($.getJSON.mock.calls.length).toBe(callsBefore + 1);
  });

  test('loadThesaurusOnDemand sets state to error and renders error message on network failure', () => {
    // Override $.getJSON to simulate failure
    $.getJSON = jest.fn((url, cb) => {
      if (url === 'api/v2/vocabs/thesauri/availability') {
        return {
          done: jest.fn(function(fn) { return this; }),
          fail: jest.fn().mockReturnThis(),
          _data: null,
        };
      }
      return { fail: jest.fn(fn => { fn({}, 'error', 'Network Error'); return { fail: jest.fn() }; }) };
    });

    document.body.innerHTML += '<div id="jstree-fail-tree"></div>';
    const config = {
      jsTreeId: '#jstree-fail-tree',
      apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
      stateKey: 'fail-tree',
    };

    exports.loadedConfigs.delete(config.jsTreeId);
    exports.loadThesaurusOnDemand(config);

    expect(exports.loadedConfigs.get(config.jsTreeId)).toBe('error');
    expect(document.querySelector('#jstree-fail-tree .alert-danger')).not.toBeNull();
  });

  // ── loadKeywordsForConfig ─────────────────────────────────────────────────

  test('loadKeywordsForConfig populates Tagify whitelist with flattened paths', () => {
    const input = document.getElementById('input-sciencekeyword');
    const config = {
      jsTreeId: '#jstree-sciencekeyword',
      inputId: '#input-sciencekeyword',
      searchInputId: '#input-sciencekeyword-thesaurussearch',
      selectedListId: 'selected-keywords-sciencekeyword',
      stateKey: 'input-sciencekeyword',
    };
    const response = {
      data: [{
        id: 'parent', text: 'Parent', scheme: 'S', schemeURI: 'http://s', language: 'en', description: '',
        children: [{ id: 'child', text: 'Child', scheme: 'S', schemeURI: 'http://s', language: 'en', description: '' }]
      }]
    };

    exports.loadKeywordsForConfig(config, response);

    const whitelist = input._tagify.settings.whitelist;
    const values = whitelist.map(w => w.value);
    expect(values).toContain('Parent');
    expect(values).toContain('Parent > Child');
  });

  test('loadKeywordsForConfig does not add duplicate entries on repeated calls', () => {
    const config = {
      jsTreeId: '#jstree-sciencekeyword',
      inputId: '#input-sciencekeyword',
      searchInputId: '#input-sciencekeyword-thesaurussearch',
      selectedListId: 'selected-keywords-sciencekeyword',
      stateKey: 'input-sciencekeyword',
    };
    const response = { data: [{ id: 'n1', text: 'Node1', children: [] }] };

    exports.loadKeywordsForConfig(config, response);
    const countAfterFirst = document.getElementById('input-sciencekeyword')._tagify.settings.whitelist.length;
    exports.loadKeywordsForConfig(config, response);
    const countAfterSecond = document.getElementById('input-sciencekeyword')._tagify.settings.whitelist.length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });

});
