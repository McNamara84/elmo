const { mountAuthorStack, mountContributorStack } = require('./utils/peopleStacks');

/**
 * @jest-environment jsdom
 */

describe('ICGEM contact person import', () => {
  let $;
  let icgemModule;

  const ICGEM_NS = 'http://icgem.gfz.de/schema';
  const DATACITE_NS = 'http://datacite.org/schema/kernel-4';

  function buildAuthorDom(authors) {
    mountAuthorStack(authors.map(author => ({ type: 'person', ...author })));
  }

  function makeIcgemXml({ familyName, givenName, email = '', website = '', orcid = '' }) {
    return new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <icgv:envelope xmlns:icgv="${ICGEM_NS}" xmlns:dc="${DATACITE_NS}">
        <icgv:globalGravityProduct>
          <icgv:contacts>
            <icgv:contact>
              <icgv:nameType>Personal</icgv:nameType>
              <icgv:name>${familyName}, ${givenName}</icgv:name>
              ${orcid ? `<icgv:identifier>${orcid}</icgv:identifier><icgv:identifierType>ORCID</icgv:identifierType>` : ''}
              ${email ? `<icgv:address>${email}</icgv:address>` : ''}
              ${website ? `<icgv:onlineResource>${website}</icgv:onlineResource>` : ''}
            </icgv:contact>
          </icgv:contacts>
        </icgv:globalGravityProduct>
      </icgv:envelope>`, 'application/xml');
  }

  beforeEach(() => {
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
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
    delete window.authorStack;
  });

  test('imports a non-author contact into Contributors without adding an author', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([{ type: 'person', familyname: 'Contact', givenname: 'New',
      roles: ['Contact Person'], affiliations: [] }]);
    const authorsBefore = window.authorStack.collectPayload();
    const xmlDoc = makeIcgemXml({
      familyName: 'Contact',
      givenName: 'New',
      email: 'new.contact@gfz.de',
      website: 'https://new-contact.example.org'
    });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.collectPayload()).toEqual(authorsBefore);
    expect(window.contributorStack.collectPayload()).toEqual([
      expect.objectContaining({ type: 'person', familyname: 'Contact', givenname: 'New',
        roles: ['Contact Person'], email: 'new.contact@gfz.de', website: 'https://new-contact.example.org' })
    ]);
    const contactCard = document.querySelector('[data-contributor-card]');
    expect(contactCard.querySelector('input[name="cbContactEmail[]"]').value).toBe('new.contact@gfz.de');
    expect(contactCard.querySelector('input[name="cbContactWebsite[]"]').value).toBe('https://new-contact.example.org');
  });

  test('preserves sparse websites on existing Contact Person cards', () => {
    const people = [
      { familyname: 'Alpha', givenname: 'Ada' },
      { familyname: 'Beta', givenname: 'Ben' },
      { familyname: 'Gamma', givenname: 'Gina' }
    ];
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack(people.map(person => ({ type: 'person', ...person, roles: ['Contact Person'] })));

    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Alpha, Ada</grav:name>
              <grav:address>ada.alpha@gfz.de</grav:address>
              <grav:onlineResource>https://ada.example.org</grav:onlineResource>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Beta, Ben</grav:name>
              <grav:address>ben.beta@gfz.de</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Gamma, Gina</grav:name>
              <grav:address>gina.gamma@gfz.de</grav:address>
              <grav:onlineResource>https://gina.example.org</grav:onlineResource>
            </grav:contact>
          </grav:contacts>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const contributors = window.contributorStack.collectPayload();
    expect(contributors).toHaveLength(3);
    expect(contributors[0]).toMatchObject({ email: 'ada.alpha@gfz.de', website: 'https://ada.example.org' });
    expect(contributors[1]).toMatchObject({ email: 'ben.beta@gfz.de', website: '' });
    expect(contributors[2]).toMatchObject({ email: 'gina.gamma@gfz.de', website: 'https://gina.example.org' });
    expect(window.authorStack.collectPayload()).toHaveLength(1);
  });

  test('creates a Contact Person card when no person card matches', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([]);
    const xmlDoc = makeIcgemXml({ familyName: 'Contact', givenName: 'New',
      email: 'new@example.org', orcid: 'https://orcid.org/0000-0002-1825-0097' });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.collectPayload()).toHaveLength(1);
    expect(window.contributorStack.collectPayload()).toEqual([
      expect.objectContaining({ type: 'person', familyname: 'Contact', givenname: 'New',
        orcid: '0000-0002-1825-0097', roles: ['Contact Person'], email: 'new@example.org' })
    ]);
  });

  test('creates a Contact Person card for an author contact that normal mapping skipped', () => {
    buildAuthorDom([{ familyname: 'Author', givenname: 'Ada' }]);
    mountContributorStack([{ type: 'person', familyname: 'Other', givenname: 'Olga', roles: ['Editor'] }]);
    const xmlDoc = makeIcgemXml({ familyName: 'Author', givenName: 'Ada',
      email: 'ada@example.org', website: 'https://ada.example.org' });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.collectPayload()).toEqual([
      expect.objectContaining({ familyname: 'Author', givenname: 'Ada', email: '' })
    ]);
    expect(window.contributorStack.collectPayload().map(entry => [entry.familyname, entry.roles, entry.email])).toEqual([
      ['Other', ['Editor'], ''],
      ['Author', ['Contact Person'], 'ada@example.org']
    ]);
  });

  test('adds the Contact Person role to a matching card that has other roles', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([{ type: 'person', familyname: 'Contact', givenname: 'Connie', roles: ['Researcher'] }]);
    const xmlDoc = makeIcgemXml({ familyName: 'Contact', givenName: 'Connie', email: 'connie@example.org' });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.contributorStack.collectPayload()).toEqual([
      expect.objectContaining({ familyname: 'Contact', roles: ['Researcher', 'Contact Person'],
        email: 'connie@example.org' })
    ]);
  });

  test('matches contributor ORCIDs and keeps roles and other cards on repeated imports', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([
      { type: 'institution', institutionname: 'Archive', roles: ['Distributor'] },
      { type: 'person', familyname: 'Contact', givenname: 'Alias', roles: ['Researcher', 'Contact Person'],
        orcid: '0000-0002-1825-0097', affiliations: [{ label: 'Lab', rorId: '03yrm5c26' }] }
    ]);
    const archive = window.contributorStack.collectPayload()[0];
    const xmlDoc = makeIcgemXml({ familyName: 'Contact', givenName: 'New',
      email: 'new@example.org', website: 'https://example.org', orcid: 'https://orcid.org/0000-0002-1825-0097' });

    icgemModule.populateIcgemContactPersons(xmlDoc);
    icgemModule.populateIcgemContactPersons(xmlDoc);

    const contributors = window.contributorStack.collectPayload();
    expect(contributors).toHaveLength(2);
    expect(contributors[0]).toEqual(archive);
    expect(contributors[1]).toMatchObject({ roles: ['Researcher', 'Contact Person'],
      orcid: '0000-0002-1825-0097', email: 'new@example.org', website: 'https://example.org',
      affiliations: [{ label: 'Lab', rorId: '03yrm5c26' }] });
    expect(window.authorStack.collectPayload()).toHaveLength(1);
  });

  test('keeps contacts recoverable when only institution Contributors are enabled', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([{ type: 'institution', institutionname: 'Archive', roles: ['Distributor'] }]);
    window.contributorStack.supportsType = type => type === 'institution';
    const contributorsBefore = window.contributorStack.collectPayload();
    const xmlDoc = makeIcgemXml({ familyName: 'Contact', givenName: 'New', email: 'new@example.org' });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.collectPayload()).toHaveLength(1);
    expect(window.authorStack.collectPayload()[0].email || '').toBe('');
    expect(window.contributorStack.collectPayload()).toEqual(contributorsBefore);
  });

  test('rejects a present uninitialized Contributors group before changing authors', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([]);
    delete window.contributorStack;
    const authorsBefore = window.authorStack.collectPayload();
    const xmlDoc = makeIcgemXml({ familyName: 'Existing', givenName: 'Author', email: 'author@example.org' });

    expect(() => icgemModule.populateIcgemContactPersons(xmlDoc)).toThrow('Contributors form is not initialized.');
    expect(window.authorStack.collectPayload()).toEqual(authorsBefore);
  });

  test('keeps a missing contact in Authors when Contributors are disabled', () => {
    window.authorStack = {
      collectPayload: jest.fn(() => [
        {
          type: 'person',
          familyname: 'Existing',
          givenname: 'Author',
          orcid: '',
          isContact: false,
          affiliations: []
        }
      ]),
      setAuthors: jest.fn()
    };

    const xmlDoc = makeIcgemXml({
      familyName: 'Contact',
      givenName: 'New',
      email: 'new.contact@gfz.de',
      website: 'https://new-contact.example.org'
    });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.setAuthors).not.toHaveBeenCalled();
  });

  test('fills existing Contact Person cards and does not copy the contact onto the author', () => {
    buildAuthorDom([{ familyname: 'Author', givenname: 'Ada' }]);
    mountContributorStack([
      { type: 'person', familyname: 'Author', givenname: 'Ada', roles: ['Contact Person'], affiliations: [] },
      { type: 'person', familyname: 'Contact', givenname: 'Connie', roles: ['Contact Person'], affiliations: [] }
    ]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}">
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Author, Ada</grav:name>
              <grav:address>ada@example.org</grav:address>
              <grav:onlineResource>https://ada.example.org</grav:onlineResource>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Contact, Connie</grav:name>
              <grav:address>connie@example.org</grav:address>
            </grav:contact>
          </grav:contacts>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.collectPayload()).toEqual([
      expect.objectContaining({ familyname: 'Author', givenname: 'Ada', isContact: false, email: '' })
    ]);
    expect(window.contributorStack.collectPayload()).toEqual([
      expect.objectContaining({ type: 'person', familyname: 'Author', givenname: 'Ada',
        roles: ['Contact Person'], email: 'ada@example.org', website: 'https://ada.example.org' }),
      expect.objectContaining({ type: 'person', familyname: 'Contact', givenname: 'Connie',
        roles: ['Contact Person'], email: 'connie@example.org', website: '' })
    ]);
  });

  test('keeps each person email when an author is a contact only as a contributor', () => {
    buildAuthorDom([
      { familyname: 'Smith', givenname: 'Bob' },
      { familyname: 'Author', givenname: 'Ada' }
    ]);
    mountContributorStack([
      { type: 'person', familyname: 'Author', givenname: 'Ada', roles: ['Contact Person'], affiliations: [] },
      { type: 'person', familyname: 'Contact', givenname: 'Connie', roles: ['Contact Person'], affiliations: [] }
    ]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}">
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Author, Ada</grav:name>
              <grav:address>ada@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Author, Ada</grav:name>
              <grav:address>ada-again@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Contact, Connie</grav:name>
              <grav:address>connie@example.org</grav:address>
            </grav:contact>
          </grav:contacts>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.collectPayload().map(author => author.email || '')).toEqual(['', '']);
    const contributors = window.contributorStack.collectPayload();
    expect(contributors.map(entry => [entry.familyname, entry.email])).toEqual([
      ['Author', 'ada@example.org'],
      ['Contact', 'connie@example.org']
    ]);
  });

  test('does not merge two people who share a name and have different ORCIDs', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([
      { type: 'person', familyname: 'Smith', givenname: 'Ann', orcid: '0000-0001-0000-0001',
        roles: ['Contact Person'], affiliations: [], email: '' },
      { type: 'person', familyname: 'Smith', givenname: 'Ann', orcid: '0000-0002-0000-0002',
        roles: ['Contact Person'], affiliations: [], email: '' }
    ]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Smith, Ann</grav:name>
              <grav:identifier>0000-0002-0000-0002</grav:identifier>
              <grav:identifierType>ORCID</grav:identifierType>
              <grav:address>ann.two@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Smith, Ann</grav:name>
              <grav:identifier>0000-0001-0000-0001</grav:identifier>
              <grav:identifierType>ORCID</grav:identifierType>
              <grav:address>ann.one@example.org</grav:address>
            </grav:contact>
          </grav:contacts>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const contributors = window.contributorStack.collectPayload();
    expect(contributors).toHaveLength(2);
    expect(contributors[0]).toMatchObject({
      orcid: '0000-0001-0000-0001', email: 'ann.one@example.org'
    });
    expect(contributors[1]).toMatchObject({
      orcid: '0000-0002-0000-0002', email: 'ann.two@example.org'
    });
  });

  test('keeps an institution email when the Contact Person role is not on the card', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([
      { type: 'person', familyname: 'Alpha', givenname: 'Ann', roles: ['Contact Person'], affiliations: [] },
      { type: 'institution', institutionname: 'GFZ', roles: ['Distributor'], affiliations: [] },
      { type: 'person', familyname: 'Beta', givenname: 'Ben', roles: ['Contact Person'], affiliations: [] }
    ]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}">
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Alpha, Ann</grav:name>
              <grav:address>ann@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Organizational</grav:nameType>
              <grav:name>GFZ</grav:name>
              <grav:address>gfz@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Beta, Ben</grav:name>
              <grav:address>ben@example.org</grav:address>
            </grav:contact>
          </grav:contacts>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.contributorStack.collectPayload().map(entry => [
      entry.familyname || entry.institutionname,
      entry.email || ''
    ])).toEqual([
      ['Alpha', 'ann@example.org'],
      ['GFZ', 'gfz@example.org'],
      ['Beta', 'ben@example.org']
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('fills a Contact Person institution by name and adds cards for the missing people', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    window.ELMO_FEATURES = { showContactInstitution: true };
    buildAuthorDom([
      { familyname: 'Smith', givenname: 'Bob' },
      { familyname: 'Author', givenname: 'Ada' }
    ]);
    mountContributorStack([
      { type: 'person', familyname: 'Contact', givenname: 'Connie', roles: ['Contact Person'], affiliations: [] },
      { type: 'institution', institutionname: 'GFZ', roles: ['Contact Person'], affiliations: [] }
    ]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}">
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Contact, Connie</grav:name>
              <grav:address>connie@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Smith, Bob</grav:name>
              <grav:address>bob@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Personal</grav:nameType>
              <grav:name>Author, Ada</grav:name>
              <grav:address>ada@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:nameType>Organizational</grav:nameType>
              <grav:name>GFZ</grav:name>
              <grav:address>gfz@example.org</grav:address>
            </grav:contact>
          </grav:contacts>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const contributors = window.contributorStack.collectPayload();
    expect(contributors.map(entry => [entry.type, entry.familyname || entry.institutionname, entry.email])).toEqual([
      ['person', 'Contact', 'connie@example.org'],
      ['institution', 'GFZ', 'gfz@example.org'],
      ['person', 'Smith', 'bob@example.org'],
      ['person', 'Author', 'ada@example.org']
    ]);
    expect(window.authorStack.collectPayload().map(author => author.email || '')).toEqual(['', '']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    delete window.ELMO_FEATURES;
  });
});
