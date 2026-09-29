/**
 * Render the changelog JSON without interpreting entry text as HTML.
 * @typedef {{type: 'text'|'code', value: string}} ChangelogPart
 * @typedef {{parts: ChangelogPart[], editions?: string[], references?: {type: 'issue'|'pull', number: number}[], children?: ChangelogEntry[]}} ChangelogEntry
 * @typedef {{currentVersion: string, releases: {version: string, date: string, sections: {title: string, entries: ChangelogEntry[]}[], notes?: {type: 'paragraph', parts: ChangelogPart[]}[]}[]}} ChangelogData
 */

export const EDITION_BADGES = Object.freeze({
  all: ['All ELMOs', 'changelog-edition-badge--all'],
  elmo: ['ELMO', 'changelog-edition-badge--elmo'],
  msl: ['ELMO-MSL', 'changelog-edition-badge--msl'],
  gem: ['ELMO-GEM', 'changelog-edition-badge--gem'],
  igsn: ['ELMO-IGSN', 'changelog-edition-badge--igsn'],
});

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:RC\d+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPOSITORY_URL = 'https://github.com/McNamara84/elmo';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0 || parts.some(part =>
    !part || !['text', 'code'].includes(part.type) || !isNonEmptyString(part.value)
  )) {
    throw new Error('Invalid changelog text parts');
  }
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Invalid changelog entry');
  validateParts(entry.parts);
  if (entry.children !== undefined) {
    if (!Array.isArray(entry.children)) throw new Error('Invalid nested changelog entries');
    entry.children.forEach(validateEntry);
  }
  if (entry.editions !== undefined) {
    if (!Array.isArray(entry.editions) || entry.editions.length === 0 ||
        new Set(entry.editions).size !== entry.editions.length ||
        entry.editions.some(edition => !Object.hasOwn(EDITION_BADGES, edition)) ||
        (entry.editions.includes('all') && entry.editions.length !== 1)) {
      throw new Error('Invalid changelog editions');
    }
  }
  if (entry.references !== undefined) {
    if (!Array.isArray(entry.references) || entry.references.some(reference =>
      !reference || !['issue', 'pull'].includes(reference.type) ||
      !Number.isSafeInteger(reference.number) || reference.number <= 0
    )) {
      throw new Error('Invalid changelog references');
    }
  }
}

/**
 * Check data before creating any links or changing the displayed content.
 * @param {ChangelogData} data
 * @returns {ChangelogData}
 */
export function validateChangelog(data) {
  if (!data || typeof data !== 'object' || !VERSION_PATTERN.test(data.currentVersion) ||
      !Array.isArray(data.releases) || data.releases.length === 0 ||
      data.releases[0].version !== data.currentVersion) {
    throw new Error('Invalid changelog releases');
  }
  const seenVersions = new Set();
  for (const release of data.releases) {
    if (!release || !VERSION_PATTERN.test(release.version) || seenVersions.has(release.version) ||
        !DATE_PATTERN.test(release.date) || !Array.isArray(release.sections)) {
      throw new Error('Invalid changelog release');
    }
    seenVersions.add(release.version);
    for (const section of release.sections) {
      if (!section || !isNonEmptyString(section.title) || !Array.isArray(section.entries)) {
        throw new Error('Invalid changelog section');
      }
      section.entries.forEach(validateEntry);
    }
    if (release.notes !== undefined) {
      if (!Array.isArray(release.notes) || release.notes.some(note => {
        if (!note || note.type !== 'paragraph') return true;
        try { validateParts(note.parts); return false; } catch { return true; }
      })) {
        throw new Error('Invalid changelog notes');
      }
    }
  }
  return data;
}

function appendParts(parent, parts) {
  for (const part of parts) {
    if (part.type === 'code') {
      const code = document.createElement('code');
      code.textContent = part.value;
      parent.append(code);
    } else {
      parent.append(document.createTextNode(part.value));
    }
  }
}

