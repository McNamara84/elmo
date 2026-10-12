const { createThemeController } = require('../../js/themeInit');
const { initThemeMenu } = require('../../js/darkmode');

describe('theme menu integration', () => {
  let controller;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div><button id="bd-theme"></button>' +
      ['auto', 'light', 'dark'].map(value =>
        '<button class="dropdown-item" data-bs-theme-value="' + value + '"></button>').join('') + '</div>';
    controller = createThemeController(window);
    initThemeMenu(document, controller);
  });
  afterEach(() => controller.destroy());
  function active() { return document.querySelector('.active')?.dataset.bsThemeValue; }
  test('shows Auto when no choice was saved', () => {
    expect(active()).toBe('auto');
    expect(localStorage.getItem('theme')).toBeNull();
  });
  test.each(['light', 'dark', 'auto'])('stores the %s choice on click', choice => {
    document.querySelector('[data-bs-theme-value="' + choice + '"]').click();
    expect(localStorage.getItem('theme')).toBe(choice);
    expect(active()).toBe(choice);
    expect(document.querySelectorAll('.active')).toHaveLength(1);
  });
  test('updates the menu when another page changes the theme', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark', storageArea: localStorage }));
    expect(active()).toBe('dark');
    expect(document.documentElement.dataset.bsTheme).toBe('dark');
  });
  test('works without a menu or controller', () => {
    document.body.innerHTML = '';
    expect(() => initThemeMenu(document, controller)).not.toThrow();
    document.body.innerHTML = '<button id="bd-theme"></button>';
    expect(() => initThemeMenu(document, null)).not.toThrow();
  });
});
