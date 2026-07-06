const fs = require('fs');
const path = require('path');
const { simulateSubmitValidation } = require('./utils');

describe('Spatial and temporal coverage submit requirements', () => {
  let $;

  function loadCheckMandatoryFields() {
    const scriptPath = path.resolve(__dirname, '../../js/checkMandatoryFields.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);
  }

  function buildStcDom() {
    document.body.innerHTML = `
      <div id="group-stc">
        <div class="row" tsc-row tsc-row-id="1">
          <label for="input-stc-latmin_1">Latitude Min</label>
          <label for="input-stc-latmax_1" class="visually-hidden">Latitude Max</label>
          <label for="input-stc-longmin_1">Longitude Min</label>
          <label for="input-stc-longmax_1" class="visually-hidden">Longitude Max</label>
          <label for="input-stc-description">Description</label>
          <label for="input-stc-datestart">Start Date</label>
          <label for="input-stc-dateend">End Date</label>
          <label for="input-stc-timestart" class="visually-hidden">Start Time</label>
          <label for="input-stc-timeend" class="visually-hidden">End Time</label>
          <label for="input-stc-timezone">Timezone</label>
          <input type="text" id="input-stc-latmin_1" name="tscLatitudeMin[]" />
          <input type="text" id="input-stc-latmax_1" name="tscLatitudeMax[]" />
          <input type="text" id="input-stc-longmin_1" name="tscLongitudeMin[]" />
          <input type="text" id="input-stc-longmax_1" name="tscLongitudeMax[]" />
          <textarea id="input-stc-description" name="tscDescription[]"></textarea>
          <input type="date" id="input-stc-datestart" name="tscDateStart[]" />
          <input type="date" id="input-stc-dateend" name="tscDateEnd[]" />
          <input type="time" id="input-stc-timestart" name="tscTimeStart[]" />
          <input type="time" id="input-stc-timeend" name="tscTimeEnd[]" />
          <select id="input-stc-timezone" name="tscTimezone[]"></select>
        </div>
      </div>
    `;
  }

  beforeEach(() => {
    buildStcDom();
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    global.requestAnimationFrame = (callback) => callback();
    loadCheckMandatoryFields();
  });

  afterEach(() => {
    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete window.ELMO_FEATURES;
    delete global.requestAnimationFrame;
  });

  test('spatial-only row requires temporal coverage outside ELMO-GEM', () => {
    $('#input-stc-latmin_1').val('-90');
    $('#input-stc-longmin_1').val('-180');
    $('#input-stc-description').val('Global spatial coverage');

    window.validateSpatialTemporalCoverageRequirements();
    simulateSubmitValidation();

    expect($('#input-stc-latmin_1').prop('required')).toBe(true);
    expect($('#input-stc-longmin_1').prop('required')).toBe(true);
    expect($('#input-stc-description').prop('required')).toBe(true);
    expect($('#input-stc-datestart').prop('required')).toBe(true);
    expect($('#input-stc-dateend').prop('required')).toBe(true);
  });

  test('ELMO-GEM spatial-only row keeps description required but does not require temporal coverage', () => {
    window.ELMO_FEATURES = { showGGMsProperties: true };

    $('#input-stc-latmin_1').val('-90');
    $('#input-stc-longmin_1').val('-180');
    $('#input-stc-description').val('Global spatial coverage');

    window.validateSpatialTemporalCoverageRequirements();
    simulateSubmitValidation();

    expect($('#input-stc-latmin_1').prop('required')).toBe(true);
    expect($('#input-stc-longmin_1').prop('required')).toBe(true);
    expect($('#input-stc-description').prop('required')).toBe(true);
    expect($('#input-stc-datestart').prop('required')).toBe(false);
    expect($('#input-stc-dateend').prop('required')).toBe(false);
  });

  test('ELMO-GEM spatial-only row still requires description', () => {
    window.ELMO_FEATURES = { showGGMsProperties: true };

    $('#input-stc-latmin_1').val('-90');
    $('#input-stc-longmin_1').val('-180');

    window.validateSpatialTemporalCoverageRequirements();
    simulateSubmitValidation();

    expect($('#input-stc-latmin_1').prop('required')).toBe(true);
    expect($('#input-stc-longmin_1').prop('required')).toBe(true);
    expect($('#input-stc-description').prop('required')).toBe(true);
    expect($('#input-stc-datestart').prop('required')).toBe(false);
    expect($('#input-stc-dateend').prop('required')).toBe(false);
  });

  test('ELMO-GEM still requires dates, both times, and timezone when a time is entered', () => {
    window.ELMO_FEATURES = { showGGMsProperties: true };

    $('#input-stc-latmin_1').val('-90');
    $('#input-stc-longmin_1').val('-180');
    $('#input-stc-description').val('Global spatial coverage');
    $('#input-stc-timestart').val('08:00');

    window.validateSpatialTemporalCoverageRequirements();
    simulateSubmitValidation();

    expect($('#input-stc-datestart').prop('required')).toBe(true);
    expect($('#input-stc-dateend').prop('required')).toBe(true);
    expect($('#input-stc-timestart').prop('required')).toBe(true);
    expect($('#input-stc-timeend').prop('required')).toBe(true);
    expect($('#input-stc-timezone').prop('required')).toBe(true);
  });

  test('visually marks dynamically required STC fields before submit', () => {
    $('#input-stc-longmax_1').val('14');

    window.validateSpatialTemporalCoverageRequirements();

    expect($('#input-stc-latmin_1').attr('aria-required')).toBe('true');
    expect($('#input-stc-latmin_1').hasClass('border-danger')).toBe(true);
    expect($('label[for="input-stc-latmin_1"] .stc-required-marker').text()).toBe('*');

    expect($('#input-stc-longmin_1').attr('aria-required')).toBe('true');
    expect($('#input-stc-longmin_1').hasClass('border-danger')).toBe(true);
    expect($('label[for="input-stc-longmin_1"] .stc-required-marker').text()).toBe('*');

    expect($('#input-stc-longmax_1').attr('aria-required')).toBe('true');
    expect($('#input-stc-longmax_1').hasClass('border-danger')).toBe(false);
    expect($('label[for="input-stc-longmax_1"] .stc-required-marker').length).toBe(0);

    expect($('#input-stc-description').attr('aria-required')).toBe('true');
    expect($('#input-stc-description').hasClass('border-danger')).toBe(true);
    expect($('label[for="input-stc-description"] .stc-required-marker').text()).toBe('*');

    expect($('#input-stc-datestart').attr('aria-required')).toBe('true');
    expect($('#input-stc-datestart').hasClass('border-danger')).toBe(true);
    expect($('label[for="input-stc-datestart"] .stc-required-marker').text()).toBe('*');

    expect($('#input-stc-dateend').attr('aria-required')).toBe('true');
    expect($('#input-stc-dateend').hasClass('border-danger')).toBe(true);
    expect($('label[for="input-stc-dateend"] .stc-required-marker').text()).toBe('*');

    $('#input-stc-longmax_1').val('');
    window.validateSpatialTemporalCoverageRequirements();

    expect($('#input-stc-latmin_1').attr('aria-required')).toBeUndefined();
    expect($('#input-stc-latmin_1').hasClass('border-danger')).toBe(false);
    expect($('label[for="input-stc-latmin_1"] .stc-required-marker').length).toBe(0);
    expect($('#input-stc-datestart').attr('aria-required')).toBeUndefined();
    expect($('#input-stc-datestart').hasClass('border-danger')).toBe(false);
    expect($('label[for="input-stc-datestart"] .stc-required-marker').length).toBe(0);
  });
});
