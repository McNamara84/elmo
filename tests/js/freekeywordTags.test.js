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
});