const types = ['DOI', 'IGSN', 'RAiD', 'arXiv', 'ISBN', 'EAN13', 'URL'].map(name => ({ name, pattern: '.*' }));

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
    select.populateIdentifierTypesDropdownWithData({ identifierTypes: [{ name: 'DOI' }, { name: 'URL' }] });
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
});
