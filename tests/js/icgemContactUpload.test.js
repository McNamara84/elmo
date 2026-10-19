const { mountAuthorStack, mountContributorStack } = require('./utils/peopleStacks');

/**
 * @jest-environment jsdom
 *
 * Unit tests for populateIcgemContactPersons().
 * A named grav:contacts entry is matched to a contributor. An older grav:contact
 * list follows DataCite ContactPerson order. Author rows are left unchanged.
 */

describe('populateIcgemContactPersons', () => {
  let icgemModule;
  let $;

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  function buildAuthorDom(authors) {
    mountAuthorStack(authors.map(author => ({ type: 'person', ...author })));
  }

  function buildPeople(authors) {
    buildAuthorDom(authors);
    mountContributorStack(authors.map(author => ({
      type: 'person',
      ...author,
      roles: ['Contact Person'],
      affiliations: []
    })));
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

  function expectAuthorsUntouched() {
    $('div[data-creator-row]').each(function () {
      expect($(this).find('input[name="contacts[]"]').prop('checked')).toBe(false);
      expect($(this).find('input[name="cpEmail[]"]').val()).toBe('');
      expect($(this).find('input[name="cpOnlineResource[]"]').val()).toBe('');
    });
  }

  function contributorCard(index) {
    return $('[data-contributor-card]').eq(index);
  }

  test('populates email for the matching contributor and leaves the author unchanged', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(contributorCard(0).find('input[name="cbContactEmail[]"]').val()).toBe('jane@example.com');
    expectAuthorsUntouched();
  });

  test('populates website for the matching contributor', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{
      familyName: 'Doe', givenName: 'Jane',
      email: 'jane@example.com', website: 'https://jane.example.com'
    }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(contributorCard(0).find('input[name="cbContactWebsite[]"]').val()).toBe('https://jane.example.com');
    expectAuthorsUntouched();
  });

  test('does not check the author contact checkbox', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expectAuthorsUntouched();
    expect(contributorCard(0).find('[data-contributor-contact-fields]').hasClass('d-none')).toBe(false);
  });

  test('does not give the email to a different contributor', () => {
    buildPeople([
      { familyname: 'Doe', givenname: 'Jane' },
      { familyname: 'Smith', givenname: 'John' },
    ]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(contributorCard(1).find('input[name="cbContactEmail[]"]').val()).toBe('');
    expectAuthorsUntouched();
  });

  test('matches names case-insensitively', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'DOE', givenName: 'JANE', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(contributorCard(0).find('input[name="cbContactEmail[]"]').val()).toBe('jane@example.com');
  });

  test('handles multiple contact persons in the same XML', () => {
    buildPeople([
      { familyname: 'Doe', givenname: 'Jane' },
      { familyname: 'Smith', givenname: 'John' },
    ]);
    const xmlDoc = makeIcgemXml([
      { familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com', website: 'https://jane.example.com' },
      { familyName: 'Smith', givenName: 'John', email: 'john@example.com' },
    ]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(contributorCard(0).find('input[name="cbContactEmail[]"]').val()).toBe('jane@example.com');
    expect(contributorCard(0).find('input[name="cbContactWebsite[]"]').val()).toBe('https://jane.example.com');
    expect(contributorCard(1).find('input[name="cbContactEmail[]"]').val()).toBe('john@example.com');
    expectAuthorsUntouched();
  });

  test('skips an empty contact element', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
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

    expect(contributorCard(0).find('input[name="cbContactEmail[]"]').val()).toBe('');
    expectAuthorsUntouched();
  });

  test('does nothing when globalGravityProduct is absent', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
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

    expect(contributorCard(0).find('input[name="cbContactEmail[]"]').val()).toBe('');
    expectAuthorsUntouched();
  });

  test('only populates email when website is absent', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', email: 'jane@example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(contributorCard(0).find('input[name="cbContactEmail[]"]').val()).toBe('jane@example.com');
    expect(contributorCard(0).find('input[name="cbContactWebsite[]"]').val()).toBe('');
  });

  test('only populates website when email is absent', () => {
    buildPeople([{ familyname: 'Doe', givenname: 'Jane' }]);
    const xmlDoc = makeIcgemXml([{ familyName: 'Doe', givenName: 'Jane', website: 'https://jane.example.com' }]);

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(contributorCard(0).find('input[name="cbContactEmail[]"]').val()).toBe('');
    expect(contributorCard(0).find('input[name="cbContactWebsite[]"]').val()).toBe('https://jane.example.com');
    expectAuthorsUntouched();
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
    expectAuthorsUntouched();
    warn.mockRestore();
  });
});
