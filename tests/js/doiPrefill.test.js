const { requireFresh } = require('./utils');

let mod;

/** Minimal Tagify mock that tracks add/remove calls */
class MockTagify {
  constructor() {
    this.tags = [];
    this.removeAllTags = jest.fn(() => { this.tags = []; });
    this.addTags = jest.fn((tags) => { this.tags.push(...tags); });
  }
}

/** Attach a MockTagify to a DOM element */
function attachTagify(selector) {
  const el = document.querySelector(selector);
  if (el) el._tagify = new MockTagify();
  return el?._tagify;
}

function loadModule() {
  mod = requireFresh('../../js/doiPrefill');
}

describe('doiPrefill.js', () => {
  beforeEach(() => {
    // Minimal jQuery / DOM setup
    const $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    global.window = window;
    global.window.elmo = {};

    // Mock $.getJSON to return empty arrays (vocab lookups)
    $.getJSON = jest.fn(() => Promise.resolve([]));

    mod?._resetCaches?.();
    loadModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /* ── escapeHtml ─────────────────────────────────────────────── */

  describe('escapeHtml', () => {
    test('escapes angle brackets and ampersands', () => {
      expect(mod.escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert("xss")&lt;/script&gt;'
      );
    });

    test('passes through plain text unchanged', () => {
      expect(mod.escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  /* ── decodeHtmlEntities ─────────────────────────────────────── */

  describe('decodeHtmlEntities', () => {
    test('decodes &gt; and &lt; entities', () => {
      expect(mod.decodeHtmlEntities('EARTH SCIENCE &gt; SOLID EARTH &gt; GEODETICS')).toBe(
        'EARTH SCIENCE > SOLID EARTH > GEODETICS'
      );
    });

    test('decodes &amp; entity', () => {
      expect(mod.decodeHtmlEntities('A &amp; B')).toBe('A & B');
    });

    test('passes through plain text unchanged', () => {
      expect(mod.decodeHtmlEntities('Geophysics')).toBe('Geophysics');
    });
  });

  /* ── normalizeRole ──────────────────────────────────────────── */

  describe('normalizeRole', () => {
    test('inserts spaces between camelCase words', () => {
      expect(mod.normalizeRole('DataCollector')).toBe('Data Collector');
      expect(mod.normalizeRole('ProjectLeader')).toBe('Project Leader');
    });

    test('handles already-spaced input', () => {
      expect(mod.normalizeRole('Data Collector')).toBe('Data Collector');
    });

    test('handles empty/null input', () => {
      expect(mod.normalizeRole('')).toBe('');
      expect(mod.normalizeRole(null)).toBe('');
    });
  });

  /* ── mapTitleTypeFromJson ───────────────────────────────────── */

  describe('mapTitleTypeFromJson', () => {
    const mapping = { '': '1', MainTitle: '1', AlternativeTitle: '2', TranslatedTitle: '3' };

    test('maps known types', () => {
      expect(mod.mapTitleTypeFromJson('AlternativeTitle', mapping)).toBe('2');
    });

    test('maps empty to default', () => {
      expect(mod.mapTitleTypeFromJson('', mapping)).toBe('1');
      expect(mod.mapTitleTypeFromJson(null, mapping)).toBe('1');
    });

    test('falls back to default for unknown type', () => {
      expect(mod.mapTitleTypeFromJson('UnknownType', mapping)).toBe('1');
    });
  });

  /* ── prefillResourceInfo ────────────────────────────────────── */

  describe('prefillResourceInfo', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="input-resourceinformation-doi" />
        <input id="input-resourceinformation-publicationyear" />
        <input id="input-resourceinformation-version" />
        <select id="input-resourceinformation-resourcetype">
          <option value="1">Dataset</option>
          <option value="2">Software</option>
        </select>
      `;
    });

    test('fills DOI, year, and version fields', () => {
      mod.prefillResourceInfo({
        doi: '10.14454/qdd3-ps68',
        publicationYear: 2024,
        version: '2.0',
      });

      expect($('#input-resourceinformation-doi').val()).toBe('10.14454/qdd3-ps68');
      expect($('#input-resourceinformation-publicationyear').val()).toBe('2024');
      expect($('#input-resourceinformation-version').val()).toBe('2.0');
    });

    test('adds prefill-highlight class to version', () => {
      mod.prefillResourceInfo({ version: '1.0' });
      expect($('#input-resourceinformation-version').hasClass('prefill-highlight')).toBe(true);
    });

    test('selects matching resource type', () => {
      mod.prefillResourceInfo({ types: { resourceTypeGeneral: 'Software' } });
      expect($('#input-resourceinformation-resourcetype').val()).toBe('2');
    });

    test('handles empty attributes gracefully', () => {
      mod.prefillResourceInfo({});
      expect($('#input-resourceinformation-doi').val()).toBe('');
    });
  });

  /* ── prefillTitles ──────────────────────────────────────────── */

  describe('prefillTitles', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="row">
          <input name="title[]" value="" />
          <select id="input-resourceinformation-titletype">
            <option value="1">Main Title</option>
            <option value="2">Alternative Title</option>
          </select>
        </div>
        <button id="button-resourceinformation-addtitle"></button>
      `;
    });

    test('fills first title into existing row', async () => {
      await mod.prefillTitles([{ title: 'My Dataset', titleType: '' }]);
      expect($('input[name="title[]"]').first().val()).toBe('My Dataset');
    });

    test('handles null/undefined gracefully', async () => {
      await mod.prefillTitles(null);
      await mod.prefillTitles(undefined);
      await mod.prefillTitles([]);
      // No error thrown
    });
  });

  /* ── prefillCreators ────────────────────────────────────────── */

  describe('prefillCreators', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div data-creator-row>
          <input name="orcids[]" />
          <input name="familynames[]" />
          <input name="givennames[]" />
          <input name="personAffiliation[]" />
          <input name="authorPersonRorIds[]" />
          <input name="contacts[]" type="checkbox" />
          <div class="contact-person-input" style="display:none;">
            <input name="cpEmail[]" />
            <input name="cpOnlineResource[]" />
          </div>
        </div>
        <button id="button-author-add"></button>
        <div data-authorinstitution-row>
          <input name="authorinstitutionName[]" value="" />
          <input name="institutionAffiliation[]" />
          <input name="authorInstitutionRorIds[]" />
        </div>
        <button id="button-authorinstitution-add"></button>
      `;
    });

    test('fills person creator fields', () => {
      mod.prefillCreators([
        {
          givenName: 'Jane',
          familyName: 'Doe',
          nameType: 'Personal',
          nameIdentifiers: [
            { nameIdentifier: 'https://orcid.org/0000-0001-2345-6789', nameIdentifierScheme: 'ORCID' },
          ],
          affiliation: [{ name: 'GFZ', affiliationIdentifier: 'https://ror.org/04z8jg394' }],
        },
      ]);

      expect($('input[name="familynames[]"]').val()).toBe('Doe');
      expect($('input[name="givennames[]"]').val()).toBe('Jane');
      expect($('input[name="orcids[]"]').val()).toBe('0000-0001-2345-6789');
      expect($('input[name="authorPersonRorIds[]"]').val()).toBe('04z8jg394');
    });

    test('fills organizational creator', () => {
      mod.prefillCreators([
        {
          name: 'World Research Institute',
          nameType: 'Organizational',
          nameIdentifiers: [],
          affiliation: [],
        },
      ]);

      expect($('input[name="authorinstitutionName[]"]').val()).toBe('World Research Institute');
    });

    test('handles empty/null input gracefully', () => {
      mod.prefillCreators(null);
      mod.prefillCreators([]);
      expect($('input[name="familynames[]"]').val()).toBe('');
    });
  });

  /* ── prefillDescriptions ────────────────────────────────────── */

  describe('prefillDescriptions', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <textarea id="input-abstract"></textarea>
        <div id="collapse-abstract" class="collapse"></div>
        <textarea id="input-description-Methods"></textarea>
        <div id="collapse-description-Methods" class="collapse"></div>
      `;
    });

    test('fills abstract field', () => {
      mod.prefillDescriptions([{ descriptionType: 'Abstract', description: 'A test abstract.' }]);
      expect($('#input-abstract').val()).toBe('A test abstract.');
      expect($('#collapse-abstract').hasClass('show')).toBe(true);
    });

    test('fills Methods description', () => {
      mod.prefillDescriptions([{ descriptionType: 'Methods', description: 'Used method X.' }]);
      expect($('#input-description-Methods').val()).toBe('Used method X.');
    });

    test('handles empty array', () => {
      mod.prefillDescriptions([]);
      expect($('#input-abstract').val()).toBe('');
    });
  });

  /* ── prefillDates ───────────────────────────────────────────── */

  describe('prefillDates', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input name="dateCreated" />
        <input name="dateEmbargo" />
      `;
    });

    test('fills Created and Available dates', () => {
      mod.prefillDates([
        { dateType: 'Created', date: '2024-06-15T00:00:00Z' },
        { dateType: 'Available', date: '2025-01-01' },
      ]);

      expect($('input[name="dateCreated"]').val()).toBe('2024-06-15');
      expect($('input[name="dateEmbargo"]').val()).toBe('2025-01-01');
    });

    test('ignores unknown date types', () => {
      mod.prefillDates([{ dateType: 'Submitted', date: '2024-01-01' }]);
      expect($('input[name="dateCreated"]').val()).toBe('');
    });
  });

  /* ── prefillGeoLocations ────────────────────────────────────── */

  describe('prefillGeoLocations', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div tsc-row tsc-row-id="0">
          <textarea name="tscDescription[]"></textarea>
          <input name="tscLatitudeMin[]" />
          <input name="tscLatitudeMax[]" />
          <input name="tscLongitudeMin[]" />
          <input name="tscLongitudeMax[]" />
        </div>
        <button id="button-stc-add"></button>
      `;
    });

    test('fills bounding box', () => {
      mod.prefillGeoLocations([
        {
          geoLocationPlace: 'Berlin',
          geoLocationBox: {
            southBoundLatitude: 52.3,
            northBoundLatitude: 52.7,
            westBoundLongitude: 13.1,
            eastBoundLongitude: 13.6,
          },
        },
      ]);

      expect($('textarea[name="tscDescription[]"]').val()).toBe('Berlin');
      expect($('input[name="tscLatitudeMin[]"]').val()).toBe('52.3');
      expect($('input[name="tscLatitudeMax[]"]').val()).toBe('52.7');
    });

    test('fills point as equal min/max coordinates', () => {
      mod.prefillGeoLocations([
        {
          geoLocationPoint: { pointLatitude: 48.8566, pointLongitude: 2.3522 },
        },
      ]);

      expect($('input[name="tscLatitudeMin[]"]').val()).toBe('48.8566');
      expect($('input[name="tscLatitudeMax[]"]').val()).toBe('48.8566');
      expect($('input[name="tscLongitudeMin[]"]').val()).toBe('2.3522');
      expect($('input[name="tscLongitudeMax[]"]').val()).toBe('2.3522');
    });
  });

  /* ── prefillKeywords ────────────────────────────────────────── */

  describe('prefillKeywords', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="input-freekeyword" />
        <input id="input-sciencekeyword" />
      `;
      attachTagify('#input-freekeyword');
      attachTagify('#input-sciencekeyword');
    });

    test('routes subjects to free keywords by default', () => {
      mod.prefillKeywords([{ subject: 'Geophysics' }]);

      const tagify = document.querySelector('#input-freekeyword')._tagify;
      expect(tagify.addTags).toHaveBeenCalled();
      expect(tagify.tags).toEqual(
        expect.arrayContaining([expect.objectContaining({ value: 'Geophysics' })])
      );
    });

    test('routes GCMD keywords to sciencekeyword tagify', () => {
      mod.prefillKeywords([
        {
          subject: 'Earth Science',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
          subjectScheme: 'GCMD',
          valueURI: 'https://gcmd.nasa.gov/earth',
        },
      ]);

      const tagify = document.querySelector('#input-sciencekeyword')._tagify;
      expect(tagify.addTags).toHaveBeenCalledWith([
        expect.objectContaining({ value: 'Earth Science' }),
      ]);
    });

    test('handles empty subjects', () => {
      mod.prefillKeywords([]);
      const tagify = document.querySelector('#input-freekeyword')._tagify;
      expect(tagify.addTags).not.toHaveBeenCalled();
    });

    test('decodes HTML entities in keyword values', () => {
      mod.prefillKeywords([
        { subject: 'EARTH SCIENCE &gt; SOLID EARTH &gt; GEODETICS' },
      ]);

      const tagify = document.querySelector('#input-freekeyword')._tagify;
      expect(tagify.addTags).toHaveBeenCalledWith([
        expect.objectContaining({ value: 'EARTH SCIENCE > SOLID EARTH > GEODETICS' }),
      ]);
    });
  });

  /* ── prefillFunding ─────────────────────────────────────────── */

  describe('prefillFunding', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="row">
          <input name="funder[]" />
          <input name="funderId[]" />
          <input name="funderidtyp[]" />
          <input name="grantNummer[]" />
          <input name="grantName[]" />
          <input name="awardURI[]" />
        </div>
        <button id="button-fundingreference-add"></button>
      `;
    });

    test('fills funding reference fields', () => {
      mod.prefillFunding([
        {
          funderName: 'DFG',
          funderIdentifier: 'https://doi.org/10.13039/501100001659',
          funderIdentifierType: 'Crossref Funder ID',
          awardNumber: 'ABC-123',
          awardTitle: 'Test Project',
          awardURI: 'https://example.org/award',
        },
      ]);

      expect($('input[name="funder[]"]').val()).toBe('DFG');
      expect($('input[name="grantNummer[]"]').val()).toBe('ABC-123');
      expect($('input[name="grantName[]"]').val()).toBe('Test Project');
    });
  });

  /* ── prefillRelatedWorks ────────────────────────────────────── */

  describe('prefillRelatedWorks', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="row">
          <input name="rIdentifier[]" />
          <select name="rIdentifierType[]">
            <option value="DOI">DOI</option>
            <option value="URL">URL</option>
          </select>
          <select name="relation[]">
            <option value="1">IsCitedBy</option>
            <option value="2">Cites</option>
          </select>
        </div>
        <button id="button-relatedwork-add"></button>
      `;
      window.ELMO_FEATURES = {};
    });

    test('fills related identifier fields', () => {
      mod.prefillRelatedWorks([
        {
          relatedIdentifier: '10.1234/related',
          relatedIdentifierType: 'DOI',
          relationType: 'IsCitedBy',
        },
      ]);

      expect($('input[name="rIdentifier[]"]').val()).toBe('10.1234/related');
      expect($('select[name="rIdentifierType[]"]').val()).toBe('DOI');
    });

    test('handles empty array gracefully', () => {
      mod.prefillRelatedWorks([]);
      expect($('input[name="rIdentifier[]"]').val()).toBe('');
    });
  });

  /* ── prefillRights ──────────────────────────────────────────── */

  describe('prefillRights', () => {
    beforeEach(() => {
      document.body.innerHTML = '<select id="input-rights-license"><option value="">--</option><option value="1">CC BY 4.0</option></select>';
      mod._resetCaches();
    });

    test('matches license case-insensitively (DataCite lowercase vs ELMO uppercase)', async () => {
      // Simulate ELMO DB: keys are uppercase
      $.getJSON = jest.fn().mockResolvedValue([
        { rights_id: 1, rightsIdentifier: 'CC-BY-4.0', text: 'CC BY 4.0' },
      ]);

      // DataCite returns lowercase
      await mod.prefillRights([
        { rightsIdentifier: 'cc-by-4.0', rights: 'Creative Commons Attribution 4.0 International' },
      ]);

      expect($('#input-rights-license').val()).toBe('1');
    });

    test('matches license with exact case', async () => {
      $.getJSON = jest.fn().mockResolvedValue([
        { rights_id: 1, rightsIdentifier: 'CC-BY-4.0', text: 'CC BY 4.0' },
      ]);

      await mod.prefillRights([
        { rightsIdentifier: 'CC-BY-4.0', rights: 'Creative Commons Attribution 4.0 International' },
      ]);

      expect($('#input-rights-license').val()).toBe('1');
    });

    test('handles empty rightsList gracefully', async () => {
      await mod.prefillRights([]);
      expect($('#input-rights-license').val()).toBe('');
    });
  });

  /* ── buildPrefillPreview ────────────────────────────────────── */

  describe('buildPrefillPreview', () => {
    test('renders title and authors in preview table', () => {
      const html = mod.buildPrefillPreview({
        titles: [{ title: 'Test Dataset' }],
        creators: [
          { familyName: 'Doe', givenName: 'Jane' },
          { familyName: 'Smith', givenName: 'John' },
        ],
        publicationYear: 2024,
        types: { resourceTypeGeneral: 'Dataset' },
        rightsList: [{ rights: 'CC BY 4.0', rightsIdentifier: 'CC-BY-4.0' }],
      });

      expect(html).toContain('Test Dataset');
      expect(html).toContain('Doe, Jane');
      expect(html).toContain('Smith, John');
      expect(html).toContain('2024');
      expect(html).toContain('Dataset');
      expect(html).toContain('CC BY 4.0');
    });

    test('truncates long author lists', () => {
      const html = mod.buildPrefillPreview({
        titles: [],
        creators: [
          { familyName: 'A', givenName: 'A' },
          { familyName: 'B', givenName: 'B' },
          { familyName: 'C', givenName: 'C' },
          { familyName: 'D', givenName: 'D' },
          { familyName: 'E', givenName: 'E' },
        ],
      });

      expect(html).toContain('(+2)');
    });

    test('escapes HTML in preview', () => {
      const html = mod.buildPrefillPreview({
        titles: [{ title: '<script>alert(1)</script>' }],
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  /* ── applyDoiPrefill (integration) ──────────────────────────── */

  describe('applyDoiPrefill', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="input-resourceinformation-doi" />
        <input id="input-resourceinformation-publicationyear" />
        <input id="input-resourceinformation-version" />
        <input id="input-resourceinformation-language" />
        <select id="input-resourceinformation-resourcetype">
          <option value="1">Dataset</option>
        </select>
        <div class="row">
          <input name="title[]" />
          <select id="input-resourceinformation-titletype">
            <option value="1">Main Title</option>
          </select>
        </div>
        <div data-creator-row>
          <input name="orcids[]" />
          <input name="familynames[]" />
          <input name="givennames[]" />
          <input name="personAffiliation[]" />
          <input name="authorPersonRorIds[]" />
          <input name="contacts[]" type="checkbox" />
          <div class="contact-person-input"><input name="cpEmail[]" /><input name="cpOnlineResource[]" /></div>
        </div>
        <textarea id="input-abstract"></textarea>
        <div id="collapse-abstract" class="collapse"></div>
        <input name="dateCreated" />
        <input id="input-freekeyword" />
        <input id="input-rights-license" />
      `;

      attachTagify('#input-freekeyword');

      // Mock clearInputFields
      global.clearInputFields = jest.fn();
    });

    test('applies all attributes to form fields', async () => {
      await mod.applyDoiPrefill({
        doi: '10.14454/qdd3-ps68',
        publicationYear: 2024,
        version: '1.0',
        titles: [{ title: 'Test' }],
        creators: [{ familyName: 'Doe', givenName: 'Jane', nameType: 'Personal', nameIdentifiers: [], affiliation: [] }],
        contributors: [],
        descriptions: [{ descriptionType: 'Abstract', description: 'Test abstract' }],
        dates: [{ dateType: 'Created', date: '2024-01-15' }],
        geoLocations: [],
        subjects: [{ subject: 'Test Keyword' }],
        relatedIdentifiers: [],
        fundingReferences: [],
        rightsList: [],
      });

      expect(global.clearInputFields).toHaveBeenCalled();
      expect($('#input-resourceinformation-doi').val()).toBe('10.14454/qdd3-ps68');
      expect($('input[name="familynames[]"]').val()).toBe('Doe');
      expect($('#input-abstract').val()).toBe('Test abstract');
      expect($('input[name="dateCreated"]').val()).toBe('2024-01-15');
    });
  });
});
