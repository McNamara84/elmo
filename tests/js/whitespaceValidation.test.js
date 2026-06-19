const fs = require('fs');
const path = require('path');

/**
 * Tests for validateTitleField and validateAuthorNameFields.
 * Ensures that whitespace-only input is rejected with proper UI feedback.
 * Addresses GitHub Issue #763.
 */
describe('validateTitleField', () => {
  let $;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="form-mde">
        <div id="group-resourceinformation">
          <div class="row">
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-resourceinformation-title" name="title[]" required />
                  <label for="input-resourceinformation-title">Title</label>
                  <div class="invalid-feedback" data-translate="resourceInfo.resourceTitleInvalid"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="group-author">
          <div class="row">
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-author-lastname" name="familynames[]" required />
                  <label for="input-author-lastname">Last Name</label>
                  <div class="invalid-feedback" data-translate="general.lastNameInvalid"></div>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-author-firstname" name="givennames[]" required />
                  <label for="input-author-firstname">First Name</label>
                  <div class="invalid-feedback" data-translate="general.firstNameInvalid"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    // Set up jQuery
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    // Set up translations
    window.translations = {
      resourceInfo: {
        resourceTitleInvalid: 'Please provide a descriptive title (that does not repeat the paper title, but describes the data).'
      },
      general: {
        lastNameInvalid: 'Please provide a lastname. Letters only. No digits or special characters (e.g. $, %, _).',
        firstNameInvalid: 'Please provide a firstname. Letters only. No digits or special characters (e.g. $, %, _).'
      },
      descriptions: {
        abstractInvalid: 'Please enter a valid abstract text.'
      }
    };
    // Make translations accessible as a global (the script uses `translations` without `window.`)
    global.translations = window.translations;

    // Load the script
    const scriptPath = path.resolve(__dirname, '../../js/checkMandatoryFields.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);
  });

  afterEach(() => {
    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete global.translations;
    delete window.$;
    delete window.jQuery;
    delete window.translations;
    delete window.applyTagifyAccessibilityAttributes;
  });

  // --- validateTitleField tests ---

  test('rejects empty title (empty string)', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = '';

    const result = window.validateTitleField();

    expect(result).toBe(false);
    expect(titleInput.classList.contains('is-invalid')).toBe(true);
    expect(titleInput.classList.contains('is-valid')).toBe(false);
    expect(titleInput.validity.valid).toBe(false);
  });

  test('rejects whitespace-only title (spaces)', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = '     ';

    const result = window.validateTitleField();

    expect(result).toBe(false);
    expect(titleInput.classList.contains('is-invalid')).toBe(true);
    expect(titleInput.classList.contains('is-valid')).toBe(false);
    expect(titleInput.validity.valid).toBe(false);
  });

  test('rejects whitespace-only title (tabs and newlines)', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = '\t\n  \t';

    const result = window.validateTitleField();

    expect(result).toBe(false);
    expect(titleInput.classList.contains('is-invalid')).toBe(true);
  });

  test('accepts valid title text', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = 'My Research Dataset';

    const result = window.validateTitleField();

    expect(result).toBe(true);
    expect(titleInput.classList.contains('is-valid')).toBe(true);
    expect(titleInput.classList.contains('is-invalid')).toBe(false);
    expect(titleInput.validity.valid).toBe(true);
  });

  test('accepts title with leading/trailing spaces (trimmed content is non-empty)', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = '  My Dataset  ';

    const result = window.validateTitleField();

    expect(result).toBe(true);
    expect(titleInput.classList.contains('is-valid')).toBe(true);
  });

  test('creates feedback element with correct data-translate attribute', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = '   ';

    window.validateTitleField();

    const container = titleInput.closest('.input-group') || titleInput.parentElement;
    const feedback = container.querySelector('.invalid-feedback[data-translate="resourceInfo.resourceTitleInvalid"]');
    expect(feedback).not.toBeNull();
    expect(feedback.innerText).toBe(window.translations.resourceInfo.resourceTitleInvalid);
  });

  test('removes old feedback element before adding new one', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = '   ';

    // Validate twice to ensure no duplicate feedback elements
    window.validateTitleField();
    window.validateTitleField();

    const container = titleInput.closest('.input-group') || titleInput.parentElement;
    const feedbacks = container.querySelectorAll('.invalid-feedback[data-translate="resourceInfo.resourceTitleInvalid"]');
    expect(feedbacks.length).toBe(1);
  });

  test('clears invalid state when valid value is entered after invalid', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');

    // First: invalid
    titleInput.value = '   ';
    window.validateTitleField();
    expect(titleInput.classList.contains('is-invalid')).toBe(true);

    // Then: valid
    titleInput.value = 'Valid Title';
    window.validateTitleField();
    expect(titleInput.classList.contains('is-valid')).toBe(true);
    expect(titleInput.classList.contains('is-invalid')).toBe(false);
    expect(titleInput.validity.valid).toBe(true);
  });

  test('sets customValidity so checkValidity() returns false for whitespace-only', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = '   ';

    window.validateTitleField();

    // HTML5 checkValidity should now fail
    expect(titleInput.checkValidity()).toBe(false);
  });

  test('clears customValidity for valid values so checkValidity() returns true', () => {
    const titleInput = document.getElementById('input-resourceinformation-title');
    titleInput.value = 'Valid Dataset Title';

    window.validateTitleField();

    expect(titleInput.checkValidity()).toBe(true);
  });

  test('returns true when title element does not exist', () => {
    document.getElementById('input-resourceinformation-title').remove();

    const result = window.validateTitleField();

    expect(result).toBe(true);
  });
});

