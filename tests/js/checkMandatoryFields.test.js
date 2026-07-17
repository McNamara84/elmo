const fs = require('fs');
const path = require('path');
const { simulateSubmitValidation } = require('./utils');


describe('validateAuthorInstitutionRequirements', () => {
  let $;
  let rafCallbacks;

  const runAnimationFrameQueue = async () => {
    while (rafCallbacks.length > 0) {
      const callback = rafCallbacks.shift();
      callback();
      await flushMicrotasks();
    }
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="group-authorinstitution">
        <div class="row" data-authorinstitution-row>
          <input type="text" id="input-authorinstitution-name" name="authorinstitutionName[]" />
          <input type="text" id="input-authorinstitution-affiliation" name="institutionAffiliation[]" />
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    rafCallbacks = [];
    global.requestAnimationFrame = (cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };

    const scriptPath = path.resolve(__dirname, '../../js/checkMandatoryFields.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);
  });

  afterEach(() => {
    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete window.applyTagifyAccessibilityAttributes;
    delete global.requestAnimationFrame;
  });

  const flushMicrotasks = () => Promise.resolve();

  test('toggles required attributes based on Tagify affiliation values', async () => {
    const nameInput = $('#input-authorinstitution-name');
    const affiliationInput = $('#input-authorinstitution-affiliation');
    const applyAccessibilitySpy = jest.fn();

    window.applyTagifyAccessibilityAttributes = applyAccessibilitySpy;
    affiliationInput[0]._tagify = { value: [] };

    expect(typeof window.validateAuthorInstitutionRequirements).toBe('function');

    // No value - should not be required
    window.validateAuthorInstitutionRequirements();
    await flushMicrotasks();
    expect(nameInput.prop('required')).toBe(false);
    expect(nameInput.attr('aria-required')).toBeUndefined();
    expect(nameInput[0].getAttribute('required')).toBeNull();
    expect(nameInput[0].getAttribute('aria-required')).toBeNull();
    expect(applyAccessibilitySpy).toHaveBeenCalledWith(affiliationInput[0]._tagify, affiliationInput[0], expect.objectContaining({
      isRequired: false
    }));

    // Plain text value triggers requirement
    affiliationInput.val('Helmholtz Centre Potsdam - GFZ');
    window.validateAuthorInstitutionRequirements();
    nameInput[0].required = true;
    await flushMicrotasks();
    nameInput[0].setAttribute('required', 'required');
    nameInput[0].setAttribute('aria-required', 'true');
    await runAnimationFrameQueue();
    expect(nameInput.prop('required')).toBe(true);
    expect(nameInput.attr('aria-required')).toBe('true');
    expect(nameInput[0].getAttribute('required')).toBe('required');
    expect(nameInput[0].getAttribute('aria-required')).toBe('true');
    expect(applyAccessibilitySpy).toHaveBeenLastCalledWith(affiliationInput[0]._tagify, affiliationInput[0], expect.objectContaining({
      isRequired: true
    }));

    // Clear visible value but simulate Tagify tags
    affiliationInput.val('');
    affiliationInput[0]._tagify = { value: [{ value: 'Helmholtz Centre Potsdam - GFZ' }] };
    window.validateAuthorInstitutionRequirements();
    nameInput[0].required = true;
    await flushMicrotasks();
    nameInput[0].setAttribute('required', 'required');
    nameInput[0].setAttribute('aria-required', 'true');
    await runAnimationFrameQueue();
    expect(nameInput.prop('required')).toBe(true);
    expect(nameInput.attr('aria-required')).toBe('true');
    expect(nameInput[0].getAttribute('required')).toBe('required');
    expect(nameInput[0].getAttribute('aria-required')).toBe('true');
    expect(applyAccessibilitySpy).toHaveBeenLastCalledWith(affiliationInput[0]._tagify, affiliationInput[0], expect.objectContaining({
      isRequired: true
    }));

    // Remove Tagify tags -> requirement should be cleared
    affiliationInput[0]._tagify.value = [];
    window.validateAuthorInstitutionRequirements();
    await flushMicrotasks();
    expect(nameInput.prop('required')).toBe(false);
    expect(nameInput.attr('aria-required')).toBeUndefined();
    expect(nameInput[0].getAttribute('required')).toBeNull();
    expect(nameInput[0].getAttribute('aria-required')).toBeNull();
    expect(applyAccessibilitySpy).toHaveBeenLastCalledWith(affiliationInput[0]._tagify, affiliationInput[0], expect.objectContaining({
      isRequired: false
    }));
  });
});

/**
 * Tests for Spatial and Temporal Coverage validation (time is optional).
 */
describe('validateSpatialTemporalCoverageRequirements', () => {
  let $;
  let rafCallbacks;

  beforeEach(() => {
    // HTML structure matches formgroups/coverage.html:
    // - Coordinate fields (latmin, latmax, longmin, longmax) have _1 suffix
    // - Date, time, description, and timezone fields do NOT have row suffix
    document.body.innerHTML = `
      <div id="group-stc">
        <div class="row" tsc-row tsc-row-id="1">
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

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    rafCallbacks = [];
    global.requestAnimationFrame = (cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };

    const scriptPath = require('path').resolve(__dirname, '../../js/checkMandatoryFields.js');
    const scriptContent = require('fs').readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);
  });

  afterEach(() => {
    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete global.requestAnimationFrame;
  });


  test('date without time is allowed (time not required)', () => {
    const datestart = $('#input-stc-datestart');
    const dateend = $('#input-stc-dateend');
    const latmin = $('#input-stc-latmin_1');
    const longmin = $('#input-stc-longmin_1');
    const description = $('#input-stc-description');
    const timestart = $('#input-stc-timestart');
    const timeend = $('#input-stc-timeend');
    const timezone = $('#input-stc-timezone');

    // Provide date-only values (no time)
    datestart.val('2025-01-01');
    dateend.val('2025-01-15');
    latmin.val('52.0');
    longmin.val('13.0');
    description.val('Test location');

    window.validateSpatialTemporalCoverageRequirements();

    simulateSubmitValidation();

    // datestart and dateend should be required
    expect(datestart.prop('required')).not.toBe(true);
    expect(dateend.prop('required')).not.toBe(true);

    // time fields should NOT be required (time is optional)
    expect(timestart.prop('required')).toBe(false);
    expect(timeend.prop('required')).toBe(false);

    // timezone should NOT be required without time
    expect(timezone.prop('required')).toBe(false);
  });

  test('time provided triggers time and timezone requirements', () => {
    const datestart = $('#input-stc-datestart');
    const dateend = $('#input-stc-dateend');
    const latmin = $('#input-stc-latmin_1');
    const longmin = $('#input-stc-longmin_1');
    const description = $('#input-stc-description');
    const timestart = $('#input-stc-timestart');
    const timeend = $('#input-stc-timeend');
    const timezone = $('#input-stc-timezone');

    datestart.val('2025-01-01');
    dateend.val('2025-01-15');
    latmin.val('52.0');
    longmin.val('13.0');
    description.val('Test location');
    // Only timestart is provided
    timestart.val('08:00');

    window.validateSpatialTemporalCoverageRequirements();

    simulateSubmitValidation();

    // Now time fields ARE required (since a time was given)
    expect(timestart.prop('required')).not.toBe(true);
    expect(timeend.prop('required')).not.toBe(true);
    expect(timezone.prop('required')).not.toBe(true);
  });

});