const { updateActiveTheme } = require('../../js/darkmode');
describe('theme menu selection', () => {
  test.each(['light', 'dark', 'auto', 'unknown'])('marks only the %s choice', choice => {
    const items = ['light', 'dark', 'auto'].map(value => {
      const item = document.createElement('button');
      item.setAttribute('data-bs-theme-value', value);
      item.classList.add('active');
      return item;
    });
    updateActiveTheme(items, choice);
    items.forEach(item => {
      const active = item.dataset.bsThemeValue === choice;
      expect(item.classList.contains('active')).toBe(active);
      expect(item.getAttribute('aria-pressed')).toBe(String(active));
    });
  });
});
