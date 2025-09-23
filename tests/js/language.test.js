const fs = require('fs');
const path = require('path');

describe('language.js accessibility integration', () => {
  let bootstrapTooltipMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <main id="main-content">
        <button id="tooltip-btn" data-bs-toggle="tooltip" title="Help"></button>
        <span data-translate="general.logoTitle"></span>
        <span data-translate-tooltip="general.help" data-bs-toggle="tooltip"></span>
      </main>
    `;

    global.resizeTitle = jest.fn();
    global.adjustButtons = jest.fn();

    const accessibilityScript = fs.readFileSync(path.resolve(__dirname, '../../js/accessibility.js'), 'utf8');
    window.eval(accessibilityScript);

    bootstrapTooltipMock = jest.fn(function TooltipMock(element, options = {}) {
      this.element = element;
      this.options = options;
      this.dispose = jest.fn();
    });
    bootstrapTooltipMock.getInstance = jest.fn(() => null);
    window.bootstrap = { Tooltip: bootstrapTooltipMock };

    const $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    $.getJSON = jest.fn(() => {
      const translations = {
        general: {
          logoTitle: 'ELMO',
          help: 'Help'
        }
      };

      const promise = Promise.resolve(translations);
      promise.fail = jest.fn(() => promise);

      return promise;
    });

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/language.js'), 'utf8');
    window.eval(script);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    window.setTranslations({ general: { logoTitle: 'ELMO', help: 'Help' } });
    window.applyTranslations();
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.bootstrap;
  });

  test('initialises tooltips within the main content container', () => {
    expect(bootstrapTooltipMock).toHaveBeenCalled();
    bootstrapTooltipMock.mock.calls.forEach(call => {
      const options = call[1] || {};
      expect(options.container).toBe(document.getElementById('main-content'));
    });
  });
});