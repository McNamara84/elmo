/**
 * @jest-environment jsdom
 *
 * populateIcgemDataSources must wait for the GCMD platforms tree before
 * addTags, then flush Tagify's hidden input so save POSTs satellite JSON.
 */

describe('populateIcgemDataSources satellite platforms', () => {
  let $;
  let icgemModule;

  const graceFo = 'Platforms > Space-based Platforms > Earth Observation Satellites > GRACE-FO';

  function buildDatasourceDom(tagify) {
    document.body.innerHTML = `
      <div id="group-datasources">
        <div class="row" data-source-row>
          <select name="datasource_type[]">
            <option value="S">Satellite</option>
            <option value="G">Ground data</option>
            <option value="A">Altimetry</option>
            <option value="M">Model</option>
            <option value="T">Elevation/Terrain</option>
          </select>
          <select name="datasource_details[]"></select>
          <textarea name="datasource_description[]"></textarea>
          <input name="satellite_platform[]" />
          <input name="dIdentifier[]" />
          <select name="dIdentifierType[]"></select>
          <input name="dName[]" />
          <button type="button" class="addDataSource"></button>
        </div>
      </div>
    `;
    const platformInput = document.querySelector('input[name="satellite_platform[]"]');
    if (tagify && platformInput) {
      platformInput._tagify = tagify;
    }
  }

  beforeEach(() => {
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    jest.resetModules();
    icgemModule = require('../../js/mappingXmlToInputFieldsIcgem.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.waitForThesaurusVocabulary;
    delete window.setupIdentifierTypesDropdown;
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
  });

  test('waits for platforms vocabulary before adding satellite tags', async () => {
    const tagify = {
      addTags: jest.fn(),
      update: jest.fn()
    };
    buildDatasourceDom(tagify);

    let resolveWait;
    window.waitForThesaurusVocabulary = jest.fn(() => new Promise((resolve) => {
      resolveWait = resolve;
    }));

    const done = icgemModule.populateIcgemDataSources({
      dataSources: [{
        inputDataSourceType: 'Satellite',
        satelliteValueName: graceFo,
        satelliteValueUri: 'https://gcmd.earthdata.nasa.gov/kms/concept/f75e34e2-ebe7-4a6c-8bf6-da596a36b632',
        satelliteSchemeName: 'NASA/GCMD Earth Platforms Keywords',
        satelliteSchemeUri: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms'
      }]
    });

    expect(tagify.addTags).not.toHaveBeenCalled();
    expect(window.waitForThesaurusVocabulary).toHaveBeenCalledWith('platforms');

    resolveWait('loaded');
    await done;

    expect(tagify.addTags).toHaveBeenCalledWith([
      expect.objectContaining({ value: graceFo })
    ]);
    expect(tagify.update).toHaveBeenCalled();
  });

  test('rejects satellite tags when platforms vocabulary wait times out', async () => {
    const tagify = {
      addTags: jest.fn(),
      update: jest.fn()
    };
    buildDatasourceDom(tagify);
    window.waitForThesaurusVocabulary = jest.fn(() => Promise.resolve('timeout'));

    await expect(icgemModule.populateIcgemDataSources({
      dataSources: [{
        inputDataSourceType: 'Satellite',
        satelliteValueName: graceFo
      }]
    })).rejects.toThrow('GCMD platforms vocabulary not ready for satellite import');

    expect(tagify.addTags).not.toHaveBeenCalled();
    expect(tagify.update).not.toHaveBeenCalled();
  });

  test('does not wait when there is no satellite platform', async () => {
    buildDatasourceDom({ addTags: jest.fn(), update: jest.fn() });
    window.waitForThesaurusVocabulary = jest.fn(() => Promise.resolve('loaded'));

    await icgemModule.populateIcgemDataSources({
      dataSources: [{
        inputDataSourceType: 'Model',
        modelDetail: 'Global Gravitational Model'
      }]
    });

    expect(window.waitForThesaurusVocabulary).not.toHaveBeenCalled();
  });

  test('waits for identifier type options before setting Model identifierType', async () => {
    buildDatasourceDom();
    let resolveTypes;
    window.setupIdentifierTypesDropdown = jest.fn(($select) => new Promise((resolve) => {
      resolveTypes = () => {
        $select.append('<option value="DOI">DOI</option>');
        resolve();
      };
    }));

    const done = icgemModule.populateIcgemDataSources({
      dataSources: [{
        inputDataSourceType: 'Model',
        identifier: '10.5880/icgem.2018.003',
        identifierType: 'DOI',
        name: 'GOCO06s'
      }]
    });

    expect($('select[name="dIdentifierType[]"]').val()).not.toBe('DOI');
    expect(window.setupIdentifierTypesDropdown).toHaveBeenCalled();

    resolveTypes();
    await done;

    expect($('select[name="dIdentifierType[]"]').val()).toBe('DOI');
    expect($('input[name="dIdentifier[]"]').val()).toBe('10.5880/icgem.2018.003');
    expect($('input[name="dName[]"]').val()).toBe('GOCO06s');
  });
});
