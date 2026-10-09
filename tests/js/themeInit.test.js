const { createThemeController } = require('../../js/themeInit');
const fs = require('fs');
const path = require('path');

describe('shared theme controller', () => {
  let host, media, saved, listeners, controller;
  beforeEach(() => {
    saved = new Map();
    listeners = {};
    media = {
      matches: false,
      addEventListener: jest.fn((type, callback) => { listeners.system = callback; }),
      removeEventListener: jest.fn()
    };
    host = {
      document,
      localStorage: {
        getItem: jest.fn(key => saved.get(key) ?? null),
        setItem: jest.fn((key, value) => saved.set(key, value))
      },
      matchMedia: jest.fn(() => media),
      addEventListener: jest.fn((type, callback) => { listeners[type] = callback; }),
      removeEventListener: jest.fn()
    };
  });
  afterEach(() => controller?.destroy());
  const appearance = () => document.documentElement.dataset.bsTheme;
  function start() { controller = createThemeController(host); return controller; }
  function systemDark(value) { media.matches = value; listeners.system(); }

  test.each(['light', 'dark', 'auto'])('restores the saved %s choice before DOM readiness', choice => {
    saved.set('theme', choice);
    media.matches = true;
    start();
    expect(controller.getChoice()).toBe(choice);
    expect(appearance()).toBe(choice === 'light' ? 'light' : 'dark');
    expect(host.localStorage.setItem).not.toHaveBeenCalled();
  });
  test.each([null, 'unknown', '', 'DARK'])('uses Auto for invalid saved choice %s', choice => {
    saved.set('theme', choice);
    start();
    expect(controller.getChoice()).toBe('auto');
    expect(appearance()).toBe('light');
    systemDark(true);
    expect(appearance()).toBe('dark');
  });
  test('keeps Auto through reloads and changing system preferences', () => {
    start().setChoice('auto');
    systemDark(true);
    expect(saved.get('theme')).toBe('auto');
    controller.destroy();
    start();
    expect(appearance()).toBe('dark');
    systemDark(false);
    expect(appearance()).toBe('light');
    expect(saved.get('theme')).toBe('auto');
  });
  test.each(['light', 'dark'])('ignores system changes for explicit %s', choice => {
    start().setChoice(choice);
    systemDark(true);
    systemDark(false);
    expect(appearance()).toBe(choice);
  });
  test('notifies subscribers immediately and supports unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = start().subscribe(listener);
    expect(listener).toHaveBeenLastCalledWith('auto', 'light');
    controller.setChoice('dark');
    expect(listener).toHaveBeenLastCalledWith('dark', 'dark');
    unsubscribe();
    controller.setChoice('light');
    expect(listener).toHaveBeenCalledTimes(2);
  });
  test('syncs other tabs without writing the received choice back', () => {
    start();
    listeners.storage({ key: 'theme', newValue: 'dark', storageArea: host.localStorage });
    expect(appearance()).toBe('dark');
    expect(controller.getChoice()).toBe('dark');
    listeners.storage({ key: 'theme', newValue: null });
    expect(controller.getChoice()).toBe('auto');
    listeners.storage({ key: null });
    expect(controller.getChoice()).toBe('auto');
    expect(host.localStorage.setItem).not.toHaveBeenCalled();
  });
  test('ignores unrelated storage and sessionStorage events', () => {
    start();
    listeners.storage({ key: 'language', newValue: 'dark' });
    listeners.storage({ key: 'theme', newValue: 'dark', storageArea: {} });
    expect(controller.getChoice()).toBe('auto');
  });
  test('works when reading and writing storage throws', () => {
    Object.defineProperty(host, 'localStorage', { get() { throw new Error('blocked'); } });
    start().setChoice('dark');
    expect(appearance()).toBe('dark');
    expect(() => listeners.storage({ key: 'theme', newValue: 'light', storageArea: {} })).not.toThrow();
    expect(appearance()).toBe('dark');
  });
  test.each(['missing', 'throws'])('falls back to light with %s matchMedia', behavior => {
    host.matchMedia = behavior === 'missing' ? undefined : () => { throw new Error('unavailable'); };
    start();
    expect(appearance()).toBe('light');
    controller.setChoice('dark');
    expect(appearance()).toBe('dark');
  });
  test('supports legacy media listeners and removes all listeners on destroy', () => {
    delete media.addEventListener;
    delete media.removeEventListener;
    media.addListener = jest.fn(callback => { listeners.system = callback; });
    media.removeListener = jest.fn();
    start();
    systemDark(true);
    expect(appearance()).toBe('dark');
    controller.destroy();
    expect(media.removeListener).toHaveBeenCalledWith(listeners.system);
    expect(host.removeEventListener).toHaveBeenCalledWith('storage', listeners.storage);
  });
  test('removes modern media listeners', () => {
    start().destroy();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', listeners.system);
  });
  test('initializes the browser controller immediately without a menu', () => {
    localStorage.setItem('theme', 'dark');
    window.eval(fs.readFileSync(path.resolve(__dirname, '../../js/themeInit.js'), 'utf8'));
    expect(window.elmoTheme.getChoice()).toBe('dark');
    expect(appearance()).toBe('dark');
    window.elmoTheme.destroy();
    delete window.elmoTheme;
    localStorage.clear();
  });
});
