/**
 * Global accessibility helpers for enhancing interactive widgets with
 * appropriate ARIA metadata.
 *
 * The helpers in this file are intentionally framework-agnostic so they can be
 * consumed from scripts that rely on vanilla JavaScript, jQuery or ES modules.
 */
(function () {
  let generatedIdCounter = 0;

  /**
   * Generates a stable, unique id that can be assigned to helper elements
   * (e.g. labels or feedback containers) when they do not already expose one.
   *
   * @param {string} prefix - The prefix to use for the generated id.
   * @returns {string} A unique id.
   */
  function generateUniqueId(prefix) {
    generatedIdCounter += 1;
    return `${prefix}-${generatedIdCounter}`;
  }

  /**
   * Ensures an element has an id attribute by generating one when necessary.
   *
   * @param {HTMLElement} element - The element that requires an id.
   * @param {string} prefix - Prefix used when generating a new id.
   * @returns {string|undefined} The element id or undefined when the element is
   *   falsy.
   */
  function ensureElementId(element, prefix) {
    if (!element) {
      return undefined;
    }

    if (!element.id) {
      element.id = generateUniqueId(prefix);
    }

    return element.id;
  }

  /**
   * Collects all elements that provide descriptive feedback for the supplied
   * input element (invalid feedback, valid feedback, helper text, etc.) and
   * returns the unique ids that should be referenced via `aria-describedby`.
   *
   * @param {HTMLElement} inputElement - The original input element that Tagify
   *   enhanced.
   * @param {HTMLElement} scope - The Tagify scope that wraps the interactive
   *   element visible to the user.
   * @param {string[]} additionalIds - Optional list of ids that should also be
   *   referenced.
   * @returns {string[]} An array of ids that describe the interactive element.
   */
  function collectDescribedByIds(inputElement, scope, additionalIds) {
    const describedBy = new Set();

    const ariaDescribedBy = (inputElement.getAttribute('aria-describedby') || '').trim();
    if (ariaDescribedBy) {
      ariaDescribedBy.split(/\s+/).forEach(id => describedBy.add(id));
    }

    (additionalIds || []).forEach(id => {
      if (id) {
        describedBy.add(id);
      }
    });

    const feedbackElements = scope.querySelectorAll('.invalid-feedback, .valid-feedback, .form-text');
    feedbackElements.forEach(element => {
      const id = ensureElementId(element, 'tagify-feedback');
      if (id) {
        describedBy.add(id);
      }
    });

    return Array.from(describedBy);
  }

  /**
   * Determines the most appropriate accessible name for the Tagify interactive
   * input. Preference is given to associated labels; otherwise the method
   * returns one of the provided fallbacks.
   *
   * @param {HTMLInputElement} inputElement - The hidden/original input element.
   * @param {HTMLElement|null} label - Associated label for the input.
   * @param {string[]} fallbackNames - Additional candidate labels that can be
   *   used when no <label> is present.
   * @returns {{ labelledby?: string, labelText?: string }} Accessible naming
   *   metadata.
   */
  function resolveAccessibleName(inputElement, label, fallbackNames) {
    if (label) {
      const labelId = ensureElementId(label, `${inputElement.id || 'tagify'}-label`);
      if (labelId) {
        return { labelledby: labelId };
      }
    }

    const nameCandidate = fallbackNames.find(candidate => Boolean(candidate && candidate.trim()));
    if (nameCandidate) {
      return { labelText: nameCandidate.trim() };
    }

    return {};
  }

  /**
   * Applies accessibility attributes to Tagify's interactive input so screen
   * readers receive the same contextual information as native inputs.
   *
   * @param {Tagify} tagifyInstance - The Tagify instance controlling the field.
   * @param {HTMLInputElement} inputElement - The original input element that was
   *   enhanced by Tagify.
   * @param {Object} [options] - Additional configuration.
   * @param {string} [options.placeholder] - Placeholder text to synchronise with
   *   Tagify's content editable element.
   * @param {string[]} [options.describedByIds] - Additional element ids that
   *   should be referenced via `aria-describedby`.
   * @param {boolean} [options.isRequired] - Explicit required state override.
   */
  function resolveTagifyScope(tagifyInstance, inputElement) {
    if (tagifyInstance && tagifyInstance.DOM && tagifyInstance.DOM.scope) {
      return tagifyInstance.DOM.scope;
    }

    return inputElement ? inputElement.parentElement : null;
  }

  function findInteractiveInput(scope) {
    return scope ? scope.querySelector('.tagify__input') : null;
  }

  function collectPlaceholderCandidates(tagifyInstance, inputElement, options) {
    return [
      options && options.placeholder,
      tagifyInstance && tagifyInstance.settings && tagifyInstance.settings.placeholder,
      inputElement && inputElement.getAttribute('placeholder'),
      inputElement && inputElement.getAttribute('data-placeholder'),
      inputElement && inputElement.getAttribute('data-translate-placeholder')
    ].filter(Boolean);
  }

  function getLabelForInput(inputElement) {
    if (!inputElement || !inputElement.id) {
      return null;
    }

    return document.querySelector(`label[for="${inputElement.id}"]`);
  }

  function applyAccessibleNameAttributes(interactiveInput, accessibleName, label) {
    if (!interactiveInput || !accessibleName) {
      return;
    }

    if (accessibleName.labelledby) {
      const labelText = label && label.textContent ? label.textContent.trim() : '';
      interactiveInput.setAttribute('aria-labelledby', accessibleName.labelledby);
      interactiveInput.removeAttribute('aria-label');
      interactiveInput.setAttribute('title', labelText);
      return;
    }

    if (accessibleName.labelText) {
      interactiveInput.setAttribute('aria-label', accessibleName.labelText);
      interactiveInput.setAttribute('title', accessibleName.labelText);
      interactiveInput.removeAttribute('aria-labelledby');
    }
  }

  function syncPlaceholder(interactiveInput, placeholderCandidates) {
    if (!interactiveInput || placeholderCandidates.length === 0) {
      return;
    }

    interactiveInput.setAttribute('data-placeholder', placeholderCandidates[0]);
  }

  function applyStaticAriaAttributes(interactiveInput) {
    if (!interactiveInput) {
      return;
    }

    interactiveInput.setAttribute('role', 'textbox');
    interactiveInput.setAttribute('aria-multiline', 'false');
    interactiveInput.setAttribute('aria-autocomplete', 'list');
    interactiveInput.setAttribute('aria-haspopup', 'listbox');
  }

  function determineRequiredState(inputElement, options) {
    if (options && typeof options.isRequired === 'boolean') {
      return options.isRequired;
    }

    return Boolean(inputElement && inputElement.hasAttribute('required'));
  }

  function applyRequiredAttribute(interactiveInput, isRequired) {
    if (!interactiveInput) {
      return;
    }

    if (isRequired) {
      interactiveInput.setAttribute('aria-required', 'true');
      return;
    }

    interactiveInput.removeAttribute('aria-required');
  }

  function updateDescribedByAttribute(interactiveInput, describedBy) {
    if (!interactiveInput) {
      return;
    }

    if (describedBy.length > 0) {
      interactiveInput.setAttribute('aria-describedby', describedBy.join(' '));
      return;
    }

    interactiveInput.removeAttribute('aria-describedby');
  }

  function applyTagifyAccessibilityAttributes(tagifyInstance, inputElement, options) {
    if (!tagifyInstance || !inputElement) {
      return;
    }

    const scope = resolveTagifyScope(tagifyInstance, inputElement);
    const interactiveInput = findInteractiveInput(scope);

    if (!scope || !interactiveInput) {
      return;
    }

    const label = getLabelForInput(inputElement);
    const placeholderCandidates = collectPlaceholderCandidates(tagifyInstance, inputElement, options);
    const accessibleName = resolveAccessibleName(inputElement, label, placeholderCandidates);

    applyAccessibleNameAttributes(interactiveInput, accessibleName, label);
    syncPlaceholder(interactiveInput, placeholderCandidates);
    applyStaticAriaAttributes(interactiveInput);

    const isRequired = determineRequiredState(inputElement, options);
    applyRequiredAttribute(interactiveInput, isRequired);

    const describedBy = collectDescribedByIds(inputElement, scope, options && options.describedByIds);
    updateDescribedByAttribute(interactiveInput, describedBy);
  }

  /**
   * Returns the preferred container for floating UI elements such as tooltips.
   * Keeping these elements within the main landmark ensures accessibility
   * audits do not flag orphaned content.
   *
   * @returns {HTMLElement} The container element that should host tooltips.
   */
  function getTooltipContainer() {
    return document.getElementById('main-content')
      || document.querySelector('main')
      || document.body;
  }

  window.applyTagifyAccessibilityAttributes = applyTagifyAccessibilityAttributes;
  window.getTooltipContainer = getTooltipContainer;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyTagifyAccessibilityAttributes: window.applyTagifyAccessibilityAttributes,
    getTooltipContainer: window.getTooltipContainer
  };
}