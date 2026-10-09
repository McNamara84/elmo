/* Keep the last form controls above the fixed footer, including wrapped translations. */
(function (root) {
  function initFooterLayout(host) {
    const doc = host.document;
    const footer = doc.querySelector('footer.fixed-bottom');
    if (!footer) return null;
    let disposed = false;
    function measure() {
      if (disposed) return;
      const height = Math.ceil(footer.getBoundingClientRect().height);
      if (height > 0) {
        const value = height + 'px';
        if (doc.documentElement.style.getPropertyValue('--elmo-fixed-footer-height') !== value) {
          doc.documentElement.style.setProperty('--elmo-fixed-footer-height', value);
        }
      }
    }
    const resizeObserver = typeof host.ResizeObserver === 'function'
      ? new host.ResizeObserver(measure) : null;
    const mutationObserver = !resizeObserver && typeof host.MutationObserver === 'function'
      ? new host.MutationObserver(measure) : null;
    if (resizeObserver) resizeObserver.observe(footer);
    if (mutationObserver) mutationObserver.observe(footer, {
      subtree: true, childList: true, characterData: true, attributes: true
    });
    host.addEventListener('resize', measure);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);
    measure();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      host.removeEventListener('resize', measure);
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initFooterLayout };
  } else if (root) {
    root.document.addEventListener('DOMContentLoaded', () => initFooterLayout(root));
  }
})(typeof window !== 'undefined' ? window : null);
