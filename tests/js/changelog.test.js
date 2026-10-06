import { initChangelog, renderChangelog, validateChangelog } from '../../js/changelog.js';
import changelog from '../../json/changelog.json';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function allEntries(entries) {
  return entries.flatMap(entry => [entry, ...allEntries(entry.children || [])]);
}

function releaseEntries(release) {
  return release.sections.flatMap(section => allEntries(section.entries));
}

function countCodeParts(data) {
  const parts = [];
  for (const release of data.releases) {
    for (const entry of releaseEntries(release)) parts.push(...entry.parts);
    for (const note of release.notes || []) parts.push(...note.parts);
  }
  return parts.filter(part => part.type === 'code').length;
}

function countReferences(releases, type) {
  return releases.flatMap(release => releaseEntries(release))
    .flatMap(entry => entry.references || [])
    .filter(reference => reference.type === type).length;
}

describe('changelog renderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="modal-changelog"><div id="panel-changelog-content"></div></div>';
  });

  test('renders every release and preserves the latest accordion and historical details', () => {
    const container = document.getElementById('panel-changelog-content');
    renderChangelog(changelog, container);

    const latest = changelog.releases[0];
    const badgeCount = changelog.releases.flatMap(release => releaseEntries(release))
      .reduce((count, entry) => count + (entry.editions?.length || 0), 0);
    expect(container.querySelectorAll('.accordion-item')).toHaveLength(changelog.releases.length);
    expect(container.querySelector('.accordion-button').textContent)
      .toBe(`Version ${latest.version} - ${latest.date.replaceAll('-', '/')}`);
    expect(container.querySelector('.accordion-collapse').classList.contains('show')).toBe(true);
    expect(container.querySelectorAll('.accordion-button[aria-expanded="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('.badge')).toHaveLength(badgeCount);
    expect(container.querySelectorAll('a[href*="github.com/McNamara84/elmo/pull/"]'))
      .toHaveLength(countReferences(changelog.releases, 'pull'));
    const issueLinks = [...container.querySelectorAll('.accordion-item:first-child a[href*="github.com/McNamara84/elmo/issues/"]')];
    expect(issueLinks).toHaveLength(countReferences(changelog.releases.slice(0, 1), 'issue'));
    expect(issueLinks.map(link => link.textContent)).toContain('Issue #1127');
    expect(issueLinks.map(link => link.textContent)).toContain('Issue #1240');
    expect(issueLinks.map(link => link.textContent)).not.toContain('Issue #1058');
    expect(container.querySelectorAll('.accordion-item:not(:first-child) .badge')).toHaveLength(0);
    expect(container.querySelectorAll('.accordion-item:not(:first-child) a')).toHaveLength(0);
    expect(container.querySelectorAll('code')).toHaveLength(countCodeParts(changelog));
    expect(container.querySelector('.accordion-item:last-child .accordion-body p').textContent)
      .toBe('First alpha release of ELMO');
    expect(container.textContent).toContain('Added: Platforms and Instruments');
  });

  test('supports all five badges, multiple editions and both reference types safely', () => {
    const data = {
      currentVersion: '2.2.0',
      releases: [{
        version: '2.2.0', date: '2026-10-19', sections: [{
          title: 'Features:', entries: [
            { parts: [{ type: 'text', value: '<img src=x onerror=alert(1)>' }],
              editions: ['all'], references: [{ type: 'issue', number: 807 }] },
            { parts: [{ type: 'text', value: 'Standard and MSL ' }, { type: 'code', value: '<safe>' }],
              editions: ['elmo', 'msl'], references: [{ type: 'pull', number: 909 }] },
            { parts: [{ type: 'text', value: 'Other variants' }], editions: ['gem', 'igsn'] },
          ]
        }]
      }]
    };
    const container = document.getElementById('panel-changelog-content');
    renderChangelog(data, container);

    expect([...container.querySelectorAll('.badge')].map(badge => badge.textContent))
      .toEqual(['All ELMOs', 'ELMO', 'ELMO-MSL', 'ELMO-GEM', 'ELMO-IGSN']);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.querySelector('code').textContent).toBe('<safe>');
    const links = [...container.querySelectorAll('a')];
    expect(links.map(link => link.href)).toEqual([
      'https://github.com/McNamara84/elmo/issues/807',
      'https://github.com/McNamara84/elmo/pull/909'
    ]);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    }
  });

  test('rejects invalid editions and references before changing the page', () => {
    const container = document.getElementById('panel-changelog-content');
    container.textContent = 'Previous content';
    const invalid = JSON.parse(JSON.stringify(changelog));
    invalid.releases[0].sections[0].entries[0].editions = ['all', 'gem'];
    expect(() => renderChangelog(invalid, container)).toThrow('Invalid changelog editions');
    expect(container.textContent).toBe('Previous content');

    invalid.releases[0].sections[0].entries[0].editions = ['gem'];
    invalid.releases[0].sections[0].entries[0].references = [{ type: 'pull', number: '../bad' }];
    expect(() => validateChangelog(invalid)).toThrow('Invalid changelog references');
  });

  test('shows an error and retries on the next opening after a failed request', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, json: async () => changelog });
    global.fetch = fetchMock;
    initChangelog();
    const modal = document.getElementById('modal-changelog');
    const container = document.getElementById('panel-changelog-content');

    modal.dispatchEvent(new Event('show.bs.modal'));
    expect(container.querySelector('[role="status"]').textContent).toContain('Loading');
    await flush();
    expect(container.querySelector('[role="alert"]').textContent).toContain('could not be loaded');
    modal.dispatchEvent(new Event('show.bs.modal'));
    await flush();
    expect(container.querySelectorAll('.accordion-item')).toHaveLength(changelog.releases.length);
    modal.dispatchEvent(new Event('show.bs.modal'));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'json/changelog.json', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'json/changelog.json', { cache: 'no-store' });
    errorSpy.mockRestore();
    delete global.fetch;
  });

  test('shows an error and retries when fetched data cannot be rendered', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const invalid = { ...changelog, currentVersion: '0.0.0' };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => invalid })
      .mockResolvedValue({ ok: true, json: async () => changelog });
    global.fetch = fetchMock;
    initChangelog();
    const modal = document.getElementById('modal-changelog');
    const container = document.getElementById('panel-changelog-content');

    modal.dispatchEvent(new Event('show.bs.modal'));
    await flush();
    expect(container.querySelector('[role="alert"]').textContent).toContain('could not be loaded');
    expect(errorSpy).toHaveBeenCalledWith('Failed to load changelog:', expect.any(Error));

    modal.dispatchEvent(new Event('show.bs.modal'));
    await flush();
    expect(container.querySelectorAll('.accordion-item')).toHaveLength(changelog.releases.length);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
    delete global.fetch;
  });
});
