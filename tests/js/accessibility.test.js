const { applyTagifyAccessibilityAttributes, getTooltipContainer } = require('../../js/accessibility.js');

describe('accessibility helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main id="main-content">
        <div class="wrapper">
          <label for="tagify-input">Roles</label>
          <div class="form-floating">
            <div class="tagify">
              <div class="tagify__input" contenteditable="true"></div>
              <div class="invalid-feedback">Please select at least one role.</div>
            </div>
          </div>
          <input id="tagify-input" />
        </div>
      </main>
    `;
  });

  test('applies aria-labelledby when a label is present', () => {
    const input = document.getElementById('tagify-input');
    const scope = document.querySelector('.tagify');
    const tagifyInstance = {
      DOM: { scope },
      settings: { placeholder: 'Select roles' }
    };

    applyTagifyAccessibilityAttributes(tagifyInstance, input, { placeholder: 'Select roles' });

    const interactiveInput = scope.querySelector('.tagify__input');
    const label = document.querySelector('label[for="tagify-input"]');

    expect(interactiveInput.getAttribute('aria-labelledby')).toBe(label.id);
    expect(interactiveInput.hasAttribute('aria-label')).toBe(false);
    expect(interactiveInput.getAttribute('role')).toBe('textbox');
    expect(interactiveInput.getAttribute('aria-autocomplete')).toBe('list');
    expect(interactiveInput.getAttribute('data-placeholder')).toBe('Select roles');
  });

  test('uses placeholder as aria-label when no label exists', () => {
    document.querySelector('label').remove();
    const input = document.getElementById('tagify-input');
    const scope = document.querySelector('.tagify');
    const tagifyInstance = {
      DOM: { scope },
      settings: { placeholder: 'Choose keywords' }
    };

    applyTagifyAccessibilityAttributes(tagifyInstance, input, {});

    const interactiveInput = scope.querySelector('.tagify__input');
    expect(interactiveInput.getAttribute('aria-label')).toBe('Choose keywords');
    expect(interactiveInput.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('collects feedback elements for aria-describedby', () => {
    const input = document.getElementById('tagify-input');
    input.setAttribute('aria-describedby', 'external-help');
    const scope = document.querySelector('.tagify');
    const tagifyInstance = {
      DOM: { scope },
      settings: { placeholder: 'Select roles' }
    };

    applyTagifyAccessibilityAttributes(tagifyInstance, input, {});

    const interactiveInput = scope.querySelector('.tagify__input');
    const describedBy = interactiveInput.getAttribute('aria-describedby');
    expect(describedBy).toContain('external-help');
    expect(describedBy.split(' ').length).toBeGreaterThan(1);
  });

  test('removes aria-required when the field is not mandatory', () => {
    const input = document.getElementById('tagify-input');
    const scope = document.querySelector('.tagify');
    const interactiveInput = scope.querySelector('.tagify__input');
    interactiveInput.setAttribute('aria-required', 'true');

    const tagifyInstance = {
      DOM: { scope },
      settings: { placeholder: 'Select roles' }
    };

    applyTagifyAccessibilityAttributes(tagifyInstance, input, { isRequired: false });

    expect(interactiveInput.hasAttribute('aria-required')).toBe(false);
  });

  test('does not overwrite placeholder when no candidates are provided', () => {
    const input = document.getElementById('tagify-input');
    const scope = document.querySelector('.tagify');
    const interactiveInput = scope.querySelector('.tagify__input');
    const tagifyInstance = { DOM: { scope }, settings: {} };

    input.removeAttribute('placeholder');
    input.removeAttribute('data-placeholder');
    input.removeAttribute('data-translate-placeholder');

    applyTagifyAccessibilityAttributes(tagifyInstance, input, {});

    expect(interactiveInput.hasAttribute('data-placeholder')).toBe(false);
  });

  test('getTooltipContainer prefers the main landmark', () => {
    const container = getTooltipContainer();
    expect(container).toBeInstanceOf(HTMLElement);
    expect(container.id).toBe('main-content');
  });
});