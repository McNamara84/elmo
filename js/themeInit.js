/* Apply the saved choice before styles load, also on pages without a theme menu. */
(function (root) {
  /** @typedef {'light'|'dark'|'auto'} ThemeChoice */
  /**
   * @typedef {Object} ThemeController
   * @property {function(): ThemeChoice} getChoice Read the selected mode, including Auto.
   * @property {function(string|null): void} setChoice Save and apply a mode; invalid values use Auto.
   * @property {function(function(ThemeChoice, string): void): function(): void} subscribe
   *   Notify a listener immediately and after each change; return an unsubscribe function.
   * @property {function(): void} destroy Remove browser listeners and subscribers.
   */

  /**
   * Apply the saved theme and follow system or same-origin tab changes.
   * Auto remains the stored choice while the displayed theme follows the system.
   * Blocked storage and unavailable system preferences fall back without throwing.
   * @param {Window} host Browser window whose document and preferences are used.
   * @returns {ThemeController} Controller shared by the editor and standalone Guide.
   */
  function createThemeController(host) {
    const normalize = value => ['light', 'dark', 'auto'].includes(value) ? value : 'auto';
    let media = null;
    try {
      media = typeof host.matchMedia === 'function'
        ? host.matchMedia('(prefers-color-scheme: dark)') : null;
    } catch (_) { /* Fall back to light when browser preferences are unavailable. */ }

    function readChoice() {
      try { return normalize(host.localStorage.getItem('theme')); }
      catch (_) { return 'auto'; }
    }

    let choice = readChoice();
    const subscribers = new Set();
    function apply() {
      const theme = choice === 'auto' ? (media && media.matches ? 'dark' : 'light') : choice;
      host.document.documentElement.setAttribute('data-bs-theme', theme);
      subscribers.forEach(listener => listener(choice, theme));
    }
    function setChoice(value) {
      choice = normalize(value);
      try { host.localStorage.setItem('theme', choice); }
      catch (_) { /* The current page still works with blocked browser storage. */ }
      apply();
    }
    function onSystemChange() {
      if (choice === 'auto') apply();
    }
    function onStorage(event) {
      if (event.key !== 'theme' && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== host.localStorage) return;
      } catch (_) { return; }
      choice = event.key === null ? 'auto' : normalize(event.newValue);
      apply();
    }
    if (media && typeof media.addEventListener === 'function') {
      media.addEventListener('change', onSystemChange);
    } else if (media && typeof media.addListener === 'function') {
      media.addListener(onSystemChange);
    }
    host.addEventListener('storage', onStorage);
    apply();
    return {
      getChoice: () => choice,
      setChoice,
      subscribe(listener) {
        subscribers.add(listener);
        listener(choice, host.document.documentElement.getAttribute('data-bs-theme'));
        return () => subscribers.delete(listener);
      },
      destroy() {
        host.removeEventListener('storage', onStorage);
        if (media && typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', onSystemChange);
        } else if (media && typeof media.removeListener === 'function') {
          media.removeListener(onSystemChange);
        }
        subscribers.clear();
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createThemeController };
  } else if (root) {
    root.elmoTheme = createThemeController(root);
  }
})(typeof window !== 'undefined' ? window : null);
