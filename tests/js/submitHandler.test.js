const fs = require('fs');
const path = require('path');

describe('submitHandler.js', () => {
  let SubmitHandler;
  let handler;
  let $;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = `
      <form id="test-form"></form>
      <div id="modal-submit"></div>
      <div id="modal-notification">
        <div id="modal-notification-label"></div>
        <div id="modal-notification-body"></div>
      </div>
      <input id="input-date-created" />
      <input id="input-date-embargo" />
      <div class="embargo-invalid"></div>
      <div id="row" tsc-row>
        <input id="input-stc-datestart-row1" />
        <input id="input-stc-dateend-row1" />
        <div class="invalid-feedback" data-translate="coverage.dateTimeInvalid"></div>
      </div>
      <input type="checkbox" id="input-submit-privacycheck">
      <button id="button-submit-submit" disabled></button>
      <input type="file" id="input-submit-datadescription" />
      <button id="remove-file-btn"></button>
      <span id="selected-file-name"></span>
      <div id="group-stc"></div>
      <div id="group-author"></div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    global.bootstrap = {
      Modal: function() {
        this.show = jest.fn();
        this.hide = jest.fn();
      }
    };

    global.translations = {
      dates: { embargoDateError: 'Embargo Error' },
      coverage: { endDateError: 'End Date Error' },
      alerts: {
        successHeading: 'Success',
        errorHeading: 'Error',
        submitError: 'Submit Error',
        validationErrorheading: 'Validation',
        validationError: 'Invalid'
      }
    };

    let script = fs.readFileSync(path.resolve(__dirname, '../../js/submitHandler.js'), 'utf8');
    script = script.replace('export default SubmitHandler;', `window.SubmitHandler = SubmitHandler;\nwindow.validateEmbargoDate = validateEmbargoDate;\nwindow.validateTemporalCoverage = validateTemporalCoverage;\nwindow.validateContactPerson = validateContactPerson;`);
    window.eval(script);
    SubmitHandler = window.SubmitHandler;
    handler = new SubmitHandler('test-form', 'modal-submit', 'modal-notification');
  });

  afterEach(() => {
    jest.useRealTimers();
    console.error.mockRestore();
  });

  test('validateEmbargoDate marks invalid when embargo before creation', () => {
    $('#input-date-created').val('2024-05-10');
    $('#input-date-embargo').val('2024-05-01');
    const result = window.validateEmbargoDate();
    expect(result).toBe(false);
    expect($('#input-date-embargo').hasClass('is-invalid')).toBe(true);
    expect($('.embargo-invalid').text()).toBe('Embargo Error');
  });

  test('validateTemporalCoverage marks invalid when end before start', () => {
    $('#input-stc-datestart-row1').val('2024-05-10');
    $('#input-stc-dateend-row1').val('2024-05-01');
    const row = document.getElementById('row');
    const result = window.validateTemporalCoverage(row);
    expect(result).toBe(false);
    expect($('#input-stc-dateend-row1').hasClass('is-invalid')).toBe(true);
    expect(row.querySelector('.invalid-feedback').textContent).toBe('End Date Error');
  });

  test('toggleSubmitButton enables button when checked', () => {
    $('#input-submit-privacycheck').prop('checked', true);
    handler.toggleSubmitButton();
    expect($('#button-submit-submit').prop('disabled')).toBe(false);
  });

  test('clearFileInput resets file fields', () => {
    const input = $('#input-submit-datadescription')[0];
    Object.defineProperty(input, 'value', { writable: true, value: 'f.txt' });
    $('#selected-file-name').text('f.txt');
    $('#remove-file-btn').show();
    handler.clearFileInput();
    expect($('#input-submit-datadescription').val()).toBe('');
    expect($('#selected-file-name').text()).toBe('');
    expect($('#remove-file-btn').css('display')).toBe('none');
  });

  test('showNotification populates modal and auto hides on success', () => {
    jest.useFakeTimers();
    handler.showNotification('success', 'Title', 'Msg');
    expect($('#modal-notification-label').text()).toBe('Title');
    expect($('#modal-notification-body').html()).toContain('Msg');
    expect(handler.modals.notification.show).toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    expect(handler.modals.notification.hide).toHaveBeenCalled();
  });

  test('handleAjaxError parses JSON response', () => {
    const spy = jest.spyOn(handler, 'showNotification');
    const xhr = {
      responseText: JSON.stringify({ message: 'server msg', debug: 'x' }),
      getResponseHeader: () => 'application/json'
    };
    handler.handleAjaxError(xhr, 'parsererror', 'err');
    expect(spy).toHaveBeenCalledWith('danger', 'Error', 'server msg');
  });

  test('handleAjaxError falls back to default on parse failure', () => {
    const spy = jest.spyOn(handler, 'showNotification');
    const xhr = {
      responseText: 'notjson',
      getResponseHeader: () => 'text/html'
    };
    handler.handleAjaxError(xhr, 'error', 'fail');
    expect(spy).toHaveBeenCalledWith('danger', 'Error', 'Submit Error');
  });
});