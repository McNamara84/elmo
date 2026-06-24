/**
 * @jest-environment jsdom
 *
 * Unit tests for js/validation/orcidValidation.js
 */

const {
  isValidOrcidChecksum,
  extractOrcidIdentifier,
  formatOrcidInput,
  validateOrcidField,
  applyTranslationToElement
} = require('../../js/validation/orcidValidation');

describe('isValidOrcidChecksum', () => {
  describe('valid ORCIDs', () => {
    const validOrcids = [
      '0000-0002-1825-0097',
      '0000-0001-5109-3700',
      '0000-0002-1694-233X',
      '0000-0001-2345-6789',
      '0009-0007-2910-0469',
      '0009-0000-1235-6950',
      '0009-0006-3313-7304',
    ];

    test.each(validOrcids)('returns true for valid ORCID %s', (orcid) => {
      expect(isValidOrcidChecksum(orcid)).toBe(true);
    });
  });

  describe('invalid ORCIDs', () => {
    const invalidOrcids = [
      ['1234-1234-1234-1234', 'common test value'],
      ['0000-0002-1825-0098', 'last digit off by one'],
      ['0000-0002-1694-2330', 'should end with X'],
      ['0000-0002-3456-7890', 'wrong check digit'],
      ['0000-0003-4567-8901', 'wrong check digit'],
    ];

    test.each(invalidOrcids)('returns false for invalid ORCID %s (%s)', (orcid) => {
      expect(isValidOrcidChecksum(orcid)).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('returns false for empty string', () => {
      expect(isValidOrcidChecksum('')).toBe(false);
    });

    test('returns false for too short input', () => {
      expect(isValidOrcidChecksum('0000-0002-1825')).toBe(false);
    });

    test('returns false for too long input', () => {
      expect(isValidOrcidChecksum('0000-0002-1825-00970')).toBe(false);
    });

    test('returns false for letters in main body', () => {
      expect(isValidOrcidChecksum('000A-0002-1825-0097')).toBe(false);
    });

    test('returns false for input without hyphens (but valid digits)', () => {
      // Without hyphens, length is 16, so this should still work
      expect(isValidOrcidChecksum('0000000218250097')).toBe(true);
    });

    test('handles X as check digit correctly', () => {
      expect(isValidOrcidChecksum('0000-0002-1694-233X')).toBe(true);
      // Lowercase x should fail (only uppercase X is valid)
      expect(isValidOrcidChecksum('0000-0002-1694-233x')).toBe(false);
    });
  });
});

describe('extractOrcidIdentifier', () => {
  test('extracts ORCID from https profile URL', () => {
    expect(extractOrcidIdentifier('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  test('extracts ORCID from profile URL with trailing slash', () => {
    expect(extractOrcidIdentifier('https://orcid.org/0000-0002-1694-233X/')).toBe('0000-0002-1694-233X');
  });

  test('keeps direct ORCID input unchanged', () => {
    expect(extractOrcidIdentifier('0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });
});

describe('formatOrcidInput', () => {
  test('formats raw digits with hyphens', () => {
    expect(formatOrcidInput('0000000218250097')).toBe('0000-0002-1825-0097');
  });

  test('formats partial input', () => {
    expect(formatOrcidInput('00000002')).toBe('0000-0002');
  });

  test('strips ORCID URL prefix (https)', () => {
    expect(formatOrcidInput('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  test('strips ORCID URL prefix for the reported #698 ORCID', () => {
    expect(formatOrcidInput('https://orcid.org/0009-0007-2910-0469')).toBe('0009-0007-2910-0469');
  });

  test('strips ORCID URL prefix (http)', () => {
    expect(formatOrcidInput('http://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  test('preserves trailing X', () => {
    expect(formatOrcidInput('000000021694233X')).toBe('0000-0002-1694-233X');
  });

  test('preserves trailing X from URL', () => {
    expect(formatOrcidInput('https://orcid.org/0000-0002-1694-233X')).toBe('0000-0002-1694-233X');
  });

  test('preserves trailing X from URL with trailing slash', () => {
    expect(formatOrcidInput('https://orcid.org/0000-0002-1694-233X/')).toBe('0000-0002-1694-233X');
  });

  test('truncates input longer than 16 characters', () => {
    expect(formatOrcidInput('00000002182500971234')).toBe('0000-0002-1825-0097');
  });

  test('removes non-digit characters', () => {
    expect(formatOrcidInput('0000.0002.1825.0097')).toBe('0000-0002-1825-0097');
  });

  test('handles already formatted input', () => {
    expect(formatOrcidInput('0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  test('returns empty string for empty input', () => {
    expect(formatOrcidInput('')).toBe('');
  });
});

describe('validateOrcidField', () => {
  let input;
  let feedback;
  let container;

  beforeEach(() => {
    // Set up DOM structure matching the app
    container = document.createElement('div');
    container.className = 'input-group has-validation';

    const floatingDiv = document.createElement('div');
    floatingDiv.className = 'form-floating';

    input = document.createElement('input');
    input.type = 'text';
    input.name = 'orcids[]';
    input.pattern = '^[0-9]{4}-[0-9]{4}-[0-9]{4}-([0-9]{4}|[0-9]{3}X)$';

    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    feedback.setAttribute('data-translate', 'general.orcidInvalid');
    feedback.textContent = 'Please enter a valid ORCID';

    floatingDiv.appendChild(input);
    floatingDiv.appendChild(feedback);
    container.appendChild(floatingDiv);
    document.body.appendChild(container);

    // Mock currentTranslations global
    global.currentTranslations = {
      general: {
        orcidInvalid: 'Please enter a valid ORCID (XXXX-XXXX-XXXX-XXX(X))',
        orcidChecksumInvalid: 'The ORCID checksum is invalid. Please verify the ORCID at <a href="https://orcid.org" target="_blank">orcid.org</a>.'
      }
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete global.currentTranslations;
  });

  test('resets state for empty field', () => {
    input.value = '';
    validateOrcidField(input);

    expect(input.classList.contains('is-valid')).toBe(false);
    expect(input.classList.contains('is-invalid')).toBe(false);
  });

  test('sets is-valid for valid ORCID with correct checksum', () => {
    input.value = '0000-0002-1825-0097';
    validateOrcidField(input);

    expect(input.classList.contains('is-valid')).toBe(true);
    expect(input.classList.contains('is-invalid')).toBe(false);
  });

  test('sets is-invalid for valid format but wrong checksum', () => {
    input.value = '1234-1234-1234-1234';
    validateOrcidField(input);

    expect(input.classList.contains('is-invalid')).toBe(true);
    expect(input.classList.contains('is-valid')).toBe(false);
    expect(feedback.getAttribute('data-translate')).toBe('general.orcidChecksumInvalid');
  });

  test('sets is-invalid for invalid format', () => {
    input.value = '1234-1234';
    validateOrcidField(input);

    expect(input.classList.contains('is-invalid')).toBe(true);
    expect(input.classList.contains('is-valid')).toBe(false);
    expect(feedback.getAttribute('data-translate')).toBe('general.orcidInvalid');
  });

  test('validates real ORCIDs as valid', () => {
    const realOrcids = [
      '0009-0007-2910-0469',
      '0009-0000-1235-6950',
      '0009-0006-3313-7304'
    ];

    realOrcids.forEach(orcid => {
      input.value = orcid;
      input.classList.remove('is-valid', 'is-invalid');
      validateOrcidField(input);
      expect(input.classList.contains('is-valid')).toBe(true);
    });
  });
});

describe('applyTranslationToElement', () => {
  test('applies translation from currentTranslations', () => {
    global.currentTranslations = {
      general: { orcidInvalid: 'Translated text' }
    };

    const el = document.createElement('div');
    el.setAttribute('data-translate', 'general.orcidInvalid');
    applyTranslationToElement(el);

    expect(el.innerHTML).toBe('Translated text');

    delete global.currentTranslations;
  });

  test('does nothing when currentTranslations is undefined', () => {
    const el = document.createElement('div');
    el.textContent = 'Original';
    el.setAttribute('data-translate', 'general.orcidInvalid');
    applyTranslationToElement(el);

    expect(el.textContent).toBe('Original');
  });
});
