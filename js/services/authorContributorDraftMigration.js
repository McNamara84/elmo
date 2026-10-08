/** Convert stored field lists without depending on the retired form groups. */
const authorPersonFields = {
  familyname: 'familynames[]', givenname: 'givennames[]', orcid: 'orcids[]',
  affiliation: 'personAffiliation[]', ror: 'authorPersonRorIds[]',
  email: 'cpEmail[]', website: 'cpOnlineResource[]'
};
const authorInstitutionFields = {
  institutionname: 'authorinstitutionName[]', affiliation: 'institutionAffiliation[]', ror: 'authorInstitutionRorIds[]'
};
const contributorPersonFields = {
  familyname: 'cbPersonLastname[]', givenname: 'cbPersonFirstname[]', orcid: 'cbORCID[]',
  roles: 'cbPersonRoles[]', affiliation: 'cbAffiliation[]', ror: 'cbpRorIds[]'
};
const contributorInstitutionFields = {
  institutionname: 'cbOrganisationName[]', roles: 'cbOrganisationRoles[]',
  affiliation: 'OrganisationAffiliation[]', ror: 'hiddenOrganisationRorId[]'
};

export const authorDraftFields = ['authorsPayload', 'contacts[]', ...Object.values(authorPersonFields), ...Object.values(authorInstitutionFields)];
export const contributorDraftFields = ['contributorsPayload', ...Object.values(contributorPersonFields),
  ...Object.values(contributorInstitutionFields), 'cbContactEmail[]', 'cbContactWebsite[]'];

const owns = (values, name) => Object.prototype.hasOwnProperty.call(values, name);
const text = value => String(value ?? '').trim();
const ror = value => text(value).replace(/^https?:\/\/ror\.org\//, '');

export function invalidPeopleDraft() {
  return Object.assign(new Error('The saved author or contributor data is invalid. The original draft has been kept.'),
    { code: 'invalidPeople' });
}

function list(values, name) {
  if (!owns(values, name)) return [];
  if (!Array.isArray(values[name])) throw invalidPeopleDraft();
  return values[name];
}

function roles(value) {
  if (!value) return [];
  let items = value;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_error) { items = items.split(','); }
  }
  if (!Array.isArray(items)) items = [items];
  return [...new Set(items.map(item => text(item?.value ?? item)).filter(Boolean))];
}

function affiliations(value, rorValue) {
  let items = [];
  if (text(value)) {
    try { items = JSON.parse(value); } catch (_error) { items = [value]; }
    if (!Array.isArray(items)) items = [value];
  }
  const ids = text(rorValue) ? String(rorValue).split(',') : [];
  return Array.from({ length: Math.max(items.length, ids.length) }, (_, index) => {
    const item = items[index];
    return {
      label: text(item?.label ?? item?.value ?? item?.name ?? item),
      rorId: ror(item?.rorId ?? item?.id ?? ids[index])
    };
  }).filter(item => item.label || item.rorId);
}

function rows(values, fields, type) {
  const columns = Object.fromEntries(Object.entries(fields).map(([key, name]) => [key, list(values, name)]));
  return Array.from({ length: Math.max(0, ...Object.values(columns).map(column => column.length)) }, (_, index) => {
    const entry = { type };
    Object.entries(columns).forEach(([key, column]) => { entry[key] = text(column[index]); });
    entry.orcid = text(entry.orcid).replace(/^https?:\/\/orcid\.org\//, '');
    entry.affiliations = affiliations(entry.affiliation, entry.ror);
    delete entry.affiliation;
    delete entry.ror;
    if (columns.roles) entry.roles = roles(columns.roles[index]);
    return entry;
  });
}

function hasContent(entry) {
  return Object.entries(entry).some(([key, value]) => key !== 'type' && key !== 'isContact' &&
    (Array.isArray(value) ? value.length > 0 : Boolean(value)));
}

function payload(values, name) {
  let entries = values[name];
  if (typeof entries === 'string') {
    try { entries = JSON.parse(entries); } catch (_error) { throw invalidPeopleDraft(); }
  }
  if (!Array.isArray(entries)) throw invalidPeopleDraft();
  entries.forEach(entry => {
    if (!entry || !['person', 'institution'].includes(entry.type)) throw invalidPeopleDraft();
    for (const key of ['familyname', 'givenname', 'institutionname', 'orcid', 'email', 'website']) {
      if (entry[key] != null && typeof entry[key] !== 'string') throw invalidPeopleDraft();
    }
    if (entry.isContact != null && typeof entry.isContact !== 'boolean') throw invalidPeopleDraft();
    if (entry.roles != null && (!Array.isArray(entry.roles) || entry.roles.some(role =>
      typeof role !== 'string' && (!role || typeof role.value !== 'string')))) throw invalidPeopleDraft();
    if (entry.affiliations != null && (!Array.isArray(entry.affiliations) || entry.affiliations.some(item =>
      typeof item !== 'string' && (!item || typeof item !== 'object' || Array.isArray(item))))) throw invalidPeopleDraft();
  });
  return entries;
}

/** Payload presence, including [], takes precedence independently for each group. */
export function migratePeopleDraft(values) {
  let authors = null;
  let contributors = null;
  let needsContactReview = false;
  if (owns(values, 'authorsPayload')) {
    authors = payload(values, 'authorsPayload');
  } else if (authorDraftFields.some(name => owns(values, name))) {
    const persons = rows(values, authorPersonFields, 'person');
    const contacts = list(values, 'contacts[]');
    const inferred = persons.filter(person => person.email || person.website).length;
    // The old checkbox value was always "on", so only unambiguous cases can be recovered.
    const allContacts = contacts.length === persons.length && contacts.length > 0;
    persons.forEach(person => { person.isContact = Boolean(person.email || person.website || allContacts); });
    needsContactReview = contacts.length > inferred && !allContacts;
    authors = [...persons, ...rows(values, authorInstitutionFields, 'institution')].filter(hasContent);
  }
  if (owns(values, 'contributorsPayload')) {
    contributors = payload(values, 'contributorsPayload');
  } else if (contributorDraftFields.some(name => owns(values, name))) {
    contributors = [...rows(values, contributorPersonFields, 'person'),
      ...rows(values, contributorInstitutionFields, 'institution')].filter(hasContent);
    // Contact arrays were introduced with ordered cards, so their mixed-type positions
    // cannot safely be attached to the older, separate contributor lists.
    if (['cbContactEmail[]', 'cbContactWebsite[]'].some(name => list(values, name).some(text))) throw invalidPeopleDraft();
  }
  return { authors, contributors, needsContactReview };
}
