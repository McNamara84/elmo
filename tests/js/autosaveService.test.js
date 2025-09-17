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
      <div id="autosave-status" class="autosave-status">
        <span id="autosave-status-text"></span>
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
    const requestArgs = fetchMock.mock.calls[0][1];
    expect(requestArgs.method).toBe('POST');
    const body = JSON.parse(requestArgs.body);
    expect(body.payload.values.title).toBe('First');

    input.value = 'Second';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await jest.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    expect(modalInstance.show).toHaveBeenCalled();

    document.getElementById('button-restore-apply').click();

    const input = document.querySelector('input[name="title"]');
    expect(input.value).toBe('Recovered dataset');
    expect(modalInstance.hide).toHaveBeenCalled();
    expect(window.localStorage.getItem('elmo.autosave.draftId')).toBe('rest-1');
    const statusText = document.getElementById('autosave-status-text').textContent;
    expect(statusText).toMatch(/Draft saved/);
  });
});