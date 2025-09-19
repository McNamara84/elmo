const { requireFresh } = require('./utils');

describe('autosaveService', () => {
  let AutosaveService;
  let modalInstance;

  beforeEach(() => {
    jest.resetModules();
    AutosaveService = requireFresh('../../js/services/autosaveService.js');
    document.body.innerHTML = `
      <form id="form-mde">
        <input name="title" value="">
      </form>
      <div id="autosave-status" class="autosave-status" role="status" aria-live="polite" aria-atomic="true" aria-labelledby="autosave-status-label autosave-status-text">
        <span class="visually-hidden" id="autosave-status-label">Autosave status:</span>
        <span class="autosave-status__indicator" aria-hidden="true"></span>
        <div class="autosave-status__text">
          <span class="autosave-status__heading" id="autosave-status-heading">Autosave</span>
          <span id="autosave-status-text"></span>
        </div>
      </div>
      <div id="modal-restore-draft">
        <div id="modal-restore-draft-description"></div>
      </div>
      <button id="button-restore-apply" type="button"></button>
      <button id="button-restore-dismiss" type="button"></button>
    `;

    modalInstance = { show: jest.fn(), hide: jest.fn() };
    global.bootstrap = {
      Modal: jest.fn(() => modalInstance)
    };
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.bootstrap;
    delete window.elmo;
  });

  test('throttles autosave cadence before persisting', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'abc', updatedAt: '2024-01-01T10:00:00Z' })
    });

    const service = new AutosaveService('form-mde', {
      fetch: fetchMock,
      throttleMs: 500,
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text',
      restoreModalId: 'modal-restore-draft'
    });
    service.start();
    fetchMock.mockClear();

    const input = document.querySelector('input[name="title"]');
    input.value = 'First';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await jest.advanceTimersByTimeAsync(400);
    expect(fetchMock).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('./api/v2/drafts');
    const requestArgs = fetchMock.mock.calls[0][1];
    expect(requestArgs.method).toBe('POST');
    const body = JSON.parse(requestArgs.body);
    expect(body.payload.values.title).toBe('First');

    input.value = 'Second';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await jest.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('updateStatus applies semantic classes and localized messages', () => {
    const service = new AutosaveService('form-mde', {
      fetch: jest.fn(),
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text'
    });

    const translations = {
      autosave: {
        status: {
          label: 'Status des automatischen Speicherns:',
          heading: 'Automatisches Speichern',
          pending: 'Automatisches Speichern geplant.',
          saving: 'Automatisches Speichern…',
          syncedWithTime: 'Entwurf gespeichert um {time}.',
          error: 'Automatisches Speichern fehlgeschlagen: {detail}',
          errorNoDetail: 'Automatisches Speichern fehlgeschlagen.',
          manual: 'Manuell gespeichert.',
          idle: 'Automatisches Speichern bereit.'
        }
      }
    };

    document.dispatchEvent(new CustomEvent('translationsLoaded', { detail: { translations } }));

    service.updateStatus('pending');
    const statusElement = document.getElementById('autosave-status');
    expect(statusElement.classList.contains('autosave-status--pending')).toBe(true);
    expect(document.getElementById('autosave-status-text').textContent).toBe('Automatisches Speichern geplant.');
    expect(statusElement.getAttribute('aria-busy')).toBe('false');

    service.updateStatus('saving');
    expect(statusElement.classList.contains('autosave-status--saving')).toBe(true);
    expect(statusElement.getAttribute('aria-busy')).toBe('true');

    const formatSpy = jest.spyOn(service, 'formatTime').mockReturnValue('12:34');
    service.lastSavedAt = new Date('2024-01-01T12:34:00Z');
    service.updateStatus('synced');
    expect(document.getElementById('autosave-status-text').textContent).toBe('Entwurf gespeichert um 12:34.');
    formatSpy.mockRestore();

    service.updateStatus('error', 'Netzwerkfehler');
    expect(statusElement.classList.contains('autosave-status--error')).toBe(true);
    expect(document.getElementById('autosave-status-text').textContent).toBe('Automatisches Speichern fehlgeschlagen: Netzwerkfehler');

    service.updateStatus('error');
    expect(document.getElementById('autosave-status-text').textContent).toBe('Automatisches Speichern fehlgeschlagen.');

    expect(document.getElementById('autosave-status-heading').textContent).toBe('Automatisches Speichern');
    expect(document.getElementById('autosave-status-label').textContent).toBe('Status des automatischen Speicherns:');
  });

  test('serializeValues preserves repeated field arrays', () => {
    const form = document.getElementById('form-mde');
    form.insertAdjacentHTML('beforeend', `
      <input name="givennames[]" value="Ada">
      <input name="givennames[]" value="Grace">
      <input type="hidden" name="authorPersonRorIds[]" value="ror-1">
      <input type="hidden" name="authorPersonRorIds[]" value="ror-2">
    `);

    const service = new AutosaveService('form-mde', {
      fetch: jest.fn(),
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text'
    });

    const values = service.serializeValues();
    expect(values['givennames[]']).toEqual(['Ada', 'Grace']);
    expect(values['authorPersonRorIds[]']).toEqual(['ror-1', 'ror-2']);
  });

  test('applyDraftValues restores repeated inputs sequentially', () => {
    const form = document.getElementById('form-mde');
    form.insertAdjacentHTML('beforeend', `
      <input name="givennames[]" value="">
      <input name="givennames[]" value="">
      <input type="hidden" name="authorPersonRorIds[]" value="">
      <input type="hidden" name="authorPersonRorIds[]" value="">
    `);

    const service = new AutosaveService('form-mde', {
      fetch: jest.fn(),
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text'
    });

    service.applyDraftValues({
      'givennames[]': ['Ada', 'Grace'],
      'authorPersonRorIds[]': ['ror-1', 'ror-2']
    });

    const names = Array.from(form.querySelectorAll('input[name="givennames[]"]')).map((input) => input.value);
    const rorIds = Array.from(form.querySelectorAll('input[name="authorPersonRorIds[]"]')).map((input) => input.value);

    expect(names).toEqual(['Ada', 'Grace']);
    expect(rorIds).toEqual(['ror-1', 'ror-2']);
  });

  test('applyDraftValues requests external expansion when add button unavailable', () => {
    const form = document.getElementById('form-mde');
    form.innerHTML = `
      <div data-creator-row>
        <input name="givennames[]" value="">
      </div>
    `;

    const handler = (event) => {
      const { detail } = event;
      if (!detail || detail.name !== 'givennames[]') {
        return;
      }

      while (form.querySelectorAll('input[name="givennames[]"]').length < detail.requiredCount) {
        const input = document.createElement('input');
        input.name = 'givennames[]';
        input.value = '';
        form.appendChild(input);
      }
    };

    document.addEventListener('autosave:ensure-array-field', handler);

    const service = new AutosaveService('form-mde', {
      fetch: jest.fn(),
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text'
    });

    service.applyDraftValues({
      'givennames[]': ['Ada', 'Grace']
    });

    const names = Array.from(form.querySelectorAll('input[name="givennames[]"]')).map((input) => input.value);
    expect(names).toEqual(['Ada', 'Grace']);

    document.removeEventListener('autosave:ensure-array-field', handler);
  });

  test('applyDraftValues expands repeatable groups before restoring values', () => {
    const form = document.getElementById('form-mde');
    form.innerHTML = `
      <div class="repeatable">
        <div class="row" data-repeatable-row>
          <input name="givennames[]" value="">
          <input name="familynames[]" value="">
          <button type="button" class="add-button" id="button-author-add"></button>
        </div>
      </div>
    `;

    const repeatable = form.querySelector('.repeatable');
    const templateRow = repeatable.querySelector('[data-repeatable-row]');
    const addButton = repeatable.querySelector('.add-button');

    addButton.addEventListener('click', () => {
      const clone = templateRow.cloneNode(true);
      clone.querySelectorAll('input').forEach((input) => {
        input.value = '';
      });
      const cloneButton = clone.querySelector('.add-button');
      if (cloneButton) {
        cloneButton.remove();
      }
      repeatable.appendChild(clone);
    });

    const service = new AutosaveService('form-mde', {
      fetch: jest.fn(),
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text'
    });

    service.applyDraftValues({
      'givennames[]': ['Ada', 'Grace'],
      'familynames[]': ['Lovelace', 'Hopper']
    });

    const rows = repeatable.querySelectorAll('[data-repeatable-row]');
    expect(rows).toHaveLength(2);

    const givenNames = Array.from(form.querySelectorAll('input[name="givennames[]"]')).map((input) => input.value);
    const familyNames = Array.from(form.querySelectorAll('input[name="familynames[]"]')).map((input) => input.value);

    expect(givenNames).toEqual(['Ada', 'Grace']);
    expect(familyNames).toEqual(['Lovelace', 'Hopper']);
  });

  test('restores draft when user accepts prompt', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'rest-1',
          updatedAt: '2024-01-03T08:00:00Z',
          payload: {
            values: {
              title: 'Recovered dataset'
            }
          }
        })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'rest-1', updatedAt: '2024-01-03T08:05:00Z' })
      });

    const service = new AutosaveService('form-mde', {
      fetch: fetchMock,
      throttleMs: 0,
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text',
      restoreModalId: 'modal-restore-draft'
    });
    service.start();

    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock.mock.calls[0][0]).toBe('./api/v2/drafts/session/latest');
    expect(modalInstance.show).toHaveBeenCalled();

    document.getElementById('button-restore-apply').click();

    const input = document.querySelector('input[name="title"]');
    expect(input.value).toBe('Recovered dataset');
    expect(modalInstance.hide).toHaveBeenCalled();
    expect(window.localStorage.getItem('elmo.autosave.draftId')).toBe('rest-1');
    const statusText = document.getElementById('autosave-status-text').textContent;
    expect(statusText).toMatch(/Draft saved/);
  });

  test('supports configurable API base URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'custom-1', updatedAt: '2024-02-01T12:00:00Z' })
    });

    const service = new AutosaveService('form-mde', {
      fetch: fetchMock,
      throttleMs: 0,
      statusElementId: 'autosave-status',
      statusTextId: 'autosave-status-text',
      restoreModalId: 'modal-restore-draft',
      apiBaseUrl: '/mde-msl/api/v2/'
    });

    service.start();
    await Promise.resolve();
    fetchMock.mockClear();

    const input = document.querySelector('input[name="title"]');
    input.value = 'Configurable base path';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await jest.runOnlyPendingTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/mde-msl/api/v2/drafts');
    expect(service.apiBaseUrl).toBe('/mde-msl/api/v2');
  });
});