function renderEntries(entries) {
  const list = document.createElement('ul');
  for (const entry of entries) {
    const item = document.createElement('li');
    for (const edition of entry.editions || []) {
      const [label, colorClass] = EDITION_BADGES[edition];
      const badge = document.createElement('span');
      badge.className = `badge changelog-edition-badge ${colorClass} me-1`;
      badge.textContent = label;
      item.append(badge);
    }
    appendParts(item, entry.parts);
    for (const reference of entry.references || []) {
      const link = document.createElement('a');
      const path = reference.type === 'issue' ? 'issues' : 'pull';
      link.href = `${REPOSITORY_URL}/${path}/${reference.number}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'ms-2';
      link.textContent = `${reference.type === 'issue' ? 'Issue' : 'PR'} #${reference.number}`;
      item.append(link);
    }
    if (entry.children?.length) item.append(renderEntries(entry.children));
    list.append(item);
  }
  return list;
}

/**
 * Build the Bootstrap accordion from the validated JSON data.
 * @param {ChangelogData} rawData
 * @param {HTMLElement} container
 * @returns {void}
 */
export function renderChangelog(rawData, container) {
  const data = validateChangelog(rawData);
  const accordion = document.createElement('div');
  accordion.id = 'accordion-changelog';
  accordion.className = 'accordion';

  data.releases.forEach((release, index) => {
    const headingId = `heading-changelog-version${index}`;
    const collapseId = `collapse-changelog-version${index}`;
    const item = document.createElement('div');
    item.className = 'accordion-item';
    const heading = document.createElement('h2');
    heading.className = 'accordion-header';
    heading.id = headingId;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `accordion-button${index ? ' collapsed' : ''}`;
    button.dataset.bsToggle = 'collapse';
    button.dataset.bsTarget = `#${collapseId}`;
    button.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
    button.setAttribute('aria-controls', collapseId);
    button.textContent = `Version ${release.version} - ${release.date.replaceAll('-', '/')}`;
    heading.append(button);

    const collapse = document.createElement('div');
    collapse.id = collapseId;
    collapse.className = `accordion-collapse collapse${index === 0 ? ' show' : ''}`;
    collapse.setAttribute('aria-labelledby', headingId);
    collapse.dataset.bsParent = '#accordion-changelog';
    const body = document.createElement('div');
    body.className = 'accordion-body';
    if (release.sections.length) {
      const sections = document.createElement('ul');
      for (const section of release.sections) {
        const group = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = section.title;
        group.append(title, renderEntries(section.entries));
        sections.append(group);
      }
      body.append(sections);
    }
    for (const note of release.notes || []) {
      const paragraph = document.createElement('p');
      appendParts(paragraph, note.parts);
      body.append(paragraph);
    }
    collapse.append(body);
    item.append(heading, collapse);
    accordion.append(item);
  });
  container.replaceChildren(accordion);
}

function showStatus(container, key, fallback, role) {
  const message = document.createElement('p');
  message.className = role === 'alert' ? 'alert alert-danger' : 'text-muted';
  message.setAttribute('role', role);
  message.dataset.translate = key;
  message.textContent = window.elmo?.translate?.(key) || fallback;
  container.replaceChildren(message);
}

/**
 * Fetch fresh data whenever the modal opens, including after a deployment.
 * @returns {void}
 */
export function initChangelog() {
  const modal = document.getElementById('modal-changelog');
  const container = document.getElementById('panel-changelog-content');
  if (!modal || !container) return;
  let pending = null;
  modal.addEventListener('show.bs.modal', () => {
    if (pending) return;
    showStatus(container, 'modals.changelog.loading', 'Loading changelog…', 'status');
    pending = fetch('json/changelog.json', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Changelog request failed: ${response.status}`);
        return response.json();
      })
      .then(data => {
        renderChangelog(data, container);
      })
      .catch(error => {
        console.error('Failed to load changelog:', error);
        showStatus(container, 'modals.changelog.error', 'The changelog could not be loaded. Please try again.', 'alert');
      })
      .finally(() => { pending = null; });
  });
}
