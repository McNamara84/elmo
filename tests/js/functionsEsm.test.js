import { replaceHelpButtonInClonedRows, createRemoveButton, updateOverlayLabels } from '../../js/eventhandlers/functions.js';

describe('ESM exports from eventhandlers/functions.js', () => {
  test('named exports are available', () => {
    expect(typeof replaceHelpButtonInClonedRows).toBe('function');
    expect(typeof createRemoveButton).toBe('function');
    expect(typeof updateOverlayLabels).toBe('function');
  });
});
