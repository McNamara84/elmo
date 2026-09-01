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

/**
 * Strips ES module exports so thesauri.js can be eval'd in Jest (non-module) tests.
 *
 * @param {string} source - Raw thesauri.js source.
 * @param {string} [extraExportEntries=''] - Additional properties for __thesauriTestExports.
 * @returns {string}
 */
function transformThesauriScript(source, extraExportEntries = '') {
  let script = source
    .replace(/\bexport function /g, 'function ')
    .replace(/\bexport const /g, 'const ')
    .replace(/\bexport let /g, 'let ')
    .replace(/\bexport default /g, '');

  const exportsList = [
    'filterTreeByRoot',
    'THESAURUS_CONFIG',
    'initTagifyForInput',
    'cleanupTagifyForInput',
    'showLoadingSpinner',
    'hideLoadingSpinner',
    'loadThesaurusOnDemand',
    'loadKeywordsForConfig',
    'loadedConfigs',
    'handleTreeNodeActivation',
    'findNodeByPath',
  ];

  if (/\bfunction ensureThesaurusLoaded\b/.test(script)) {
    exportsList.push('ensureThesaurusLoaded');
  }

  if (extraExportEntries) {
    exportsList.push(extraExportEntries);
  }

  script += `\nwindow.__thesauriTestExports = { ${exportsList.join(', ')} };`;
  return script;
}

module.exports = { requireFresh, simulateSubmitValidation, transformThesauriScript };
