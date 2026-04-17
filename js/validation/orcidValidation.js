/**
 * ORCID Checksum Validation and Auto-Formatting
 *
 * Validates ORCID identifiers using the ISO 7064 Mod 11-2 algorithm
 * and provides auto-formatting for ORCID input fields.
 *
 * @see https://support.orcid.org/hc/en-us/articles/360006897674-Structure-of-the-ORCID-Identifier
 */

/**
 * Validates the checksum of an ORCID identifier using ISO 7064 Mod 11-2.
 *
 * @param {string} orcid - The ORCID identifier (with or without hyphens)
 * @returns {boolean} True if the checksum is valid, false otherwise
 */
function isValidOrcidChecksum(orcid) {
  const digits = orcid.replace(/-/g, '');
  if (digits.length !== 16 || !/^\d{15}[\dX]$/.test(digits)) {
    return false;
  }

  let total = 0;
  for (let i = 0; i < 15; i++) {
    total = (total + parseInt(digits[i], 10)) * 2;
  }
  const remainder = total % 11;
  const checkDigit = (12 - remainder) % 11;
  const expectedChar = checkDigit === 10 ? 'X' : String(checkDigit);

  return digits[15] === expectedChar;
}

/**
 * Formats a raw input value into ORCID format (XXXX-XXXX-XXXX-XXXX).
 * Strips ORCID URL prefixes, removes non-digit characters (except trailing X),
 * and inserts hyphens.
 *
 * @param {string} value - The raw input value
 * @returns {string} The formatted ORCID string
 */
function formatOrcidInput(value) {
  // Strip ORCID URL prefixes
  value = value.replace(/^https?:\/\/orcid\.org\//i, '');

  // Separate possible trailing X
  const upperValue = value.toUpperCase();
  const hasTrailingX = upperValue.replace(/-/g, '').length > 0 &&
    upperValue.replace(/-/g, '').slice(-1) === 'X';

  // Remove all non-digit characters
  let digits = value.replace(/[^\d]/g, '');

  // Re-add trailing X if it was present and we have at least 15 digits
  if (hasTrailingX && digits.length >= 15) {
    digits = digits.slice(0, 15) + 'X';
  }

  // Limit to 16 characters
  digits = digits.slice(0, 16);

  // Insert hyphens after every 4 characters
  let formatted = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && i % 4 === 0) {
      formatted += '-';
    }
    formatted += digits[i];
  }

  return formatted;
}

/**
 * Validates an ORCID input field and sets appropriate visual feedback.
 * Uses Bootstrap 5 validation classes (is-valid/is-invalid) and
 * updates the invalid-feedback element with the appropriate message.
 *
 * @param {HTMLInputElement} input - The ORCID input element
 */
function validateOrcidField(input) {
  const feedback = input.closest('.has-validation')
    ?.querySelector('.invalid-feedback');
  if (!feedback) return;

  const value = input.value.trim();

  // Empty field: reset state (ORCID is optional)
  if (value === '') {
    input.classList.remove('is-valid', 'is-invalid');
    input.setCustomValidity('');
    return;
  }

  // Check format first
  const formatRegex = /^\d{4}-\d{4}-\d{4}-(\d{4}|\d{3}X)$/;
  if (!formatRegex.test(value)) {
    // Format invalid — use the default pattern mismatch message
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    input.setCustomValidity('format');
    feedback.setAttribute('data-translate', 'general.orcidInvalid');
    applyTranslationToElement(feedback);
    return;
  }

  // Format valid — check checksum
  if (!isValidOrcidChecksum(value)) {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    input.setCustomValidity('checksum');
    feedback.setAttribute('data-translate', 'general.orcidChecksumInvalid');
    applyTranslationToElement(feedback);
    return;
  }

  // All valid
  input.classList.remove('is-invalid');
  input.classList.add('is-valid');
  input.setCustomValidity('');
}

/**
 * Applies the current translation to a single element based on its
 * data-translate attribute. Falls back to the existing text if no
 * translation is available.
 *
 * @param {HTMLElement} element - The element to translate
 */
function applyTranslationToElement(element) {
  const key = element.getAttribute('data-translate');
  if (!key || typeof currentTranslations === 'undefined') return;

  const keys = key.split('.');
  let value = currentTranslations;
  for (const k of keys) {
    value = value?.[k];
  }
  if (typeof value === 'string') {
    element.innerHTML = value;
  }
}

// ── Event handlers (delegated for dynamically added rows) ──

const ORCID_SELECTOR = 'input[name="orcids[]"], input[name="cbORCID[]"]';

document.addEventListener('focusout', function (e) {
  if (e.target.matches(ORCID_SELECTOR)) {
    validateOrcidField(e.target);
  }
});

document.addEventListener('paste', function (e) {
  if (e.target.matches(ORCID_SELECTOR)) {
    setTimeout(function () {
      e.target.value = formatOrcidInput(e.target.value);
      validateOrcidField(e.target);
    }, 0);
  }
});

document.addEventListener('input', function (e) {
  if (e.target.matches(ORCID_SELECTOR)) {
    const cursorPos = e.target.selectionStart;
    const oldLength = e.target.value.length;
    e.target.value = formatOrcidInput(e.target.value);
    const newLength = e.target.value.length;
    // Adjust cursor position after formatting
    const newPos = cursorPos + (newLength - oldLength);
    e.target.setSelectionRange(newPos, newPos);
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isValidOrcidChecksum,
    formatOrcidInput,
    validateOrcidField,
    applyTranslationToElement
  };
}
