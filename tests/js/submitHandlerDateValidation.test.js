const { requireFresh } = require('./utils');

describe('Submit handler date validation', () => {
  let $;
  let validateEmbargoDate;

  beforeEach(() => {
    document.body.innerHTML = `
      <input id="input-date-created" />
      <input id="input-date-embargo" />
      <div class="embargo-invalid"></div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    global.translations = {
      dates: {
        embargoDateError: 'Embargo Error'
      }
    };

    ({ validateEmbargoDate } = requireFresh('../../js/submitHandler.js'));
  });

  afterEach(() => {
    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete global.translations;
  });

  test('embargo date is valid when Date Created is empty', () => {
    $('#input-date-created').val('');
    $('#input-date-embargo').val('2026-07-01');

    expect(validateEmbargoDate()).toBe(true);
    expect($('#input-date-embargo').hasClass('is-invalid')).toBe(false);
    expect($('.embargo-invalid').text()).toBe('');
  });
});
