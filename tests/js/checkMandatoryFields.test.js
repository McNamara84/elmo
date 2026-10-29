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
      <div data-author-stack>
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

    // datestart and dateend should not be required
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

    // A time turns both dates, both times, and the timezone into one required bundle.
    expect(datestart.prop('required')).toBe(true);
    expect(dateend.prop('required')).toBe(true);
    expect(timestart.prop('required')).toBe(true);
    expect(timeend.prop('required')).toBe(true);
    expect(timezone.prop('required')).toBe(true);
  });

});

describe('validateAuthorsGroup', () => {
  let $;
  let previousApplyTranslationsTo;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="authors-test-form">
        <div id="formgroup-authors">
          <div class="card-header">Authors</div>
          <div class="card-body">
            <div data-author-stack>
              <div data-author-entry-row data-creator-row>
                <input type="text" name="familynames[]" />
                <input type="email" name="cpEmail[]" />
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = window.jQuery = $;

    previousApplyTranslationsTo = window.applyTranslationsTo;
    window.applyTranslationsTo = jest.fn();

    const scriptPath = path.resolve(
      __dirname,
      '../../js/checkMandatoryFields.js'
    );

    window.eval(fs.readFileSync(scriptPath, 'utf8'));
  });

  afterEach(() => {
    window.applyTranslationsTo = previousApplyTranslationsTo;

    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
  });

  test('returns true when the Authors group is absent', () => {
    $('#formgroup-authors').remove();

    expect(window.validateAuthorsGroup()).toBe(true);
    expect($('#authors-group-error')).toHaveLength(0);
  });

  test('shows an error when no author cards exist', () => {
    $('[data-author-stack]').empty();

    expect(window.validateAuthorsGroup()).toBe(false);
    expect($('#authors-group-error')).toHaveLength(1);
  });

  test('rejects an empty or whitespace-only author name', () => {
    $('input[name="familynames[]"]').val('   ');

    expect(window.validateAuthorsGroup()).toBe(false);
    expect($('#authors-group-error')).toHaveLength(1);
  });

  test('accepts a person with a name and valid fields', () => {
    $('input[name="familynames[]"]').val('Doe');

    expect(window.validateAuthorsGroup()).toBe(true);
    expect($('#authors-group-error')).toHaveLength(0);
  });

  test('accepts an institution with a name', () => {
    $('[data-author-stack]').html(`
      <div data-author-entry-row data-authorinstitution-row>
        <input
          type="text"
          name="authorinstitutionName[]"
          value="GFZ"
        />
      </div>
    `);

    expect(window.validateAuthorsGroup()).toBe(true);
    expect($('#authors-group-error')).toHaveLength(0);
  });

  test('rejects a field with native validation errors', () => {
    $('input[name="familynames[]"]').val('Doe');
    $('input[name="cpEmail[]"]').val('invalid-email');

    expect(window.validateAuthorsGroup()).toBe(false);
    expect($('#authors-group-error')).toHaveLength(1);
  });

  test('rejects a field marked as invalid by custom validation', () => {
    $('input[name="familynames[]"]')
      .val('Doe')
      .addClass('is-invalid');

    expect(window.validateAuthorsGroup()).toBe(false);
    expect($('#authors-group-error')).toHaveLength(1);
  });

  test('removes the error after the author becomes valid', () => {
    expect(window.validateAuthorsGroup()).toBe(false);

    $('input[name="familynames[]"]').val('Doe');

    expect(window.validateAuthorsGroup()).toBe(true);
    expect($('#authors-group-error')).toHaveLength(0);
  });

  test('does not duplicate the error and requests its translation', () => {
    window.validateAuthorsGroup();
    window.validateAuthorsGroup();

    const $feedback = $('#authors-group-error');

    expect($feedback).toHaveLength(1);
    expect($feedback.attr('data-translate'))
      .toBe('authors.validationError');

    expect(window.applyTranslationsTo).toHaveBeenCalledTimes(2);

    const calls = window.applyTranslationsTo.mock.calls;
    const translatedElement = calls[calls.length - 1][0];

    expect(translatedElement).toHaveLength(1);
    expect(translatedElement[0]).toBe($feedback[0]);
  });

  test('places the error below the card body, outside collapsed fields', () => {
    $('.card-body').addClass('collapse');

    window.validateAuthorsGroup();

    const feedback = document.getElementById('authors-group-error');
    const group = document.getElementById('formgroup-authors');

    expect(feedback.parentElement).toBe(group);
    expect(group.lastElementChild).toBe(feedback);
    expect(feedback.closest('.collapse')).toBeNull();
  });
});
