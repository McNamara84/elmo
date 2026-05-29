/**
 * @description Handles the combined Authors stack for person and institution authors.
 *
 * @module authorStack
 */

import { createRemoveButton, replaceHelpButtonInClonedRows, translateClonedRow } from '../functions.js';

$(document).ready(function () {
  const stack = $('[data-author-stack]').first();
  const payloadInput = $('input[name="authorsPayload"]').first();
  const summaryCount = $('[data-author-summary-count]').first();
  const contactSummary = $('[data-author-contact-summary]').first();
  const shell = stack.closest('[data-author-stack-shell]');
  const eventRoot = shell.length ? shell : stack;

  if (!stack.length || !payloadInput.length) {
    return;
  }

  const personTemplate = stack.find('[data-creator-row]').first().clone(false);
  const institutionTemplate = stack.find('[data-authorinstitution-row]').first().clone(false);
  const authorUiState = new Map();
  let entryIndex = stack.find('[data-author-entry-row]').length;
  const authorTypes = ['person', 'institution'];
  const affiliationFields = {
    person: { affiliationName: 'personAffiliation[]', rorName: 'authorPersonRorIds[]' },
    institution: { affiliationName: 'institutionAffiliation[]', rorName: 'authorInstitutionRorIds[]' }
  };

  function escapeSelector(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/[\0-\x1F\x7F"'\\#.:;,!?+*~=<>^$\[\](){}|\/\s-]/g, '\\$&');
  }

  function normalizeBaseId(id) {
    return id ? id.replace(/-\d+$/, '') : id;
  }

  function getEntryType(row) {
    return row.is('[data-authorinstitution-row]') || row.attr('data-author-entry-type') === 'institution'
      ? 'institution'
      : 'person';
  }

  function getEditPanelId(row) {
    const key = row.attr('data-author-entry-key') || `author-entry-${entryIndex}`;
    return `${key}-edit`.replace(/[^A-Za-z0-9_-]/g, '-');
  }

  function getEntryKey(row) {
    let entryKey = row.attr('data-author-entry-key');
    if (!entryKey) {
      entryKey = `author-${getEntryType(row)}-${entryIndex++}`;
      row.attr('data-author-entry-key', entryKey);
    }
    return entryKey;
  }

  function getRowState(row) {
    const entryKey = getEntryKey(row);
    let state = authorUiState.get(entryKey);
    if (!state) {
      state = {
        entryKey,
        type: getEntryType(row),
        isExpanded: row.find('[data-author-edit-panel]').first().hasClass('show') !== false,
        isContact: false,
        affiliations: []
      };
      authorUiState.set(entryKey, state);
    }
    return state;
  }

  function createSummary(type) {
    const iconClass = type === 'institution' ? 'bi-building' : 'bi-person';
    return $(
      `<div class="d-flex flex-wrap align-items-center gap-2 p-2" data-author-summary>
        <span class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary border text-body-secondary" style="width: 2rem; height: 2rem;" data-author-avatar>
          <i class="bi ${iconClass}" aria-hidden="true"></i>
        </span>
        <strong class="me-1" data-author-summary-name></strong>
        <span class="badge text-bg-light border text-uppercase" data-author-type-badge></span>
        <span class="badge text-bg-warning d-none" data-author-contact-badge></span>
        <span class="small text-body-secondary" data-author-summary-orcid></span>
        <span class="d-flex flex-wrap gap-1" data-author-summary-affiliations></span>
      </div>`
    );
  }

  function createActionButton(name, iconClass, label) {
    return $(
      `<button type="button" class="btn btn-outline-secondary btn-sm" ${name} aria-label="${label}">
        <i class="bi ${iconClass}" aria-hidden="true"></i>
      </button>`
    );
  }

  function createCardRemoveButton() {
    const button = createRemoveButton();
    button.attr({
      'data-author-remove': '',
      'aria-label': translate('authors.removeEntry', 'Remove author entry')
    }).addClass('btn-sm').removeAttr('style');
    button.html('<i class="bi bi-x-lg" aria-hidden="true"></i>');
    return button;
  }

  function getTypeLabel(type) {
    return type === 'institution'
      ? translate('authors.institution', 'Institution')
      : translate('authors.person', 'Person');
  }

  function createTypeSwitcher() {
    const switcher = $('<div class="border-bottom bg-body-tertiary p-2" data-author-type-switcher></div>');
    const group = $('<div class="btn-group btn-group-sm" role="group"></div>')
      .attr('aria-label', translate('authors.typeSwitcherLabel', 'Author type'));

    authorTypes.forEach(function (type) {
      group.append(
        $('<button type="button" class="btn btn-outline-dark" data-author-type-option></button>')
          .attr('data-author-type-option', type)
      );
    });

    return switcher.append(group);
  }

  function ensureTypeSwitcher(row) {
    const editPanel = row.find('[data-author-edit-panel]').first();
    if (!editPanel.children('[data-author-type-switcher]').length) {
      editPanel.prepend(createTypeSwitcher());
    }
    updateTypeSwitcher(row);
  }

  function createAffiliationEditor() {
    const editor = $('<div class="border-bottom p-2" data-author-affiliation-editor></div>');
    const header = $('<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2"></div>');
    const title = $('<strong data-author-affiliation-title></strong>');
    const count = $('<span class="badge text-bg-light border" data-author-affiliation-count>0</span>');
    const list = $('<div class="d-grid gap-2" data-author-affiliation-list></div>');
    const controls = $('<div class="input-group input-group-sm mt-2"></div>');
    const input = $('<input type="text" class="form-control" data-author-affiliation-input>');
    const searchButton = $('<button type="button" class="btn btn-outline-dark" data-author-affiliation-search></button>')
      .append('<i class="bi bi-search" aria-hidden="true"></i>');
    const addButton = $('<button type="button" class="btn btn-primary d-inline-flex align-items-center gap-1" data-author-affiliation-add></button>')
      .append('<i class="bi bi-plus-lg" aria-hidden="true"></i>')
      .append('<span data-author-affiliation-add-label></span>');
    const results = $('<div class="list-group mt-2 d-none" data-author-affiliation-results></div>');

    header.append(title, count);
    controls.append(input, searchButton, addButton);
    return editor.append(header, list, controls, results);
  }

  function getAffiliationFieldConfig(row) {
    return affiliationFields[getEntryType(row)] || affiliationFields.person;
  }

  function getAffiliationInputs(row, config = getAffiliationFieldConfig(row)) {
    return {
      affiliationInput: row.find(`input[name="${config.affiliationName}"]`).first(),
      rorInput: row.find(`input[name="${config.rorName}"]`).first()
    };
  }

  function hideLegacyAffiliationFields(row) {
    const fields = getAffiliationInputs(row);
    const wrapper = fields.affiliationInput.closest('[data-author-fields] > div');

    if (wrapper.length) {
      wrapper.addClass('d-none');
    } else {
      fields.affiliationInput.addClass('d-none').attr({ type: 'hidden', tabindex: '-1', 'aria-hidden': 'true' });
    }
    fields.rorInput.attr({ type: 'hidden', tabindex: '-1', 'aria-hidden': 'true' });
  }

  function ensureAffiliationEditor(row) {
    const editPanel = row.find('[data-author-edit-panel]').first();
    hideLegacyAffiliationFields(row);

    if (!editPanel.children('[data-author-affiliation-editor]').length) {
      const switcher = editPanel.children('[data-author-type-switcher]').first();
      const editor = createAffiliationEditor();
      if (switcher.length) {
        switcher.after(editor);
      } else {
        editPanel.prepend(editor);
      }
    }

    renderAffiliationEditor(row);
  }

  function setExpanded(row, isExpanded) {
    const state = getRowState(row);
    const editPanel = row.find('[data-author-edit-panel]').first();
    const toggle = row.find('[data-author-toggle-edit]').first();
    state.isExpanded = isExpanded;

    row.attr('data-author-expanded', isExpanded ? 'true' : 'false');
    editPanel.toggleClass('show', isExpanded).attr('aria-hidden', isExpanded ? 'false' : 'true');
    toggle.attr({
      'aria-expanded': isExpanded ? 'true' : 'false',
      'aria-label': isExpanded
        ? translate('authors.collapseEntry', 'Collapse author entry')
        : translate('authors.editEntry', 'Edit author entry')
    });
    toggle.find('i')
      .toggleClass('bi-pencil', !isExpanded)
      .toggleClass('bi-chevron-up', isExpanded);
  }

  function updateCardActionLabels(row) {
    const isExpanded = row.find('[data-author-edit-panel]').first().hasClass('show');
    row.find('[data-author-toggle-edit]').first().attr(
      'aria-label',
      isExpanded
        ? translate('authors.collapseEntry', 'Collapse author entry')
        : translate('authors.editEntry', 'Edit author entry')
    );
    row.find('[data-author-remove]').first().attr('aria-label', translate('authors.removeEntry', 'Remove author entry'));
  }

  function focusFirstEditableField(row) {
    const preferredInput = row.is('[data-authorinstitution-row]')
      ? row.find('input[name="authorinstitutionName[]"]').first()
      : row.find('input[name="familynames[]"]').first();
    const fallbackInput = row.find('[data-author-edit-panel] input:not([type="hidden"]), [data-author-edit-panel] select, [data-author-edit-panel] textarea').first();
    const target = preferredInput.length ? preferredInput : fallbackInput;

    if (target.length) {
      target.trigger('focus');
    }
  }

  function focusAfterRemove(nextFocusTarget) {
    const fallbackButton = shell.find('[data-author-add-type="person"]').first();
    const target = nextFocusTarget.length ? nextFocusTarget : fallbackButton;

    if (target.length) {
      target.trigger('focus');
    }
  }

  function ensureCardScaffold(row, type = getEntryType(row)) {
    row.attr('data-author-card', '').attr('data-author-entry-type', type);
    row.removeClass('row g-1 p-2').addClass('d-flex align-items-stretch border rounded bg-body overflow-hidden');

    const editPanelId = getEditPanelId(row);
    const summaryNameId = `${editPanelId}-summary-name`;
    const typeBadgeId = `${editPanelId}-type`;
    const dragButton = row.find('.drag-handle').first().detach();
    let dragZone = row.children('[data-author-drag-zone]').first().detach();
    if (!dragZone.length) {
      dragZone = $('<div class="d-flex align-items-center justify-content-center px-2 border-end bg-body-tertiary" data-author-drag-zone></div>');
    }
    if (dragButton.length && !dragZone.find('.drag-handle').length) {
      dragZone.empty().append(dragButton);
    }

    let actions = row.children('[data-author-actions]').first().detach();
    if (!actions.length) {
      actions = $('<div class="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-1 p-2 border-start bg-body-tertiary" data-author-actions></div>');
    }
    if (!actions.find('[data-author-toggle-edit]').length) {
      actions.append(createActionButton('data-author-toggle-edit', 'bi-pencil', translate('authors.editEntry', 'Edit author entry')).attr({
        'aria-controls': editPanelId,
        'aria-expanded': 'true'
      }));
    }
    if (!actions.find('[data-author-move-up]').length) {
      actions.append(createActionButton('data-author-move-up', 'bi-chevron-up', translate('authors.moveEntryUp', 'Move author up')));
    }
    if (!actions.find('[data-author-move-down]').length) {
      actions.append(createActionButton('data-author-move-down', 'bi-chevron-down', translate('authors.moveEntryDown', 'Move author down')));
    }
    if (!actions.find('[data-author-remove]').length) {
      actions.append(createCardRemoveButton());
    }

    let content = row.children('[data-author-card-content]').first().detach();
    if (!content.length) {
      const fields = row.children().not('[data-author-drag-zone], [data-author-actions]').detach();
      content = $('<div class="flex-grow-1 min-width-0" data-author-card-content></div>');
      content.append(createSummary(type));
      content.append(
        $('<div class="collapse show border-top" data-author-edit-panel></div>')
          .attr('id', editPanelId)
          .append($('<div class="row g-1 p-2" data-author-fields></div>').append(fields))
      );
    } else {
      content.find('[data-author-edit-panel]').first().attr('id', editPanelId).addClass('collapse');
    }

    row.empty().append(dragZone, content, actions);
    row.attr({
      role: 'group',
      'aria-labelledby': `${summaryNameId} ${typeBadgeId}`
    });
    row.find('[data-author-summary-name]').first().attr('id', summaryNameId);
    row.find('[data-author-type-badge]').first().attr('id', typeBadgeId);
    row.find('[data-author-edit-panel]').first().attr('aria-labelledby', summaryNameId);
    updateCardActionLabels(row);
    const contactToggle = row.find('label[for^="checkbox-author-contactperson"]');
    if (type === 'person') {
      contactToggle.attr('data-author-contact-toggle', '');
    } else {
      contactToggle.removeAttr('data-author-contact-toggle');
      row.find('[data-author-contact-badge]').remove();
    }

    ensureTypeSwitcher(row);
    ensureAffiliationEditor(row);
    setExpanded(row, getRowState(row).isExpanded !== false);

    return row;
  }

  function ensureAddActions() {
    let addActions = shell.find('[data-author-add-actions]').first();
    if (!addActions.length) {
      addActions = $('<div class="d-flex flex-wrap gap-2 mt-2" data-author-add-actions></div>');
      stack.after(addActions);
    }

    if (addActions.children().length) {
      return;
    }

    const addPersonButton = stack.find('#button-author-add').first().detach();
    const addInstitutionButton = stack.find('#button-authorinstitution-add').first().detach();
    if (addPersonButton.length) {
      addActions.append(addPersonButton);
    }
    if (addInstitutionButton.length) {
      addActions.append(addInstitutionButton);
    }
  }

  function updateIds(row, index) {
    const idMap = new Map();

    row.find('[id]').each(function () {
      const element = $(this);
      const oldId = element.attr('id');
      const newId = `${normalizeBaseId(oldId)}-${index}`;
      idMap.set(oldId, newId);
      element.attr('id', newId);
    });

    row.find('label[for]').each(function () {
      const label = $(this);
      const oldFor = label.attr('for');
      const newFor = idMap.get(oldFor) || `${normalizeBaseId(oldFor)}-${index}`;
      label.attr('for', newFor);
    });
  }

  function resetRow(row) {
    row.find('input, select, textarea').each(function () {
      const element = $(this);
      if (element.is(':checkbox') || element.is(':radio')) {
        element.prop('checked', false);
      } else {
        element.val('');
      }
      element.removeClass('is-invalid is-valid').removeAttr('aria-invalid');
    });

    row.find('.invalid-feedback, .valid-feedback').css('display', '');
    row.find('.tagify').remove();
  }

  function prepareClone(template, type, keepAddButton = false) {
    if (!template || !template.length) {
      return null;
    }

    const row = template.clone(false);
    const index = entryIndex++;
    row.attr('data-author-entry-key', `author-${type}-${index}`);
    updateIds(row, index);
    resetRow(row);
    row.find('.addAuthor, .addauthorinstitution').remove();
    ensureCardScaffold(row, type);
    replaceHelpButtonInClonedRows(row);
    translateClonedRow(row);
    setupContactFields(row);
    return row;
  }

  function initializeAffiliationAutocomplete(row) {
    ensureAffiliationEditor(row);
  }

  function addRow(type, options = {}) {
    const template = type === 'institution' ? institutionTemplate : personTemplate;
    const row = prepareClone(template, type);
    if (!row) {
      return null;
    }

    stack.append(row);
    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    initializeAffiliationAutocomplete(row);
    initializeTooltips(row);
    updatePayload();
    if (options.focus !== false) {
      focusFirstEditableField(row);
    }
    return row;
  }

  function normalizeRorId(value) {
    if (!value) {
      return '';
    }

    return String(value).trim().replace(/^https?:\/\/ror\.org\//, '');
  }

  function normalizeAffiliations(affiliations) {
    if (!Array.isArray(affiliations)) {
      return [];
    }

    return affiliations
      .map(function (affiliation) {
        if (typeof affiliation === 'string') {
          return { label: affiliation, rorId: '' };
        }

        const label = affiliation.label || affiliation.name || affiliation.value || '';
        const rorId = normalizeRorId(affiliation.rorId || affiliation.id || affiliation.affiliationIdentifier || '');
        return { label, rorId };
      })
      .filter(function (affiliation) {
        return affiliation.label !== '' || affiliation.rorId !== '';
      });
  }

  function writeAffiliations(row, affiliationName, rorName, affiliations) {
    const normalizedAffiliations = normalizeAffiliations(affiliations);
    const affiliationInput = row.find(`input[name="${affiliationName}"]`);
    const rorInput = row.find(`input[name="${rorName}"]`);
    const tagifyElement = affiliationInput.get(0);
    const tagifyTags = normalizedAffiliations.map(function (affiliation) {
      return {
        value: affiliation.label,
        label: affiliation.label,
        rorId: affiliation.rorId,
        id: affiliation.rorId
      };
    });

    rorInput.val(normalizedAffiliations.map(function (affiliation) {
      return affiliation.rorId;
    }).join(','));

    if (tagifyElement && tagifyElement._tagify) {
      tagifyElement._tagify.removeAllTags();
      tagifyElement._tagify.addTags(tagifyTags);
    }

    affiliationInput.val(JSON.stringify(tagifyTags));
    return normalizedAffiliations;
  }

  function setAffiliations(row, affiliationName, rorName, affiliations) {
    const normalizedAffiliations = writeAffiliations(row, affiliationName, rorName, affiliations);
    renderAffiliationEditor(row);
    return normalizedAffiliations;
  }

  function setRowAffiliations(row, affiliations, options = {}) {
    const config = getAffiliationFieldConfig(row);
    const normalizedAffiliations = writeAffiliations(row, config.affiliationName, config.rorName, affiliations);
    const state = getRowState(row);
    state.affiliations = normalizedAffiliations;

    if (options.render !== false) {
      renderAffiliationEditor(row);
    }

    return normalizedAffiliations;
  }

  function createPayloadRow(author, keepAddButton) {
    const type = author.type === 'institution' ? 'institution' : 'person';
    const template = type === 'institution' ? institutionTemplate : personTemplate;
    const row = prepareClone(template, type, keepAddButton);

    if (!row) {
      return null;
    }

    if (type === 'institution') {
      row.find('input[name="authorinstitutionName[]"]').val(author.institutionname || author.institutionName || '');
      setAffiliations(row, 'institutionAffiliation[]', 'authorInstitutionRorIds[]', author.affiliations || []);
    } else {
      row.find('input[name="familynames[]"]').val(author.familyname || author.familyName || '');
      row.find('input[name="givennames[]"]').val(author.givenname || author.givenName || '');
      row.find('input[name="orcids[]"]').val(String(author.orcid || '').replace(/^https?:\/\/orcid\.org\//, ''));
      row.find('input[name="contacts[]"]').prop('checked', author.isContact === true);
      row.find('input[name="cpEmail[]"]').val(author.email || '');
      row.find('input[name="cpOnlineResource[]"]').val(author.website || '');
      setAffiliations(row, 'personAffiliation[]', 'authorPersonRorIds[]', author.affiliations || []);
      setupContactFields(row);
    }

    return row;
  }

  function normalizeAuthorsInput(authors) {
    if (typeof authors === 'string') {
      try {
        const parsed = JSON.parse(authors);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }

    return Array.isArray(authors) ? authors : [];
  }

  function setAuthors(authors) {
    const normalizedAuthors = normalizeAuthorsInput(authors);
    const hasPerson = normalizedAuthors.some(function (author) { return author.type === 'person'; });
    const hasInstitution = normalizedAuthors.some(function (author) { return author.type === 'institution'; });
    let keptPersonAddButton = false;
    let keptInstitutionAddButton = false;

    stack.empty();
    authorUiState.clear();

    normalizedAuthors.forEach(function (author) {
      const type = author.type === 'institution' ? 'institution' : 'person';
      const keepAddButton = type === 'person'
        ? !keptPersonAddButton
        : !keptInstitutionAddButton;
      const row = createPayloadRow(author, keepAddButton);

      if (!row) {
        return;
      }

      if (type === 'person' && keepAddButton) {
        keptPersonAddButton = true;
      }
      if (type === 'institution' && keepAddButton) {
        keptInstitutionAddButton = true;
      }

      stack.append(row);
      initializeAffiliationAutocomplete(row);
      initializeTooltips(row);
    });

    if (!hasPerson) {
      const row = createPayloadRow({ type: 'person', affiliations: [] }, true);
      if (row) {
        stack.prepend(row);
        initializeAffiliationAutocomplete(row);
        initializeTooltips(row);
      }
    }

    if (!hasInstitution && institutionTemplate.length) {
      const row = createPayloadRow({ type: 'institution', affiliations: [] }, true);
      if (row) {
        stack.append(row);
        initializeAffiliationAutocomplete(row);
        initializeTooltips(row);
      }
    }

    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }

    return updatePayload();
  }

  function initializeTooltips(row) {
    if (window.bootstrap && typeof window.bootstrap.Tooltip === 'function') {
      row.find('[data-bs-toggle="tooltip"]').each(function () {
        new window.bootstrap.Tooltip(this);
      });
    }
  }

  function setupContactFields(row) {
    if (!row.is('[data-creator-row]')) {
      return;
    }

    const checkbox = row.find('input[name="contacts[]"]');
    const contactToggle = row.find(`label[for="${checkbox.attr('id')}"]`).first();
    const contactFields = row.find('.contact-person-input');

    function updateFields() {
      contactToggle
        .addClass('btn btn-outline-primary d-inline-flex align-items-center gap-1')
        .removeClass('lh-sm round-corners-left con-reduce')
        .attr('data-author-contact-toggle', '')
        .removeAttr('aria-pressed')
        .toggleClass('active', checkbox.prop('checked'))
        .empty()
        .append('<i class="bi bi-person-lines-fill" aria-hidden="true"></i>')
        .append($('<span></span>').text(
          checkbox.prop('checked')
            ? translate('authors.contactPersonLabel', 'Contact person')
            : translate('authors.markAsContact', 'Mark as contact')
        ));

      if (checkbox.prop('checked')) {
        contactFields.show();
      } else {
        contactFields.hide().find('input').val('');
      }
    }

    checkbox.off('change.authorStack click.authorStack');
    checkbox.on('change.authorStack click.authorStack', function () {
      updateFields();
      updatePayload();
    });
    updateFields();
  }

  function parseRorIds(value) {
    if (!value) {
      return [];
    }
    return String(value).split(',').map(function (rorId) {
      return rorId.trim().replace(/^https?:\/\/ror\.org\//, '') || null;
    });
  }

  function parseAffiliationValues(input) {
    const element = input.get(0);
    if (element && element._tagify && Array.isArray(element._tagify.value)) {
      return element._tagify.value;
    }

    const rawValue = input.val();
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [{ value: rawValue, label: rawValue }];
    }
  }

  function buildAffiliations(row, affiliationName, rorName) {
    const affiliationInput = row.find(`input[name="${affiliationName}"]`);
    const rorIds = parseRorIds(row.find(`input[name="${rorName}"]`).val());

    return parseAffiliationValues(affiliationInput)
      .map(function (affiliation, index) {
        const label = affiliation.label || affiliation.name || affiliation.value || '';
        const rorId = affiliation.rorId || affiliation.id || rorIds[index] || '';
        return { label, rorId };
      })
      .filter(function (affiliation) {
        return affiliation.label !== '' || affiliation.rorId !== '';
      });
  }

  function getRowAffiliations(row) {
    const config = getAffiliationFieldConfig(row);
    return buildAffiliations(row, config.affiliationName, config.rorName);
  }

  function updateAffiliationEditorTexts(editor) {
    editor.find('[data-author-affiliation-title]').text(translate('authors.affiliations', 'Affiliations'));
    editor.find('[data-author-affiliation-input]').attr({
      placeholder: translate('general.affiliation', 'Affiliation'),
      'aria-label': translate('general.affiliation', 'Affiliation')
    });
    editor.find('[data-author-affiliation-search]').attr('aria-label', translate('authors.affiliationSearch', 'Search affiliation'));
    editor.find('[data-author-affiliation-add]').attr('aria-label', translate('authors.affiliationAdd', 'Add affiliation'));
    editor.find('[data-author-affiliation-add-label]').text(translate('authors.affiliationAdd', 'Add affiliation'));
  }

  function createAffiliationChip(affiliation, index, count) {
    const label = affiliation.label || '';
    const rorId = normalizeRorId(affiliation.rorId || '');
    const chip = $('<div class="border rounded bg-body p-2" data-author-affiliation-chip></div>')
      .attr('data-author-affiliation-index', String(index))
      .attr('data-author-affiliation-ror-id', rorId);
    const group = $('<div class="input-group input-group-sm"></div>');
    const moveUp = $('<button type="button" class="btn btn-outline-dark" data-author-affiliation-move-up></button>')
      .attr('aria-label', translate('authors.affiliationMoveUp', 'Move affiliation up'))
      .prop('disabled', index === 0)
      .append('<i class="bi bi-chevron-up" aria-hidden="true"></i>');
    const moveDown = $('<button type="button" class="btn btn-outline-dark" data-author-affiliation-move-down></button>')
      .attr('aria-label', translate('authors.affiliationMoveDown', 'Move affiliation down'))
      .prop('disabled', index === count - 1)
      .append('<i class="bi bi-chevron-down" aria-hidden="true"></i>');
    const labelInput = $('<input type="text" class="form-control" data-author-affiliation-label>')
      .attr('aria-label', translate('authors.affiliationEdit', 'Edit affiliation'))
      .val(label);
    const rorSegment = $('<span class="input-group-text small" data-author-affiliation-ror></span>')
      .attr('aria-label', rorId ? `${translate('authors.affiliationRorId', 'ROR ID')} ${rorId}` : translate('authors.affiliationRorId', 'ROR ID'))
      .toggleClass('d-none', rorId === '')
      .text(rorId);
    const remove = $('<button type="button" class="btn btn-outline-danger" data-author-affiliation-remove></button>')
      .attr('aria-label', translate('authors.affiliationRemove', 'Remove affiliation'))
      .append('<i class="bi bi-x-lg" aria-hidden="true"></i>');

    group.append(moveUp, moveDown, labelInput, rorSegment, remove);
    return chip.append(group);
  }

  function renderAffiliationEditor(row) {
    const editor = row.find('[data-author-affiliation-editor]').first();
    if (!editor.length) {
      return;
    }

    const affiliations = getRowAffiliations(row);
    const list = editor.find('[data-author-affiliation-list]').empty();
    updateAffiliationEditorTexts(editor);
    editor.find('[data-author-affiliation-count]').text(String(affiliations.length));

    affiliations.forEach(function (affiliation, index) {
      list.append(createAffiliationChip(affiliation, index, affiliations.length));
    });
  }

  function readEditorAffiliations(row) {
    return row.find('[data-author-affiliation-chip]').map(function () {
      const chip = $(this);
      return {
        label: String(chip.find('[data-author-affiliation-label]').val() || '').trim(),
        rorId: normalizeRorId(chip.attr('data-author-affiliation-ror-id') || chip.find('[data-author-affiliation-ror]').text())
      };
    }).get().filter(function (affiliation) {
      return affiliation.label !== '' || affiliation.rorId !== '';
    });
  }

  function syncEditorAffiliations(row) {
    setRowAffiliations(row, readEditorAffiliations(row), { render: false });
    updatePayload();
  }

  function addAffiliation(row, affiliation) {
    const editor = row.find('[data-author-affiliation-editor]').first();
    const input = editor.find('[data-author-affiliation-input]').first();
    const affiliations = readEditorAffiliations(row);
    const normalizedAffiliation = normalizeAffiliations([affiliation])[0];

    if (!normalizedAffiliation) {
      return;
    }

    affiliations.push(normalizedAffiliation);
    setRowAffiliations(row, affiliations);
    input.val('').trigger('focus');
    editor.find('[data-author-affiliation-results]').empty().addClass('d-none');
    updatePayload();
  }

  function getAffiliationSearchFunction() {
    if (typeof window.searchAffiliationsFromServer === 'function') {
      return window.searchAffiliationsFromServer;
    }
    if (typeof searchAffiliationsFromServer === 'function') {
      return searchAffiliationsFromServer;
    }
    return null;
  }

  function normalizeAffiliationSearchResult(result) {
    return normalizeAffiliations([{
      label: result.label || result.name || result.value || result.mappedValue || '',
      rorId: result.rorId || result.id || result.affiliationIdentifier || ''
    }])[0];
  }

  function renderAffiliationSearchResults(row, results) {
    const editor = row.find('[data-author-affiliation-editor]').first();
    const resultContainer = editor.find('[data-author-affiliation-results]').empty();
    const normalizedResults = results.map(normalizeAffiliationSearchResult).filter(Boolean);

    if (!normalizedResults.length) {
      resultContainer.addClass('d-none');
      return;
    }

    normalizedResults.forEach(function (affiliation) {
      const button = $('<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between gap-2" data-author-affiliation-result></button>')
        .attr('data-author-affiliation-label-value', affiliation.label)
        .attr('data-author-affiliation-ror-value', affiliation.rorId);
      button.append($('<span></span>').text(affiliation.label));
      if (affiliation.rorId) {
        button.append($('<span class="badge text-bg-light border text-body-secondary"></span>').text(affiliation.rorId));
      }
      resultContainer.append(button);
    });

    resultContainer.removeClass('d-none');
  }

  async function searchAffiliations(row) {
    const editor = row.find('[data-author-affiliation-editor]').first();
    const input = editor.find('[data-author-affiliation-input]').first();
    const query = String(input.val() || '').trim();
    const searchFunction = getAffiliationSearchFunction();

    if (!searchFunction || query.length < 2) {
      renderAffiliationSearchResults(row, []);
      return;
    }

    const results = await searchFunction(query, 20);
    renderAffiliationSearchResults(row, Array.isArray(results) ? results : []);
  }

  function hasPersonContent(author) {
    return author.familyname !== '' ||
      author.givenname !== '' ||
      author.orcid !== '' ||
      author.email !== '' ||
      author.website !== '' ||
      author.isContact ||
      author.affiliations.length > 0;
  }

  function hasInstitutionContent(author) {
    return author.institutionname !== '' || author.affiliations.length > 0;
  }

  function rowHasContent(row) {
    return getEntryType(row) === 'institution'
      ? readInstitution(row, 0) !== null
      : readPerson(row, 0) !== null;
  }

  function updateTypeSwitcher(row) {
    const switcher = row.find('[data-author-type-switcher]').first();
    if (!switcher.length) {
      return;
    }

    const currentType = getEntryType(row);
    const isLocked = rowHasContent(row);
    const lockText = translate('authors.typeSwitchLocked', 'Type can only be changed while this entry is empty.');

    switcher.find('[role="group"]').attr('aria-label', translate('authors.typeSwitcherLabel', 'Author type'));
    switcher.find('[data-author-type-option]').each(function () {
      const button = $(this);
      const type = button.attr('data-author-type-option') === 'institution' ? 'institution' : 'person';
      const isActive = type === currentType;
      const isDisabled = isLocked && !isActive;

      button
        .text(getTypeLabel(type))
        .toggleClass('active', isActive)
        .attr('aria-pressed', isActive ? 'true' : 'false')
        .prop('disabled', isDisabled)
        .attr('aria-disabled', isDisabled ? 'true' : 'false');

      if (isDisabled) {
        button.attr({
          title: lockText,
          'data-bs-title': lockText
        });
      } else {
        button.removeAttr('title data-bs-title');
      }
    });
  }

  function switchEntryType(row, targetType) {
    const currentType = getEntryType(row);
    if (!authorTypes.includes(targetType) || targetType === currentType) {
      return row;
    }

    if (rowHasContent(row)) {
      updateTypeSwitcher(row);
      return row;
    }

    const entryKey = getEntryKey(row);
    const isExpanded = row.find('[data-author-edit-panel]').first().hasClass('show');
    const template = targetType === 'institution' ? institutionTemplate : personTemplate;
    const replacement = prepareClone(template, targetType);

    if (!replacement) {
      return row;
    }

    row.replaceWith(replacement);
    authorUiState.delete(entryKey);
    setExpanded(replacement, isExpanded);
    initializeAffiliationAutocomplete(replacement);
    initializeTooltips(replacement);
    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    updatePayload();
    focusFirstEditableField(replacement);
    return replacement;
  }

  function readPerson(row, order) {
    const author = {
      type: 'person',
      entryKey: row.attr('data-author-entry-key') || `author-person-${order}`,
      order,
      familyname: String(row.find('input[name="familynames[]"]').val() || '').trim(),
      givenname: String(row.find('input[name="givennames[]"]').val() || '').trim(),
      orcid: String(row.find('input[name="orcids[]"]').val() || '').trim(),
      isContact: row.find('input[name="contacts[]"]').prop('checked') === true,
      email: String(row.find('input[name="cpEmail[]"]').val() || '').trim(),
      website: String(row.find('input[name="cpOnlineResource[]"]').val() || '').trim(),
      affiliations: buildAffiliations(row, 'personAffiliation[]', 'authorPersonRorIds[]')
    };

    return hasPersonContent(author) ? author : null;
  }

  function readInstitution(row, order) {
    const author = {
      type: 'institution',
      entryKey: row.attr('data-author-entry-key') || `author-institution-${order}`,
      order,
      institutionname: String(row.find('input[name="authorinstitutionName[]"]').val() || '').trim(),
      affiliations: buildAffiliations(row, 'institutionAffiliation[]', 'authorInstitutionRorIds[]')
    };

    return hasInstitutionContent(author) ? author : null;
  }

  function collectPayload() {
    const payload = [];
    stack.children('[data-author-entry-row]').each(function () {
      const row = $(this);
      const order = payload.length;
      const author = row.is('[data-creator-row]')
        ? readPerson(row, order)
        : readInstitution(row, order);

      if (author) {
        payload.push(author);
      }
    });
    return payload;
  }

  function translate(key, fallback, variables = {}) {
    const translated = window.elmo && typeof window.elmo.translate === 'function'
      ? window.elmo.translate(key)
      : null;
    const template = typeof translated === 'string' && translated !== '' ? translated : fallback;

    return Object.keys(variables).reduce(function (result, variableName) {
      return result.replace(new RegExp(`\\{${variableName}\\}`, 'g'), String(variables[variableName]));
    }, template);
  }

  function countSummary(count, singularKey, pluralKey, summaryKey, singularFallback, pluralFallback) {
    const label = count === 1
      ? translate(singularKey, singularFallback)
      : translate(pluralKey, pluralFallback);

    return translate(summaryKey, '{count} {label}', { count, label });
  }

  function updateSummary(payload) {
    const authorCount = payload.length;
    const contactCount = payload.filter(function (author) {
      return author.type === 'person' && author.isContact === true;
    }).length;

    summaryCount.text(countSummary(
      authorCount,
      'authors.entrySingular',
      'authors.entryPlural',
      'authors.entriesSummary',
      'entry',
      'entries'
    ));
    summaryCount.attr({ 'aria-live': 'polite', 'aria-atomic': 'true' });
    contactSummary.attr({ 'aria-live': 'polite', 'aria-atomic': 'true' });

    if (contactCount > 0) {
      contactSummary
        .removeClass('text-bg-warning')
        .addClass('text-bg-success')
        .text(countSummary(
          contactCount,
          'authors.contactPersonSingular',
          'authors.contactPersonPlural',
          'authors.contactsSummary',
          'contact person',
          'contact persons'
        ));
    } else {
      contactSummary
        .removeClass('text-bg-success')
        .addClass('text-bg-warning')
        .text(translate('authors.contactRequired', 'at least 1 contact required'));
    }
  }

  function createAffiliationBadge(affiliation) {
    const badge = $('<span class="badge text-bg-light border text-body-secondary"></span>');
    const label = affiliation.label || '';
    const rorId = normalizeRorId(affiliation.rorId || '');
    badge.text(rorId ? `${label} ${rorId}` : label);
    return badge;
  }

  function getInitials(givenname, familyname) {
    const initials = [givenname, familyname]
      .map(function (part) { return part.trim().charAt(0).toUpperCase(); })
      .filter(Boolean)
      .join('');
    return initials || '?';
  }

  function syncRowState(row) {
    const state = getRowState(row);
    const isPerson = getEntryType(row) === 'person';
    const affiliationName = isPerson ? 'personAffiliation[]' : 'institutionAffiliation[]';
    const rorName = isPerson ? 'authorPersonRorIds[]' : 'authorInstitutionRorIds[]';

    state.type = getEntryType(row);
    state.isExpanded = row.find('[data-author-edit-panel]').first().hasClass('show');
    state.isContact = isPerson && row.find('input[name="contacts[]"]').prop('checked') === true;
    state.affiliations = buildAffiliations(row, affiliationName, rorName);
    return state;
  }

  function renderEntrySummary(row) {
    const type = getEntryType(row);
    const isPerson = type === 'person';
    const familyname = String(row.find('input[name="familynames[]"]').val() || '').trim();
    const givenname = String(row.find('input[name="givennames[]"]').val() || '').trim();
    const institutionName = String(row.find('input[name="authorinstitutionName[]"]').val() || '').trim();
    const name = isPerson
      ? [givenname, familyname].filter(Boolean).join(' ')
      : institutionName;
    const fallbackName = isPerson ? translate('authors.person', 'Person') : translate('authors.institution', 'Institution');
    const typeLabel = isPerson ? translate('authors.person', 'Person') : translate('authors.institution', 'Institution');
    const summary = row.find('[data-author-summary]').first();
    const state = syncRowState(row);

    summary.find('[data-author-summary-name]').text(name || fallbackName);
    summary.find('[data-author-type-badge]').text(typeLabel);
    const avatar = summary.find('[data-author-avatar]').first();
    if (isPerson) {
      avatar.text(getInitials(givenname, familyname));
    } else if (!avatar.find('.bi-building').length) {
      avatar.html('<i class="bi bi-building" aria-hidden="true"></i>');
    }

    const contactBadge = summary.find('[data-author-contact-badge]');
    if (isPerson && state.isContact) {
      contactBadge.removeClass('d-none').text(translate('authors.contactPersonBadge', 'Contact person'));
    } else {
      contactBadge.addClass('d-none');
    }

    const orcid = String(row.find('input[name="orcids[]"]').val() || '').trim();
    summary.find('[data-author-summary-orcid]').text(orcid ? `${translate('general.orcid', 'ORCID')} ${orcid}` : '');

    const affiliationName = isPerson ? 'personAffiliation[]' : 'institutionAffiliation[]';
    const rorName = isPerson ? 'authorPersonRorIds[]' : 'authorInstitutionRorIds[]';
    const affiliationSummary = summary.find('[data-author-summary-affiliations]').empty();
    state.affiliations.forEach(function (affiliation) {
      affiliationSummary.append(createAffiliationBadge(affiliation));
    });
    updateTypeSwitcher(row);
  }

  function updateReorderControls() {
    const rows = stack.children('[data-author-entry-row]');
    rows.each(function (index) {
      const row = $(this);
      const isFirst = index === 0;
      const isLast = index === rows.length - 1;
      row.find('[data-author-move-up]')
        .prop('disabled', isFirst)
        .attr('aria-disabled', isFirst ? 'true' : 'false')
        .attr('aria-label', translate('authors.moveEntryUp', 'Move author up'));
      row.find('[data-author-move-down]')
        .prop('disabled', isLast)
        .attr('aria-disabled', isLast ? 'true' : 'false')
        .attr('aria-label', translate('authors.moveEntryDown', 'Move author down'));
    });
  }

  function moveEntry(row, direction) {
    const target = direction < 0
      ? row.prev('[data-author-entry-row]')
      : row.next('[data-author-entry-row]');

    if (!target.length) {
      return;
    }

    if (direction < 0) {
      target.before(row);
    } else {
      target.after(row);
    }

    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    updatePayload();
    const preferredButton = row.find(direction < 0 ? '[data-author-move-up]' : '[data-author-move-down]');
    const fallbackButton = row.find(direction < 0 ? '[data-author-move-down]' : '[data-author-move-up]');
    const focusButton = preferredButton.prop('disabled') ? fallbackButton : preferredButton;
    focusButton.trigger('focus');
  }

  function updatePayload() {
    stack.children('[data-author-entry-row]').each(function () {
      renderEntrySummary($(this));
    });
    updateReorderControls();
    const payload = collectPayload();
    payloadInput.val(JSON.stringify(payload));
    updateSummary(payload);
    document.dispatchEvent(new CustomEvent('authorsPayload:updated', { detail: { payload } }));
    return payload;
  }

  function ensureRowsForField(name, requiredCount) {
    const selector = `[name="${escapeSelector(name)}"]`;
    let currentCount = stack.find(selector).length;
    const type = name === 'authorinstitutionName[]' || name === 'institutionAffiliation[]' || name === 'authorInstitutionRorIds[]'
      ? 'institution'
      : 'person';

    while (currentCount < requiredCount) {
      const row = addRow(type, { focus: false });
      if (!row) {
        break;
      }
      currentCount = stack.find(selector).length;
    }
  }

  ensureAddActions();

  stack.children('[data-author-entry-row]').each(function () {
    const row = $(this);
    ensureCardScaffold(row);
    setupContactFields(row);
  });

  if (typeof stack.sortable === 'function') {
    stack.sortable({
      items: '> [data-author-entry-row]',
      handle: '.drag-handle',
      cancel: 'input, textarea, select, option',
      axis: 'y',
      tolerance: 'pointer',
      containment: 'parent',
      update: updatePayload
    });
  }

  eventRoot.on('click', '#button-author-add, [data-author-add-type="person"]', function () {
    addRow('person');
  });

  eventRoot.on('click', '#button-authorinstitution-add, [data-author-add-type="institution"]', function () {
    addRow('institution');
  });

  stack.on('click', '[data-author-toggle-edit]', function (event) {
    event.preventDefault();
    const row = $(this).closest('[data-author-entry-row]');
    const isExpanded = row.find('[data-author-edit-panel]').first().hasClass('show');
    setExpanded(row, !isExpanded);
  });

  stack.on('click', '[data-author-type-option]', function (event) {
    event.preventDefault();
    const button = $(this);
    if (button.prop('disabled')) {
      return;
    }

    const row = button.closest('[data-author-entry-row]');
    switchEntryType(row, button.attr('data-author-type-option'));
  });

  stack.on('click', '[data-author-move-up], [data-author-move-down]', function (event) {
    event.preventDefault();
    const button = $(this);
    if (button.prop('disabled')) {
      return;
    }

    moveEntry(button.closest('[data-author-entry-row]'), button.is('[data-author-move-up]') ? -1 : 1);
  });

  stack.on('input', '[data-author-affiliation-label]', function () {
    syncEditorAffiliations($(this).closest('[data-author-entry-row]'));
  });

  stack.on('keydown', '[data-author-affiliation-input]', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      $(this).closest('[data-author-affiliation-editor]').find('[data-author-affiliation-add]').trigger('click');
    }
  });

  stack.on('click', '[data-author-affiliation-add]', function () {
    const row = $(this).closest('[data-author-entry-row]');
    const input = row.find('[data-author-affiliation-input]').first();
    const label = String(input.val() || '').trim();
    if (label) {
      addAffiliation(row, { label, rorId: '' });
    }
  });

  stack.on('click', '[data-author-affiliation-search]', function () {
    const row = $(this).closest('[data-author-entry-row]');
    searchAffiliations(row).catch(function (error) {
      console.error('Affiliation search error:', error);
    });
  });

  stack.on('click', '[data-author-affiliation-result]', function () {
    const result = $(this);
    addAffiliation(result.closest('[data-author-entry-row]'), {
      label: result.attr('data-author-affiliation-label-value') || '',
      rorId: result.attr('data-author-affiliation-ror-value') || ''
    });
  });

  stack.on('click', '[data-author-affiliation-remove]', function () {
    const row = $(this).closest('[data-author-entry-row]');
    const affiliations = readEditorAffiliations(row);
    const index = Number($(this).closest('[data-author-affiliation-chip]').attr('data-author-affiliation-index'));
    affiliations.splice(index, 1);
    setRowAffiliations(row, affiliations);
    updatePayload();
  });

  stack.on('click', '[data-author-affiliation-move-up], [data-author-affiliation-move-down]', function () {
    const button = $(this);
    const row = button.closest('[data-author-entry-row]');
    const affiliations = readEditorAffiliations(row);
    const index = Number(button.closest('[data-author-affiliation-chip]').attr('data-author-affiliation-index'));
    const direction = button.is('[data-author-affiliation-move-up]') ? -1 : 1;
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= affiliations.length) {
      return;
    }

    [affiliations[index], affiliations[targetIndex]] = [affiliations[targetIndex], affiliations[index]];
    setRowAffiliations(row, affiliations);
    updatePayload();
  });

  stack.on('click', '.removeButton', function () {
    const row = $(this).closest('[data-author-entry-row]');
    const entryKey = getEntryKey(row);
    const nextFocusTarget = row.next('[data-author-entry-row]').find('[data-author-toggle-edit]').first();
    row.remove();
    authorUiState.delete(entryKey);
    updatePayload();
    focusAfterRemove(nextFocusTarget);
  });

  stack.on('input change', 'input, select, textarea', function () {
    if ($(this).is('[data-author-affiliation-input], [data-author-affiliation-label]')) {
      return;
    }

    const row = $(this).closest('[data-author-entry-row]');
    if ($(this).is('input[name="contacts[]"]')) {
      setupContactFields(row);
    }
    updatePayload();
  });

  document.addEventListener('autosave:ensure-array-field', function (event) {
    const detail = event.detail || {};
    if (!detail.name || !detail.requiredCount || detail.requiredCount <= 1) {
      return;
    }

    ensureRowsForField(detail.name, detail.requiredCount);
  });

  document.addEventListener('translationsLoaded', function () {
    stack.children('[data-author-entry-row]').each(function () {
      const row = $(this);
      setupContactFields(row);
      renderEntrySummary(row);
      renderAffiliationEditor(row);
      updateCardActionLabels(row);
    });
    updateReorderControls();
    updateSummary(collectPayload());
  });

  window.authorStack = {
    addPerson: function () { return addRow('person'); },
    addInstitution: function () { return addRow('institution'); },
    setAuthors,
    updatePayload,
    collectPayload
  };

  updatePayload();
});