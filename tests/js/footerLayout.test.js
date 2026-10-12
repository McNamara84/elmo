const { initFooterLayout } = require('../../js/footerLayout');
describe('fixed footer spacing', () => {
  let host, callback, resize, mutation, cleanup, height;
  beforeEach(() => {
    height = 130.3;
    document.body.innerHTML = '<footer class="fixed-bottom"></footer>';
    document.documentElement.style.removeProperty('--elmo-fixed-footer-height');
    document.querySelector('footer').getBoundingClientRect = () => ({ height });
    resize = { observe: jest.fn(), disconnect: jest.fn() };
    mutation = { observe: jest.fn(), disconnect: jest.fn() };
    host = {
      document,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      ResizeObserver: jest.fn(function (fn) { callback = fn; return resize; }),
      MutationObserver: jest.fn(function (fn) { callback = fn; return mutation; })
    };
  });
  afterEach(() => { cleanup?.(); cleanup = null; });
  const spacing = () => document.documentElement.style.getPropertyValue('--elmo-fixed-footer-height');
  test('measures immediately and updates after the footer wraps', () => {
    cleanup = initFooterLayout(host);
    expect(spacing()).toBe('131px');
    expect(resize.observe).toHaveBeenCalledWith(document.querySelector('footer'));
    height = 278;
    callback();
    expect(spacing()).toBe('278px');
  });
  test('does not repeat unchanged style writes', () => {
    cleanup = initFooterLayout(host);
    const write = jest.spyOn(document.documentElement.style, 'setProperty');
    callback();
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
  test('uses mutations and window resize without ResizeObserver', () => {
    delete host.ResizeObserver;
    cleanup = initFooterLayout(host);
    expect(mutation.observe).toHaveBeenCalled();
    height = 300;
    callback();
    expect(spacing()).toBe('300px');
    expect(host.addEventListener).toHaveBeenCalledWith('resize', callback);
  });
  test('works with window resize alone', () => {
    delete host.ResizeObserver;
    delete host.MutationObserver;
    cleanup = initFooterLayout(host);
    expect(spacing()).toBe('131px');
    height = 200;
    host.addEventListener.mock.calls[0][1]();
    expect(spacing()).toBe('200px');
  });
  test('keeps the CSS fallback when the footer has no layout', () => {
    height = 0;
    cleanup = initFooterLayout(host);
    expect(spacing()).toBe('');
  });
  test('does nothing on pages without a fixed footer', () => {
    document.body.innerHTML = '';
    expect(initFooterLayout(host)).toBeNull();
    expect(host.addEventListener).not.toHaveBeenCalled();
  });
  test('disconnects observers and ignores later callbacks', () => {
    cleanup = initFooterLayout(host);
    cleanup();
    expect(resize.disconnect).toHaveBeenCalled();
    expect(host.removeEventListener).toHaveBeenCalledWith('resize', callback);
    height = 400;
    callback();
    expect(spacing()).toBe('131px');
  });
  test('disconnects the fallback observer', () => {
    delete host.ResizeObserver;
    cleanup = initFooterLayout(host);
    cleanup();
    expect(mutation.disconnect).toHaveBeenCalled();
  });
  test('remeasures when web fonts finish loading', async () => {
    const ready = { then: jest.fn() };
    host.document = {
      querySelector: document.querySelector.bind(document),
      documentElement: document.documentElement,
      fonts: { ready }
    };
    cleanup = initFooterLayout(host);
    height = 180;
    ready.then.mock.calls[0][0]();
    expect(spacing()).toBe('180px');
  });
});
