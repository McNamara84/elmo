const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMappingModule(contextOverrides = {}) {
  const code = fs.readFileSync(path.resolve(__dirname, '../../js/mappingXmlToInputFields.js'), 'utf8');
  const context = {
    console,
    document: global.document,
    window: global.window,
    ...contextOverrides,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

describe('mappingXmlToInputFields helpers', () => {
  test('processResourceType selects option matching resourceTypeGeneral', () => {
    document.body.innerHTML = `
      <select id="input-resourceinformation-resourcetype">
        <option value="Dataset">Dataset</option>
        <option value="Software">Software</option>
      </select>`;

    const ctx = loadMappingModule();

    const xml = `<resource xmlns=\"http://datacite.org/schema/kernel-4\">
      <resourceType resourceTypeGeneral=\"Dataset\">Genome Sequencing Data</resourceType>
    </resource>`;
    const xmlDoc = new DOMParser().parseFromString(xml, 'application/xml');

    ctx.processResourceType(xmlDoc);
    const select = document.getElementById('input-resourceinformation-resourcetype');
    expect(select.value).toBe('Dataset');
  });

  test('extractLicenseIdentifier resolves SPDX identifier', () => {
    const ctx = loadMappingModule();
    const xml = `<rights rightsURI=\"https://spdx.org/licenses/CC0-1.0.html\">CC0 1.0</rights>`;
    const node = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
    expect(ctx.extractLicenseIdentifier(node)).toBe('CC0-1');
  });

  test('mapTitleType maps known types to option values', () => {
    const ctx = loadMappingModule();
    expect(ctx.mapTitleType('AlternativeTitle')).toBe('2');
    expect(ctx.mapTitleType('TranslatedTitle')).toBe('3');
    expect(ctx.mapTitleType('UnknownType')).toBe('1');
  });

  test('normalizeRole inserts whitespace in contributor roles', () => {
    const ctx = loadMappingModule();
    expect(ctx.normalizeRole('DataCurator')).toBe('Data Curator');
  });

  test('findLabNameById returns lab info from labData', () => {
    const ctx = loadMappingModule();
    vm.runInContext(`labData = [{id: 'MSL-001', name: 'Max Planck Institute for Astronomy', rorid: 'https://ror.org/05y42nb95', affiliation: 'Max Planck Society'}];`, ctx);
    const lab = ctx.findLabNameById('MSL-001');
    expect(lab).toEqual({id: 'MSL-001', name: 'Max Planck Institute for Astronomy', rorid: 'https://ror.org/05y42nb95', affiliation: 'Max Planck Society'});
  });
});