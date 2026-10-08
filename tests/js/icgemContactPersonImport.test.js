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

    const contacts = group === 'authors' ? window.authorStack.collectPayload() : window.contributorStack.collectPayload();
    expect(contacts).toHaveLength(3);
    expect(contacts[0]).toMatchObject({ email: 'ada.alpha@gfz.de', website: 'https://ada.example.org',
      orcid: '0000-0001-2345-6789', affiliations: [{ label: 'GFZ Potsdam', rorId: '03yrm5c26' }] });
    expect(contacts[1]).toMatchObject({ email: 'ben.beta@gfz.de', website: '' });
    expect(contacts[2]).toMatchObject({ email: 'gina.gamma@gfz.de', website: 'https://gina.example.org' });
    if (group === 'authors') expect(window.contributorStack.collectPayload()).toEqual([]);
    else expect(window.authorStack.collectPayload()).toHaveLength(1);
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

    expect(window.authorStack.collectPayload()).toHaveLength(2);
    expect(window.authorStack.collectPayload()[1]).toMatchObject({ isContact: true, email: 'new@example.org' });
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

    expect(window.authorStack.setAuthors).toHaveBeenCalledTimes(1);
    expect(window.authorStack.setAuthors).toHaveBeenCalledWith([
      expect.objectContaining({
        familyname: 'Existing',
        givenname: 'Author',
        isContact: false
      }),
      expect.objectContaining({
        familyname: 'Contact',
        givenname: 'New',
        isContact: true,
        email: 'new.contact@gfz.de',
        website: 'https://new-contact.example.org'
      })
    ]);
  });
});
