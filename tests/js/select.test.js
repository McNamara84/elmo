const fs = require('fs');
const path = require('path');

const flushPromises = () => new Promise(res => setTimeout(res, 0));

describe('select.js', () => {
  let $;
  beforeEach(() => {
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
});