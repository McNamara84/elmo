const changelog = require('../../json/changelog.json');

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
    expect(entries).toHaveLength(260);
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
});
