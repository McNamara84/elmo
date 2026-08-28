const fs = require('fs');
const path = require('path');

/**
 * Shared helpers for GGM HTML ↔ Playwright coverage metatests.
 *
 * HTML formgroups are the source of truth for field ids. Playwright specs that
 * claim GGM coverage must reference every id, and must not reference stale ids.
 */

const REPO_ROOT = path.resolve(__dirname, '../..');

const GGM_FORMGROUP_FILES = [
  'formgroups/GGMsDefinition.html',
  'formgroups/GGMsProperties.html',
  'formgroups/GGMsModelTypes.html',
  'formgroups/GGMsDescriptions.html',
];

/** Playwright files that together must cover every GGM HTML field id. */
const GGM_COVERAGE_SPEC_FILES = [
  'tests/playwright/flows/icgem-roundtrip.spec.ts',
  'tests/playwright/formgroups/elmogem-specific/elmogem-clear.spec.ts',
  'tests/playwright/utils/flows.ts',
];

/**
 * Extract element ids from <input>, <select>, and <textarea> tags in HTML.
 * @param {string} html
 * @returns {string[]}
 */
function extractFieldIdsFromHtml(html) {
  const ids = new Set();
  const tagRe = /<(input|select|textarea)\b([^>]*)>/gi;
  let tagMatch;
  while ((tagMatch = tagRe.exec(html)) !== null) {
    const attrs = tagMatch[2];
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (idMatch) {
      ids.add(idMatch[1]);
    }
  }
  return [...ids].sort();
}

/**
 * Collect all GGM form field ids from the four HTML formgroups.
 * @param {string} [repoRoot=REPO_ROOT]
 * @returns {string[]}
 */
function getGgmsHtmlFieldIds(repoRoot = REPO_ROOT) {
  const ids = new Set();
  for (const rel of GGM_FORMGROUP_FILES) {
    const abs = path.join(repoRoot, rel);
    const html = fs.readFileSync(abs, 'utf8');
    for (const id of extractFieldIdsFromHtml(html)) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

/**
 * Extract CSS-id selectors (#foo) from a Playwright/TS/JS source string.
 * Also catches quoted selector fragments like '#input-model-type'.
 * @param {string} source
 * @returns {string[]}
 */
function extractCssIdsFromSource(source) {
  const ids = new Set();
  const re = /#([A-Za-z][\w-]*)/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    ids.add(match[1]);
  }
  return [...ids].sort();
}

/**
 * Collect CSS ids referenced by the GGM coverage Playwright sources.
 * @param {string} [repoRoot=REPO_ROOT]
 * @returns {{ byFile: Record<string, string[]>, all: string[] }}
 */
function getGgmsCoverageSelectorIds(repoRoot = REPO_ROOT) {
  const byFile = {};
  const all = new Set();
  for (const rel of GGM_COVERAGE_SPEC_FILES) {
    const abs = path.join(repoRoot, rel);
    const source = fs.readFileSync(abs, 'utf8');
    const ids = extractCssIdsFromSource(source);
    byFile[rel] = ids;
    for (const id of ids) {
      all.add(id);
    }
  }
  return { byFile, all: [...all].sort() };
}

module.exports = {
  REPO_ROOT,
  GGM_FORMGROUP_FILES,
  GGM_COVERAGE_SPEC_FILES,
  extractFieldIdsFromHtml,
  extractCssIdsFromSource,
  getGgmsHtmlFieldIds,
  getGgmsCoverageSelectorIds,
};
