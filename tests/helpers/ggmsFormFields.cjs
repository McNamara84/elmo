const fs = require('fs');
const path = require('path');

/**
 * Shared helpers for GGM HTML field ids and Playwright selector hygiene.
 *
 * HTML formgroups are the source of truth for field ids. Roundtrip coverage is
 * measured at runtime in the ICGEM Step 4 ingest survivors (filled ids after
 * re-upload)
 */

const REPO_ROOT = path.resolve(__dirname, '../..');

const GGM_FORMGROUP_FILES = [
  'formgroups/ggms-definition.html',
  'formgroups/ggms-properties.html',
  'formgroups/GGMsModelTypes.html',
  'formgroups/ggms-data-sources.html',
  'formgroups/GGMsDescriptions.html',
];

/**
 * Playwright files scanned for stale GGM `#id` selectors.
 *
 * Roundtrip ingest coverage is recorded at Step 4, not from these strings.
 * The clear spec is listed because it asserts the reset state of the same
 * fields and so must not drift either.
 */
const GGM_COVERAGE_SPEC_FILES = [
  'tests/playwright/flows/elmogem-specific/icgem-roundtrip.spec.ts',
  'tests/playwright/flows/elmogem-specific/elmogem-clear.spec.ts',
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
 * Collect all GGM form field ids from the GGM HTML formgroups.
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

/**
 * HTML field ids that never received a value in the ingested set.
 * @param {string[]} htmlIds
 * @param {Iterable<string>} ingestedIds
 * @returns {string[]}
 */
function diffMissingHtmlIds(htmlIds, ingestedIds) {
  const ingested = ingestedIds instanceof Set ? ingestedIds : new Set(ingestedIds);
  return htmlIds.filter((id) => !ingested.has(id));
}
// only for use in playwright tests or other node--driven systems.
module.exports = {
  REPO_ROOT,
  GGM_FORMGROUP_FILES,
  GGM_COVERAGE_SPEC_FILES,
  extractFieldIdsFromHtml,
  extractCssIdsFromSource,
  getGgmsHtmlFieldIds,
  getGgmsCoverageSelectorIds,
  diffMissingHtmlIds,
};