describe('validateAuthorNameFields', () => {
  let $;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="form-mde">
        <div id="group-author">
          <div class="row">
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-author-lastname" name="familynames[]" required />
                  <label for="input-author-lastname">Last Name</label>
                  <div class="invalid-feedback" data-translate="general.lastNameInvalid"></div>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-author-firstname" name="givennames[]" required />
                  <label for="input-author-firstname">First Name</label>
                  <div class="invalid-feedback" data-translate="general.firstNameInvalid"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    window.translations = {
      resourceInfo: {
        resourceTitleInvalid: 'Please provide a descriptive title.'
      },
      general: {
        lastNameInvalid: 'Please provide a lastname. Letters only. No digits or special characters (e.g. $, %, _).',
        firstNameInvalid: 'Please provide a firstname. Letters only. No digits or special characters (e.g. $, %, _).'
      },
      descriptions: {
        abstractInvalid: 'Please enter a valid abstract text.'
      }
    };
    global.translations = window.translations;

    const scriptPath = path.resolve(__dirname, '../../js/checkMandatoryFields.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);
  });

  afterEach(() => {
    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete global.translations;
    delete window.$;
    delete window.jQuery;
    delete window.translations;
    delete window.applyTagifyAccessibilityAttributes;
  });

  // --- Last name validation ---

  test('rejects whitespace-only last name', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = '   ';
    firstname.value = 'John';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(false);
    expect(lastname.classList.contains('is-invalid')).toBe(true);
    expect(firstname.classList.contains('is-valid')).toBe(true);
  });

  test('rejects empty last name', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = '';
    firstname.value = 'John';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(false);
    expect(lastname.classList.contains('is-invalid')).toBe(true);
  });

  // --- First name validation ---

  test('rejects whitespace-only first name', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = 'Doe';
    firstname.value = '   ';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(false);
    expect(firstname.classList.contains('is-invalid')).toBe(true);
    expect(lastname.classList.contains('is-valid')).toBe(true);
  });

  test('rejects empty first name', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = 'Doe';
    firstname.value = '';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(false);
    expect(firstname.classList.contains('is-invalid')).toBe(true);
  });

  // --- Both fields invalid ---

  test('rejects both fields when both are whitespace-only', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = '   ';
    firstname.value = '   ';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(false);
    expect(lastname.classList.contains('is-invalid')).toBe(true);
    expect(firstname.classList.contains('is-invalid')).toBe(true);
  });

  // --- Both fields valid ---

  test('accepts valid author names', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = 'Doe';
    firstname.value = 'John';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(true);
    expect(lastname.classList.contains('is-valid')).toBe(true);
    expect(firstname.classList.contains('is-valid')).toBe(true);
    expect(lastname.classList.contains('is-invalid')).toBe(false);
    expect(firstname.classList.contains('is-invalid')).toBe(false);
  });

  test('accepts compound names with spaces (e.g. "van der Berg")', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = 'van der Berg';
    firstname.value = 'Jan';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(true);
    expect(lastname.classList.contains('is-valid')).toBe(true);
  });

  test('accepts names with leading/trailing spaces (trimmed content non-empty)', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = '  Doe  ';
    firstname.value = '  John  ';

    const result = window.validateAuthorNameFields();

    expect(result).toBe(true);
    expect(lastname.classList.contains('is-valid')).toBe(true);
    expect(firstname.classList.contains('is-valid')).toBe(true);
  });

  // --- Feedback element handling ---

  test('creates feedback elements with correct data-translate attributes', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = '   ';
    firstname.value = '   ';

    window.validateAuthorNameFields();

    const lastnameContainer = lastname.closest('.input-group') || lastname.parentElement;
    const firstnameContainer = firstname.closest('.input-group') || firstname.parentElement;
    const lastnameFeedback = lastnameContainer.querySelector('.invalid-feedback[data-translate="general.lastNameInvalid"]');
    const firstnameFeedback = firstnameContainer.querySelector('.invalid-feedback[data-translate="general.firstNameInvalid"]');

    expect(lastnameFeedback).not.toBeNull();
    expect(lastnameFeedback.innerText).toBe(window.translations.general.lastNameInvalid);
    expect(firstnameFeedback).not.toBeNull();
    expect(firstnameFeedback.innerText).toBe(window.translations.general.firstNameInvalid);
  });

  test('does not duplicate feedback elements on multiple validations', () => {
    const lastname = document.getElementById('input-author-lastname');
    lastname.value = '   ';
    const firstname = document.getElementById('input-author-firstname');
    firstname.value = 'John';

    window.validateAuthorNameFields();
    window.validateAuthorNameFields();
    window.validateAuthorNameFields();

    const container = lastname.closest('.input-group') || lastname.parentElement;
    const feedbacks = container.querySelectorAll('.invalid-feedback[data-translate="general.lastNameInvalid"]');
    expect(feedbacks.length).toBe(1);
  });

  // --- State transitions ---

  test('clears invalid state when valid value is entered after whitespace-only', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');

    // First: both invalid
    lastname.value = '   ';
    firstname.value = '   ';
    window.validateAuthorNameFields();
    expect(lastname.classList.contains('is-invalid')).toBe(true);
    expect(firstname.classList.contains('is-invalid')).toBe(true);

    // Then: both valid
    lastname.value = 'Doe';
    firstname.value = 'Jane';
    window.validateAuthorNameFields();
    expect(lastname.classList.contains('is-valid')).toBe(true);
    expect(firstname.classList.contains('is-valid')).toBe(true);
    expect(lastname.classList.contains('is-invalid')).toBe(false);
    expect(firstname.classList.contains('is-invalid')).toBe(false);
  });

  // --- setCustomValidity integration ---

  test('sets customValidity so checkValidity() returns false for whitespace-only names', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = '   ';
    firstname.value = '   ';

    window.validateAuthorNameFields();

    expect(lastname.checkValidity()).toBe(false);
    expect(firstname.checkValidity()).toBe(false);
  });

  test('clears customValidity for valid names so checkValidity() returns true', () => {
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');
    lastname.value = 'Doe';
    firstname.value = 'John';

    window.validateAuthorNameFields();

    expect(lastname.checkValidity()).toBe(true);
    expect(firstname.checkValidity()).toBe(true);
  });
});

