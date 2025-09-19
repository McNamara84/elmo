
const fs = require('fs');
const path = require('path');

describe('validateAuthorInstitutionRequirements', () => {
  let $;

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
  });

  test('toggles required attributes based on Tagify affiliation values', () => {
    const nameInput = $('#input-authorinstitution-name');
    const affiliationInput = $('#input-authorinstitution-affiliation');

    expect(typeof window.validateAuthorInstitutionRequirements).toBe('function');

    // No value - should not be required
    window.validateAuthorInstitutionRequirements();
    expect(nameInput.attr('required')).toBeUndefined();
    expect(nameInput.attr('aria-required')).toBeUndefined();

    // Plain text value triggers requirement
    affiliationInput.val('Helmholtz Centre Potsdam - GFZ');
    window.validateAuthorInstitutionRequirements();
    expect(nameInput.attr('required')).toBe('required');
    expect(nameInput.attr('aria-required')).toBe('true');

    // Clear visible value but simulate Tagify tags
    affiliationInput.val('');
    affiliationInput[0].tagify = { value: [{ value: 'Helmholtz Centre Potsdam - GFZ' }] };
    window.validateAuthorInstitutionRequirements();
    expect(nameInput.attr('required')).toBe('required');
    expect(nameInput.attr('aria-required')).toBe('true');

    // Remove Tagify tags -> requirement should be cleared
    affiliationInput[0].tagify.value = [];
    window.validateAuthorInstitutionRequirements();
    expect(nameInput.attr('required')).toBeUndefined();
    expect(nameInput.attr('aria-required')).toBeUndefined();
  });
});