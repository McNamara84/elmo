const { requireFresh } = require('./utils');

let SaveHandler;
let $;
let modalInstances;

function createSaveHandlerFetchMock({
  saveFilename = 'dataset.xml',
  blob = new Blob(),
  csrfRefreshToken = 'test-csrf-token-refreshed'
} = {}) {
  return jest.fn(function(url) {
    if (url === 'save/save_data.php') {
      return Promise.resolve({
        ok: true,
        headers: { get: function() { return `attachment; filename="${saveFilename}"`; } },
        blob: function() {
          return Promise.resolve(blob);
        }
      });
    }

    if (url === 'api/csrf_token.php') {
      return Promise.resolve({
        ok: true,
        json: function() {
          return Promise.resolve({ token: csrfRefreshToken });
        }
      });
    }
  });
}

function loadScript() {
  ({ SaveHandler } =
    requireFresh('../../js/saveHandler.js'));
}

describe('saveHandler.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="form-mde">
        <input id="input-date-created">
        <input id="input-date-embargo">
        <input id="input-form-csrf-token" value="test-csrf-token">
        <input id="input-save-time-spent">
        <input id="input-information-website">
        <div class="embargo-invalid"></div>
        <div id="group-author">
          <input type="checkbox" name="contacts[]" value="1">
          <input type="checkbox" name="contacts[]" value="2">
        </div>
      </form>
      <div id="modal-saveas">
        <h2 id="label-saveas-modal"></h2>
        <input id="input-saveas-filename">
        <span id="saveas-extension"></span>
        <button class="btn-close"></button>
        <button class="btn-secondary"></button>
      </div>
      <div id="modal-notification">
        <div id="modal-notification-label"></div>
        <div id="modal-notification-body"></div>
        <button class="btn-close"></button>
        <button class="btn-primary"></button>
      </div>`;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    global.applyTranslations = jest.fn();

    modalInstances = [];
    global.bootstrap = {
      Modal: jest.fn(() => {
        const inst = { show: jest.fn(), hide: jest.fn() };
        modalInstances.push(inst);
        return inst;
      })
    };

    global.translations = {
      dates: { embargoDateError: 'embargoErr' },
      coverage: { endDateError: 'endErr' },
      alerts: {
        processingHeading: 'procH',
        preparingDownload: 'prepD',
        filenameErrorHeading: 'fh',
        filenameError: 'fe',
        successHeading: 'sh',
        savingSuccess: 'ss',
        errorHeading: 'eh',
        saveError: 'se',
        savingHeading: 'savH',
        savingInfo: 'savI'
      },
      modals: {
        save: {
          saveAs: 'Save as XML',
          saveAsJsonLd: 'Save as JSON-LD'
        }
      }
    };
    global.logEvent = jest.fn().mockResolvedValue();
    loadScript();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('generateFilename returns formatted timestamp', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-05-30T12:34:56Z').getTime());
    const handler = new SaveHandler('form-mde','modal-saveas','modal-notification');
    const name = await handler.generateFilename();
    expect(name).toBe('dataset_20240530_123456');
  });

  test('handleSaveConfirm validates filename', async () => {
    const handler = new SaveHandler('form-mde','modal-saveas','modal-notification');
    jest.spyOn(handler, 'showNotification').mockImplementation(() => {});
    jest.spyOn(handler, 'saveAndDownload').mockResolvedValue();

    $('#input-saveas-filename').val('');
    await handler.handleSaveConfirm();
    expect(handler.showNotification).toHaveBeenCalledWith('danger','fh','fe');
    expect(modalInstances[0].hide).not.toHaveBeenCalled();

    handler.showNotification.mockClear();
    $('#input-saveas-filename').val('file');
    await handler.handleSaveConfirm();
    expect(modalInstances[0].hide).toHaveBeenCalled();
    expect(handler.saveAndDownload).toHaveBeenCalledWith('file', 'xml');
  });

  test('handleSave updates modal state for jsonld', async () => {
    const handler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification');
    jest.spyOn(handler, 'generateFilename').mockResolvedValue('dataset_20240530_123456');
    jest.spyOn(handler, 'showNotification').mockImplementation(() => {});

    await handler.handleSave('jsonld');

    expect($('#label-saveas-modal').text()).toBe('Save as JSON-LD');
    expect($('#saveas-extension').text()).toBe('.jsonld');
    expect($('#input-saveas-filename').val()).toBe('dataset_20240530_123456');
    expect(modalInstances[0].show).toHaveBeenCalled();
  });

  test('showNotification updates modal and hides on actions', () => {
    const handler = new SaveHandler('form-mde','modal-saveas','modal-notification');
    handler.showNotification('success','Title','Message');
    expect($('#modal-notification-label').text()).toBe('Title');
    expect($('#modal-notification-body').html()).toContain('Message');
    expect(modalInstances[1].show).toHaveBeenCalled();

    document.querySelector('#modal-notification .btn-close').click();
    expect(modalInstances[1].hide).toHaveBeenCalled();
  });

  test('saveAndDownload coordinates with autosave service', async () => {
    const autosave = {
      flushPending: jest.fn().mockResolvedValue(),
      markManualSave: jest.fn().mockResolvedValue()
    };
    const revokeSpy = jest.fn();
    global.fetch = createSaveHandlerFetchMock({
      saveFilename: 'dataset.xml',
      blob: new Blob(['<xml/>'], { type: 'application/xml' })
    });
    
    const originalCreate = window.URL.createObjectURL;
    const originalRevoke = window.URL.revokeObjectURL;
    window.URL.createObjectURL = jest.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = revokeSpy;

    const handler = new SaveHandler('form-mde','modal-saveas','modal-notification', autosave);
    await handler.saveAndDownload('dataset');

    expect(autosave.flushPending).toHaveBeenCalled();
    expect(autosave.markManualSave).toHaveBeenCalled();
    
    // Find the save/download fetch call
    const saveCall = global.fetch.mock.calls.find(call => call[0] === 'save/save_data.php');
    expect(saveCall).toBeDefined();
    expect(saveCall[1].method).toBe('POST');
    expect(saveCall[1].body.get('download_format')).toBe('xml');
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');

    window.URL.createObjectURL = originalCreate;
    window.URL.revokeObjectURL = originalRevoke;
    delete global.fetch;
  });

  test('provides ES module exports', async () => {
    const mod = await import('../../js/saveHandler.js');
    expect(mod.default).toBeDefined();
    expect(mod.SaveHandler).toBeDefined();
  });

  test('saveAndDownload logs success event', async () => {
    global.fetch = createSaveHandlerFetchMock({ saveFilename: 'dataset.xml', blob: new Blob() });
    window.URL.createObjectURL = jest.fn();
    window.URL.revokeObjectURL = jest.fn();

    const handler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification');
    await handler.saveAndDownload('dataset');

    expect(global.logEvent).toHaveBeenCalledWith('save', 'user successfully saved xml file locally');
    expect(global.logEvent).toHaveBeenCalledTimes(1);
    delete global.fetch;
  });

  test('saveAndDownload sends jsonld format and logs jsonld success', async () => {
    global.fetch = createSaveHandlerFetchMock({
      saveFilename: 'dataset.jsonld',
      blob: new Blob([], { type: 'application/ld+json' })
    });
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-jsonld');
    window.URL.revokeObjectURL = jest.fn();

    const handler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification');
    await handler.saveAndDownload('dataset', 'jsonld');

    // Find the save/download fetch call
    const saveCall = global.fetch.mock.calls.find(call => call[0] === 'save/save_data.php');
    expect(saveCall).toBeDefined();
    expect(saveCall[1].body.get('download_format')).toBe('jsonld');
    expect(global.logEvent).toHaveBeenCalledWith('save', 'user successfully saved json-ld file locally');
    delete global.fetch;
  });

  test('saveAndDownload logs failure on network error', async () => {
    global.fetch = jest.fn(function(url) {
      if (url === 'save/save_data.php') {
        return Promise.reject(new Error('Network failure'));
      }

      if (url === 'api/csrf_token.php') {
        return Promise.resolve({
          ok: true,
          json: function() { return Promise.resolve({ token: 'test-csrf-token' }); }
        });
      }
    });
    
    const handler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification');
    await handler.saveAndDownload('dataset');

    expect(global.logEvent).toHaveBeenCalledWith('save', 'user FAILED to save xml file locally');
    expect(global.logEvent).toHaveBeenCalledTimes(1);
    delete global.fetch;
  });

  test('saveAndDownload logs failure on HTTP error', async () => {
    global.fetch = jest.fn(function(url) {
      if (url === 'save/save_data.php') {
        return Promise.resolve({ ok: false, status: 500 });
      }

      if (url === 'api/csrf_token.php') {
        return Promise.resolve({
          ok: true,
          json: function() { return Promise.resolve({ token: 'test-csrf-token' }); }
        });
      }
    });
    
    const handler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification');
    await handler.saveAndDownload('dataset');

    expect(global.logEvent).toHaveBeenCalledWith('save', 'user FAILED to save xml file locally');
    expect(global.logEvent).toHaveBeenCalledTimes(1);
    delete global.fetch;
  });
});