const fs = require('fs');
const path = require('path');

describe('search.js', () => {
  let markInstance;
  let createdMark;
  beforeEach(() => {
    createdMark = undefined;
    markInstance = {
      unmark: jest.fn(({ done }) => { if (done) done(); }),
      mark: jest.fn((term, opts) => {
        createdMark = document.createElement('mark');
        createdMark.scrollIntoView = jest.fn();
        document.body.appendChild(createdMark);
        if (opts && opts.done) opts.done();
      }),
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

  test('marks term when Enter is pressed', () => {
    loadScript();
    const input = document.getElementById('help-search');
    input.value = 'term';
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    input.dispatchEvent(event);

    expect(markInstance.unmark).toHaveBeenCalled();
    expect(markInstance.mark).toHaveBeenCalledWith('term', expect.objectContaining({
      separateWordSearch: false,
      done: expect.any(Function),
    }));
    const markEl = document.querySelector('mark');
    expect(markEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  test('does not mark when input is empty', () => {
    loadScript();
    const input = document.getElementById('help-search');
    input.value = '   ';
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    input.dispatchEvent(event);

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
    expect(markInstance.mark).toHaveBeenCalledWith('button', expect.objectContaining({
      separateWordSearch: false,
      done: expect.any(Function),
    }));
    const markEl2 = document.querySelector('mark');
    expect(markEl2.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });
});