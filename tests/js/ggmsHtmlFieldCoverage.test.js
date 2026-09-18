/**
 * Metatest: GGM HTML form field ids stay discoverable and Playwright specs
 * do not keep stale GGM `#id` selectors.
 *
 * Roundtrip coverage is not measured here. The ICGEM Step 4 ingest ledger
 * records which HTML ids actually received values after re-upload.
 *
 * Fails when:
 *  - GGM formgroup HTML cannot be scanned for input/select/textarea ids
 *  - a GGM field selector remains in the roundtrip or clear spec after the
 *    HTML id was removed
 */

const {
  GGM_FORMGROUP_FILES,
  getGgmsHtmlFieldIds,
  getGgmsCoverageSelectorIds,
} = require('../helpers/ggmsFormFields.cjs');

describe('GGM HTML ↔ Playwright field coverage metatest', () => {
  const htmlIds = getGgmsHtmlFieldIds();
  const { byFile } = getGgmsCoverageSelectorIds();

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
  // checks that the input selectors used in the icgem-roundtrip.spec.ts
  // and elmogem-clear.spec.ts are in sync with the HTML formgroups.
  // Fails when: an id changes without a change in the test spec
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


});
