const fs = require('fs');
const path = require('path');
const { transformThesauriScript } = require('./utils');

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

describe('thesauri.js', () => {
  let $;

  beforeEach((done) => {
    // Minimal HTML containers (thesauri.js generates thesaurus input items + modals dynamically)
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" class="card mb-2" style="display: none;">
        <div class="card-header"><b data-translate="keywords.thesaurus.name"></b></div>
        <div id="thesaurusKeywordsGroup"></div>
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

  test('fetches availability and generates UI for available thesauri', () => {
    // availability was called
    expect($.getJSON).toHaveBeenCalledWith('api/v2/vocabs/thesauri/availability');

    expect(document.querySelector('#input-sciencekeyword')).toBeTruthy();
    expect(document.querySelector('#input-platforms')).toBeTruthy();

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

  test('does not enable enforceWhitelist when the vocabulary response is empty', () => {
    const input = document.getElementById('input-sciencekeyword');
    expect(input._tagify.settings.enforceWhitelist).toBe(false);

    $.getJSON.mockImplementation((url, cb) => {
      if (url === 'api/v2/vocabs/thesauri/availability') {
        return {
          done: jest.fn(function (fn) { fn(mockAvailability); return this; }),
          fail: jest.fn().mockReturnThis(),
        };
      }
      if (typeof cb === 'function') cb({ data: [] });
      return { fail: jest.fn().mockReturnThis() };
    });

    openModal('#modal-sciencekeyword');

    expect(input._tagify.settings.whitelist).toHaveLength(0);
    expect(input._tagify.settings.enforceWhitelist).toBe(false);
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

  test('pre-populated Tagify values are synced to jsTree on ready after lazy loading', () => {
    const input = document.getElementById('input-sciencekeyword');

    // Simulate uploaded value before modal/tree is opened
    input._tagify.addTags([{ value: 'Root > Child' }]);

    // Tree not loaded yet
    expect($('#jstree-sciencekeyword').jstree(true)).toBeUndefined();

    // Open modal -> lazy loads thesaurus + initializes tree
    openModal('#modal-sciencekeyword');

    const tree = $('#jstree-sciencekeyword').jstree(true);
    expect(tree).toBeDefined();

    // Simulate jsTree ready event for the new ready-handler logic
    $('#jstree-sciencekeyword').trigger('ready.jstree');

    expect(tree.get_selected()).toEqual(['child']);
    expect($('#selected-keywords-sciencekeyword li').text()).toContain('Root > Child');
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
        <div id="thesaurusKeywordsGroup"></div>
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
        <div id="thesaurusKeywordsGroup"></div>
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

      // No thesaurus input items generated
      expect(document.querySelectorAll('.thesaurus-input-item').length).toBe(0);

      done();
    });
  });

  test('does not render thesauri listed in hiddenThesauri', (done) => {
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" class="card mb-2" style="display: none;">
        <div id="thesaurusKeywordsGroup"></div>
      </div>
      <div id="thesaurusModalsContainer"></div>
    `;

    window.ELMO_FEATURES = {
      showThesauri: true,
      showMslVocabs: false,
      hiddenThesauri: ['platforms']
    };

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(transformThesauriScript(script));

    $(document).ready(() => {
      document.dispatchEvent(new Event('translationsLoaded'));

      expect(document.querySelector('#input-sciencekeyword')).toBeTruthy();
      expect(document.querySelector('#input-platforms')).toBeNull();

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
        <div id="thesaurusKeywordsGroup"></div>
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
      selectedKeywordsListId: 'selected-keywords-sciencekeyword',
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
      selectedKeywordsListId: 'selected-keywords-sciencekeyword',
    };
    const response = { data: [{ id: 'n1', text: 'Node1', children: [] }] };

    exports.loadKeywordsForConfig(config, response);
    const countAfterFirst = document.getElementById('input-sciencekeyword')._tagify.settings.whitelist.length;
    exports.loadKeywordsForConfig(config, response);
    const countAfterSecond = document.getElementById('input-sciencekeyword')._tagify.settings.whitelist.length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  // Clicking a row must browse the hierarchy for broader terms while keeping every
  // term selectable, so these cases pin down the whole interaction contract.
  describe('handleTreeNodeActivation', () => {
    function createTreeStub(isParent) {
      return {
        is_parent: jest.fn(() => isParent),
        toggle_node: jest.fn(),
      };
    }

    function clickOn(className) {
      const target = document.createElement('i');
      target.className = className;
      return { target };
    }

    test('opens or closes a broader term instead of selecting it', () => {
      const tree = createTreeStub(true);
      const node = { id: 'parent' };

      const selects = exports.handleTreeNodeActivation.call(tree, node, clickOn('jstree-icon'));

      expect(selects).toBe(false);
      expect(tree.toggle_node).toHaveBeenCalledWith(node);
    });

    test('selects a term without narrower terms', () => {
      const tree = createTreeStub(false);

      const selects = exports.handleTreeNodeActivation.call(tree, { id: 'leaf' }, clickOn('jstree-icon'));

      expect(selects).toBe(true);
      expect(tree.toggle_node).not.toHaveBeenCalled();
    });

    test('keeps broader terms selectable through their checkbox', () => {
      const tree = createTreeStub(true);

      const selects = exports.handleTreeNodeActivation.call(tree, { id: 'parent' }, clickOn('jstree-icon jstree-checkbox'));

      expect(selects).toBe(true);
      expect(tree.toggle_node).not.toHaveBeenCalled();
    });

    test('keeps broader terms selectable with a modifier key', () => {
      const tree = createTreeStub(true);
      const event = clickOn('jstree-icon');
      event.ctrlKey = true;

      expect(exports.handleTreeNodeActivation.call(tree, { id: 'parent' }, event)).toBe(true);
      expect(tree.toggle_node).not.toHaveBeenCalled();
    });

    test('leaves programmatic activation without an event untouched', () => {
      const tree = createTreeStub(true);

      expect(exports.handleTreeNodeActivation.call(tree, { id: 'parent' })).toBe(true);
      expect(tree.toggle_node).not.toHaveBeenCalled();
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// GGMs thesaurus root-node limiting
// Tests that when showGGMsProperties is enabled the science_keywords tree is
// filtered to only the nodes listed in GGM_THESAURUS_ROOT_NODES, their
// children are preserved, and nodes NOT in the list are excluded.
// ─────────────────────────────────────────────────────────────────────────────
describe('thesauri.js — GGMs root node filtering', () => {
  let $;
  let exports;

  // ── mock data ──────────────────────────────────────────────────────────────

  /**
   * Simulated GCMD science-keywords vocabulary response.
   *
   * Tree shape:
   *   Science Keywords
   *     EARTH SCIENCE
   *       SOLID EARTH
   *         GEODETICS                        ← in GGM list
   *           ELLIPSOID CHARACTERISTICS      ← child of listed node
   *         TOPOGRAPHY                       ← NOT in GGM list
   *       OCEANS
   *         MARINE GEOPHYSICS
   *           MARINE GRAVITY FIELD           ← in GGM list
   *             OCEAN DEPTH                  ← child of listed node
   *     EARTH SCIENCE SERVICES
   *       MODELS
   *         SPHERICAL HARMONIC MODELS        ← in GGM list
   *         CLIMATE MODELS                   ← NOT in GGM list
   */
  const GGM_ROOT_IDS = [
    'uri:geodetics',
    'uri:marine-gravity-field',
    'uri:spherical-harmonic-models',
  ];

  const mockScienceKeywordsVocabulary = {
    data: [
      {
        id: 'uri:science-keywords', text: 'Science Keywords', children: [
          {
            id: 'uri:earth-science', text: 'EARTH SCIENCE', children: [
              {
                id: 'uri:solid-earth', text: 'SOLID EARTH', children: [
                  {
                    id: 'uri:geodetics', text: 'GEODETICS', children: [
                      { id: 'uri:ellipsoid', text: 'ELLIPSOID CHARACTERISTICS', children: [] },
                    ],
                  },
                  {
                    id: 'uri:topography', text: 'TOPOGRAPHY', children: [],
                  },
                ],
              },
              {
                id: 'uri:oceans', text: 'OCEANS', children: [
                  {
                    id: 'uri:marine-geophysics', text: 'MARINE GEOPHYSICS', children: [
                      {
                        id: 'uri:marine-gravity-field', text: 'MARINE GRAVITY FIELD', children: [
                          { id: 'uri:ocean-depth', text: 'OCEAN DEPTH', children: [] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'uri:earth-science-services', text: 'EARTH SCIENCE SERVICES', children: [
              {
                id: 'uri:models', text: 'MODELS', children: [
                  { id: 'uri:spherical-harmonic-models', text: 'SPHERICAL HARMONIC MODELS', children: [] },
                  { id: 'uri:climate-models', text: 'CLIMATE MODELS', children: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  // ── shared setup ──────────────────────────────────────────────────────────

  function setupEnvironment(done, featureFlags = {}) {
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" style="display: none;">
        <div id="thesaurusKeywordsGroup"></div>
      </div>
      <div id="thesaurusModalsContainer"></div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    // Minimal jstree mock that tracks nodes loaded into it
    (function ($) {
      $.fn.jstree = function (arg) {
        if (arg === undefined || arg === true) return this.data('jstree');
        if (typeof arg === 'object') {
          const inst = {
            _data: arg.core.data,
            allNodeIds() {
              const ids = [];
              function walk(nodes) {
                if (!Array.isArray(nodes)) return;
                nodes.forEach(n => { ids.push(n.id); walk(n.children); });
              }
              walk(this._data);
              return ids;
            },
          };
          this.data('jstree', inst);
          return this;
        }
        return this;
      };
    })($);

    global.Tagify = MockTagify;
    global.translations = {
      keywords: { thesaurus: { label: 'KW', unavailable: 'err' }, searchPlaceholder: 'Search', selectedKeywords: 'Selected' },
      general: { loading: 'Loading' },
    };

    window.ELMO_FEATURES = {
      showThesauri: true,
      showMslVocabs: false,
      showGGMsProperties: featureFlags.showGGMsProperties ?? true,
    };

    $.getJSON = jest.fn((url, cb) => {
      if (url === 'api/v2/vocabs/thesauri/availability') {
        return {
          done: jest.fn(function (fn) { fn({ science_keywords: { available: true, displayName: 'Science Keywords' } }); return this; }),
          fail: jest.fn().mockReturnThis(),
        };
      }
      // Vocabulary endpoint — return the mock tree
      if (typeof cb === 'function') cb(mockScienceKeywordsVocabulary);
      return { fail: jest.fn().mockReturnThis() };
    });

    // Patch GGM_THESAURUS_ROOT_NODES inside the evaluated script by injecting
    // it into the source before eval so the test controls the list.
    const rawScript = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    const patchedScript = rawScript
      // Replace the hard-coded URI list with our test IDs
      .replace(
        /const GGM_THESAURUS_ROOT_NODES\s*=\s*\{[\s\S]*?\};/,
        `const GGM_THESAURUS_ROOT_NODES = { science_keywords: ${JSON.stringify(GGM_ROOT_IDS)} };`
      );

    window.eval(transformThesauriScript(patchedScript));

    $(document).ready(() => {
      document.dispatchEvent(new Event('translationsLoaded'));
      exports = window.__thesauriTestExports;

      // Trigger lazy load so the tree is actually built
      const modal = document.querySelector('#modal-sciencekeyword');
      if (modal) modal.dispatchEvent(new Event('show.bs.modal'));

      done();
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.Tagify;
    delete global.translations;
    delete window.ELMO_FEATURES;
  });

  // ── tests ─────────────────────────────────────────────────────────────────

  describe('with GGMsProperties enabled', () => {
    beforeEach((done) => setupEnvironment(done));

    afterEach(() => {
      jest.restoreAllMocks();
      delete global.Tagify;
      delete global.translations;
      delete window.ELMO_FEATURES;
    });

    test('listed root nodes are present in the tree', () => {
      const tree = $('#jstree-sciencekeyword').jstree(true);
      const ids = tree.allNodeIds();
      GGM_ROOT_IDS.forEach(id => {
        expect(ids).toContain(id);
      });
    });

    test('children of listed root nodes are present in the tree', () => {
      const tree = $('#jstree-sciencekeyword').jstree(true);
      const ids = tree.allNodeIds();
      // ELLIPSOID CHARACTERISTICS is a child of GEODETICS (listed)
      expect(ids).toContain('uri:ellipsoid');
      // OCEAN DEPTH is a child of MARINE GRAVITY FIELD (listed)
      expect(ids).toContain('uri:ocean-depth');
    });

    test('nodes NOT in GGM_ROOT_IDS and not their descendants are excluded', () => {
      const tree = $('#jstree-sciencekeyword').jstree(true);
      const ids = tree.allNodeIds();
      // TOPOGRAPHY is a sibling of GEODETICS but not listed
      expect(ids).not.toContain('uri:topography');
      // CLIMATE MODELS is a sibling of SPHERICAL HARMONIC MODELS but not listed
      expect(ids).not.toContain('uri:climate-models');
    });

    test('ancestor/container nodes that lead to listed nodes are NOT present (subtrees are detached)', () => { 
      const tree = $('#jstree-sciencekeyword').jstree(true);
      const ids = tree.allNodeIds();
      // The tree should start from the listed nodes themselves, not from the full hierarchy
      expect(ids).not.toContain('uri:science-keywords');
      expect(ids).not.toContain('uri:earth-science');
      expect(ids).not.toContain('uri:solid-earth');
    });

    test('Tagify whitelist only contains paths reachable from listed nodes', () => {
      const input = document.getElementById('input-sciencekeyword');
      const whitelistValues = input._tagify.settings.whitelist.map(w => w.value);

      // Paths from listed nodes and their children should be present
      expect(whitelistValues.some(v => v.includes('GEODETICS'))).toBe(true);
      expect(whitelistValues.some(v => v.includes('ELLIPSOID CHARACTERISTICS'))).toBe(true);
      expect(whitelistValues.some(v => v.includes('MARINE GRAVITY FIELD'))).toBe(true);
      expect(whitelistValues.some(v => v.includes('SPHERICAL HARMONIC MODELS'))).toBe(true);

      // Paths from non-listed nodes must NOT appear
      expect(whitelistValues.some(v => v.includes('TOPOGRAPHY'))).toBe(false);
      expect(whitelistValues.some(v => v.includes('CLIMATE MODELS'))).toBe(false);
    });

    test('entry built for science_keywords uses rootNodes (array), not rootNodeId', () => {
      // Verify the bug is fixed: an array override must not land on rootNodeId
      const input = document.getElementById('input-sciencekeyword');
      // The Tagify whitelist being scoped is enough proof, but we also confirm
      // no fatal "Root node with ID Array(...) not found" path was taken by
      // checking the tree was actually initialised (it would be null on that error).
      const tree = $('#jstree-sciencekeyword').jstree(true);
      expect(tree).toBeDefined();
      expect(tree).not.toBeNull();
      // If rootNodeId had received the array, loadKeywordsForConfig would have
      // logged an error and returned early without building a whitelist.
      expect(input._tagify.settings.whitelist.length).toBeGreaterThan(0);
    });

    // ── overlap / deduplication ─────────────────────────────────────────────

    test('when rootNodes contains both a parent and its child, the child is not promoted to a separate top-level entry', (done) => {
      // Simulate rootNodes = [GEODETICS, ELLIPSOID_CHARACTERISTICS] — a parent and its own child.
      // The child must NOT appear at top level alongside its parent; it must only appear
      // as a child of GEODETICS — otherwise it gets two breadcrumb paths in the whitelist.
      const overlapIds = ['uri:geodetics', 'uri:ellipsoid']; // parent + its child

      document.body.innerHTML = `
        <div id="thesaurusKeywordsFormGroup" style="display: none;">
          <div id="thesaurusKeywordsGroup"></div>
        </div>
        <div id="thesaurusModalsContainer"></div>
      `;

      $.getJSON = jest.fn((url, cb) => {
        if (url === 'api/v2/vocabs/thesauri/availability') {
          return {
            done: jest.fn(function (fn) { fn({ science_keywords: { available: true, displayName: 'Science Keywords' } }); return this; }),
            fail: jest.fn().mockReturnThis(),
          };
        }
        if (typeof cb === 'function') cb(mockScienceKeywordsVocabulary);
        return { fail: jest.fn().mockReturnThis() };
      });

      const rawScript = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
      const patchedScript = rawScript.replace(
        /const GGM_THESAURUS_ROOT_NODES\s*=\s*\{[\s\S]*?\};/,
        `const GGM_THESAURUS_ROOT_NODES = { science_keywords: ${JSON.stringify(overlapIds)} };`
      );
      window.eval(transformThesauriScript(patchedScript));

      $(document).ready(() => {
        document.dispatchEvent(new Event('translationsLoaded'));

        const modal = document.querySelector('#modal-sciencekeyword');
        if (modal) modal.dispatchEvent(new Event('show.bs.modal'));

        const tree = $('#jstree-sciencekeyword').jstree(true);
        const topLevelIds = (tree._data || []).map(n => n.id);

        // ELLIPSOID CHARACTERISTICS must NOT appear at the top level — it is already a child of GEODETICS
        expect(topLevelIds).not.toContain('uri:ellipsoid');
        // GEODETICS is the only top-level node (it's the ancestor that covers both)
        expect(topLevelIds).toContain('uri:geodetics');

        // Whitelist should contain ONLY the nested path, not a standalone "ELLIPSOID CHARACTERISTICS"
        const input = document.getElementById('input-sciencekeyword');
        const whitelistValues = input._tagify.settings.whitelist.map(w => w.value);
        expect(whitelistValues).toContain('GEODETICS > ELLIPSOID CHARACTERISTICS'); // deep canonical path ✓
        expect(whitelistValues).not.toContain('ELLIPSOID CHARACTERISTICS');          // standalone duplicate ✗

        done();
      });
    }, 5000);

    // ── focus-trigger lazy loading ────────────────────────────────────────

    test('Tagify input focus also produces a filtered tree and whitelist (focus-trigger path)', (done) => {
      // Reset state so lazy loading has not fired yet for this sub-test.
      // Re-run setupEnvironment WITHOUT dispatching the modal event so the
      // vocabulary data has not been loaded when we fire focus.
      document.body.innerHTML = `
        <div id="thesaurusKeywordsFormGroup" style="display: none;">
          <div id="thesaurusKeywordsGroup"></div>
        </div>
        <div id="thesaurusModalsContainer"></div>
      `;

      $.getJSON = jest.fn((url, cb) => {
        if (url === 'api/v2/vocabs/thesauri/availability') {
          return {
            done: jest.fn(function (fn) { fn({ science_keywords: { available: true, displayName: 'Science Keywords' } }); return this; }),
            fail: jest.fn().mockReturnThis(),
          };
        }
        if (typeof cb === 'function') cb(mockScienceKeywordsVocabulary);
        return { fail: jest.fn().mockReturnThis() };
      });

      const rawScript = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
      const patchedScript = rawScript.replace(
        /const GGM_THESAURUS_ROOT_NODES\s*=\s*\{[\s\S]*?\};/,
        `const GGM_THESAURUS_ROOT_NODES = { science_keywords: ${JSON.stringify(GGM_ROOT_IDS)} };`
      );
      window.eval(transformThesauriScript(patchedScript));

      $(document).ready(() => {
        document.dispatchEvent(new Event('translationsLoaded'));

        // Tree must NOT be loaded yet (no modal open)
        expect($('#jstree-sciencekeyword').jstree(true)).toBeUndefined();

        // Trigger via focus, same as when a user starts typing before opening the modal
        const input = document.getElementById('input-sciencekeyword');
        const tagifyWrapper = input.closest('.tagify') || input.parentElement?.querySelector('.tagify') || input;
        tagifyWrapper.dispatchEvent(new Event('focus', { bubbles: false }));

        // Tree must now be initialised and must be filtered
        const tree = $('#jstree-sciencekeyword').jstree(true);
        expect(tree).toBeDefined();
        const ids = tree.allNodeIds();

        GGM_ROOT_IDS.forEach(id => expect(ids).toContain(id));             // listed roots present
        expect(ids).toContain('uri:ellipsoid');                             // child of listed root present
        expect(ids).not.toContain('uri:topography');                        // non-listed sibling absent
        expect(ids).not.toContain('uri:climate-models');                    // non-listed sibling absent

        done();
      });
    }, 5000);

    // ── pre-population round-trip ─────────────────────────────────────────

    test('a value saved in a previous session is present in the filtered whitelist (round-trip compatibility)', () => {
      // "GEODETICS > ELLIPSOID CHARACTERISTICS" is the correct deep breadcrumb path for a
      // concept that lives inside one of the GGMs root subtrees. It must appear verbatim in
      // the filtered Tagify whitelist so that programmatic addTags (used by XML→input mapping)
      // does not render the tag as invalid.
      const input = document.getElementById('input-sciencekeyword');
      const whitelistValues = input._tagify.settings.whitelist.map(w => w.value);

      // The deep path (canonical breadcrumb built from the filtered tree) must exist
      expect(whitelistValues).toContain('GEODETICS > ELLIPSOID CHARACTERISTICS');
      expect(whitelistValues).toContain('MARINE GRAVITY FIELD > OCEAN DEPTH');
      expect(whitelistValues).toContain('SPHERICAL HARMONIC MODELS');

      // Simulate what mappingXmlToInputFields does: programmatically add a previously saved tag
      input._tagify.addTags(['GEODETICS > ELLIPSOID CHARACTERISTICS']);
      expect(input._tagify.value.some(v => v.value === 'GEODETICS > ELLIPSOID CHARACTERISTICS')).toBe(true);
    });
  });

  describe('with GGMsProperties disabled', () => {
    beforeEach((done) => setupEnvironment(done, { showGGMsProperties: false }));

    afterEach(() => {
      jest.restoreAllMocks();
      delete global.Tagify;
      delete global.translations;
      delete window.ELMO_FEATURES;
    });

    test('full vocabulary tree is loaded without filtering when feature is off', () => {
      const tree = $('#jstree-sciencekeyword').jstree(true);
      const ids = tree.allNodeIds();
      // All nodes including non-GGM ones should be present
      expect(ids).toContain('uri:topography');
      expect(ids).toContain('uri:climate-models');
      expect(ids).toContain('uri:science-keywords');
    });

    test('Tagify whitelist includes non-GGM paths when feature is off', () => {
      const input = document.getElementById('input-sciencekeyword');
      const whitelistValues = input._tagify.settings.whitelist.map(w => w.value);
      expect(whitelistValues.some(v => v.includes('TOPOGRAPHY'))).toBe(true);
      expect(whitelistValues.some(v => v.includes('CLIMATE MODELS'))).toBe(true);
    });
  });
});
