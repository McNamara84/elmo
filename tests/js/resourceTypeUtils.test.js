/**
 * @jest-environment jsdom
 */

const {
  getDataCite47ResourceTypes,
  toSpacedResourceTypeLabel,
} = require('./utils/dataciteResourceTypes');
const {
  normalizeResourceTypeGeneral,
  findResourceTypeOption,
} = require('../../js/resourceTypeUtils');

const DATACITE_47_RESOURCE_TYPES = getDataCite47ResourceTypes();

describe('resourceTypeUtils', () => {
  test.each(DATACITE_47_RESOURCE_TYPES)(
    'matches the DataCite 4.7 type %s against its ERNIE display label',
    resourceTypeGeneral => {
      const option = document.createElement('option');
      option.text = toSpacedResourceTypeLabel(resourceTypeGeneral);

      expect(findResourceTypeOption([option], resourceTypeGeneral)).toBe(option);
      expect(normalizeResourceTypeGeneral(option.text)).toBe(resourceTypeGeneral);
    }
  );

  test('prefers an exact label over a whitespace-normalized label', () => {
    const spacedOption = document.createElement('option');
    spacedOption.text = 'Data Paper';
    const exactOption = document.createElement('option');
    exactOption.text = 'DataPaper';

    expect(
      findResourceTypeOption([spacedOption, exactOption], 'DataPaper')
    ).toBe(exactOption);
  });
});
