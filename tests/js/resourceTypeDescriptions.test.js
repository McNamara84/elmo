const { getResourceTypeDescription, RESOURCE_TYPE_FALLBACKS } = require('../../js/resourceTypeDescriptions.js');

describe('resource type descriptions', () => {
  test('uses the ERNIE description when present', () => {
    expect(getResourceTypeDescription('Dataset', '  Current ERNIE definition. '))
      .toBe('Current ERNIE definition.');
  });

  test.each(Object.keys(RESOURCE_TYPE_FALLBACKS))('has a fallback for %s', key => {
    expect(getResourceTypeDescription(key, null)).toBe(RESOURCE_TYPE_FALLBACKS[key]);
  });

  test('shows an explicit fallback for future types', () => {
    expect(getResourceTypeDescription('Future Type', null)).toContain('No definition');
  });
});
