const changelog = require('../../json/changelog.json');
const english = require('../../lang/en.json');
const german = require('../../lang/de.json');
const french = require('../../lang/fr.json');

function allEntries(entries) {
  return entries.flatMap(entry => [entry, ...allEntries(entry.children || [])]);
}

describe('changelog migration', () => {
  test('contains every existing release and preserves their order', () => {
    expect(changelog.currentVersion).toBe('2.2.0');
    expect(changelog.releases).toHaveLength(19);
    expect(changelog.releases[0].version).toBe(changelog.currentVersion);
    expect(new Set(changelog.releases.map(release => release.version)).size).toBe(19);

    const dates = changelog.releases.map(release => {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const date = new Date(`${release.date}T00:00:00Z`);
      expect(Number.isNaN(date.getTime())).toBe(false);
      expect(date.toISOString().slice(0, 10)).toBe(release.date);
      return date.getTime();
    });
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  test('preserves all list entries, nested lists, inline code and the first release note', () => {
    const entries = changelog.releases.flatMap(release =>
      release.sections.flatMap(section => allEntries(section.entries))
    );
    expect(entries).toHaveLength(261);
    expect(entries.filter(entry => entry.children?.length)).toHaveLength(2);
    expect(entries.flatMap(entry => entry.parts).filter(part => part.type === 'code')).toHaveLength(6);

    for (const release of changelog.releases) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+(?:RC\d+)?$/);
      for (const section of release.sections) {
        expect(section.title).toEqual(expect.any(String));
        for (const entry of allEntries(section.entries)) {
          expect(entry.parts.length).toBeGreaterThan(0);
          for (const part of entry.parts) {
            expect(['text', 'code']).toContain(part.type);
            expect(part.value).toEqual(expect.any(String));
            expect(part.value.length).toBeGreaterThan(0);
          }
        }
      }
    }

    const oldest = changelog.releases.at(-1);
    expect(oldest.version).toBe('1.7.0');
    expect(oldest.notes).toEqual([
      { type: 'paragraph', parts: [{ type: 'text', value: 'First alpha release of ELMO' }] }
    ]);
  });

  test('scopes every 2.2.0 entry and only uses verified issue and PR references', () => {
    const latestEntries = changelog.releases[0].sections.flatMap(section => section.entries);
    const entryByText = prefix => latestEntries.find(entry =>
      entry.parts.map(part => part.value).join('').startsWith(prefix)
    );
    expect(latestEntries).toHaveLength(18);
    const allowedEditions = new Set(['all', 'elmo', 'msl', 'gem', 'igsn']);
    const verifiedIssues = new Set([401, 769, 807, 812, 885, 909, 1009, 1022, 1087, 1127, 1140, 1148, 1191, 1240]);
    const verifiedPullRequests = new Set([1188, 1213, 1222, 1229, 1233, 1234, 1235, 1238, 1246]);

    for (const entry of latestEntries) {
      expect(entry.editions.length).toBeGreaterThan(0);
      expect(new Set(entry.editions).size).toBe(entry.editions.length);
      for (const edition of entry.editions) expect(allowedEditions.has(edition)).toBe(true);
      if (entry.editions.includes('all')) expect(entry.editions).toEqual(['all']);
      for (const reference of entry.references || []) {
        expect(['issue', 'pull']).toContain(reference.type);
        const verifiedNumbers = reference.type === 'issue' ? verifiedIssues : verifiedPullRequests;
        expect(verifiedNumbers.has(reference.number)).toBe(true);
      }
    }

    expect(entryByText('The footer version opens').editions).toEqual(['all']);
    expect(entryByText('The footer version opens').references).toEqual([
      { type: 'issue', number: 807 }, { type: 'issue', number: 909 },
      { type: 'issue', number: 1240 }, { type: 'pull', number: 1246 }
    ]);
    expect(entryByText('ELMO-GEM now branches').editions).toEqual(['gem']);
    expect(entryByText('ELMO-GEM now branches').references).toEqual([
      { type: 'issue', number: 1127 }, { type: 'pull', number: 1188 }
    ]);
    expect(entryByText('Related Work now starts empty').references).toEqual([
      { type: 'issue', number: 812 }, { type: 'issue', number: 1009 },
      { type: 'pull', number: 1229 }
    ]);
    expect(entryByText('ELMO-GEM now restores').editions).toEqual(['gem']);
    expect(entryByText('ELMO-GEM now restores').references).toEqual([
      { type: 'issue', number: 1191 }, { type: 'pull', number: 1234 }
    ]);
    expect(entryByText('ELMO-MSL restores').editions).toEqual(['msl']);
    expect(entryByText('ELMO-MSL restores').references).toEqual([
      { type: 'issue', number: 1148 }, { type: 'pull', number: 1233 }
    ]);
    expect(entryByText('Submission errors').references).toBeUndefined();

    for (const release of changelog.releases.slice(1)) {
      for (const section of release.sections) {
        for (const entry of allEntries(section.entries)) {
          expect(entry.editions).toBeUndefined();
          expect(entry.references).toBeUndefined();
        }
      }
    }
  });

  test('groups 2.2.0 entries by edition within each section', () => {
    const [features, fixes, documentation] = changelog.releases[0].sections;
    const editions = section => section.entries.map(entry => entry.editions[0]);

    expect(editions(features)).toEqual([
      'all', 'all', 'all', 'all', 'all', 'all', 'all', 'gem', 'gem', 'gem'
    ]);
    expect(editions(fixes)).toEqual([
      'all', 'all', 'all', 'all', 'all', 'msl', 'gem'
    ]);
    expect(editions(documentation)).toEqual(['gem']);
  });

  test('has labels and loading states in every supported language', () => {
    for (const locale of [english, german, french]) {
      expect(locale.modals.about.heading).toEqual(expect.any(String));
      expect(locale.modals.about.text).toEqual(expect.any(String));
      expect(locale.modals.about.metadataEditorLink).toEqual(expect.any(String));
      expect(locale.modals.changelog.title).toEqual(expect.any(String));
      expect(locale.modals.changelog.loading).toEqual(expect.any(String));
      expect(locale.modals.changelog.error).toEqual(expect.any(String));
    }
  });
});
