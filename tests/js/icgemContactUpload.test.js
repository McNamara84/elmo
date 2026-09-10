/**
 * @jest-environment jsdom
 *
 * Unit tests for populateIcgemContactPersons().
 * Verifies that when an ICGEM XML envelope is uploaded, the contact person
 * email and website are read from dace:nameIdentifier elements inside
 * grav:globalGravityProduct, the contact-person checkbox is checked, the
 * hidden .contact-person-input fields are made visible, and the values are
 * written into the correct form inputs.
 */

describe('populateIcgemContactPersons', () => {
  let icgemModule;
  let $;

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  /** Build the author-group DOM. Each entry in `authors` is { familyname, givenname }. */
  function buildAuthorDom(authors) {
    const rows = authors.map((a, i) => `
      <div class="row" data-creator-row>
        <input type="checkbox" id="checkbox-author-contactperson${i > 0 ? '-' + i : ''}"
               name="contacts[]" />
        <input type="text" name="familynames[]" value="${a.familyname}" />
        <input type="text" name="givennames[]"  value="${a.givenname}"  />
        <input type="text" name="orcids[]"      value=""                />
        <div class="contact-person-input" style="display: none;">
          <input type="email" name="cpEmail[]"          value="" />
        </div>
        <div class="contact-person-input" style="display: none;">
          <input type="text"  name="cpOnlineResource[]" value="" />
        </div>
      </div>
    `).join('');

    document.body.innerHTML = `
      <div id="group-author">
        ${rows}
        <button type="button" id="button-author-add"></button>
      </div>
    `;

    // Minimal add-row handler so the module can create new rows if needed
    $('#button-author-add').on('click', function () {
      $('#group-author').append(`
        <div class="row" data-creator-row>
          <input type="checkbox" name="contacts[]" />
          <input type="text"  name="familynames[]"      value="" />
          <input type="text"  name="givennames[]"       value="" />
          <input type="text"  name="orcids[]"           value="" />
          <div class="contact-person-input" style="display: none;">
            <input type="email" name="cpEmail[]"          value="" />
          </div>
          <div class="contact-person-input" style="display: none;">
            <input type="text"  name="cpOnlineResource[]" value="" />
          </div>
        </div>
      `);
    });
  }

  // ─── XML helpers ──────────────────────────────────────────────────────────

  // JSDOM XPath matches namespace prefixes by name, not URI.
  // Resolver maps 'icgv' → ICGEM NS and 'dc' → DataCite NS.
  // Test XML must use those exact prefixes. Real-world grav:/dace: is covered by Playwright.
  const ICGEM_NS = 'http://icgem.gfz.de/schema';
  const DACE_NS  = 'http://datacite.org/schema/kernel-4';

  /**
   * Build a minimal ICGEM envelope for testing populateIcgemContactPersons.
   *
   * Contact person names come from dc:resource/dc:contributors (DataCite, for row
   * matching). Contact email and website come from icgv:globalGravityProduct/icgv:contact
   * (addresses and onlineResources, positionally aligned with contributors).
   *
   * Note: email is NOT NULL in the DB, so every contact person always contributes
   * exactly one icgv:address. icgv:onlineResource is only emitted when a website exists,
   * so position[i] of onlineResource corresponds to the i-th person who has a website.
   * Tests use cases where all persons either all have or all lack websites to avoid the
   * positional-mismatch edge case.
   *
   * @param {Array<{familyName, givenName, email?, website?}>} contacts
   */
  function makeIcgemXml(contacts) {
    const contributors = contacts.map(c => `
      <dc:contributor contributorType="ContactPerson">
        <dc:contributorName>${c.givenName} ${c.familyName}</dc:contributorName>
        <dc:givenName>${c.givenName}</dc:givenName>
        <dc:familyName>${c.familyName}</dc:familyName>
      </dc:contributor>
    `).join('');

    // Addresses and onlineResources in positional order (one per person).
    const contactChildren = contacts.map(c => {
      let s = '';
      if (c.email)   s += `<icgv:address>${c.email}</icgv:address>\n          `;
      if (c.website) s += `<icgv:onlineResource>${c.website}</icgv:onlineResource>\n          `;
      return s;
    }).join('');

    return new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <icgv:envelope xmlns:icgv="${ICGEM_NS}" xmlns:dc="${DACE_NS}">
        <dc:resource>
          <dc:contributors>
            ${contributors}
          </dc:contributors>
        </dc:resource>
        <icgv:globalGravityProduct>
          <icgv:contact>
            ${contactChildren}
          </icgv:contact>
        </icgv:globalGravityProduct>
      </icgv:envelope>`, 'application/xml');
  }

  // ─── Setup / teardown ─────────────────────────────────────────────────────

  beforeEach(() => {
    $ = require('jquery');
    global.$       = $;
    global.jQuery  = $;
    window.$       = $;
    window.jQuery  = $;

    jest.resetModules();
    icgemModule = require('../../js/mappingXmlToInputFieldsIcgem.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
  });

  // ─── Tests ────────────────────────────────────────────────────────────────

  test('populates email for matching author row', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    expect($row.find('input[name="cpEmail[]"]').val()).toBe('jane@example.com');
  });

  test('populates website for matching author row', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{
      familyName: 'Doe', givenName: 'Jane',
      email: 'jane@example.com', website: 'https://jane.example.com'
    }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    expect($row.find('input[name="cpOnlineResource[]"]').val()).toBe('https://jane.example.com');
  });

  test('checks the contact-person checkbox', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    expect($row.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('makes .contact-person-input visible', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    $row.find('.contact-person-input').each(function () {
      expect($(this).css('display')).not.toBe('none');
    });
  });

  test('does not touch non-matching author rows', () => {
    buildAuthorDom([
      { familyname: 'Doe',   givenname: 'Jane' },
      { familyname: 'Smith', givenname: 'John' },
    ]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $second = $('div[data-creator-row]').eq(1);
    expect($second.find('input[name="contacts[]"]').prop('checked')).toBe(false);
    expect($second.find('input[name="cpEmail[]"]').val()).toBe('');
  });

  test('matches names case-insensitively', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'DOE', givenName: 'JANE', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    expect($row.find('input[name="cpEmail[]"]').val()).toBe('jane@example.com');
  });

  test('handles multiple contact persons in the same XML', () => {
    buildAuthorDom([
      { familyname: 'Doe',   givenname: 'Jane' },
      { familyname: 'Smith', givenname: 'John' },
    ]);
    const xmlDoc = makeIcgemXml([
      { familyName: 'Doe',   givenName: 'Jane', email: 'jane@example.com', website: 'https://jane.example.com' },
      { familyName: 'Smith', givenName: 'John', email: 'john@example.com' },
    ]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $jane = $('div[data-creator-row]').eq(0);
    expect($jane.find('input[name="cpEmail[]"]').val()).toBe('jane@example.com');
    expect($jane.find('input[name="cpOnlineResource[]"]').val()).toBe('https://jane.example.com');

    const $john = $('div[data-creator-row]').eq(1);
    expect($john.find('input[name="cpEmail[]"]').val()).toBe('john@example.com');
    expect($john.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('skips contributor with no email and no website', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    // icgv:contact is present but empty — no icgv:address or icgv:onlineResource
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <icgv:envelope xmlns:icgv="${ICGEM_NS}" xmlns:dc="${DACE_NS}">
        <dc:resource>
          <dc:contributors>
            <dc:contributor contributorType="ContactPerson">
              <dc:givenName>Jane</dc:givenName>
              <dc:familyName>Doe</dc:familyName>
            </dc:contributor>
          </dc:contributors>
        </dc:resource>
        <icgv:globalGravityProduct>
          <icgv:contact></icgv:contact>
        </icgv:globalGravityProduct>
      </icgv:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    // Contributor was skipped — checkbox stays unchecked, email stays empty
    expect($row.find('input[name="contacts[]"]').prop('checked')).toBe(false);
    expect($row.find('input[name="cpEmail[]"]').val()).toBe('');
  });

  test('does nothing when globalGravityProduct is absent', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <dc:resource xmlns:dc="${DACE_NS}">
        <dc:contributors>
          <dc:contributor contributorType="ContactPerson">
            <dc:givenName>Jane</dc:givenName>
            <dc:familyName>Doe</dc:familyName>
          </dc:contributor>
        </dc:contributors>
      </dc:resource>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    // No globalGravityProduct → nothing populated
    const $row = $('div[data-creator-row]').eq(0);
    expect($row.find('input[name="cpEmail[]"]').val()).toBe('');
  });

  test('only populates email when website is absent', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    expect($row.find('input[name="cpEmail[]"]').val()).toBe('jane@example.com');
    expect($row.find('input[name="cpOnlineResource[]"]').val()).toBe('');
  });

  test('only populates website when email is absent', () => {
    buildAuthorDom([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', website: 'https://jane.example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const $row = $('div[data-creator-row]').eq(0);
    expect($row.find('input[name="cpEmail[]"]').val()).toBe('');
    expect($row.find('input[name="cpOnlineResource[]"]').val()).toBe('https://jane.example.com');
    expect($row.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('warns and leaves authors untouched when grav:contact has no ContactPerson contributor', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    buildAuthorDom([
      { familyname: 'Dahle', givenname: 'Christoph' },
      { familyname: 'Flechtner', givenname: 'Frank' },
    ]);

    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <icgv:envelope xmlns:icgv="${ICGEM_NS}" xmlns:dc="${DACE_NS}">
        <dc:resource>
          <dc:creators>
            <dc:creator>
              <dc:creatorName nameType="Personal">Dahle, Christoph</dc:creatorName>
              <dc:givenName>Christoph</dc:givenName>
              <dc:familyName>Dahle</dc:familyName>
            </dc:creator>
            <dc:creator>
              <dc:creatorName nameType="Personal">Flechtner, Frank</dc:creatorName>
              <dc:givenName>Frank</dc:givenName>
              <dc:familyName>Flechtner</dc:familyName>
            </dc:creator>
          </dc:creators>
        </dc:resource>
        <icgv:globalGravityProduct>
          <icgv:contact>
            <icgv:address>gfz@gfz.de</icgv:address>
            <icgv:onlineResource>knowledge.de</icgv:onlineResource>
          </icgv:contact>
        </icgv:globalGravityProduct>
      </icgv:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(warn).toHaveBeenCalledWith("couldn't determine the contact person from metadata");
    $('div[data-creator-row]').each(function () {
      expect($(this).find('input[name="cpEmail[]"]').val()).toBe('');
      expect($(this).find('input[name="contacts[]"]').prop('checked')).toBe(false);
    });
    warn.mockRestore();
  });
});
