/**
 * @jest-environment jsdom
 */

const { requireFresh } = require('./utils');

describe('synchronizeTagifyInputs', () => {
  let synchronizeTagifyInputs;

  beforeEach(() => {
    ({ synchronizeTagifyInputs } = requireFresh('../../js/thesauriHelpers.js'));
    document.body.innerHTML = `<form id="form-mde"></form>`;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('flushes Tagify.value onto an empty original input', () => {
    const form = document.getElementById('form-mde');
    const input = document.createElement('input');
    input.name = 'platforms';
    form.appendChild(input);

    const graceFo = {
      value: 'Platforms > Space-based Platforms > Earth Observation Satellites > GRACE-FO',
      id: 'https://gcmd.earthdata.nasa.gov/kms/concept/f75e34e2-ebe7-4a6c-8bf6-da596a36b632',
    };
    input._tagify = {
      value: [graceFo],
      update: jest.fn(),
    };

    synchronizeTagifyInputs(form);

    expect(input._tagify.update).toHaveBeenCalled();
    expect(JSON.parse(input.value)).toEqual([graceFo]);
  });

  test('re-enables a disabled Tagify original so FormData includes it', () => {
    const form = document.getElementById('form-mde');
    const input = document.createElement('input');
    input.name = 'platforms';
    input.disabled = true;
    input.value = '[{"value":"GRACE-FO"}]';
    form.appendChild(input);
    input._tagify = { value: [{ value: 'GRACE-FO' }], update: jest.fn() };

    synchronizeTagifyInputs(form);

    expect(input.disabled).toBe(false);
    const posted = new FormData(form);
    expect(posted.get('platforms')).toContain('GRACE-FO');
  });

  test('does not overwrite a non-empty original input', () => {
    const form = document.getElementById('form-mde');
    const input = document.createElement('input');
    input.name = 'platforms';
    input.value = '[{"value":"already-flushed"}]';
    form.appendChild(input);
    input._tagify = {
      value: [{ value: 'stale-chip' }],
      update: jest.fn(),
    };

    synchronizeTagifyInputs(form);

    expect(input.value).toBe('[{"value":"already-flushed"}]');
  });
});
