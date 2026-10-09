const { requireFresh } = require('./utils');

describe('Resource Information import map', () => {
  const { parseResourceInformationMap } = requireFresh('../../js/mappingXmlToInputFields.js');

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="input-resourceinformation-resourcetype"><option value="5">Dataset</option></select>
      <select id="input-resourceinformation-language"><option value="1">English</option></select>`;
  });

  test('resolves vocabulary IDs and preserves title order and version', () => {
    const mapped = new DOMParser().parseFromString(`<ResourceInformation>
      <Doi>10.5880/example</Doi><Year>2026</Year><ResourceType>Dataset</ResourceType>
      <Version>3.0</Version><Language>en</Language><Titles>
      <Title type="" position="0">Main</Title>
      <Title type="AlternativeTitle" position="1">Second</Title>
      <Title type="TranslatedTitle" position="2">First</Title>
      </Titles></ResourceInformation>`, 'application/xml');
    expect(parseResourceInformationMap(mapped, { en: '1' }, {
      '': '1', AlternativeTitle: '2', TranslatedTitle: '3'
    })).toEqual({
      doi: '10.5880/example', year: '2026', resourceTypeId: '5', version: '3.0', languageId: '1',
      titles: [
        { key: 'main', text: 'Main', typeId: '1', position: 0 },
        { key: 'import-1', text: 'Second', typeId: '2', position: 1 },
        { key: 'import-2', text: 'First', typeId: '3', position: 2 }
      ]
    });
  });
});
