const changelog = require('../../json/changelog.json');
const english = require('../../lang/en.json');
const german = require('../../lang/de.json');
const french = require('../../lang/fr.json');

function allEntries(entries) {
  return entries.flatMap(entry => [entry, ...allEntries(entry.children || [])]);
}

function isEditionScopedRelease(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const [major, minor] = match.slice(1).map(Number);
  return major > 2 || (major === 2 && minor >= 2);
}

describe('changelog migration', () => {
  test('contains every existing release and preserves their order', () => {
    expect(changelog.releases.length).toBeGreaterThan(0);
    expect(changelog.releases[0].version).toBe(changelog.currentVersion);
    expect(new Set(changelog.releases.map(release => release.version)).size)
      .toBe(changelog.releases.length);

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
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter(entry => entry.children?.length).length).toBeGreaterThan(0);
    expect(entries.flatMap(entry => entry.parts).filter(part => part.type === 'code').length)
      .toBeGreaterThan(0);

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

  test('scopes current entries by edition and keeps reference links well formed', () => {
    const scopedEntries = changelog.releases
      .filter(release => isEditionScopedRelease(release.version))
      .flatMap(release => release.sections.flatMap(section => section.entries));
    const entryByText = prefix => scopedEntries.find(entry =>
      entry.parts.map(part => part.value).join('').startsWith(prefix)
    );
    expect(scopedEntries.length).toBeGreaterThan(0);
    const allowedEditions = new Set(['all', 'elmo', 'msl', 'gem', 'igsn']);

    for (const entry of scopedEntries) {
      expect(entry.editions.length).toBeGreaterThan(0);
      expect(new Set(entry.editions).size).toBe(entry.editions.length);
      for (const edition of entry.editions) expect(allowedEditions.has(edition)).toBe(true);
      if (entry.editions.includes('all')) expect(entry.editions).toEqual(['all']);
      for (const reference of entry.references || []) {
        expect(['issue', 'pull']).toContain(reference.type);
        expect(Number.isSafeInteger(reference.number)).toBe(true);
        expect(reference.number).toBeGreaterThan(0);
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
    expect(entryByText("ELMO-GEM's ICGEM registration email").references).toEqual([
      { type: 'issue', number: 1203 }, { type: 'pull', number: 1245 }
    ]);
    expect(entryByText('ELMO-GEM can skip researcher confirmation').references).toEqual([
      { type: 'issue', number: 1196 }, { type: 'pull', number: 1245 }
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
    expect(entryByText('A separate DOI lookup').references).toEqual([{ type: 'issue', number: 831 }]);
    expect(entryByText('Resource type help').references).toEqual([{ type: 'issue', number: 1013 }]);
    expect(entryByText('Resource Information DOI and title controls').references)
      .toEqual([{ type: 'pull', number: 1249 }]);
    expect(entryByText('For Standard, MSL, and IGSN submissions').editions).toEqual(['elmo', 'msl', 'igsn']);

    for (const release of changelog.releases.filter(item => !isEditionScopedRelease(item.version))) {
      for (const section of release.sections) {
        for (const entry of allEntries(section.entries)) {
          expect(entry.editions).toBeUndefined();
          expect(entry.references).toBeUndefined();
        }
      }
    }
  });

  test('groups edition-scoped entries by edition within each section', () => {
    const editionOrder = ['all', 'elmo', 'msl', 'gem', 'igsn'];
    for (const release of changelog.releases.filter(item => isEditionScopedRelease(item.version))) {
      for (const section of release.sections) {
        const positions = section.entries.map(entry => editionOrder.indexOf(entry.editions[0]));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
      }
    }
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
