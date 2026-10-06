const { requireFresh } = require('./utils');

describe('relatedWorkPayloadService.js', () => {
  let synchronizeRelatedWorksPayload;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="form-mde">
        <input type="hidden" name="relatedWorksPayload" value='[{"identifier":"stale"}]'>
      </form>
    `;
    ({ synchronizeRelatedWorksPayload } = requireFresh('../../js/services/relatedWorkPayloadService.js'));
  });

  afterEach(() => {
    delete window.relatedWorkStack;
  });

  test('regenerates the payload from relatedWorkStack without emitting a change notification', () => {
    const freshPayload = [
      {
        relation: 'IsReferencedBy',
        relationId: '7',
        identifier: '10.1234/example',
        identifierType: 'DOI',
        order: 0
      }
    ];
    window.relatedWorkStack = {
      updatePayload: jest.fn().mockReturnValue(freshPayload)
    };

    const result = synchronizeRelatedWorksPayload(document.getElementById('form-mde'));

    expect(result).toBe(freshPayload);
    expect(window.relatedWorkStack.updatePayload).toHaveBeenCalledWith({ notify: false });
    expect(JSON.parse(document.querySelector('input[name="relatedWorksPayload"]').value))
      .toEqual(freshPayload);
  });

  test('rejects a missing hidden payload field before asking the stack to update', () => {
    document.querySelector('input[name="relatedWorksPayload"]').remove();
    window.relatedWorkStack = { updatePayload: jest.fn().mockReturnValue([]) };

    expect(() => synchronizeRelatedWorksPayload(document.getElementById('form-mde')))
      .toThrow('hidden relatedWorksPayload field is missing');
    expect(window.relatedWorkStack.updatePayload).not.toHaveBeenCalled();
  });

  test('rejects an uninitialized relatedWorkStack instead of using the stale field value', () => {
    expect(() => synchronizeRelatedWorksPayload(document.getElementById('form-mde')))
      .toThrow('relatedWorkStack is not initialized');
  });

  test('rejects non-array results from relatedWorkStack', () => {
    window.relatedWorkStack = { updatePayload: jest.fn().mockReturnValue({ relatedWorks: [] }) };

    expect(() => synchronizeRelatedWorksPayload(document.getElementById('form-mde')))
      .toThrow('relatedWorkStack returned a non-array value');
  });

  test('reports payload generation failures with the original error as the cause', () => {
    const generationError = new Error('DOM collection failed');
    window.relatedWorkStack = {
      updatePayload: jest.fn(() => { throw generationError; })
    };

    try {
      synchronizeRelatedWorksPayload(document.getElementById('form-mde'));
      throw new Error('Expected payload synchronization to fail.');
    } catch (error) {
      expect(error.message).toBe('Cannot synchronize Related Works payload from the current form state.');
      expect(error.cause).toBe(generationError);
    }
  });

  test('rejects roots that cannot be queried', () => {
    window.relatedWorkStack = { updatePayload: jest.fn().mockReturnValue([]) };

    expect(() => synchronizeRelatedWorksPayload(null)).toThrow(TypeError);
  });
});
