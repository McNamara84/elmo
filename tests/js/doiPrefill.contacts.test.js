const { mountAuthorStack, mountContributorStack } = require('./utils/peopleStacks');
const { requireFresh } = require('./utils');

// Reduced public responses; source URLs and retrieval dates are in each fixture.
const examples = [
  ['icdp', ['Secrétan']],
  ['dqto', ['Achmüller']],
  ['fidgeo', ['Müller', 'Klein']],
].map(([name, contacts]) => [name, require(`../fixtures/doi-prefill/issue-1300-${name}.json`).data.attributes, contacts]);

const person = (overrides = {}) => ({
  nameType: 'Personal', givenName: 'Jane', familyName: 'Doe',
  nameIdentifiers: [], affiliation: [], ...overrides,
});
const contact = (overrides = {}) => person({ contributorType: 'ContactPerson', ...overrides });
const copy = value => JSON.parse(JSON.stringify(value));
const identifiers = value => [{ nameIdentifierScheme: 'ORCID', nameIdentifier: value }];
const ORCID = '0000-0001-2345-6789';
const SECOND_ORCID = '0000-0002-3456-789X';
let mod;
let lookupContacts;

beforeEach(() => {
  document.body.innerHTML = '';
  window.elmo = {};
  mountAuthorStack([]);
  mountContributorStack([]);
  $.getJSON = jest.fn().mockResolvedValue([]);
  window.loadClearInputFields = jest.fn().mockResolvedValue(() => {
    window.authorStack.setAuthors([]);
    window.contributorStack?.setContributors([]);
  });
  lookupContacts = jest.fn().mockResolvedValue({ email: null, website: null });
  mod = requireFresh('../../js/doiPrefill');
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.loadClearInputFields;
  delete window.ELMO_FEATURES;
});

async function apply(creators, contributors, service = { lookupContacts }) {
  await mod.applyDoiPrefill({ creators, contributors }, service);
  return {
    authors: window.authorStack.collectPayload(),
    contributors: window.contributorStack?.collectPayload() || [],
  };
}

test.each(examples)('issue #1300: imports published contacts for %s without local contact data', async (_name, attributes, names) => {
  await mod.applyDoiPrefill(copy(attributes), { lookupContacts });
  const authors = window.authorStack.collectPayload();
  expect(authors.filter(author => author.isContact).map(author => author.familyname)).toEqual(names);
  expect(window.contributorStack.collectPayload().some(entry => entry.roles.includes('Contact Person'))).toBe(false);
  expect(lookupContacts).toHaveBeenCalledTimes(names.length);
  expect(JSON.parse(document.querySelector('[name="authorsPayload"]').value)).toEqual(authors);
  expect($('input[name="contacts[]"]:checked')).toHaveLength(names.length);
  expect(authors.every(author => author.email === '' && author.website === '')).toBe(true);
});

test('does not query or mark authors without an explicit contact role', async () => {
  lookupContacts.mockResolvedValue({ email: 'unrelated@example.org', website: 'https://example.org/' });
  const { authors } = await apply([person()], [person({ contributorType: 'DataCollector' })]);
  expect(lookupContacts).not.toHaveBeenCalled();
  expect(authors[0]).toMatchObject({ isContact: false, email: '', website: '' });
});

