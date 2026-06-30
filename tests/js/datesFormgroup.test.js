const fs = require('fs');
const path = require('path');

describe('dates formgroup', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../formgroups/dates.html'), 'utf8');
    document.body.innerHTML = html;
  });

  test('Date Created is optional and not a submit-only required field', () => {
    const input = document.getElementById('input-date-created');
    const label = document.querySelector('label[for="input-date-created"]');

    expect(input).not.toBeNull();
    expect(input.hasAttribute('required')).toBe(false);
    expect(input.classList.contains('js-required-on-submit')).toBe(false);
    expect(label.querySelector('.red-star')).toBeNull();
  });
});
