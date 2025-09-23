const fs = require('fs');
const path = require('path');

class MockTagify {
  constructor(el, settings) {
    this.el = el;
    this.settings = settings;
    this.value = [];
    this._callbacks = {};
    this.DOM = {
      input: document.createElement('input'),
      scope: document.createElement('div'),
    };
    this.whitelist = settings?.whitelist || [];

    if (settings?.placeholder) {
      this.DOM.input.setAttribute('data-placeholder', settings.placeholder);
    }

    this.DOM.input.setAttribute('aria-busy', 'false');
    if (el && el.value) {
      this.addTags(el.value);
    }
  }
  on(event, cb) {
    this._callbacks[event] = cb;
  }
  addTags(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach((item) => {
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
    if (this._callbacks[event]) {
      this._callbacks[event]({ detail });
    }
  }
}

describe('thesauri lazy loading', () => {
  let $;
  let fetchMock;
  let intersectionObserverMock;

  beforeEach(async () => {
    document.body.innerHTML = `
      <input id="input-sciencekeyword" />
      <div id="modal-sciencekeyword" class="modal">
        <div class="modal-body">
          <input id="input-sciencekeyword-thesaurussearch" />
          <div id="jstree-sciencekeyword"></div>
          <ul id="selected-keywords-gcmd"></ul>
        </div>
        <div class="modal-footer">
          <button type="button" id="footer-trigger" class="btn btn-primary">Add</button>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    (function ($inner) {
      class JsTreeMock {
        constructor($el, opts) {
          this.$el = $el;
          this.data = opts.core.data;
          this.map = {};
          const build = (nodes, parent) => {
            nodes.forEach((node) => {
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
          const parts = [];
          let cur = node;
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
          this.selected = this.selected.filter((n) => n !== node);
          this.$el.trigger('changed.jstree', [{ instance: this }]);
        }
        search(str) {
          this.lastSearch = str;
        }
      }
      $inner.fn.jstree = function (arg, arg2) {
        if (arg === undefined || arg === true) {
          return this.data('jstree');
        }
        if (typeof arg === 'string') {
          const inst = this.data('jstree');
          if (arg === 'get_selected') return inst.get_selected(arg2);
          if (arg === 'deselect_node') {
            inst.deselect_node(arg2);
            return this;
          }
          if (arg === 'select_node') {
            inst.select_node(arg2);
            return this;
          }
        } else if (typeof arg === 'object') {
          const inst = new JsTreeMock(this, arg);
          this.data('jstree', inst);
          setTimeout(() => {
            this.trigger('ready.jstree');
          }, 0);
          return this;
        }
        return this;
      };
    })($);

    global.Tagify = MockTagify;
    global.translations = {
      keywords: {
        thesaurus: {
          label: 'initial',
          loading: 'Loading…',
          error: 'Error!'
        }
      }
    };

    fetchMock = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        data: [
          {
            id: 'root',
            text: 'Root',
            children: [{ id: 'child', text: 'Child' }]
          }
        ]
      })
    }));

    global.fetch = fetchMock;
    window.fetch = fetchMock;

    const createdObservers = [];
    intersectionObserverMock = jest.fn(function (callback) {
      this._callback = callback;
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      this.trigger = (entry) => {
        callback([entry]);
      };
      createdObservers.push(this);
    });
    intersectionObserverMock.createdObservers = createdObservers;

    global.IntersectionObserver = intersectionObserverMock;
    window.IntersectionObserver = intersectionObserverMock;

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(script);

    await new Promise((resolve) => {
      $(document).ready(() => {
        document.dispatchEvent(new Event('translationsLoaded'));
        resolve();
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.Tagify;
    delete global.translations;
    delete global.fetch;
    delete window.fetch;
    delete global.IntersectionObserver;
    delete window.IntersectionObserver;
    delete window.__THESAURI_MIN_STATUS_DURATION__;
    jest.useRealTimers();
  });

  test('loads thesaurus data only after visibility trigger and caches the result', async () => {
    jest.useFakeTimers();

    const input = document.getElementById('input-sciencekeyword');

    expect(fetchMock).not.toHaveBeenCalled();

    const observerInstance = intersectionObserverMock.createdObservers[0];
    expect(observerInstance).toBeDefined();

    observerInstance.trigger({ isIntersecting: true, target: input });
    await input._thesaurusInitPromise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(input._tagify).toBeInstanceOf(MockTagify);

    const statusElement = document.querySelector('.thesaurus-loading-status');
    expect(statusElement).not.toBeNull();
    expect(statusElement.getAttribute('aria-live')).toBe('polite');
    expect(statusElement.classList).not.toContain('visually-hidden');

    const minDuration = window.__THESAURI_MIN_STATUS_DURATION__ || 0;
    jest.advanceTimersByTime(minDuration);
    await Promise.resolve();

    expect(statusElement.classList).toContain('visually-hidden');

    observerInstance.trigger({ isIntersecting: true, target: input });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(observerInstance.disconnect).toHaveBeenCalled();
  });

  test('shows an error message and retries loading when footer button is activated', async () => {
    jest.useFakeTimers();

    const input = document.getElementById('input-sciencekeyword');
    const footerButton = document.getElementById('footer-trigger');

    fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500 }));
    fetchMock.mockImplementation(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        data: [
          {
            id: 'root',
            text: 'Root',
            children: [{ id: 'child', text: 'Child' }]
          }
        ]
      })
    }));

    footerButton.click();
    await expect(input._thesaurusInitPromise).rejects.toThrow('Failed to fetch');

    const statusElement = document.querySelector('.thesaurus-loading-status');
    expect(statusElement).not.toBeNull();
    expect(statusElement.classList).not.toContain('visually-hidden');
    expect(statusElement.textContent).toContain('Error');

    footerButton.click();
    await input._thesaurusInitPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const minDuration = window.__THESAURI_MIN_STATUS_DURATION__ || 0;
    jest.advanceTimersByTime(minDuration);
    await Promise.resolve();
    expect(statusElement.classList).toContain('visually-hidden');
    expect(input._tagify).toBeInstanceOf(MockTagify);
  });

  test('initializes Tagify placeholders before data load and updates when translations change', async () => {
    const input = document.getElementById('input-sciencekeyword');

    expect(input._tagify).toBeInstanceOf(MockTagify);
    expect(input._tagify.settings.placeholder).toBe('initial');
    expect(input._tagify.DOM.input.getAttribute('data-placeholder')).toBe('initial');

    global.translations.keywords.thesaurus.label = 'Updated placeholder';
    document.dispatchEvent(new Event('translationsLoaded'));

    expect(input._tagify.settings.placeholder).toBe('Updated placeholder');
    expect(input._tagify.DOM.input.getAttribute('data-placeholder')).toBe('Updated placeholder');
  });

  test('keeps the loading status visible for a minimum duration before hiding it', async () => {
    jest.useFakeTimers();

    const input = document.getElementById('input-sciencekeyword');
    const observerInstance = intersectionObserverMock.createdObservers[0];

    observerInstance.trigger({ isIntersecting: true, target: input });

    await input._thesaurusInitPromise;

    const statusElement = document.querySelector('.thesaurus-loading-status');
    expect(statusElement).not.toBeNull();

    expect(statusElement.textContent).toContain('Loading');
    expect(statusElement.classList).not.toContain('visually-hidden');

    const minDuration = window.__THESAURI_MIN_STATUS_DURATION__ || 0;

    jest.advanceTimersByTime(Math.max(0, minDuration - 1));
    await Promise.resolve();

    expect(statusElement.classList).not.toContain('visually-hidden');

    jest.advanceTimersByTime(1);
    await Promise.resolve();

    expect(statusElement.classList).toContain('visually-hidden');
    expect(statusElement.textContent).toBe('');
  });
});