describe('contact identity', () => {
  test.each([
    ['bare', ORCID],
    ['https', `https://orcid.org/${ORCID}`],
    ['http', `http://orcid.org/${ORCID}`],
    ['whitespace and case', ` HTTPS://ORCID.ORG/${ORCID} `],
  ])('matches %s ORCIDs before names and preserves author metadata', async (_label, value) => {
    const { authors, contributors } = await apply([
      person({ nameIdentifiers: identifiers(ORCID), affiliation: [{ name: 'Original affiliation' }] }),
      person({ familyName: 'Different', nameIdentifiers: identifiers(SECOND_ORCID) }),
    ], [contact({ familyName: 'Changed', givenName: 'Name', nameIdentifiers: identifiers(value), affiliation: ['Different affiliation'] })]);
    expect(authors.map(author => author.isContact)).toEqual([true, false]);
    expect(authors[0]).toMatchObject({ familyname: 'Doe', givenname: 'Jane', orcid: ORCID, affiliations: [{ label: 'Original affiliation', rorId: '' }] });
    expect(contributors).toEqual([]);
    expect(lookupContacts).toHaveBeenCalledWith({ orcid: ORCID, familyname: 'Changed', givenname: 'Name' });
  });

  test.each([
    ['both absent', [], []],
    ['only author', identifiers(ORCID), []],
    ['only contact', [], identifiers(ORCID)],
  ])('falls back to a unique full name when ORCIDs are %s', async (_label, creatorIds, contactIds) => {
    const { authors, contributors } = await apply([person({ nameIdentifiers: creatorIds })], [contact({ nameIdentifiers: contactIds })]);
    expect(authors[0].isContact).toBe(true);
    expect(contributors).toEqual([]);
    expect(lookupContacts.mock.calls[0][0].orcid).toBe(creatorIds.length || contactIds.length ? ORCID : '');
  });

  test('normalizes case, Unicode and whitespace in names', async () => {
    const { authors } = await apply([person({ familyName: 'Müller', givenName: 'Jane Ann' })],
      [contact({ familyName: ' MU\u0308LLER ', givenName: ' jane   ANN ' })]);
    expect(authors[0]).toMatchObject({ isContact: true, familyname: 'Müller', givenname: 'Jane Ann' });
  });

  test.each([
    ['conflicting ORCIDs', [person({ nameIdentifiers: identifiers(ORCID) })], contact({ nameIdentifiers: identifiers(SECOND_ORCID) })],
    ['ambiguous names', [person(), person()], contact()],
    ['duplicate ORCID', [person({ nameIdentifiers: identifiers(ORCID) }), person({ familyName: 'Other', nameIdentifiers: identifiers(ORCID) })], contact({ nameIdentifiers: identifiers(ORCID) })],
    ['initials', [person()], contact({ givenName: 'J.' })],
    ['different accents', [person({ familyName: 'Müller' })], contact({ familyName: 'Muller' })],
    ['missing given name', [person({ givenName: '' })], contact({ givenName: '' })],
    ['empty names', [person({ givenName: '', familyName: '' })], contact({ givenName: '', familyName: '' })],
    ['institution with same name', [{ nameType: 'Organizational', name: 'Doe, Jane' }], contact()],
  ])('keeps a separate contributor for %s', async (_label, creators, sourceContact) => {
    const { authors, contributors } = await apply(creators, [sourceContact]);
    expect(authors.some(author => author.isContact)).toBe(false);
    expect(contributors).toHaveLength(1);
    expect(contributors[0].roles).toEqual(['Contact Person']);
  });

  test('ORCID disambiguates authors with identical names and binds enrichment to the correct author', async () => {
    lookupContacts.mockResolvedValue({ email: 'second@example.org' });
    const { authors } = await apply([
      person({ nameIdentifiers: identifiers(ORCID) }),
      person({ nameIdentifiers: identifiers(SECOND_ORCID) }),
    ], [contact({ nameIdentifiers: identifiers(SECOND_ORCID.toLowerCase()) })]);
    expect(authors[0]).toMatchObject({ isContact: false, email: '' });
    expect(authors[1]).toMatchObject({ isContact: true, email: 'second@example.org' });
  });

  test('parses comma-separated personal names on either side', async () => {
    const { authors, contributors } = await apply([
      person({ givenName: '', familyName: '', name: ' Doe, Jane ' }),
      person({ givenName: 'John', familyName: 'Smith' }),
    ], [contact(), contact({ givenName: '', familyName: '', name: 'Smith, John' })]);
    expect(authors.map(author => [author.familyname, author.givenname, author.isContact])).toEqual([
      ['Doe', 'Jane', true], ['Smith', 'John', true],
    ]);
    expect(contributors).toEqual([]);
  });

  test('fills only missing structured names from a personal display name', async () => {
    const { authors } = await apply([person({ familyName: '', name: 'Doe, Different' })], [contact()]);
    expect(authors[0]).toMatchObject({ familyname: 'Doe', givenname: 'Jane', isContact: true });
  });

  test.each(['Jane Doe', 'Doe, Jane, Jr.', 'Doe,'])('preserves %s without guessing name components', async name => {
    const { contributors } = await apply([person()], [contact({ familyName: '', givenName: '', name })]);
    expect(contributors[0]).toMatchObject({ familyname: name, givenname: '', roles: ['Contact Person'] });
    expect(lookupContacts).not.toHaveBeenCalled();
  });

  test('can match and enrich an ORCID-only contact', async () => {
    lookupContacts.mockResolvedValue({ email: 'jane@example.org' });
    const { authors } = await apply([person({ nameIdentifiers: identifiers(ORCID) })],
      [contact({ givenName: '', familyName: '', nameIdentifiers: identifiers(ORCID) })]);
    expect(authors[0]).toMatchObject({ isContact: true, email: 'jane@example.org' });
  });
});

