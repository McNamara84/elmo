const { requireFresh } = require('./utils');

describe('helpMenu.js', () => {
  let offcanvasElement;
  let offcanvasInstance;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="offcanvasNavbar" class="offcanvas">
        <a href="#section1" class="nav-link">Section 1</a>
      </div>
      <div id="section1"></div>
    `;

    offcanvasElement = {
      addEventListener: jest.fn((event, handler) => { offcanvasElement.handler = handler; }),
      removeEventListener: jest.fn(),
    };
    offcanvasInstance = {
      _element: offcanvasElement,
      hide: jest.fn(),
    };
    global.bootstrap = {
      Offcanvas: { getInstance: jest.fn(() => offcanvasInstance) },
      ScrollSpy: jest.fn(),
    };

    requireFresh('../../doc/helpMenu.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    delete global.bootstrap;
  });

  test('initializes ScrollSpy on DOMContentLoaded', () => {
    expect(global.bootstrap.ScrollSpy).toHaveBeenCalledWith(document.body, { target: '#offcanvasNavbar', offset: 100 });
  });

  test('clicking nav link hides offcanvas and scrolls to section', () => {
    const link = document.querySelector('.nav-link');
    const target = document.getElementById('section1');
    target.scrollIntoView = jest.fn();

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(offcanvasInstance.hide).toHaveBeenCalled();
    expect(offcanvasElement.addEventListener).toHaveBeenCalledWith('hidden.bs.offcanvas', expect.any(Function));

    const handler = offcanvasElement.addEventListener.mock.calls[0][1];
    handler();

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    expect(offcanvasElement.removeEventListener).toHaveBeenCalledWith('hidden.bs.offcanvas', handler);
  });

  test('does nothing when no Offcanvas instance found', () => {
    global.bootstrap.Offcanvas.getInstance.mockReturnValue(null);
    const link = document.querySelector('.nav-link');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(offcanvasInstance.hide).toHaveBeenCalledTimes(0);
  });
});