const fs = require('fs');
const path = require('path');

describe('buttons.js', () => {
  let $;

  function loadScript() {
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/buttons.js'),
      'utf8'
    );
    script = script.replace(/^import.*$/gm, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <form id="form-mde">
        <input id="field1" class="js-required-on-submit" required>
        <input id="field2" class="js-required-on-submit" required>
      </form>
      <div class="input-group-text"></div>
      <div class="input-group-text"></div>
      <button id="buttonHelpOn"></button>
      <button id="buttonHelpOff"></button>
      <button id="buttonHelp"></button>
      <button id="bd-theme"></button>
      <button id="button-form-reset"></button>
      <button id="button-form-load"></button>
      <button id="button-form-save"></button>
      <button id="button-form-submit"></button>
      <div id="modal-uploadxml"></div>
      <a id="button-changelog-show" href="#"></a>
      <div id="panel-changelog-content"></div>
      <div id="modal-changelog"></div>
      <div data-bs-toggle="tooltip" id="tooltip-target"></div>
    `;
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    $.fn.modal = jest.fn();
    $.fn.load = jest.fn(function (url, cb) { if (cb) cb(); return this; });
    $.fn.tooltip = jest.fn();
    window.clearInputFields = jest.fn();
    window.showConfirmationModal = jest.fn();
    window.open = jest.fn();
    localStorage.clear();

    window.validateFundingReferenceRequirements = jest.fn();
    window.validateRelatedWorkRequirements = jest.fn();
    window.validateSpatialTemporalCoverageRequirements = jest.fn();
    window.validateContributorOrganisationRequirements = jest.fn();
    window.validateContributorPersonRequirements = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  test('shows help icons by default', () => {
    loadScript();
    expect($('.input-group-text').first().css('display')).not.toBe('none');
  });

  test('initializes help icons based on localStorage', () => {
    localStorage.setItem('inputGroupTextVisible', 'false');
    loadScript();
    expect($('.input-group-text').first().css('display')).toBe('none');
  });

  test('buttonHelpOn shows help icons and stores preference', () => {
    localStorage.setItem('inputGroupTextVisible', 'false');
    loadScript();
    $('#buttonHelpOn').trigger('click');
    expect($('.input-group-text').first().css('display')).not.toBe('none');
    expect(localStorage.getItem('inputGroupTextVisible')).toBe('true');
  });

  test('buttonHelpOff hides help icons and stores preference', () => {
    loadScript();
    $('#buttonHelpOff').trigger('click');
    expect($('.input-group-text').first().css('display')).toBe('none');
    expect(localStorage.getItem('inputGroupTextVisible')).toBe('false');
  });

  test('hovering 30 times opens Easter egg', () => {
    loadScript();
    for (let i = 0; i < 30; i++) {
      $('#buttonHelp').trigger('mouseenter');
    }
    expect(window.open).toHaveBeenCalledWith(
      'doc/egg.html',
      'Egg',
      'width=650,height=450,scrollbars=no,resizable=no,location=no'
    );
  });

  test('hover counter resets after 1 second', () => {
    loadScript();
    for (let i = 0; i < 10; i++) {
      $('#buttonHelp').trigger('mouseenter');
    }
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < 20; i++) {
      $('#buttonHelp').trigger('mouseenter');
    }
    expect(window.open).not.toHaveBeenCalled();
  });

  test('reset button shows confirmation modal', () => {
    loadScript();
    $('#button-form-reset').trigger('click');
    expect(window.showConfirmationModal).toHaveBeenCalledWith(
      'confirmations.clear.title',
      'confirmations.clear.message',
      'confirmations.clear.cancel',
      'confirmations.clear.confirm',
      window.clearInputFields
    );
  });

  test('reset button does NOT call clearInputFields immediately', () => {
    loadScript();
    $('#button-form-reset').trigger('click');
    expect(window.clearInputFields).not.toHaveBeenCalled();
  });

  test('load button shows upload modal', () => {
    loadScript();
    $('#button-form-load').trigger('click');
    expect($.fn.modal).toHaveBeenCalledWith('show');
  });

  test('changelog button loads content and shows modal', () => {
    loadScript();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('button-changelog-show').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect($.fn.load).toHaveBeenCalledWith('doc/changelog.html', expect.any(Function));
    expect($.fn.modal).toHaveBeenCalledWith('show');
  });

  test('tooltips are initialized', () => {
    loadScript();
    expect($.fn.tooltip).toHaveBeenCalled();
  });

  test('Save button makes js-required-on-submit fields optional', () => {
    loadScript();
    const field1 = document.getElementById('field1');
    const field2 = document.getElementById('field2');

    field1.setAttribute('required', 'required');
    field1.classList.add('is-invalid');
    field2.setAttribute('required', 'required');
    field2.classList.add('is-invalid');

    $('#button-form-save').trigger('click');

    expect(field1.hasAttribute('required')).toBe(false);
    expect(field2.hasAttribute('required')).toBe(false);
    expect(field1.classList.contains('is-invalid')).toBe(false);
    expect(field2.classList.contains('is-invalid')).toBe(false);

    // Save must NOT trigger submit validators
    expect(window.validateFundingReferenceRequirements).not.toHaveBeenCalled();
    expect(window.validateRelatedWorkRequirements).not.toHaveBeenCalled();
    expect(window.validateSpatialTemporalCoverageRequirements).not.toHaveBeenCalled();
    expect(window.validateContributorOrganisationRequirements).not.toHaveBeenCalled();
    expect(window.validateContributorPersonRequirements).not.toHaveBeenCalled();
  });

  test('Submit button enforces required on js-required-on-submit fields and calls validators', () => {
    loadScript();
    const field1 = document.getElementById('field1');
    const field2 = document.getElementById('field2');

    const clickEvent = $.Event('click');
    $('#button-form-submit').trigger(clickEvent);

    expect(field1.hasAttribute('required')).toBe(true);
    expect(field2.hasAttribute('required')).toBe(true);

    // Validation is now handled by submitHandler.handleSubmit() in validation.js,
    // so buttons.js must NOT call preventDefault or add was-validated.
    expect(clickEvent.isDefaultPrevented()).toBe(false);

    // Validators must run on Submit
    expect(window.validateFundingReferenceRequirements).toHaveBeenCalledTimes(1);
    expect(window.validateRelatedWorkRequirements).toHaveBeenCalledTimes(1);
    expect(window.validateSpatialTemporalCoverageRequirements).toHaveBeenCalledTimes(1);
    expect(window.validateContributorOrganisationRequirements).toHaveBeenCalledTimes(1);
    expect(window.validateContributorPersonRequirements).toHaveBeenCalledTimes(1);
  });

});