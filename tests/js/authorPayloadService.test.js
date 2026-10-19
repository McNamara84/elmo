const { requireFresh } = require('./utils');

describe('authorPayloadService.js', () => {
  let synchronizeAuthorsPayload;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="form-mde">
        <input type="hidden" name="authorsPayload" value='[{"type":"person","familyname":"Stale"}]'>
      </form>
    `;
    ({ synchronizeAuthorsPayload } = requireFresh('../../js/services/authorPayloadService.js'));
  });

  afterEach(() => {
    delete window.authorStack;
  });

  test('regenerates the payload from authorStack and updates the transport field', () => {
    const freshPayload = [
      { type: 'institution', institutionname: 'GFZ', affiliations: [] },
      { type: 'person', familyname: 'Doe', givenname: 'Jane', affiliations: [] }
    ];
    window.authorStack = {
      updatePayload: jest.fn().mockReturnValue(freshPayload)
    };

    const result = synchronizeAuthorsPayload(document.getElementById('form-mde'));

    expect(result).toBe(freshPayload);
    expect(window.authorStack.updatePayload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(document.querySelector('input[name="authorsPayload"]').value)).toEqual(freshPayload);
  });

  test('rejects a missing hidden payload field before asking the stack to update', () => {
    document.querySelector('input[name="authorsPayload"]').remove();
    window.authorStack = { updatePayload: jest.fn().mockReturnValue([]) };

    expect(() => synchronizeAuthorsPayload(document.getElementById('form-mde')))
      .toThrow('hidden authorsPayload field is missing');
    expect(window.authorStack.updatePayload).not.toHaveBeenCalled();
  });

  test('rejects an uninitialized authorStack instead of using the stale field value', () => {
    expect(() => synchronizeAuthorsPayload(document.getElementById('form-mde')))
      .toThrow('authorStack is not initialized');
  });

  test('rejects non-array results from authorStack', () => {
    window.authorStack = { updatePayload: jest.fn().mockReturnValue({ authors: [] }) };

    expect(() => synchronizeAuthorsPayload(document.getElementById('form-mde')))
      .toThrow('authorStack returned a non-array value');
  });

  test('reports payload generation failures with the original error as the cause', () => {
    const generationError = new Error('DOM collection failed');
    window.authorStack = { updatePayload: jest.fn(() => { throw generationError; }) };

    try {
      synchronizeAuthorsPayload(document.getElementById('form-mde'));
      throw new Error('Expected payload synchronization to fail.');
    } catch (error) {
      expect(error.message).toBe('Cannot synchronize Authors payload from the current form state.');
      expect(error.cause).toBe(generationError);
    }
  });

  test('rejects roots that cannot be queried', () => {
    window.authorStack = { updatePayload: jest.fn().mockReturnValue([]) };

    expect(() => synchronizeAuthorsPayload(null)).toThrow(TypeError);
  });
});
