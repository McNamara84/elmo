const { requireFresh } = require('./utils');

describe('Resource Information payload synchronization', () => {
  const { synchronizeResourceInformationPayload } = requireFresh('../../js/services/resourceInformationPayloadService.js');

  beforeEach(() => {
    document.body.innerHTML = '<form id="form-mde"><input name="resourceInformationPayload" value="stale"></form>';
  });

  afterEach(() => { delete window.resourceInformation; });

  test('writes the current controller state before a request', () => {
    const payload = { doi: '', titles: [{ text: 'Current', typeId: '1', position: 0 }] };
    window.resourceInformation = { sync: jest.fn(() => payload) };
    expect(synchronizeResourceInformationPayload(document.getElementById('form-mde'))).toBe(payload);
    expect(JSON.parse(document.querySelector('[name="resourceInformationPayload"]').value)).toEqual(payload);
  });

  test('rejects an uninitialized or invalid state', () => {
    expect(() => synchronizeResourceInformationPayload(document.getElementById('form-mde'))).toThrow('not initialized');
    window.resourceInformation = { sync: () => ({ titles: null }) };
    expect(() => synchronizeResourceInformationPayload(document.getElementById('form-mde'))).toThrow('invalid');
  });
});
