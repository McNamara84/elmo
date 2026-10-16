const types = require('../fixtures/identifier-types.json');

describe('identifier detection in Related Work and GEM fields', () => {
  let $, select, requests;
  const input = () => $('input[name="rIdentifier[]"]').first();
  const type = () => $('select[name="rIdentifierType[]"]').first();
  const microtasks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

  beforeEach(() => {
    jest.resetModules();
    $ = require('jquery');
    global.$ = global.jQuery = $;
    $(document).off();
    delete global.fetch;
    window.elmo = {};
    document.body.innerHTML = ['r', 'r', 'd'].map((prefix, i) => `
      <div class="row" ${prefix === 'r' ? 'data-related-work-entry' : ''}>
        <input name="${prefix}Identifier[]" id="identifier-${i}">
        <select name="${prefix}IdentifierType[]"><option value=""></option>${types.map(t => `<option>${t.name}</option>`).join('')}</select>
      </div>`).join('');
    requests = [];
    $.getJSON = jest.fn((url, callback) => { callback({ identifierTypes: types }); return { fail: jest.fn() }; });
    $.ajax = jest.fn(options => {
      if (options.url === 'api/v2/validation/identifier-type') requests.push(options);
      else options.success?.({});
      return { fail: jest.fn() };
    });
    select = require('../../js/select.js');
    select.populateIdentifierTypesDropdownWithData({ identifierTypes: types });
  });

  afterEach(() => { jest.useRealTimers(); $(document).off(); document.body.innerHTML = ''; });

  async function begin(value, element = input()[0]) {
    $(element).val(value);
    const promise = select.updateIdentifierType(element);
    await microtasks();
    return { promise };
  }
  function resolve(request, identifierType = 'IGSN') {
    request.success({ status: 'detected', identifierType, source: 'datacite' });
  }

  test.each(['IGSN', 'RAiD', 'DOI'])('selects confirmed %s and permits resolver input', async identifierType => {
    const { promise } = await begin('https://doi.org/10.60510/gf1211s-47');
    expect(type().val()).toBe('');
    resolve(requests[0], identifierType);
    await promise;
    expect(type().val()).toBe(identifierType);
    expect(input()[0].checkValidity()).toBe(true);
  });
  test('a late answer cannot overwrite a newer identifier', async () => {
    const first = await begin('10.1234/first');
    const second = await begin('10.1234/second');
    resolve(requests[1], 'DOI'); await second.promise;
    resolve(requests[0], 'IGSN'); await first.promise;
    expect(type().val()).toBe('DOI');
  });
  test.each(['ISBN', ''])('a manual decision %s beats a pending answer', async choice => {
    const { promise } = await begin('10.1234/first');
    type().val(choice).trigger('change');
    resolve(requests[0]); await promise;
    expect(type().val()).toBe(choice);
  });
  test('A → B → A ignores obsolete completions and preserves the latest choice', async () => {
    const first = await begin('10.1234/a');
    const second = await begin('10.1234/b');
    const third = await begin('10.1234/a');
    type().val('RAiD').trigger('change');
    resolve(requests[0]); resolve(requests[1], 'DOI');
    await Promise.all([first.promise, second.promise, third.promise]);
    expect(type().val()).toBe('RAiD');
    expect(requests).toHaveLength(2);
  });
  test('a detached or disabled field receives no late change', async () => {
    const element = input()[0]; const selector = type();
    const { promise } = await begin('10.1234/a', element);
    $(element).closest('.row').remove();
    resolve(requests[0]); await promise;
    expect(selector.val()).toBe('');
    const ds = $('input[name="dIdentifier[]"]')[0];
    const next = await begin('10.1234/b', ds); ds.disabled = true;
    resolve(requests[1]); await next.promise;
    expect($('select[name="dIdentifierType[]"]').val()).toBe('');
  });
  test('restoring a type with the same identifier invalidates pending work and subsequent blur', async () => {
    const { promise } = await begin('10.1234/a');
    type().val('RAiD'); window.elmo.restoreIdentifierType(input()[0]);
    resolve(requests[0]); await promise;
    await select.updateIdentifierType(input()[0]);
    expect(type().val()).toBe('RAiD');
    expect(requests).toHaveLength(1);
  });
  test('each row keeps its debounce timer and GEM follows the same rules', async () => {
    jest.useFakeTimers();
    const fields = $('input');
    fields.eq(0).val('https://arxiv.org/abs/2507.21532').trigger('input');
    fields.eq(1).val('https://raid.org/10.82210/162fda4d').trigger('input');
    fields.eq(2).val('9783831048069').trigger('input');
    jest.advanceTimersByTime(301); await microtasks();
    expect($('select').map((i, element) => $(element).val()).get()).toEqual(['arXiv', 'RAiD', '']);
  });
  test.each([0, 1])('GEM row %i keeps field IDs and label associations during identifier detection', async rowIndex => {
    jest.useFakeTimers();
    const group = $('<div id="group-datasources"></div>').appendTo(document.body);
    for (const suffix of ['', '-1']) {
      group.append(`<div class="row" data-source-row>
        <label for="input-datasource-type${suffix}">Type</label><select id="input-datasource-type${suffix}" name="datasource_type[]"></select>
        <label for="input-datasource-details${suffix}">Details</label><select id="input-datasource-details${suffix}" name="datasource_details[]"></select>
        <label for="input-datasource-modelname${suffix}">Model name</label><input id="input-datasource-modelname${suffix}" name="dName[]">
        <label for="input-datasource-identifier${suffix}">Identifier</label><input id="input-datasource-identifier${suffix}" name="dIdentifier[]">
        <label for="input-datasource-identifiertype${suffix}">Identifier type</label><select id="input-datasource-identifiertype${suffix}" name="dIdentifierType[]">
          <option value=""></option>${types.map(t => `<option>${t.name}</option>`).join('')}
        </select>
      </div>`);
    }
    const ids = () => group.find('[id]').map((i, element) => element.id).get();
    const originalIds = ids();
    const row = group.children('.row').eq(rowIndex);
    const identifier = row.find('input[name="dIdentifier[]"]');
    const identifierType = row.find('select[name="dIdentifierType[]"]');
    identifier.val('https://arxiv.org/abs/2507.21532').trigger('input');
    jest.advanceTimersByTime(301); await microtasks();
    expect(identifierType.val()).toBe('arXiv');
    expect(ids()).toEqual(originalIds);
    identifier.trigger('blur'); await microtasks();
    identifierType.val('ISBN').trigger('change');
    expect(ids()).toEqual(originalIds);
    group.find('label').each((i, label) => {
      expect(document.getElementById(label.htmlFor)).not.toBeNull();
      expect(document.getElementById(label.htmlFor).closest('.row')).toBe(label.closest('.row'));
    });
  });
  test('editing a manual decision enables fresh automatic detection', async () => {
    type().val('ISBN').trigger('change');
    input().val('https://arxiv.org/abs/2507.21532').trigger('input');
    await select.updateIdentifierType(input()[0]);
    expect(type().val()).toBe('arXiv');
  });
  test('a failed lookup clears an old automatic type and leaves manual choice available', async () => {
    type().val('arXiv');
    const { promise } = await begin('10.1234/a');
    requests[0].error({}, 'timeout'); await promise;
    expect(type().val()).toBe('');
    expect($('[data-identifier-detection-status]').first().text()).toMatch(/manually/);
  });
  test('inactive confirmed IGSN never falls back to DOI', async () => {
    select.populateIdentifierTypesDropdownWithData({ identifierTypes: types.filter(type => ['DOI', 'URL'].includes(type.name)) });
    const { promise } = await begin('10.1234/a'); resolve(requests[0]); await promise;
    expect(type().val()).toBe('');
    expect(type().find('option[value="IGSN"]')).toHaveLength(0);
  });
  test('checksum validation follows manual ISBN/EAN13 selections as the input changes', () => {
    input().val('9783831048069'); type().val('EAN13').trigger('change');
    expect(input()[0].checkValidity()).toBe(true);
    input().val('9783831048068').trigger('input');
    type().val('EAN13').trigger('change');
    expect(input()[0].validity.customError).toBe(true);
    input().val(''); select.updateValidationPattern(type()[0]);
    expect(input()[0].validity.customError).toBe(false);
  });

  test('an edit clears the old type immediately, before the debounce completes', () => {
    input().val('https://arxiv.org/abs/2507.21532'); type().val('arXiv').trigger('change');
    input().val('10.60510/gf1211s-47').trigger('input');
    expect(type().val()).toBe('');
  });

  test.each(['r', 'd'])('%s fields use changed ERNIE definitions for validation and detection', async prefix => {
    const field = $('input[name="' + prefix + 'Identifier[]"]').first();
    const dropdown = $('select[name="' + prefix + 'IdentifierType[]"]').first();
    field.val('https://arxiv.org/abs/2507.21532');
    dropdown.val('arXiv').trigger('change');
    expect(field[0].checkValidity()).toBe(true);
    const changed = types.map(type => type.name === 'arXiv'
      ? {name: type.name, pattern: '^central-new-format$'} : type);
    select.populateIdentifierTypesDropdownWithData({identifierTypes: changed});
    expect(dropdown.val()).toBe('arXiv');
    expect(field[0].validity.customError).toBe(true);
    select.populateIdentifierTypesDropdownWithData({identifierTypes: types});
    expect(field[0].validity.customError).toBe(false);
    select.populateIdentifierTypesDropdownWithData({identifierTypes: changed});
    field.val('central-new-format').trigger('input');
    await select.updateIdentifierType(field[0]);
    expect(dropdown.val()).toBe('arXiv');
    expect(field[0].checkValidity()).toBe(true);
  });

  test('a registry confirmation cannot bypass the supplied IGSN validation pattern', async () => {
    select.populateIdentifierTypesDropdownWithData({identifierTypes: types.map(type =>
      type.name === 'IGSN' ? {name: 'IGSN', pattern: '^legacy-only$'} : type)});
    const {promise} = await begin('10.60510/gf1211s-47');
    resolve(requests[0], 'IGSN'); await promise;
    expect(type().val()).toBe('');
    expect($('[data-identifier-detection-status]').first().text()).toMatch(/manually/);
  });

  test('a legacy pattern response cannot overwrite validity installed by a vocabulary reload', () => {
    select.populateIdentifierTypesDropdownWithData({identifierTypes: types.filter(type => type.name !== 'IGSN')});
    let legacy;
    $.ajax.mockImplementation(options => { legacy = options; });
    type().append('<option value="IGSN">IGSN</option>');
    input().val('central-current'); type().val('IGSN').trigger('change');
    expect(legacy.url).toBe('api/v2/validation/patterns/IGSN');
    select.populateIdentifierTypesDropdownWithData({identifierTypes: [{name: 'IGSN', pattern: '^central-current$'}]});
    expect(input()[0].checkValidity()).toBe(true);
    legacy.success({pattern: '^obsolete$'});
    expect(input()[0].checkValidity()).toBe(true);
  });

  test('restored types wait for delayed GEM dropdown options', async () => {
    const ds = $('input[name="dIdentifier[]"]');
    const select = $('select[name="dIdentifierType[]"]');
    let complete;
    select.empty().append('<option value=""></option>').data('identifierTypesReady', new Promise(resolve => { complete = resolve; }));
    ds.val('10.1234/old');
    window.elmo.restoreIdentifierType(ds[0], 'RAiD');
    complete(); await microtasks();
    expect(select.val()).toBe('RAiD');
  });

  test('a user edit cancels a delayed dropdown restoration', async () => {
    let complete;
    type().data('identifierTypesReady', new Promise(resolve => { complete = resolve; }));
    input().val('10.1234/old'); window.elmo.restoreIdentifierType(input()[0], 'RAiD');
    type().val('ISBN').trigger('change');
    complete(); await microtasks();
    expect(type().val()).toBe('ISBN');
  });

  test('whitespace does not satisfy a manually chosen identifier format', () => {
    input().val('   '); type().val('IGSN').trigger('change');
    expect(input()[0].validity.customError).toBe(true);
  });

  test.each(['r', 'd'])('%s whitespace errors survive mandatory-field cleanup triggered by another field', prefix => {
    const field = $('input[name="' + prefix + 'Identifier[]"]').first();
    const dropdown = $('select[name="' + prefix + 'IdentifierType[]"]').first();
    field.prop('required', true).val('   '); dropdown.val('IGSN').trigger('change');
    expect(field[0].validity.customError).toBe(true);
    const mandatory = require('../../js/checkMandatoryFields.js');
    $('<input name="title[]">').appendTo(document.body).trigger('blur');
    mandatory.validateAllMandatoryFields();
    expect(field[0].validity.customError).toBe(true);
    expect(field[0].checkValidity()).toBe(false);
  });

  test.each(['r', 'd'])('%s late registry responses cannot restore a type removed by vocabulary reload', async prefix => {
    const field = $('input[name="' + prefix + 'Identifier[]"]').first();
    const dropdown = $('select[name="' + prefix + 'IdentifierType[]"]').first();
    const {promise} = await begin('10.60510/gf1211s-47', field[0]);
    select.populateIdentifierTypesDropdownWithData({identifierTypes: types.filter(type => type.name !== 'IGSN')});
    dropdown.find('option[value="IGSN"]').remove();
    resolve(requests[0]); await promise;
    expect(dropdown.val()).toBe('');
    expect(dropdown.find('option[value="IGSN"]')).toHaveLength(0);
  });

  test.each(['r', 'd'])('%s late registry responses use a newly narrowed type pattern', async prefix => {
    const field = $('input[name="' + prefix + 'Identifier[]"]').first();
    const dropdown = $('select[name="' + prefix + 'IdentifierType[]"]').first();
    const {promise} = await begin('10.60510/gf1211s-47', field[0]);
    select.populateIdentifierTypesDropdownWithData({identifierTypes: types.map(type =>
      type.name === 'IGSN' ? {name: 'IGSN', pattern: '^legacy-only$'} : type)});
    resolve(requests[0]); await promise;
    expect(dropdown.val()).toBe('');
  });

  test('percent-encoded resolver paths reach the registry as a decoded DOI', async () => {
    const {promise} = await begin('https://doi.org/10.60510/gf1211s%2D47');
    expect(requests[0].data.doi).toBe('10.60510/gf1211s-47');
    resolve(requests[0]); await promise;
    expect(type().val()).toBe('IGSN');
  });

  test('clearing the retained GEM row resets validity, manual state and pending lookups', async () => {
    const row = $('input[name="dIdentifier[]"]').closest('.row').attr('data-source-row', '').wrap('<div id="group-datasources"></div>');
    const field = row.find('input'); const dropdown = row.find('select');
    const {promise} = await begin('10.60510/gf1211s-47', field[0]);
    dropdown.val('ISBN').trigger('change');
    expect(field[0].validity.customError).toBe(true);
    require('../../js/clear.js').clearInputFields();
    expect(field.val()).toBe('');
    expect(field[0].validity.customError).toBe(false);
    expect(dropdown.val()).toBe('');
    expect(field.siblings('[data-identifier-detection-status]').text()).toBe('');
    field.val('10.60510/gf1211s-47');
    resolve(requests[0]); await promise;
    expect(dropdown.val()).toBe('');
    await select.updateIdentifierType(field[0]);
    expect(dropdown.val()).toBe('IGSN');
    expect(field[0].checkValidity()).toBe(true);
  });
});