describe('roles and lookup', () => {
  test.each([undefined, null, []])('handles absent contributors (%s) without lookup', async contributors => {
    const result = await apply([person()], contributors);
    expect(result.authors[0].isContact).toBe(false);
    expect(lookupContacts).not.toHaveBeenCalled();
  });

  test.each([null, {}, { email: null, website: null }, 'failure'])('preserves the role with lookup result %s', async result => {
    if (result === 'failure') lookupContacts.mockRejectedValue(new Error('offline'));
    else lookupContacts.mockResolvedValue(result);
    const { authors } = await apply([person()], [contact()]);
    expect(authors[0]).toMatchObject({ isContact: true, email: '', website: '' });
  });

  test('preserves the role when lookup throws synchronously or is unavailable', async () => {
    lookupContacts.mockImplementation(() => { throw new Error('unavailable'); });
    expect((await apply([person()], [contact()])).authors[0].isContact).toBe(true);
    lookupContacts.mockClear();
    expect((await apply([person()], [contact()], null)).authors[0].isContact).toBe(true);
    expect(lookupContacts).not.toHaveBeenCalled();
  });

  test.each([
    [{ email: 'contact@example.org' }, 'contact@example.org', ''],
    [{ website: 'https://example.org/' }, '', 'https://example.org/'],
    [{ email: 'contact@example.org', website: 'https://example.org/' }, 'contact@example.org', 'https://example.org/'],
  ])('enriches author and contributor contacts with %j', async (response, email, website) => {
    lookupContacts.mockResolvedValue(response);
    const { authors, contributors } = await apply([person()], [contact(), contact({ familyName: 'Smith' })]);
    expect(authors[0]).toMatchObject({ isContact: true, email, website });
    expect(contributors[0]).toMatchObject({ roles: ['Contact Person'], email, website });
    expect(JSON.parse(document.querySelector('[name="contributorsPayload"]').value)).toEqual(contributors);
    expect($('input[name="cpEmail[]"]').val()).toBe(email);
    expect($('input[name="cbContactEmail[]"]').val()).toBe(email);
  });

  test('enriches contact contributors without a creators array', async () => {
    lookupContacts.mockResolvedValue({ email: 'contributor@example.org' });
    const { contributors } = await apply(undefined, [contact()]);
    expect(contributors[0]).toMatchObject({ roles: ['Contact Person'], email: 'contributor@example.org' });
  });

  test('deduplicates contacts while preserving other roles and affiliations', async () => {
    const affiliation = { name: 'Institute', affiliationIdentifier: 'https://ror.org/04z8jg394' };
    const { authors, contributors } = await apply([person()], [
      contact(), contact(), person({ contributorType: 'DataCollector', affiliation: [affiliation] }),
      contact({ familyName: 'Smith', affiliation: ['External institute'] }),
      contact({ familyName: 'Smith', affiliation: ['External institute'] }),
      person({ familyName: 'Smith', contributorType: 'DataCurator' }),
    ]);
    expect(authors[0].isContact).toBe(true);
    expect(contributors.map(entry => entry.roles)).toEqual([['Data Collector'], ['Contact Person', 'Data Curator']]);
    expect(contributors[0].affiliations).toEqual([{ label: 'Institute', rorId: '04z8jg394' }]);
    expect(contributors[1].affiliations).toEqual([{ label: 'External institute', rorId: '' }]);
    expect(lookupContacts).toHaveBeenCalledTimes(2);
  });

  test.each([false, true])('respects institutional contacts feature flag %s without personal lookup', async enabled => {
    window.ELMO_FEATURES = { showContactInstitution: enabled };
    const { contributors } = await apply([], [{ nameType: 'Organizational', name: 'Institute', contributorType: 'ContactPerson' }]);
    expect(contributors[0].roles).toEqual(enabled ? ['Contact Person'] : []);
    expect(lookupContacts).not.toHaveBeenCalled();
  });

  test('marks authors when the contributor group is disabled', async () => {
    document.querySelector('[data-contributor-formgroup]').remove();
    delete window.contributorStack;
    const { authors } = await apply([person()], [contact()]);
    expect(authors[0].isContact).toBe(true);
  });

  test('fails clearly if an enabled contributor group is uninitialized', () => {
    delete window.contributorStack;
    expect(() => mod.prefillContributors([contact()])).toThrow('Contributors form is not initialized.');
  });

  test('a subsequent import clears previous contact selections and details', async () => {
    lookupContacts.mockResolvedValue({ email: 'old@example.org' });
    await apply([person()], [contact(), contact({ familyName: 'Smith' })]);
    lookupContacts.mockClear();
    const { authors, contributors } = await apply([person()], []);
    expect(authors[0]).toMatchObject({ isContact: false, email: '', website: '' });
    expect(contributors).toEqual([]);
    expect(lookupContacts).not.toHaveBeenCalled();
  });
});
