const fs = require('fs');
const path = require('path');

describe('darkmode.js', () => {
  let prefersDark;
  let triggerMediaQueryChange;

  function loadScript() {
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/darkmode.js'),
      'utf8'
    );
    script = script.replace('document.addEventListener("DOMContentLoaded", function () {', '(function () {');
    script = script.replace(/\}\);\s*$/, '})();');
    window.eval(script);
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="dropdown">
        <button id="bd-theme"></button>
        <button class="dropdown-item" data-bs-theme-value="light"></button>
        <button class="dropdown-item" data-bs-theme-value="dark"></button>
        <button class="dropdown-item" data-bs-theme-value="auto"></button>
      </div>
    `;
    prefersDark = false;
    const listeners = new Set();
    const mediaQueryList = {
      media: '(prefers-color-scheme: dark)',
      get matches() {
        return prefersDark;
      },
      onchange: null,
      addEventListener: (_type, listener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        listeners.delete(listener);
      },
      addListener: (listener) => {
        listeners.add(listener);
      },
      removeListener: (listener) => {
        listeners.delete(listener);
      },
    };

    window.matchMedia = jest.fn().mockImplementation(() => mediaQueryList);

    triggerMediaQueryChange = (value) => {
      prefersDark = value;
      const event = { matches: value, media: mediaQueryList.media };

      listeners.forEach((listener) => {
        if (typeof listener === 'function') {
          listener(event);
        } else if (listener && typeof listener.handleEvent === 'function') {
          listener.handleEvent(event);
        }
      });

      if (typeof mediaQueryList.onchange === 'function') {
        mediaQueryList.onchange(event);
      }
    };
    localStorage.clear();
  });

  test('applies stored dark theme on load', () => {
    localStorage.setItem('theme', 'dark');
    loadScript();
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    const items = document.querySelectorAll('.dropdown-item');
    expect(items[1].classList.contains('active')).toBe(true);
  });

  test('defaults to light theme when system preference is light', () => {
    loadScript();
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    const items = document.querySelectorAll('.dropdown-item');
    expect(items[0].classList.contains('active')).toBe(true);
  });

  test('clicking dark item updates theme and localStorage', () => {
    loadScript();
    const darkItem = document.querySelector('.dropdown-item[data-bs-theme-value="dark"]');
    darkItem.dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    const items = document.querySelectorAll('.dropdown-item');
    expect(items[1].classList.contains('active')).toBe(true);
  });

  test('clicking auto selects system preference', () => {
    loadScript();
    prefersDark = true;
    const autoItem = document.querySelector('.dropdown-item[data-bs-theme-value="auto"]');
    autoItem.dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  test('auto mode updates when system preference changes', () => {
    loadScript();
    const autoItem = document.querySelector('.dropdown-item[data-bs-theme-value="auto"]');
    autoItem.dispatchEvent(new Event('click', { bubbles: true }));

    triggerMediaQueryChange(true);
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    triggerMediaQueryChange(false);
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});