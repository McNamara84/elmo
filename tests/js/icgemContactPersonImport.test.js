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
        <dc:resource>
          <dc:contributors>
            <dc:contributor contributorType="ContactPerson">
              <dc:contributorName>${givenName} ${familyName}</dc:contributorName>
              <dc:givenName>${givenName}</dc:givenName>
              <dc:familyName>${familyName}</dc:familyName>
              ${orcid ? `<dc:nameIdentifier nameIdentifierScheme="ORCID">${orcid}</dc:nameIdentifier>` : ''}
            </dc:contributor>
          </dc:contributors>
        </dc:resource>
        <icgv:globalGravityProduct>
          <icgv:contact>
            <icgv:address>${email}</icgv:address>
            <icgv:onlineResource>${website}</icgv:onlineResource>
          </icgv:contact>
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

  test.each(['authors', 'contributors'])('preserves sparse websites and identifiers in %s with grav/dace prefixes', group => {
    const people = [
      { familyname: 'Alpha', givenname: 'Ada' },
      { familyname: 'Beta', givenname: 'Ben' },
      { familyname: 'Gamma', givenname: 'Gina' }
    ];
    buildAuthorDom(group === 'authors' ? people : [{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack(group === 'contributors'
      ? people.map(person => ({ type: 'person', ...person, roles: ['Contact Person'] })) : []);

    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <dace:resource>
          <dace:contributors>
            <dace:contributor contributorType="ContactPerson">
              <dace:contributorName>Ada Alpha</dace:contributorName>
              <dace:givenName>Ada</dace:givenName>
              <dace:familyName>Alpha</dace:familyName>
              <dace:nameIdentifier nameIdentifierScheme="ORCID">https://orcid.org/0000-0001-2345-6789</dace:nameIdentifier>
              <dace:personAffiliation affiliationIdentifier="https://ror.org/03yrm5c26">GFZ Potsdam</dace:personAffiliation>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:contributorName>Ben Beta</dace:contributorName>
              <dace:givenName>Ben</dace:givenName>
              <dace:familyName>Beta</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:contributorName>Gina Gamma</dace:contributorName>
              <dace:givenName>Gina</dace:givenName>
              <dace:familyName>Gamma</dace:familyName>
            </dace:contributor>
          </dace:contributors>
        </dace:resource>
        <grav:globalGravityProduct>
          <grav:contact>
            <grav:address>ada.alpha@gfz.de</grav:address>
            <grav:onlineResource>https://ada.example.org</grav:onlineResource>
            <grav:address>ben.beta@gfz.de</grav:address>
            <grav:address>gina.gamma@gfz.de</grav:address>
            <grav:onlineResource>https://gina.example.org</grav:onlineResource>
          </grav:contact>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const contributors = window.contributorStack.collectPayload();
    expect(contributors).toHaveLength(3);
    expect(contributors[0]).toMatchObject({ email: 'ada.alpha@gfz.de', website: 'https://ada.example.org',
      orcid: '0000-0001-2345-6789', affiliations: [{ label: 'GFZ Potsdam', rorId: '03yrm5c26' }],
      roles: ['Contact Person'] });
    expect(contributors[1]).toMatchObject({ email: 'ben.beta@gfz.de', website: '' });
    expect(contributors[2]).toMatchObject({ email: 'gina.gamma@gfz.de', website: 'https://gina.example.org' });
    const authors = window.authorStack.collectPayload();
    if (group === 'authors') {
      expect(authors).toHaveLength(3);
      authors.forEach((author) => expect(author.email || '').toBe(''));
    } else {
      expect(authors).toHaveLength(1);
    }
  });

  test('creates a contributor contact when no person card matches', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([]);
    const xmlDoc = makeIcgemXml({ familyName: 'Contact', givenName: 'New',
      email: 'new@example.org', orcid: 'https://orcid.org/0000-0002-1825-0097' });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.collectPayload()).toHaveLength(1);
    expect(window.contributorStack.collectPayload()).toEqual([
      expect.objectContaining({ familyname: 'Contact', givenname: 'New', roles: ['Contact Person'],
        email: 'new@example.org', orcid: '0000-0002-1825-0097' })
    ]);
  });

  test('matches contributor ORCIDs and keeps roles and other cards on repeated imports', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([
      { type: 'institution', institutionname: 'Archive', roles: ['Distributor'] },
      { type: 'person', familyname: 'Contact', givenname: 'Alias', roles: ['Researcher'],
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
      email: 'new@example.org', website: 'https://example.org',
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

  test('puts the same legacy entry on the author and the matching contributor card', () => {
    buildAuthorDom([{ familyname: 'Author', givenname: 'Ada' }]);
    mountContributorStack([]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <dace:resource>
          <dace:contributors>
            <dace:contributor contributorType="ContactPerson">
              <dace:contributorName nameType="Personal">Author, Ada</dace:contributorName>
              <dace:givenName>Ada</dace:givenName>
              <dace:familyName>Author</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:contributorName nameType="Personal">Contact, Connie</dace:contributorName>
              <dace:givenName>Connie</dace:givenName>
              <dace:familyName>Contact</dace:familyName>
            </dace:contributor>
          </dace:contributors>
        </dace:resource>
        <grav:globalGravityProduct>
          <grav:contact>
            <grav:address>ada@example.org</grav:address>
            <grav:onlineResource>https://ada.example.org</grav:onlineResource>
            <grav:address>connie@example.org</grav:address>
          </grav:contact>
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
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <dace:resource>
          <dace:contributors>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Ada</dace:givenName>
              <dace:familyName>Author</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Ada</dace:givenName>
              <dace:familyName>Author</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Connie</dace:givenName>
              <dace:familyName>Contact</dace:familyName>
            </dace:contributor>
          </dace:contributors>
        </dace:resource>
        <grav:globalGravityProduct>
          <grav:contact>
            <grav:address>ada@example.org</grav:address>
            <grav:address>connie@example.org</grav:address>
          </grav:contact>
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
        roles: ['Researcher'], affiliations: [], email: '' },
      { type: 'person', familyname: 'Smith', givenname: 'Ann', orcid: '0000-0002-0000-0002',
        roles: ['Researcher'], affiliations: [], email: '' }
    ]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:type>personal</grav:type>
              <grav:name>Smith, Ann</grav:name>
              <grav:identifier>0000-0002-0000-0002</grav:identifier>
              <grav:identifierType>ORCID</grav:identifierType>
              <grav:address>ann.two@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:type>personal</grav:type>
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

  test('keeps an institution email off the next person when the institution has no contact role', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    mountContributorStack([
      { type: 'person', familyname: 'Alpha', givenname: 'Ann', roles: ['Contact Person'], affiliations: [] },
      { type: 'institution', institutionname: 'GFZ', roles: ['Distributor'], affiliations: [] },
      { type: 'person', familyname: 'Beta', givenname: 'Ben', roles: ['Contact Person'], affiliations: [] }
    ]);
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <dace:resource>
          <dace:contributors>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Ann</dace:givenName>
              <dace:familyName>Alpha</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="HostingInstitution">
              <dace:contributorName nameType="Organizational">GFZ</dace:contributorName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Ben</dace:givenName>
              <dace:familyName>Beta</dace:familyName>
            </dace:contributor>
          </dace:contributors>
        </dace:resource>
        <grav:globalGravityProduct>
          <grav:contact>
            <grav:address>ann@example.org</grav:address>
            <grav:address>gfz@example.org</grav:address>
            <grav:address>ben@example.org</grav:address>
          </grav:contact>
        </grav:globalGravityProduct>
      </grav:envelope>`, 'application/xml');

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.contributorStack.collectPayload().map(entry => [
      entry.familyname || entry.institutionname,
      entry.email
    ])).toEqual([
      ['Alpha', 'ann@example.org'],
      ['GFZ', 'gfz@example.org'],
      ['Beta', 'ben@example.org']
    ]);
  });

  test('skips repeated author entries in a saved contact list and keeps the institution entry', () => {
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
      <grav:envelope xmlns:grav="${ICGEM_NS}" xmlns:dace="${DATACITE_NS}">
        <dace:resource>
          <dace:contributors>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Connie</dace:givenName>
              <dace:familyName>Contact</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Bob</dace:givenName>
              <dace:familyName>Smith</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:givenName>Ada</dace:givenName>
              <dace:familyName>Author</dace:familyName>
            </dace:contributor>
            <dace:contributor contributorType="ContactPerson">
              <dace:contributorName nameType="Organizational">GFZ</dace:contributorName>
            </dace:contributor>
          </dace:contributors>
        </dace:resource>
        <grav:globalGravityProduct>
          <grav:contacts>
            <grav:contact>
              <grav:type>personal</grav:type>
              <grav:name>Contact, Connie</grav:name>
              <grav:address>connie@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:type>personal</grav:type>
              <grav:name>Smith, Bob</grav:name>
              <grav:address>bob@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:type>personal</grav:type>
              <grav:name>Author, Ada</grav:name>
              <grav:address>ada@example.org</grav:address>
            </grav:contact>
            <grav:contact>
              <grav:type>institutional</grav:type>
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
    delete window.ELMO_FEATURES;
  });
});
