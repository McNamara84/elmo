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
  document.body.innerHTML = `<input id="input-freekeyword" data-translate-placeholder="keywords.free.placeholder">

  <div class="modal fade" id="freeKeywordsCsvModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-body">
          <label for="input-freekeywords-csv" id="freekeywords-csv-dropzone"></label>
          <input type="file" id="input-freekeywords-csv" class="visually-hidden" accept=".csv,text/csv">
          <a id="button-download-csv-test-files"></a>
          <div id="freekeywords-csv-filename"></div>
          <div id="freekeywords-csv-feedback"></div>
        </div>
        <div class="modal-footer">
          <button type="button" id="button-confirm-csv-upload" disabled>
            Import keywords
          </button>
        </div>
      </div>
    </div>
  </div>
`;
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

  test('accepts valid csv file from input change and enables confirm', async () => {
    loadScript(() => ({
      done(cb) { cb([]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));

    const input = document.getElementById('input-freekeywords-csv');
    const confirmBtn = document.getElementById('button-confirm-csv-upload');
    const fileName = document.getElementById('freekeywords-csv-filename');
    const feedback = document.getElementById('freekeywords-csv-feedback');

    const file = new File(['ignored'], 'geoscience-keywords.csv', { type: 'text/csv' });
    file.__mockText = 'rock mechanics, seismology\nInSAR; rock mechanics';

    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true
    });

    input.dispatchEvent(new Event('change', { bubbles: true }));

    await flushPromises();
    await flushPromises();

    expect(fileName.textContent).toBe('geoscience-keywords.csv');
    expect(feedback.textContent).toContain('keywords ready to import.');
    expect(feedback.className).toContain('text-success');
    expect(confirmBtn.disabled).toBe(false);
  });

  test('rejects invalid non-csv file', async () => {
    loadScript(() => ({
      done(cb) { cb([]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));

    const input = document.getElementById('input-freekeywords-csv');
    const confirmBtn = document.getElementById('button-confirm-csv-upload');
    const feedback = document.getElementById('freekeywords-csv-feedback');

    const file = new File(['seismology'], 'geoscience-keywords.txt', { type: 'text/plain' });

    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true
    });

    input.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    expect(feedback.textContent).toBe('Please select a valid CSV file.');
    expect(feedback.className).toContain('text-danger');
    expect(confirmBtn.disabled).toBe(true);
  });

  test('handles dropped csv file', async () => {
    loadScript(() => ({
      done(cb) { cb([]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));

    const dropzone = document.getElementById('freekeywords-csv-dropzone');
    const confirmBtn = document.getElementById('button-confirm-csv-upload');
    const fileName = document.getElementById('freekeywords-csv-filename');
    const feedback = document.getElementById('freekeywords-csv-feedback');

    const file = new File(['ignored'], 'tectonics-keywords.csv', { type: 'text/csv' });
    file.__mockText = 'fault creep, induced seismicity';

    const dropEvent = new Event('drop', { bubbles: true });
    dropEvent.preventDefault = jest.fn();
    dropEvent.dataTransfer = { files: [file] };

    dropzone.dispatchEvent(dropEvent);
    await flushPromises();
    await flushPromises();

    expect(dropEvent.preventDefault).toHaveBeenCalled();
    expect(fileName.textContent).toBe('tectonics-keywords.csv');
    expect(feedback.textContent).toContain('keywords ready to import.');
    expect(confirmBtn.disabled).toBe(false);
  });

  test('accepts a .csv file even when browser reports application/vnd.ms-excel', async () => {
    loadScript(() => ({
      done(cb) { cb([]); return { fail: jest.fn() }; },
      fail: jest.fn()
    }));

    const csvInput = document.getElementById('input-freekeywords-csv');
    const confirmButton = document.getElementById('button-confirm-csv-upload');
    const feedback = document.getElementById('freekeywords-csv-feedback');

    global.FileReader = jest.fn(function () {
      this.readAsText = () => {
        this.onload({
          target: {
            result: 'alpha,beta'
          }
        });
      };
    });

    const file = new File(['alpha,beta'], 'keywords.csv', {
      type: 'application/vnd.ms-excel'
    });

    Object.defineProperty(csvInput, 'files', {
      value: [file],
      configurable: true
    });

    csvInput.dispatchEvent(new Event('change'));
    await flushPromises();

    expect(confirmButton.disabled).toBe(false);
    expect(feedback.textContent).toBe('2 keywords ready to import.');
    expect(feedback.className).toContain('text-success');
  });
});