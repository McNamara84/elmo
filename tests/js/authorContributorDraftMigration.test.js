import { migratePeopleDraft } from '../../js/services/authorContributorDraftMigration.js';
import legacy from '../fixtures/author-contributor-drafts/legacy.json';

describe('stored author and contributor data', () => {
  test('recovers positional fields, contacts, roles and ROR pairs without merging names', () => {
    const before = JSON.stringify(legacy);
    const result = migratePeopleDraft(legacy);
    expect(result.authors.map(entry => entry.familyname || entry.institutionname)).toEqual(['First', 'Last', 'Research Centre']);
    expect(result.authors[0]).toMatchObject({ orcid: '0000-0002-1825-0097', isContact: false,
      affiliations: [{ label: 'Institute, Berlin', rorId: '' }, { label: 'Lab', rorId: '04z8jg394' }] });
    expect(result.authors[1]).toMatchObject({ isContact: true, email: 'last@example.org', website: 'https://example.org' });
    expect(result.authors[2].affiliations).toEqual([{ label: 'Visiting institute, Potsdam', rorId: '' }]);
    expect(result.contributors.map(entry => entry.givenname || entry.institutionname)).toEqual(['A', 'B', 'Archive']);
    expect(result.contributors[0]).toMatchObject({ roles: ['Researcher', 'Data Collector'],
      affiliations: [{ label: 'University', rorId: '04z8jg394' }] });
    expect(result.contributors[2].roles).toEqual(['Hosting Institution', 'Distributor']);
    expect(result.needsContactReview).toBe(false);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  test('preserves incomplete rows and a ROR ID without a label', () => {
    const result = migratePeopleDraft({ 'givennames[]': ['Ada'], 'authorPersonRorIds[]': ['', '04z8jg394'] });
    expect(result.authors).toHaveLength(2);
    expect(result.authors[1].affiliations).toEqual([{ label: '', rorId: '04z8jg394' }]);
  });

  test('preserves an incomplete person marked as the only contact', () => {
    const result = migratePeopleDraft({ 'familynames[]': [''], 'contacts[]': ['on'] });
    expect(result.authors).toEqual([expect.objectContaining({ type: 'person', isContact: true })]);
    expect(result.needsContactReview).toBe(false);
  });

  test('rejects unsupported checkbox encodings without guessing contact positions', () => {
    expect(() => migratePeopleDraft({ 'familynames[]': ['Doe'], 'contacts[]': ['1'] })).toThrow();
  });

  test('migrates each group independently and respects explicitly empty payloads', () => {
    const result = migratePeopleDraft({ ...legacy, authorsPayload: '[]' });
    expect(result.authors).toEqual([]);
    expect(result.contributors).toHaveLength(3);
    expect(migratePeopleDraft({ ...legacy, contributorsPayload: [] }).contributors).toEqual([]);
  });

  test('keeps mixed order in a structured payload', () => {
    const authors = [{ type: 'institution', institutionname: 'Lab' }, { type: 'person', familyname: 'Doe' }];
    expect(migratePeopleDraft({ ...legacy, authorsPayload: authors }).authors).toEqual(authors);
  });

  test('does not guess which person an ambiguous checkbox belongs to', () => {
    const result = migratePeopleDraft({ 'familynames[]': ['First', 'Last'], 'contacts[]': ['on'] });
    expect(result.needsContactReview).toBe(true);
    expect(result.authors.map(author => author.isContact)).toEqual([false, false]);
    const all = migratePeopleDraft({ 'familynames[]': ['First', 'Last'], 'contacts[]': ['on', 'on'] });
    expect(all.needsContactReview).toBe(false);
    expect(all.authors.map(author => author.isContact)).toEqual([true, true]);
  });

  test.each(['{', 'null', '{}', '[null]', '[{"type":"unknown"}]', '[{"type":"person","roles":{}}]', '[{"type":"person","affiliations":[{"label":{}}]}]'])
  ('rejects damaged payload %s instead of falling back to old fields', value => {
    expect(() => migratePeopleDraft({ ...legacy, authorsPayload: value })).toThrow();
  });

  test('does not silently lose contact arrays without a mixed contributor payload', () => {
    expect(() => migratePeopleDraft({ 'cbPersonLastname[]': ['Doe'], 'cbContactEmail[]': ['a@example.org'] })).toThrow();
  });

  test('leaves groups with no saved fields alone', () => {
    expect(migratePeopleDraft({ title: 'Title' })).toEqual({ authors: null, contributors: null, needsContactReview: false });
  });
});
