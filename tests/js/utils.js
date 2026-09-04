const fs = require('fs');
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

const FULL_KEYWORDS_IMPORT = /import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/thesaurusFullKeywords\.js['"]\s*;?\s*/;

/**
 * Strips ES module exports so thesauri.js can be eval'd in Jest (non-module) tests.
 * Inlines js/thesaurusFullKeywords.js because eval cannot resolve ESM imports.
 *
 * @param {string} source - Raw thesauri.js source.
 * @param {string} [extraExportEntries=''] - Additional properties for __thesauriTestExports.
 * @returns {string}
 */
function transformThesauriScript(source, extraExportEntries = '') {
  const helpersPath = path.resolve(__dirname, '../../js/thesaurusFullKeywords.js');
  const helpers = fs.readFileSync(helpersPath, 'utf8')
    .replace(/\bexport function /g, 'function ')
    .replace(/\bexport const /g, 'const ')
    .replace(/\bexport let /g, 'let ')
    .replace(/\bexport default /g, '');

  let script = source
    .replace(FULL_KEYWORDS_IMPORT, '')
    .replace(/\bexport function /g, 'function ')
    .replace(/\bexport const /g, 'const ')
    .replace(/\bexport let /g, 'let ')
    .replace(/\bexport default /g, '');

  script = helpers + '\n' + script;

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

  if (/\bfunction waitForThesaurusVocabulary\b/.test(script)) {
    exportsList.push('waitForThesaurusVocabulary');
  }

  if (extraExportEntries) {
    exportsList.push(extraExportEntries);
  }

  script += `\nwindow.__thesauriTestExports = { ${exportsList.join(', ')} };`;
  return script;
}

module.exports = { requireFresh, simulateSubmitValidation, transformThesauriScript };
