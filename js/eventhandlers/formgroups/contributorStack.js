/** Combined, ordered contributor cards. The hidden payload is only a transport field. */
$(document).ready(function () {
  const shell = document.querySelector('[data-contributor-shell]');
  const stack = shell?.querySelector('[data-contributor-stack]');
  const payloadInput = shell?.querySelector('input[name="contributorsPayload"]');
  if (!stack || !payloadInput) return;

  const templates = {
    person: document.querySelector('#contributor-person-template')?.content.querySelector('[contributor-person-row]'),
    institution: document.querySelector('#contributor-institution-template')?.content.querySelector('[contributors-row]')
  };
  let nextId = 0;
  let rendering = false;
  const t = (key, fallback) => window.elmo?.translate?.(key) || fallback;

  function rolesFromValue(value) {
    if (Array.isArray(value)) return [...new Set(value.map(role => String(role?.value ?? role).trim()).filter(Boolean))];
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return rolesFromValue(parsed);
    } catch (_error) { /* Legacy plain role value. */ }
    return String(value).split(',').map(role => role.trim()).filter(Boolean);
  }

  function affiliationPairs(value, rorValue) {
    let tags = [];
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed)) tags = parsed;
    } catch (_error) {
      tags = String(value || '').split(',').filter(Boolean);
    }
    const rorIds = String(rorValue || '').split(',');
    return tags.map((tag, index) => ({
      label: String(tag?.label ?? tag?.value ?? tag?.name ?? tag).trim(),
      rorId: String(tag?.rorId ?? tag?.id ?? rorIds[index] ?? '').replace(/^https?:\/\/ror\.org\//, '').trim()
    })).filter(pair => pair.label);
  }

  function field(card, name) {
    return card.querySelector(`[name="${name}"]`);
  }

  function typeOf(card) {
    return card.dataset.contributorType;
  }

  function read(card) {
    const type = typeOf(card);
    const person = type === 'person';
    const roles = rolesFromValue(field(card, person ? 'cbPersonRoles[]' : 'cbOrganisationRoles[]')?.value);
    const affiliations = affiliationPairs(
      field(card, person ? 'cbAffiliation[]' : 'OrganisationAffiliation[]')?.value,
      field(card, person ? 'cbpRorIds[]' : 'hiddenOrganisationRorId[]')?.value
    );
    const entry = {
      type,
      familyname: person ? (field(card, 'cbPersonLastname[]')?.value || '').trim() : '',
      givenname: person ? (field(card, 'cbPersonFirstname[]')?.value || '').trim() : '',
      orcid: person ? (field(card, 'cbORCID[]')?.value || '').trim() : '',
      institutionname: person ? '' : (field(card, 'cbOrganisationName[]')?.value || '').trim(),
      roles,
      affiliations,
      email: (field(card, 'cbContactEmail[]')?.value || '').trim(),
      website: (field(card, 'cbContactWebsite[]')?.value || '').trim()
    };
    return entry;
  }

  function hasContent(entry) {
    return Boolean(entry.familyname || entry.givenname || entry.orcid || entry.institutionname ||
      entry.roles.length || entry.affiliations.length || entry.email || entry.website);
  }

  function collectPayload() {
    return Array.from(stack.children).filter(card => card.matches('[data-contributor-card]'))
      .map(read).filter(hasContent).map((entry, order) => ({ ...entry, order }));
  }

  function renderCard(card) {
    const entry = read(card);
    const person = entry.type === 'person';
    const name = person ? [entry.givenname, entry.familyname].filter(Boolean).join(' ') : entry.institutionname;
    const typeLabel = t(person ? 'contributors.person' : 'contributors.institution', person ? 'Person' : 'Institution');
    card.querySelector('[data-contributor-name]').textContent = name || typeLabel;
    const avatar = card.querySelector('[data-contributor-avatar]');
    avatar.setAttribute('aria-label', typeLabel);
    avatar.title = typeLabel;
    avatar.querySelector('i').className = `bi ${person ? 'bi-person' : 'bi-building'}`;
    const roleSummary = card.querySelector('[data-contributor-roles]');
    roleSummary.textContent = entry.roles.join(', ');
    const contact = entry.roles.includes('Contact Person') && (person || window.ELMO_FEATURES?.showContactInstitution === true);
    const contactFields = card.querySelector('[data-contributor-contact-fields]');
    contactFields.classList.toggle('d-none', !contact);
    field(card, 'cbContactEmail[]').required = contact;
    const switcher = card.querySelector('[data-contributor-type-switcher]');
    if (switcher) {
      switcher.querySelectorAll('[data-contributor-type-option]').forEach(button => {
        const active = button.dataset.contributorTypeOption === entry.type;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        button.disabled = !active && hasContent(entry);
      });
    }
  }

  function updatePayload() {
    if (rendering) return collectPayload();
    Array.from(stack.children).forEach(renderCard);
    const cards = Array.from(stack.children);
    cards.forEach((card, index) => {
      card.querySelector('[data-contributor-move-up]').disabled = index === 0;
      card.querySelector('[data-contributor-move-down]').disabled = index === cards.length - 1;
    });
    const payload = collectPayload();
    payloadInput.value = JSON.stringify(payload);
    shell.querySelector('[data-contributor-add-actions]').classList.toggle('mt-2', cards.length > 0);
    const count = document.querySelector('[data-contributor-summary-count]');
    if (count) count.textContent = `${payload.length} ${t(payload.length === 1 ? 'contributors.entrySingular' : 'contributors.entryPlural', payload.length === 1 ? 'entry' : 'entries')}`;
    document.dispatchEvent(new CustomEvent('contributorsPayload:updated', { detail: { payload } }));
    return payload;
  }

  function makeButton(action, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-secondary btn-sm';
    button.setAttribute(action, '');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;
    return button;
  }

  function addContactFields(panel, id) {
    const fields = document.createElement('div');
    fields.className = 'row g-2 mt-1 d-none';
    fields.dataset.contributorContactFields = '';
    fields.innerHTML = `<div class="col-12 col-md-6"><div class="form-floating">
      <input type="url" class="form-control" id="contributor-contact-website-${id}" name="cbContactWebsite[]">
      <label for="contributor-contact-website-${id}" data-translate="contactPersons.website">Website</label>
    </div></div><div class="col-12 col-md-6"><div class="form-floating">
      <input type="email" class="form-control" id="contributor-contact-email-${id}" name="cbContactEmail[]">
      <label for="contributor-contact-email-${id}" data-translate="contactPersons.email">Email address</label>
      <div class="invalid-feedback" data-translate="contactPersons.emailInvalid">Please provide a valid email address.</div>
    </div></div>`;
    panel.append(fields);
  }

  function buildCard(type) {
    const template = templates[type];
    if (!template) return null;
    const id = nextId++;
    const card = document.createElement('div');
    card.className = 'd-flex align-items-stretch border rounded bg-body overflow-hidden';
    card.dataset.contributorCard = '';
    card.dataset.contributorType = type;
    card.setAttribute('role', 'group');
    const panelId = `contributor-edit-${id}`;
    const summaryId = `contributor-summary-${id}`;

    const dragZone = document.createElement('div');
    dragZone.className = 'd-flex align-items-center px-2 border-end bg-body-tertiary';
    const drag = makeButton('data-contributor-drag', 'bi-grip-vertical', t('contributors.dragHandle', 'Drag to change order'));
    drag.classList.add('drag-handle');
    dragZone.append(drag);

    const middle = document.createElement('div');
    middle.className = 'flex-grow-1 min-width-0';
    const summary = document.createElement('div');
    summary.className = 'd-flex flex-wrap align-items-center gap-2 p-2';
    summary.id = summaryId;
    summary.innerHTML = '<span class="d-inline-flex flex-shrink-0 align-items-center justify-content-center rounded-circle bg-dark text-white" style="width: 2rem; height: 2rem;" role="img" data-contributor-avatar><i class="bi" aria-hidden="true"></i></span><strong data-contributor-name></strong><span class="text-body-secondary" data-contributor-roles></span>';
    const panel = document.createElement('div');
    panel.className = 'collapse show border-top p-2';
    panel.id = panelId;
    panel.dataset.contributorEditPanel = '';

    const types = Object.keys(templates).filter(key => templates[key]);
    if (types.length === 2) {
      const switcher = document.createElement('div');
      switcher.className = 'btn-group btn-group-sm mb-2';
      switcher.dataset.contributorTypeSwitcher = '';
      switcher.setAttribute('role', 'group');
      switcher.setAttribute('aria-label', t('contributors.typeSwitcherLabel', 'Contributor type'));
      types.forEach(key => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-dark';
        button.dataset.contributorTypeOption = key;
        button.textContent = t(key === 'person' ? 'contributors.person' : 'contributors.institution', key === 'person' ? 'Person' : 'Institution');
        switcher.append(button);
      });
      panel.append(switcher);
    }

    const fields = template.cloneNode(true);
    fields.querySelector('.addContributorPerson, .addContributor')?.closest('.col-2')?.remove();
    fields.querySelectorAll('[id]').forEach(element => { element.id = `${element.id}-${id}`; });
    fields.querySelectorAll('label[for]').forEach(label => { label.htmlFor = `${label.htmlFor}-${id}`; });
    fields.classList.add('g-1');
    const affiliationName = type === 'person' ? 'cbAffiliation[]' : 'OrganisationAffiliation[]';
    const affiliationColumn = fields.querySelector(`[name="${affiliationName}"]`)
      ?.closest('[class^="col-"], [class*=" col-"]');
    if (affiliationColumn) affiliationColumn.className = 'col-12 p-1';
    fields.querySelectorAll(':scope > [class^="col-"], :scope > [class*=" col-"]').forEach(column => {
      if (column === affiliationColumn) return;
      column.className = type === 'person'
        ? 'col-12 col-md-6 col-lg-3 p-1'
        : column.querySelector('[name="cbOrganisationName[]"]')
          ? 'col-12 col-lg-8 p-1'
          : 'col-12 col-lg-4 p-1';
    });
    panel.append(fields);
    addContactFields(panel, id);
    if (affiliationColumn) {
      const affiliationRow = document.createElement('div');
      affiliationRow.className = 'row g-1 mt-1';
      affiliationRow.dataset.contributorAffiliationRow = '';
      affiliationRow.append(affiliationColumn);
      panel.append(affiliationRow);
    }
    middle.append(summary, panel);

    const actions = document.createElement('div');
    actions.className = 'd-flex flex-column flex-sm-row align-items-center justify-content-center gap-1 p-2 border-start bg-body-tertiary';
    const toggle = makeButton('data-contributor-toggle-edit', 'bi-chevron-up', t('contributors.collapseEntry', 'Collapse contributor entry'));
    toggle.setAttribute('aria-controls', panelId);
    toggle.setAttribute('aria-expanded', 'true');
    const up = makeButton('data-contributor-move-up', 'bi-chevron-up', t('contributors.moveEntryUp', 'Move contributor up'));
    const down = makeButton('data-contributor-move-down', 'bi-chevron-down', t('contributors.moveEntryDown', 'Move contributor down'));
    const remove = makeButton('data-contributor-remove', 'bi-x-lg', t('contributors.removeEntry', 'Remove contributor entry'));
    remove.classList.replace('btn-outline-secondary', 'btn-danger');
    actions.append(toggle, up, down, remove);
    card.append(dragZone, middle, actions);
    card.setAttribute('aria-labelledby', summaryId);
    card.dataset.contributorExpanded = 'true';
    return card;
  }

  function setExpanded(card, open) {
    const panel = card.querySelector('[data-contributor-edit-panel]');
    const toggle = card.querySelector('[data-contributor-toggle-edit]');
    panel.classList.toggle('show', open);
    panel.setAttribute('aria-hidden', String(!open));
    card.dataset.contributorExpanded = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    const label = t(open ? 'contributors.collapseEntry' : 'contributors.editEntry',
      open ? 'Collapse contributor entry' : 'Edit contributor entry');
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.querySelector('i').classList.toggle('bi-chevron-up', open);
    toggle.querySelector('i').classList.toggle('bi-pencil', !open);
  }

  function initializeWidgets(card) {
    const person = typeOf(card) === 'person';
    const role = field(card, person ? 'cbPersonRoles[]' : 'cbOrganisationRoles[]');
    const affiliation = field(card, person ? 'cbAffiliation[]' : 'OrganisationAffiliation[]');
    const ror = field(card, person ? 'cbpRorIds[]' : 'hiddenOrganisationRorId[]');
    if (typeof window.setupRolesDropdown === 'function' && role) {
      window.setupRolesDropdown(person ? ['person', 'both'] : ['institution', 'both'], `#${role.id}`);
    }
    if (typeof window.autocompleteAffiliations === 'function' && affiliation && ror) {
      window.autocompleteAffiliations(affiliation.id, ror.id);
    }
    if (typeof window.applyTranslations === 'function') window.applyTranslations();
  }

  function add(type, options = {}) {
    const card = buildCard(type);
    if (!card) return null;
    stack.append(card);
    initializeWidgets(card);
    if (typeof $(stack).sortable === 'function') $(stack).sortable('refresh');
    updatePayload();
    if (options.focus !== false) card.querySelector(type === 'person' ? '[name="cbPersonLastname[]"]' : '[name="cbOrganisationName[]"]')?.focus();
    return card;
  }

  function writeTags(input, values) {
    if (!input) return;
    const tags = values.map(value => typeof value === 'string' ? { value } : { value: value.label, rorId: value.rorId, id: value.rorId });
    if (input._tagify) {
      input._tagify.removeAllTags();
      input._tagify.addTags(tags);
    }
    input.value = JSON.stringify(tags);
  }

  function setContributors(entries) {
    rendering = true;
    stack.replaceChildren();
    (Array.isArray(entries) ? entries : []).forEach(entry => {
      const type = entry?.type === 'institution' ? 'institution' : 'person';
      const card = add(type, { focus: false });
      if (!card) return;
      const person = type === 'person';
      const values = person
        ? { 'cbPersonLastname[]': entry.familyname, 'cbPersonFirstname[]': entry.givenname, 'cbORCID[]': entry.orcid }
        : { 'cbOrganisationName[]': entry.institutionname ?? entry.name };
      Object.entries(values).forEach(([name, value]) => { if (field(card, name)) field(card, name).value = value || ''; });
      const roles = rolesFromValue(entry.roles);
      if (!person && window.ELMO_FEATURES?.showContactInstitution !== true) {
        const index = roles.indexOf('Contact Person');
        if (index >= 0) roles.splice(index, 1);
      }
      writeTags(field(card, person ? 'cbPersonRoles[]' : 'cbOrganisationRoles[]'), roles);
      const affiliations = Array.isArray(entry.affiliations) ? entry.affiliations.map(item => ({
        label: item?.label ?? item?.value ?? item?.name ?? String(item),
        rorId: item?.rorId ?? item?.id ?? ''
      })) : [];
      writeTags(field(card, person ? 'cbAffiliation[]' : 'OrganisationAffiliation[]'), affiliations);
      field(card, person ? 'cbpRorIds[]' : 'hiddenOrganisationRorId[]').value = affiliations.map(item => item.rorId).join(',');
      field(card, 'cbContactEmail[]').value = entry.email || '';
      field(card, 'cbContactWebsite[]').value = entry.website || '';
    });
    rendering = false;
    updatePayload();
  }

  shell.addEventListener('click', event => {
    const addButton = event.target.closest('[data-contributor-add-type]');
    if (addButton) { add(addButton.dataset.contributorAddType); return; }
    const button = event.target.closest('button');
    const card = button?.closest('[data-contributor-card]');
    if (!card) return;
    if (button.matches('[data-contributor-remove]')) {
      card.remove();
      updatePayload();
      shell.querySelector('[data-contributor-add-type]')?.focus();
    } else if (button.matches('[data-contributor-toggle-edit]')) {
      const panel = card.querySelector('[data-contributor-edit-panel]');
      setExpanded(card, !panel.classList.contains('show'));
    } else if (button.matches('[data-contributor-move-up], [data-contributor-move-down]')) {
      const sibling = button.matches('[data-contributor-move-up]') ? card.previousElementSibling : card.nextElementSibling;
      if (sibling) {
        sibling[button.matches('[data-contributor-move-up]') ? 'before' : 'after'](card);
        updatePayload();
        button.focus();
      }
    } else if (button.matches('[data-contributor-type-option]')) {
      if (button.disabled || hasContent(read(card))) return;
      const replacement = buildCard(button.dataset.contributorTypeOption);
      if (!replacement) return;
      card.replaceWith(replacement);
      initializeWidgets(replacement);
      updatePayload();
      replacement.querySelector('input:not([type="hidden"])')?.focus();
    }
  });
  stack.addEventListener('input', updatePayload);
  stack.addEventListener('change', updatePayload);
  document.addEventListener('translationsLoaded', () => {
    Array.from(stack.children).forEach(renderCard);
    updatePayload();
  });
  if (typeof $(stack).sortable === 'function') {
    $(stack).sortable({
      items: '> [data-contributor-card]',
      handle: '.drag-handle',
      // jQuery UI cancels all buttons by default, including our drag handle.
      cancel: 'input, textarea, select, option, button:not(.drag-handle)',
      axis: 'y',
      tolerance: 'pointer',
      containment: 'parent',
      update: updatePayload
    });
  }
  window.contributorStack = {
    addPerson: () => add('person'),
    addInstitution: () => add('institution'),
    collectPayload,
    updatePayload,
    setContributors
  };
  updatePayload();
});
