/**
 * Validate the optional resource version using the input's HTML constraints.
 * Keep empty fields neutral and preserve the text (including minor zeroes).
 *
 * @param {HTMLInputElement|null} input The resource version field.
 * @param {{trim?: boolean}} [options={}] Normalize outer whitespace on blur/submit.
 * @returns {boolean} Whether the version satisfies the field's constraints.
 */
export function validateResourceVersion(input, { trim = false } = {}) {
  if (!input) return true;

  if (trim) input.value = input.value.trim();
  const valid = input.validity.valid;
  input.dataset.empty = String(input.value === '');
  input.classList.remove('is-valid');
  input.classList.toggle('is-invalid', !valid);
  input.setAttribute('aria-invalid', String(!valid));
  return valid;
}
