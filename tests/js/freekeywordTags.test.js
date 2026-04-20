const { requireFresh } = require('./utils');

class MockTagify {
  constructor(el, options = {}) {
    this.el = el;
    this.settings = options;
    this.value = [];
    this.dropdown = { visible: false, refilter: jest.fn() };
  }
  addTags(tags) {
    const arr = Array.isArray(tags) ? tags : [tags];
    arr.forEach(t => {
      if (typeof t === 'string') {
        this.value.push({ value: t });
      } else {
        this.value.push(t);
      }
    });
  }
  removeAllTags() {
    this.value = [];
  }
}

const flushPromises = () => new Promise(res => setTimeout(res, 0));

function loadScript(ajaxImpl, translations = { keywords: { free: { placeholder: 'Placeholder' } } }) {
  document.body.innerHTML = '<input id="input-freekeyword" data-translate-placeholder="keywords.free.placeholder">';
  const $ = require('jquery');
  global.$ = $;
  global.jQuery = $;
  global.Tagify = MockTagify;
  global.translations = translations;
  $.ajax = jest.fn(ajaxImpl);
  requireFresh('../../js/freekeywordTags.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  return { $ };
}

describe('freekeywordTags.js', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('initializes Tagify and loads keywords', async () => {
    loadScript(() => ({
      done(cb) { cb([{ free_keyword: 'A' }, { free_keyword: 'B' }]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));
    await flushPromises();
    const input = document.getElementById('input-freekeyword');
    expect(input._tagify).toBeInstanceOf(MockTagify);
    expect(input._tagify.settings.placeholder).toBe('Placeholder');
    expect(input._tagify.settings.whitelist).toEqual(['A', 'B']);
  });

  test('refreshes Tagify on translationsLoaded', () => {
    loadScript(() => ({
      done(cb) { cb([{ free_keyword: 'One' }]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));
    const input = document.getElementById('input-freekeyword');
    input._tagify.addTags('One');
    global.translations = { keywords: { free: { placeholder: 'New' } } };
    document.dispatchEvent(new Event('translationsLoaded'));
    expect(input._tagify.settings.placeholder).toBe('New');
    expect(input._tagify.settings.whitelist).toEqual(['One']);
    expect(input._tagify.value[0].value).toBe('One');
    expect(input.style.display).toBe('block');
  });

  test('handles invalid API response', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadScript(() => ({
      done(cb) { cb({}); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));
    expect(errSpy).toHaveBeenCalled();
    const input = document.getElementById('input-freekeyword');
    expect(input._tagify.settings.whitelist).toEqual([]);
    errSpy.mockRestore();
  });

  test('does not log curated keywords message when empty array returned', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    loadScript(() => ({
      done(cb) { cb([]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));
    expect(logSpy).not.toHaveBeenCalled();
    const input = document.getElementById('input-freekeyword');
    expect(input._tagify.settings.whitelist).toEqual([]);
    logSpy.mockRestore();
  });

  test('silently ignores API request failures without console warnings', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    loadScript(() => ({
      done() { return { fail: cb => cb({ status: 404, statusText: 'Not Found', responseText: 'err' }, 'error', 'err') }; },
      fail: jest.fn()
    }));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
  
  test('adds default MSL free keywords for new records when feature is enabled', async () => {
    // Set feature flags before loading the script so the DOMContentLoaded handler sees them
    global.window = global.window || {};
    window.ELMO_FEATURES = { showMslDefaultFreeKeywords: true };
    window.elmo = { isNewRecord: true };

    loadScript(() => ({
      done(cb) { cb([]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));

    // Wait one tick to let async callbacks (including Tagify init) complete
    await new Promise(resolve => setTimeout(resolve, 0));

    const input = document.getElementById('input-freekeyword');
    expect(input._tagify.value).toEqual([
      { value: 'EPOS' },
      { value: 'multi-scale laboratories' }
    ]);
  });
});