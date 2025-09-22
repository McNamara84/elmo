const fs = require('fs');
const path = require('path');

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
    affiliationInput[0].tagify = { value: [] };

    expect(typeof window.validateAuthorInstitutionRequirements).toBe('function');

    // No value - should not be required
    window.validateAuthorInstitutionRequirements();
    await flushMicrotasks();
    expect(nameInput.attr('required')).toBeUndefined();
    expect(nameInput.attr('aria-required')).toBeUndefined();
    expect(nameInput[0].getAttribute('required')).toBeNull();
    expect(nameInput[0].getAttribute('aria-required')).toBeNull();
    expect(applyAccessibilitySpy).toHaveBeenCalledWith(affiliationInput[0].tagify, affiliationInput[0], expect.objectContaining({
      isRequired: false
    }));

    // Plain text value triggers requirement
    affiliationInput.val('Helmholtz Centre Potsdam - GFZ');
    window.validateAuthorInstitutionRequirements();
    nameInput[0].required = true;
    await flushMicrotasks();
    nameInput[0].setAttribute('required', '');
    nameInput[0].setAttribute('aria-required', '');
    await runAnimationFrameQueue();
    expect(nameInput.attr('required')).toBe('required');
    expect(nameInput.attr('aria-required')).toBe('true');
    expect(nameInput[0].getAttribute('required')).toBe('required');
    expect(nameInput[0].getAttribute('aria-required')).toBe('true');
    expect(applyAccessibilitySpy).toHaveBeenLastCalledWith(affiliationInput[0].tagify, affiliationInput[0], expect.objectContaining({
      isRequired: true
    }));

    // Clear visible value but simulate Tagify tags
    affiliationInput.val('');
    affiliationInput[0].tagify = { value: [{ value: 'Helmholtz Centre Potsdam - GFZ' }] };
    window.validateAuthorInstitutionRequirements();
    nameInput[0].required = true;
    await flushMicrotasks();
    nameInput[0].setAttribute('required', '');
    nameInput[0].setAttribute('aria-required', '');
    await runAnimationFrameQueue();
    expect(nameInput.attr('required')).toBe('required');
    expect(nameInput.attr('aria-required')).toBe('true');
    expect(nameInput[0].getAttribute('required')).toBe('required');
    expect(nameInput[0].getAttribute('aria-required')).toBe('true');
    expect(applyAccessibilitySpy).toHaveBeenLastCalledWith(affiliationInput[0].tagify, affiliationInput[0], expect.objectContaining({
      isRequired: true
    }));

    // Remove Tagify tags -> requirement should be cleared
    affiliationInput[0].tagify.value = [];
    window.validateAuthorInstitutionRequirements();
    await flushMicrotasks();
    expect(nameInput.attr('required')).toBeUndefined();
    expect(nameInput.attr('aria-required')).toBeUndefined();
    expect(nameInput[0].getAttribute('required')).toBeNull();
    expect(nameInput[0].getAttribute('aria-required')).toBeNull();
    expect(applyAccessibilitySpy).toHaveBeenLastCalledWith(affiliationInput[0].tagify, affiliationInput[0], expect.objectContaining({
      isRequired: false
    }));
  });
});