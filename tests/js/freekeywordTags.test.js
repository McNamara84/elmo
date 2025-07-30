const fs = require('fs');
const path = require('path');

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
  const script = fs.readFileSync(path.resolve(__dirname, '../../js/freekeywordTags.js'), 'utf8');
  window.eval(script);
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
});