const fs = require('fs');
const path = require('path');

const flushPromises = () => new Promise(res => setTimeout(res, 0));

describe('select.js', () => {
  let $;
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = `
      <select id="input-relatedwork-identifiertype"></select>
      <select id="test-select"></select>
      <div id="group-relatedwork">
        <div class="row">
          <select name="relation"></select>
          <input name="rIdentifier[]" />
          <select name="rIdentifierType[]">
            <option value=""></option>
            <option value="DOI">DOI</option>
            <option value="HANDLE">HANDLE</option>
          </select>
        </div>
        <div class="row">
          <select name="relation"></select>
          <input name="rIdentifier[]" />
          <select name="rIdentifierType[]">
            <option value=""></option>
            <option value="DOI">DOI</option>
            <option value="HANDLE">HANDLE</option>
          </select>
        </div>
      </div>
      <div id="group-datasources">
        <div class="row">
          <input name="dName[]" />
          <input name="dIdentifier[]" />
          <select name="dIdentifierType[]">
            <option value=""></option>
            <option value="DOI">DOI</option>
          </select>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    $.getJSON = jest.fn((url, cb) => { cb({identifierTypes: []}); return { fail: jest.fn() }; });
    $.ajax = jest.fn((opts) => { if(opts.success) opts.success({}); return { fail: jest.fn() }; });

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/select.js'), 'utf8');
    window.eval(script);
  });

  afterEach(() => {
    jest.useRealTimers();
    console.error.mockRestore();
    jest.resetAllMocks();
  });

  test('setupIdentifierTypesDropdown populates options', () => {
    $.getJSON.mockImplementationOnce((url, cb) => { cb({identifierTypes:[{name:'DOI', description:'d1'},{name:'HANDLE', description:'d2'}]}); return { fail: jest.fn() }; });
    window.setupIdentifierTypesDropdown('#test-select');
    const options = $('#test-select option').map((i,el)=>$(el).text()).get();
    expect(options).toEqual(['Choose...','DOI','HANDLE']);
  });

  test('setupIdentifierTypesDropdown warns when no types', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    $.getJSON.mockImplementationOnce((u,cb)=>{cb({}); return { fail: jest.fn() };});
    window.setupIdentifierTypesDropdown('#test-select');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('updateIdentifierType sets value based on regex', async () => {
    $.ajax.mockImplementationOnce(opts => { opts.success({identifierTypes:[{name:'DOI', pattern:'^10\\..+'}]}); return { fail: jest.fn() }; });
    const input = $('#group-relatedwork .row:first-child input');
    const select = $('#group-relatedwork .row:first-child select[name="rIdentifierType[]"]');
    input.val('10.1234/abcd');
    await window.updateIdentifierType(input[0]);
    expect(select.val()).toBe('DOI');
  });

  test('updateIdentifierType clears when no match', async () => {
    $.ajax.mockImplementationOnce(opts => { opts.success({identifierTypes:[{name:'DOI', pattern:'^10\\..+'}]}); return { fail: jest.fn() }; });
    const input = $('#group-relatedwork .row:first-child input');
    const select = $('#group-relatedwork .row:first-child select[name="rIdentifierType[]"]');
    input.val('xyz');
    await window.updateIdentifierType(input[0]);
    expect(select.val()).toBe('');
  });

  test('updateIdentifierType handles invalid regex', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(()=>{});
    $.ajax.mockImplementationOnce(opts => { opts.success({identifierTypes:[{name:'BAD', pattern:'(/'}]}); return { fail: jest.fn() }; });
    const input = $('#group-relatedwork .row:first-child input');
    input.val('bad');
    await window.updateIdentifierType(input[0]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('updateIdentifierType chooses most specific match', async () => {
    $.ajax.mockImplementationOnce(opts => {
      opts.success({identifierTypes:[
        {name:'URL', pattern:'^10\\..+'},
        {name:'DOI', pattern:'^10\\.\\d{4,9}\/[-._;()/:A-Z0-9]+$/i'}]});
      return { fail: jest.fn() };
    });
    const input = $('#group-relatedwork .row:first-child input');
    const select = $('#group-relatedwork .row:first-child select[name="rIdentifierType[]"]');
    input.val('10.1234/ABCD');
    await window.updateIdentifierType(input[0]);
    expect(select.val()).toBe('DOI');
  });

  test('updateIdentifierType prefers DOI over URL when both match', async () => {
    $.ajax.mockImplementationOnce(opts => {
      opts.success({identifierTypes:[
        {name:'URL', pattern:'https?://.+\\..+'},
        {name:'DOI', pattern:'^(?:https?:\\/\\/doi\\.org/)?10\\.\\d{4,9}\/[-._;()/:A-Z0-9]+$'}]});
      return { fail: jest.fn() };
    });
    const input = $('#group-relatedwork .row:first-child input');
    const select = $('#group-relatedwork .row:first-child select[name="rIdentifierType[]"]');
    input.val('http://doi.org/10.2777/061652');
    await window.updateIdentifierType(input[0]);
    expect(select.val()).toBe('DOI');
  });

  test('updateIdentifierType ajax error resets select', async () => {
    $.ajax.mockImplementationOnce(opts => { if(opts.error) opts.error(); return { fail: jest.fn() }; });
    const input = $('#group-relatedwork .row:first-child input');
    const select = $('#group-relatedwork .row:first-child select[name="rIdentifierType[]"]');
    input.val('10.1');
    await window.updateIdentifierType(input[0]);
    expect(select.val()).toBe('');
  });

  test('updateIdentifierType matches DOI regardless of case', async () => {
    $.ajax.mockImplementationOnce(opts => {
      opts.success({identifierTypes:[
        {name:'URL', pattern:'https?://.+\\..+'},
        {name:'DOI', pattern:'^(?:https?:\\/\\/doi\\.org/)?10\\.\\d{4,9}\/[-._;()/:A-Z0-9]+$'}]});
      return { fail: jest.fn() };
    });
    const input = $('#group-relatedwork .row:first-child input');
    const select = $('#group-relatedwork .row:first-child select[name="rIdentifierType[]"]');
    input.val('https://doi.org/10.1002/asi.24037');
    await window.updateIdentifierType(input[0]);
    expect(select.val()).toBe('DOI');
  });

  test('debounce delays function call', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const debounced = window.debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalled();
  });

  test('updateIdsAndNames assigns sequential ids', () => {
    window.updateIdsAndNames();
    const ids = $('#group-relatedwork select[name^="relation"]').map((i,el)=>$(el).attr('id')).get();
    expect(ids).toEqual(['input-relatedwork-relation0','input-relatedwork-relation1']);
  });

  test('updateIdentifierType detects type for data source fields', async () => {
    $.ajax.mockImplementationOnce(opts => {
      opts.success({identifierTypes:[{name:'DOI', pattern:'^10\\..+'}]});
      return { fail: jest.fn() };
    });
    const input = $('#group-datasources input[name="dIdentifier[]"]');
    const select = $('#group-datasources select[name="dIdentifierType[]"]');
    input.val('10.1234/abcd');
    await window.updateIdentifierType(input[0]);
    expect(select.val()).toBe('DOI');
  });

  test('updateDataSourceIdsAndNames assigns ids to model fields', () => {
    window.updateDataSourceIdsAndNames();
    expect($('#group-datasources input[name="dName[]"]').attr('id')).toBe('input-datasource-modelname0');
    expect($('#group-datasources input[name="dIdentifier[]"]').attr('id')).toBe('input-datasource-identifier0');
    expect($('#group-datasources select[name="dIdentifierType[]"]').attr('id')).toBe('input-datasource-identifiertype0');
  });

  test('initializeTimezoneDropdown fetches and selects timezone', async () => {
    const tzData = [{label:'UTC+00:00 (Europe/Berlin)'}];
    global.fetch = jest.fn(() => Promise.resolve({json: () => Promise.resolve(tzData)}));
    const originalIntl = Intl.DateTimeFormat;
    Intl.DateTimeFormat = jest.fn(() => ({resolvedOptions: ()=>({timeZone:'Europe/Berlin'})}));
    const select = $('<select id="tz"></select>').appendTo(document.body);
    await window.initializeTimezoneDropdown('#tz', '/fake.json');
    expect(fetch).toHaveBeenCalledWith('/fake.json');
    expect(select.val()).toBe('+00:00');
    Intl.DateTimeFormat = originalIntl;
  });

  test('initializeTimezoneDropdown uses existing options without fetch', async () => {
    global.fetch = jest.fn();
    const originalIntl = Intl.DateTimeFormat;
    Intl.DateTimeFormat = jest.fn(() => ({resolvedOptions: ()=>({timeZone:'Europe/Berlin'})}));
    const select = $('<select id="tz2"><option value="+00:00">UTC+00:00 (Europe/Berlin)</option></select>').appendTo(document.body);
    await window.initializeTimezoneDropdown('#tz2', '/fake.json');
    expect(fetch).not.toHaveBeenCalled();
    expect(select.val()).toBe('+00:00');
    Intl.DateTimeFormat = originalIntl;
  });

  test('setupLanguageDropdown populates options from API', async () => {
    const select = $('<select id="input-resourceinformation-language"></select>').appendTo(document.body);
    $.ajax.mockImplementation(opts => {
      opts.success([
        { id: 1, code: 'en', name: 'English' },
        { id: 2, code: 'de', name: 'German' },
      ]);
      if (opts.complete) opts.complete();
      return { fail: jest.fn() };
    });

    await flushPromises();
    window.setupLanguageDropdown();
    const options = select.find('option').map((i,el)=>$(el).text()).get();
    expect(options).toEqual(['Choose...','English','German']);
    expect(select.prop('disabled')).toBe(false);
  });

  test('setupTitleTypeDropdown selects main title and exposes globals', async () => {
    const select = $('<select id="input-resourceinformation-titletype"></select>').appendTo(document.body);
    $.ajax.mockImplementationOnce(opts => {
      opts.success([
        { id: 1, name: 'Main Title' },
        { id: 2, name: 'Alternative Title' },
      ]);
      if (opts.complete) opts.complete();
      return { fail: jest.fn() };
    });

    window.setupTitleTypeDropdown();

    const options = select.find('option').map((i,el)=>$(el).text()).get();
    expect(options).toEqual(['Choose...','Main Title','Alternative Title']);
    expect(select.val()).toBe('1');
    expect(window.mainTitleTypeId).toBe('1');
    expect(window.titleTypeOptionsHtml).toContain('Alternative Title');
  });

  test('setupLanguageDropdown shows error on ajax failure', async () => {
    const select = $('<select id="input-resourceinformation-language"></select>').appendTo(document.body);
    $.ajax.mockImplementation(opts => { if(opts.error) opts.error(); if(opts.complete) opts.complete(); return { fail: jest.fn() }; });

    await flushPromises();
    window.setupLanguageDropdown();
    const options = select.find('option').map((i,el)=>$(el).text()).get();
    expect(options).toEqual(['Error loading data']);
    expect(select.prop('disabled')).toBe(false);
  });
});