const path = require('path');

function requireFresh(relPath) {
  let mod;
  jest.isolateModules(() => {
    mod = require(path.resolve(__dirname, relPath));
  });
  return mod;
}

/**
 * Applies submit-only required fields for tests.
 * Mirrors the behavior of the real Submit handler.
 */
function simulateSubmitValidation(root = document) {
  root.querySelectorAll('.js-required-on-submit').forEach(el => {
    el.setAttribute('required', 'required');
  });
}

module.exports = { requireFresh, simulateSubmitValidation };
