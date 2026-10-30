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

const FULL_KEYWORDS_IMPORT = /import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/thesauriHelpers\.js['"]\s*;?\s*/;
const THESAURUS_CONFIG_IMPORT = /import\s*\{\s*THESAURUS_CONFIG\s*\}\s*from\s*['"]\.\/thesaurusConfig\.js['"]\s*;?\s*/;
const THESAURUS_CONFIG_REEXPORT = /export\s*\{\s*THESAURUS_CONFIG\s*\}\s*;?\s*/;

/**
 * Strips ES module exports so thesauri.js can be eval'd in Jest (non-module) tests.
 * Inlines js/thesauriHelpers.js because eval cannot resolve ESM imports.
 *
 * @param {string} source - Raw thesauri.js source.
 * @param {string} [extraExportEntries=''] - Additional properties for __thesauriTestExports.
 * @returns {string}
 */
function transformThesauriScript(source, extraExportEntries = '') {
  const helpersPath = path.resolve(__dirname, '../../js/thesauriHelpers.js');
  const helpers = fs.readFileSync(helpersPath, 'utf8')
    .replace(/\bexport function /g, 'function ')
    .replace(/\bexport const /g, 'const ')
    .replace(/\bexport let /g, 'let ')
    .replace(/\bexport default /g, '')
    .replace(/if \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*?\n\}/, '');

  const configPath = path.resolve(__dirname, '../../js/thesaurusConfig.js');
  const config = fs.readFileSync(configPath, 'utf8')
    .replace(/\bexport const /g, 'const ');

  let script = source
    .replace(FULL_KEYWORDS_IMPORT, '')
    .replace(THESAURUS_CONFIG_IMPORT, '')
    .replace(THESAURUS_CONFIG_REEXPORT, '')
    .replace(/\bexport function /g, 'function ')
    .replace(/\bexport const /g, 'const ')
    .replace(/\bexport let /g, 'let ')
    .replace(/\bexport default /g, '');

  script = helpers + '\n' + config + '\n' + script;

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
    'updateThesaurusKeywordCount',
    'bindKeywordCount',
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
