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

describe('thesauri.js', () => {
  let $;

  beforeEach((done) => {
    document.body.innerHTML = `
      <input id="input-sciencekeyword" />
      <input id="input-sciencekeyword-thesaurussearch" />
      <div id="jstree-sciencekeyword"></div>
      <ul id="selected-keywords-gcmd"></ul>
      <div id="modal-sciencekeyword" class="modal"></div>
      <input id="input-Platforms" />
      <input id="input-Platforms-thesaurussearch" />
      <div id="jstree-Platforms"></div>
      <ul id="selected-keywords-Platforms-gcmd"></ul>
      <div id="modal-Platforms" class="modal"></div>
      <input id="input-Instruments" />
      <input id="input-instruments-thesaurussearch" />
      <div id="jstree-instruments"></div>
      <ul id="selected-keywords-instruments-gcmd"></ul>
      <div id="modal-instruments" class="modal"></div>
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
        get_selected() {
          return this.selected;
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
    global.translations = { keywords: { thesaurus: { label: 'initial' } }, general: { loading: 'Loading...' } };
    // Set default feature toggles (GCMD enabled, MSL disabled)
    window.ELMO_FEATURES = {
      showGcmdThesauri: true,
      showMslVocabs: false
    };

    $.getJSON = jest.fn((file, cb) => {
      if (file === 'json/thesauri/gcmdPlatformsKeywords.json') {
        cb({ data: [
          {
            id: 'platforms',
            text: 'Platforms',
            children: [
              {
                id: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
                text: 'Space-based Platforms',
                children: [ { id: 'sat', text: 'Satellite' } ]
              },
              { id: 'ground', text: 'Ground-based Platforms' }
            ]
          }
        ] });
        return { fail: jest.fn().mockReturnThis() };
      } else {
        cb({ data: [ { id: 'root', text: 'Root', children: [ { id: 'child', text: 'Child' } ] } ] });
        return { fail: jest.fn().mockReturnThis() };
      }
    });

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(script);

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

  test('initializes Tagify immediately (with lazy loading, before modal opens)', () => {
    const input = document.getElementById('input-sciencekeyword');
    expect(input._tagify).toBeInstanceOf(MockTagify);
    expect(input._tagify.settings.placeholder).toBe('initial');
    // enforceWhitelist should be false initially (before thesaurus is loaded)
    expect(input._tagify.settings.enforceWhitelist).toBe(false);
  });

  test('updates placeholder on translationsLoaded', () => {
    const input = document.getElementById('input-sciencekeyword');
    expect(input._tagify.settings.placeholder).toBe('initial');

    global.translations.keywords.thesaurus.label = 'updated';
    document.dispatchEvent(new Event('translationsLoaded'));
    expect(input._tagify.settings.placeholder).toBe('updated');
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
    expect($('#selected-keywords-gcmd li').text()).toContain('Root > Child');

    tree.deselect_node('child');
    expect(input._tagify.value).toHaveLength(0);

    input._tagify.trigger('add', { data: { value: 'Root > Child' } });
    expect(tree.get_selected().map(n => n.id)).toEqual(['child']);

    input._tagify.trigger('remove', { data: { value: 'Root > Child' } });
    expect(tree.get_selected()).toHaveLength(0);
  });

  test('does not reload thesaurus data on subsequent modal opens', () => {
    // Open modal first time
    openModal('#modal-sciencekeyword');
    
    const callCountAfterFirst = $.getJSON.mock.calls.length;
    
    // Try to open modal again (but the event listener was set with { once: true })
    // We need to re-dispatch, but it shouldn't reload since config is marked as loaded
    const modal = document.querySelector('#modal-sciencekeyword');
    modal.dispatchEvent(new Event('show.bs.modal'));
    
    // Should not have made additional getJSON calls for this specific file
    // Note: The { once: true } on the event listener means the listener itself won't fire again
    expect($.getJSON.mock.calls.length).toBe(callCountAfterFirst);
  });

});
