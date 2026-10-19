const fs = require('fs');
const path = require('path');

describe('separate DOI search and submission DOI flow', () => {
  let $;
  let lookupDoi;

  beforeEach(() => {
    document.body.innerHTML = `
      <input id="input-resourceinformation-source-doi"><div id="source-doi-status"></div>
      <button id="button-resourceinformation-prefill-doi"></button>
      <input id="input-resourceinformation-doi"><div id="submission-doi-status"></div>
      <input id="input-resourceinformation-version">
      <button id="button-resourceinformation-edit-doi"></button>
      <div id="modal-doi-prefill"><div id="doi-prefill-preview"></div>
        <button id="button-doi-prefill-confirm"></button><button id="button-doi-prefill-cancel"></button></div>`;
    $ = require('jquery');
    window.$ = window.jQuery = $;
    global.$ = global.jQuery = $;
    lookupDoi = jest.fn();
    window.DoiLookupService = jest.fn(() => ({ lookupDoi }));
    window.buildPrefillPreview = jest.fn(() => '<p>Preview</p>');
    window.applyDoiPrefill = jest.fn();
    window.bootstrap = { Modal: Object.assign(jest.fn(() => ({ show: jest.fn(), hide: jest.fn() })),
      { getInstance: jest.fn(() => null) }) };
    window.resourceInformation = { enableDoiEditing: jest.fn() };
    window.ELMO_FEATURES = { showGGMsProperties: false };
    let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/doiPrefillHandler.js'), 'utf8');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\}\);\s*$/, '\n})();');
    window.eval(script);
  });

  afterEach(() => {
    delete window.DoiLookupService;
    delete window.buildPrefillPreview;
    delete window.applyDoiPrefill;
    delete window.bootstrap;
    delete window.resourceInformation;
    delete window.ELMO_FEATURES;
  });

  test('search action uses its own DOI and leaves submission DOI empty', async () => {
    lookupDoi.mockResolvedValue({ found: true, attributes: { doi: '10.5880/source' } });
    $('#input-resourceinformation-source-doi').val('10.5880/source');
    await $('#button-resourceinformation-prefill-doi').triggerHandler('click');
    expect(lookupDoi).toHaveBeenCalledWith('10.5880/source');
    expect($('#input-resourceinformation-doi').val()).toBe('');
    expect($('#doi-prefill-preview').html()).toContain('Preview');
  });

  test.each([
    'https://doi.org/10.5880/source',
    'http://dx.doi.org/10.5880/source',
  ])('accepts a DOI resolver link in the metadata search: %s', async resolverUrl => {
    lookupDoi.mockResolvedValue({ found: true, attributes: { doi: '10.5880/source' } });
    $('#input-resourceinformation-source-doi').val(resolverUrl);

    await $('#button-resourceinformation-prefill-doi').triggerHandler('click');

    expect(lookupDoi).toHaveBeenCalledWith('10.5880/source');
    expect($('#input-resourceinformation-source-doi').val()).toBe('10.5880/source');
    expect($('#input-resourceinformation-doi').val()).toBe('');
  });

  test('does not accept a link from a lookalike DOI host', async () => {
    $('#input-resourceinformation-source-doi').val('https://doi.org.evil/10.5880/source');

    await $('#button-resourceinformation-prefill-doi').triggerHandler('click');

    expect(lookupDoi).not.toHaveBeenCalled();
    expect($('#source-doi-status').hasClass('text-danger')).toBe(true);
  });

  test('empty DOI search stays neutral and clears a stale error while typing', async () => {
    await $('#button-resourceinformation-prefill-doi').triggerHandler('click');
    expect($('#source-doi-status').text()).toBe('');
    expect(lookupDoi).not.toHaveBeenCalled();

    $('#input-resourceinformation-source-doi').val('invalid');
    await $('#button-resourceinformation-prefill-doi').triggerHandler('click');
    expect($('#source-doi-status').hasClass('text-danger')).toBe(true);
    expect($('#input-resourceinformation-source-doi').attr('aria-invalid')).toBe('true');

    $('#input-resourceinformation-source-doi').val('').trigger('input');
    expect($('#source-doi-status').text()).toBe('');
    expect($('#input-resourceinformation-source-doi').attr('aria-invalid')).toBe('false');
  });

  test('external DOI remains visible and blocks submission until manually removed', async () => {
    $('#input-resourceinformation-doi').val('10.1234/external');
    expect(await window.resourceInformation.validateSubmissionDoi()).toBe(false);
    expect($('#input-resourceinformation-doi').val()).toBe('10.1234/external');
    expect(await window.resourceInformation.validateSubmissionDoi({ forSubmit: true })).toBe(false);
    expect(await window.resourceInformation.validateSubmissionDoi({ forSubmit: true })).toBe(false);
    $('#input-resourceinformation-doi').val('10.1234/imported').attr('data-imported-doi', 'true');
    expect(await window.resourceInformation.validateSubmissionDoi()).toBe(false);
    expect($('#input-resourceinformation-doi').val()).toBe('10.1234/imported');
    $('#input-resourceinformation-doi').val('').trigger('input');
    expect(await window.resourceInformation.validateSubmissionDoi({ forSubmit: true })).toBe(true);
  });

  test('ignores an obsolete DataCite response after the DOI changes', async () => {
    let resolveLookup;
    lookupDoi.mockImplementation(() => new Promise(resolve => { resolveLookup = resolve; }));
    $('#input-resourceinformation-doi').val('10.5880/first');
    const pending = window.resourceInformation.validateSubmissionDoi();
    $('#input-resourceinformation-doi').val('10.5880/second').trigger('input');
    resolveLookup({ found: true, attributes: { version: '2.4' } });
    expect(await pending).toBe(false);
    expect($('#input-resourceinformation-version').val()).toBe('');
  });

  test('found GFZ DOI proposes the next major version and shows curation warning', async () => {
    lookupDoi.mockResolvedValue({ found: true, attributes: { version: '2.4' } });
    $('#input-resourceinformation-doi').val('10.5880/existing');
    expect(await window.resourceInformation.validateSubmissionDoi()).toBe(true);
    expect($('#input-resourceinformation-version').val()).toBe('3.0');
    expect($('#submission-doi-status').text()).toContain('manual curation');
    $('#input-resourceinformation-version').val('2.0');
    expect(await window.resourceInformation.validateSubmissionDoi()).toBe(false);
  });

  test('missing version starts at 1.0; missing record and network errors block', async () => {
    $('#input-resourceinformation-doi').val('10.5880/one');
    lookupDoi.mockResolvedValueOnce({ found: true, attributes: {} });
    expect(await window.resourceInformation.validateSubmissionDoi()).toBe(true);
    expect($('#input-resourceinformation-version').val()).toBe('1.0');
    $('#input-resourceinformation-doi').val('10.5880/two').trigger('input');
    lookupDoi.mockResolvedValueOnce({ found: false });
    expect(await window.resourceInformation.validateSubmissionDoi()).toBe(false);
    $('#input-resourceinformation-doi').val('10.5880/three').trigger('input');
    lookupDoi.mockRejectedValueOnce(new Error('offline'));
    expect(await window.resourceInformation.validateSubmissionDoi()).toBe(false);
  });

  test('ICGEM keeps the existing DOI path without a DataCite reuse check', async () => {
    window.ELMO_FEATURES.showGGMsProperties = true;
    $('#input-resourceinformation-doi').val('10.1234/icgem-existing');
    expect(await window.resourceInformation.validateSubmissionDoi({ forSubmit: true })).toBe(true);
    expect(lookupDoi).not.toHaveBeenCalled();
  });

  test('unclear published version blocks the submit confirmation', async () => {
    lookupDoi.mockResolvedValue({ found: true, attributes: { version: 'release two' } });
    $('#input-resourceinformation-doi').val('10.5880/existing');
    expect(await window.resourceInformation.validateSubmissionDoi({ forSubmit: true })).toBe(false);
    expect($('#submission-doi-status').text()).toContain('unclear');
  });
});
