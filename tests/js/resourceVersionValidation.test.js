const fs = require('fs');
const path = require('path');
const { validateResourceVersion } = require('../../js/validation/resourceVersionValidation.js');

describe('resource version validation', () => {
  let input;

  beforeEach(() => {
    document.body.innerHTML = fs.readFileSync(path.resolve(__dirname, '../../formgroups/resource-information.html'), 'utf8');
    input = document.getElementById('input-resourceinformation-version');
  });

  test.each(['', '1.4', '12.3', '0.1', '1.0', '1.10', '01.02'])('accepts %j without changing the text', value => {
    input.value = value;
    expect(validateResourceVersion(input)).toBe(true);
    expect(input.value).toBe(value);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.classList.contains('is-invalid')).toBe(false);
    expect(input.classList.contains('is-valid')).toBe(false);
    expect(input.dataset.empty).toBe(String(value === ''));
  });

  test.each(['1.2.3', '1.2.3.4', '1', '1.', '.1', 'v1.4', '-1.4', '1,4', '١.٤', ' 1.4 '])('explains invalid %j without rewriting it', value => {
    input.value = value;
    expect(validateResourceVersion(input)).toBe(false);
    expect(input.value).toBe(value);
    expect(input.validity.patternMismatch).toBe(true);
    expect(input.classList.contains('is-invalid')).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.form.classList.contains('was-validated')).toBe(false);
  });

  test.each(['1.10', ''])('removes an old error when corrected to %j', value => {
    input.value = '1.2.3';
    validateResourceVersion(input);
    input.value = value;
    expect(validateResourceVersion(input)).toBe(true);
    expect(input.classList.contains('is-invalid')).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.validity.customError).toBe(false);
  });

  test.each([[' 1.10 ', '1.10'], ['   ', '']])('normalizes %j only when requested', (raw, expected) => {
    input.value = raw;
    expect(validateResourceVersion(input, { trim: true })).toBe(true);
    expect(input.value).toBe(expected);
    expect(input.dataset.empty).toBe(String(expected === ''));
  });

  test('uses the actual HTML constraints rather than another version pattern', () => {
    input.pattern = '\\d+';
    input.value = '2';
    expect(validateResourceVersion(input)).toBe(true);
    input.value = '2.0';
    expect(validateResourceVersion(input)).toBe(false);
  });

  test('does not rewrite the translated live feedback on every validation', () => {
    const feedback = document.getElementById('resource-version-error');
    feedback.textContent = 'A translated error';
    const changes = new MutationObserver(() => {});
    changes.observe(feedback, { childList: true, subtree: true, characterData: true });
    input.value = '1.2.3';
    validateResourceVersion(input);
    validateResourceVersion(input);
    expect(changes.takeRecords()).toHaveLength(0);
    changes.disconnect();
    expect(input.getAttribute('aria-describedby').split(' ')).toEqual(['resource-version-hint', 'resource-version-error']);
    expect(feedback.getAttribute('aria-live')).toBe('polite');
  });

  test('supports pages without a version field', () => {
    expect(validateResourceVersion(null)).toBe(true);
  });
});
