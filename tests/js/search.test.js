const fs = require('fs');
const path = require('path');

describe('search.js', () => {
  let markInstance;
  beforeEach(() => {
    markInstance = {
      unmark: jest.fn(({ done }) => { if (done) done(); }),
      mark: jest.fn(),
    };
    global.Mark = jest.fn(() => markInstance);
  });

  afterEach(() => {
    delete global.Mark;
  });

  function loadScript(html = '<input id="help-search" /><button id="help-search-btn"></button>') {
    document.body.innerHTML = html;
    const script = fs.readFileSync(path.resolve(__dirname, '../../doc/search.js'), 'utf8');
    window.eval(script);
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }

  test('does nothing if search input is missing', () => {
    loadScript('');
    expect(global.Mark).not.toHaveBeenCalled();
  });

  test('marks term when input is provided', () => {
    loadScript();
    const input = document.getElementById('help-search');
    input.value = 'term';
    input.dispatchEvent(new Event('input'));

    expect(markInstance.unmark).toHaveBeenCalled();
    expect(markInstance.mark).toHaveBeenCalledWith('term', { separateWordSearch: false });
  });

  test('does not mark when input is empty', () => {
    loadScript();
    const input = document.getElementById('help-search');
    input.value = '   ';
    input.dispatchEvent(new Event('input'));

    expect(markInstance.unmark).toHaveBeenCalled();
    expect(markInstance.mark).not.toHaveBeenCalled();
  });

  test('marks term when search button is clicked', () => {
    loadScript();
    const input = document.getElementById('help-search');
    const button = document.getElementById('help-search-btn');
    input.value = 'button';
    button.click();

    expect(markInstance.unmark).toHaveBeenCalled();
    expect(markInstance.mark).toHaveBeenCalledWith('button', { separateWordSearch: false });
  });
});