describe('validateTitleField and validateAuthorNameFields integration', () => {
  let $;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="form-mde">
        <div id="group-resourceinformation">
          <div class="row">
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-resourceinformation-title" name="title[]" required />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="group-author">
          <div class="row">
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-author-lastname" name="familynames[]" required />
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" class="form-control js-required-on-submit"
                    id="input-author-firstname" name="givennames[]" required />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    window.translations = {
      resourceInfo: {
        resourceTitleInvalid: 'Please provide a descriptive title.'
      },
      general: {
        lastNameInvalid: 'Please provide a lastname.',
        firstNameInvalid: 'Please provide a firstname.'
      },
      descriptions: {
        abstractInvalid: 'Please enter a valid abstract text.'
      }
    };
    global.translations = window.translations;

    const scriptPath = path.resolve(__dirname, '../../js/checkMandatoryFields.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    window.eval(scriptContent);
  });

  afterEach(() => {
    jest.resetModules();
    delete global.$;
    delete global.jQuery;
    delete global.translations;
    delete window.$;
    delete window.jQuery;
    delete window.translations;
    delete window.applyTagifyAccessibilityAttributes;
  });

  test('form checkValidity() fails when title is whitespace-only', () => {
    const form = document.getElementById('form-mde');
    const titleInput = document.getElementById('input-resourceinformation-title');
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');

    titleInput.value = '   ';
    lastname.value = 'Doe';
    firstname.value = 'John';

    window.validateTitleField();
    window.validateAuthorNameFields();

    expect(form.checkValidity()).toBe(false);
  });

  test('form checkValidity() fails when author names are whitespace-only', () => {
    const form = document.getElementById('form-mde');
    const titleInput = document.getElementById('input-resourceinformation-title');
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');

    titleInput.value = 'Valid Title';
    lastname.value = '   ';
    firstname.value = '   ';

    window.validateTitleField();
    window.validateAuthorNameFields();

    expect(form.checkValidity()).toBe(false);
  });

  test('form checkValidity() passes when all fields have valid values', () => {
    const form = document.getElementById('form-mde');
    const titleInput = document.getElementById('input-resourceinformation-title');
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');

    titleInput.value = 'Valid Dataset Title';
    lastname.value = 'Doe';
    firstname.value = 'John';

    window.validateTitleField();
    window.validateAuthorNameFields();

    expect(form.checkValidity()).toBe(true);
  });

  test('validateAllMandatoryFields does NOT mark empty title/author fields as invalid on its own', () => {
    // validateAllMandatoryFields() must NOT call validateTitleField/validateAuthorNameFields
    // because that would turn fields red on page load before user interaction.
    // These functions are called explicitly in submitHandler.handleSubmit() instead.
    const titleInput = document.getElementById('input-resourceinformation-title');
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');

    titleInput.value = '   ';
    lastname.value = '   ';
    firstname.value = '   ';

    window.validateAllMandatoryFields();

    // Fields must NOT be marked invalid by validateAllMandatoryFields()
    expect(titleInput.classList.contains('is-invalid')).toBe(false);
    expect(lastname.classList.contains('is-invalid')).toBe(false);
    expect(firstname.classList.contains('is-invalid')).toBe(false);
  });

  test('validateTitleField and validateAuthorNameFields must be called explicitly before submit', () => {
    // This mirrors the submitHandler.handleSubmit() flow:
    // call validateTitleField() and validateAuthorNameFields() before checkValidity()
    const titleInput = document.getElementById('input-resourceinformation-title');
    const lastname = document.getElementById('input-author-lastname');
    const firstname = document.getElementById('input-author-firstname');

    titleInput.value = '   ';
    lastname.value = '   ';
    firstname.value = '   ';

    window.validateTitleField();
    window.validateAuthorNameFields();

    expect(titleInput.classList.contains('is-invalid')).toBe(true);
    expect(lastname.classList.contains('is-invalid')).toBe(true);
    expect(firstname.classList.contains('is-invalid')).toBe(true);
  });
});
