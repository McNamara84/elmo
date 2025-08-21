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
      <input id="input-sciencekeyword-search" />
      <div id="jstree-sciencekeyword"></div>
      <ul id="selected-keywords-gcmd"></ul>
      <input id="input-datasource-platforms" />
      <input id="input-platforms-thesaurussearch-ds" />
      <div id="jstree-platforms-datasource"></div>
      <ul id="selected-keywords-platforms-ds"></ul>
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
    global.translations = { keywords: { thesaurus: { label: 'initial' } } };

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
      } else {
        cb({ data: [ { id: 'root', text: 'Root', children: [ { id: 'child', text: 'Child' } ] } ] });
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
  });

  test('initializes Tagify and updates placeholder on translationsLoaded', () => {
    const input = document.getElementById('input-sciencekeyword');
    expect(input._tagify).toBeInstanceOf(MockTagify);
    expect(input._tagify.settings.placeholder).toBe('initial');

    global.translations.keywords.thesaurus.label = 'updated';
    document.dispatchEvent(new Event('translationsLoaded'));
    expect(input._tagify.settings.placeholder).toBe('updated');
  });

  test('syncs selections between jsTree and Tagify', () => {
    const input = document.getElementById('input-sciencekeyword');
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

  test('limits platform keywords to Space-based Platforms', () => {
    document.dispatchEvent(new Event('translationsLoaded'));
    const tree = $('#jstree-platforms-datasource').jstree(true);
    const data = tree.get_json('#');
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847');
    const childIds = data[0].children.map(n => n.id);
    expect(childIds).toEqual(['sat']);
  });
});
