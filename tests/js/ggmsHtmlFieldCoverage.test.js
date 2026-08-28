/**
 * Metatest: GGM HTML form fields ↔ Playwright coverage stay in sync.
 *
 * Fails when:
 *  - a new input/select/textarea id is added to GGMs*.html but is not referenced
 *    by the ICGEM roundtrip suite, the clear spec, or fillGEM
 *  - a GGM field selector remains in those specs after the HTML id was removed
 *
 * The ICGEM roundtrip suite is the primary contract: every GGM field should be
 * driven by a reference XML fixture rather than by a bespoke fill-and-assert spec.
 */

const {
  GGM_FORMGROUP_FILES,
  GGM_COVERAGE_SPEC_FILES,
  getGgmsHtmlFieldIds,
  getGgmsCoverageSelectorIds,
} = require('../helpers/ggmsFormFields.cjs');

const ROUNDTRIP_SPEC = 'tests/playwright/flows/icgem-roundtrip.spec.ts';

describe('GGM HTML ↔ Playwright field coverage metatest', () => {
  const htmlIds = getGgmsHtmlFieldIds();
  const { byFile, all: coverageIds } = getGgmsCoverageSelectorIds();

  test('discovers field ids from all four GGM formgroups', () => {
    expect(GGM_FORMGROUP_FILES.length).toBe(4);
    expect(htmlIds.length).toBeGreaterThan(20);
    // Spot-check one id from each formgroup
    expect(htmlIds).toEqual(expect.arrayContaining([
      'input-model-type',           // Definition
      'input-tide-system',          // Properties
      'input-temporal-start',       // Model Types
      'input-abstract',             // Descriptions
    ]));
  });

  test('every HTML GGM field id is referenced by roundtrip, clear, or fillGEM', () => {
    const covered = new Set(coverageIds);
    const missing = htmlIds.filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  test('coverage specs do not reference stale GGM HTML field ids', () => {
    const htmlSet = new Set(htmlIds);
    const stale = [];

    for (const [rel, ids] of Object.entries(byFile)) {
      for (const id of ids) {
        // Only flag selectors that look like GGM form controls but are absent from HTML.
        // Non-GGM ids used in roundtrip (DOI, authors, …) are ignored.
        const looksLikeGgmControl =
          /^(input|select|checkbox)-(model|mathematical|file-format|celestial|tide|degree|errors|error-handling|radius|semimajor|second-variable|earth-gravity|static|temporal|time-variable|custom-frequency|release|topo|abstract|general-model|input-data|processing-procedures|specific-features|other)/.test(id)
          || htmlSet.has(id);

        if (looksLikeGgmControl && !htmlSet.has(id)) {
          stale.push(`${rel} → #${id}`);
        }
      }
    }

    expect(stale).toEqual([]);
  });

  test('the ICGEM roundtrip suite drives every GGM field', () => {
    // Selectors built by concatenation (e.g. `#select-topo-density${suffix}`)
    // only surface their common prefix, so accept a prefix match as coverage.
    const roundtripIds = byFile[ROUNDTRIP_SPEC];
    expect(Array.isArray(roundtripIds)).toBe(true);

    const missing = htmlIds.filter((id) => !roundtripIds.some(
      (referenced) => referenced === id || id.startsWith(`${referenced}-`),
    ));
    expect(missing).toEqual([]);
  });
});
