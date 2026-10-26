/**
 * @description Handles the combined Authors stack for person and institution authors.
 *
 * @module authorStack
 */

import { createRemoveButton, replaceHelpButtonInClonedRows, translateClonedRow } from '../functions.js';
import { updateHelpStatus } from '../../help.js';
import { createAffiliationEditor, createAffiliationBadge, normalizeRorId, normalizeAffiliations } from '../../affiliationEditor.js';

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
  const personHelpSectionIds = ['help-author-orcid', 'help-contactperson-email', 'help-contactperson-website'];

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
        <span class="badge elmo-badge border text-uppercase" data-author-type-badge></span>
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
        $('<button type="button" class="btn btn-outline-secondary" data-author-type-option></button>')
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


  function createAffiliationHelpButton() {
    return $('<i class="bi bi-question-circle-fill help-icon-author-affiliation" ' +
      'data-help-section-id="help-author-affiliation" ' +
      'data-author-affiliation-help></i>');
  }

  function syncAffiliationHelpButtons() {
    const editors = stack.find('[data-author-affiliation-editor]');
    editors.each(function () {
      const editor = $(this);
      const help = editor.find('[data-author-affiliation-help]');
      if (!help.length) {
        editor.find('[data-author-affiliation-title]').first().after(createAffiliationHelpButton());
      }
      editor.find('[data-author-affiliation-help]').addClass('help-icon-author-affiliation');
    });
  }

  function syncPersonHelpButtons() {
    const personRows = stack.find('[data-creator-row]');

    personRows.each(function () {
      const row = $(this);
      personHelpSectionIds.forEach(function (sectionId) {
        // Target the icon only. Cloned-row placeholders copy data-help-section-id
        // onto the wrapper span, and that duplicate must not be treated as a help icon.
        const help = row.find(`i[data-help-section-id="${sectionId}"]`);
        if (help.length) {
          help.addClass('help-icon-author-affiliation');
        }
      });
    });
  }

  function helpIconField(icon) {
    const groupField = icon.closest('.input-group')
      .find('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')
      .first();
    if (groupField.length) {
      return groupField;
    }

    const precedingField = icon.closest('span').prevAll('input:not([type="hidden"]):not([type="checkbox"])').first();
    if (precedingField.length) {
      return precedingField;
    }

    return icon.closest('[data-author-affiliation-editor]').find('[data-author-affiliation-input]').first();
  }

  function isFieldShown(field) {
    if (!field.length || field.attr('type') === 'hidden') {
      return false;
    }

    let node = field.get(0);
    while (node && node !== stack.get(0)) {
      const $node = $(node);
      if ($node.css('display') === 'none' || $node.hasClass('d-none')) {
        return false;
      }
      node = node.parentElement;
    }
    return Boolean(node);
  }

  function isFirstHelpIconOfKind(icon) {
    const field = helpIconField(icon);
    if (!isFieldShown(field)) {
      return false;
    }

    const name = field.attr('name');
    const peers = name
      ? stack.find(`input[name="${escapeSelector(name)}"]`)
      : stack.find('[data-author-affiliation-input]');
    const firstShown = peers.filter(function () {
      return isFieldShown($(this));
    }).first();
    return firstShown.get(0) === field.get(0);
  }

  function setHelpIconVisibility(icon, shouldBeVisible) {
    const wrapper = icon.closest('span.input-group-text');

    icon.closest('.input-group').find('.orcid-search-btn')
      .toggleClass('input-right-no-round-corners', shouldBeVisible)
      .toggleClass('input-right-with-round-corners', !shouldBeVisible);

    icon.toggleClass('d-none', !shouldBeVisible).attr('aria-hidden', shouldBeVisible ? 'false' : 'true');
    if (!wrapper.length) {
      return;
    }

    wrapper.toggleClass('d-none', !shouldBeVisible).attr('aria-hidden', shouldBeVisible ? 'false' : 'true');
    wrapper.css('display', shouldBeVisible ? '' : 'none');
    if (shouldBeVisible) {
      wrapper
        .removeClass('help-placeholder')
        .removeAttr('data-help-section-id')
        .css({ visibility: '', width: '', height: '' });
      return;
    }

    wrapper.css('visibility', 'hidden');
  }

  function applyAuthorHelpStatus() {
    syncAffiliationHelpButtons();
    syncPersonHelpButtons();

    const helpOn = (localStorage.getItem('helpStatus') || 'help-on') === 'help-on';
    stack.find('.help-icon-author-affiliation').each(function () {
      const icon = $(this);
      setHelpIconVisibility(icon, helpOn && isFirstHelpIconOfKind(icon));
    });
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
    const fieldsContainer = row.find('[data-author-fields]').first();
    hideLegacyAffiliationFields(row);

    let editor = row.find('[data-author-affiliation-editor]').first();
    if (!editor.length) {
      const config = getAffiliationFieldConfig(row);
      const instance = createAffiliationEditor({
        card: row[0], group: 'author', translate, helpButton: createAffiliationHelpButton(),
        readAffiliations: () => getRowAffiliations(row),
        writeAffiliations: values => {
          writeAffiliations(row, config.affiliationName, config.rorName, values);
          row.find(`input[name="${config.affiliationName}"]`).trigger('change');
          window.validateAllMandatoryFields?.();
        },
        onChange: updatePayload
      });
      editor = instance.element;
    }

    if (fieldsContainer.length && !editor.parent().is(fieldsContainer)) {
      fieldsContainer.append(editor);
    } else if (!fieldsContainer.length && !editor.parent().is(editPanel)) {
      editPanel.append(editor);
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
    removeEmptyFieldColumns(row);
    setExpanded(row, getRowState(row).isExpanded !== false);

    return row;
  }

  function ensureAddActions() {
    let addActions = shell.find('[data-author-add-actions]').first();
    if (!addActions.length) {
      addActions = $('<div class="d-flex flex-wrap gap-2 mt-2" data-author-add-actions></div>');
      stack.after(addActions);
    }
    addActions.addClass('align-items-center');

    if (addActions.children().length) {
      return;
    }

    const addPersonButton = stack.find('#button-author-add').first().detach();
    const addInstitutionButton = stack.find('#button-authorinstitution-add').first().detach();
    if (addPersonButton.length) {
      addActions.append(prepareAddActionButton(addPersonButton));
    }
    if (addInstitutionButton.length) {
      addActions.append(prepareAddActionButton(addInstitutionButton));
    }
  }

  function prepareAddActionButton(button) {
    return button
      .removeClass('add-button')
      .addClass('text-nowrap px-3')
      .removeAttr('style');
  }

  function removeEmptyFieldColumns(row) {
    row.find('[data-author-fields] > div').filter(function () {
      const column = $(this);
      return column.text().trim() === '' && column.find('input, select, textarea, button, label').length === 0;
    }).remove();
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
    // Keep person help icons as real buttons on every clone. applyAuthorHelpStatus()
    // shows the first icon of each kind, including after type switch/delete/reorder.
    replaceHelpButtonInClonedRows(row, "input-right-with-round-corners", personHelpSectionIds);

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
    applyAuthorHelpStatus();
    if (options.focus !== false) {
      focusFirstEditableField(row);
    }
    return row;
  }

  function writeAffiliations(row, affiliationName, rorName, affiliations) {
    const normalizedAffiliations = normalizeAffiliations(affiliations, { keepEmpty: true });
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

  /**
   * Replace author cards from an import or an autosaved draft.
   * @param {Array<Object>|string} authors Structured or serialized author entries.
   * @param {Object} [options={}] Restore settings.
   * @param {boolean} [options.restoreUiState=false] Restore unconfirmed affiliation text only for autosave.
   * @returns {Array<Object>} Confirmed metadata synchronized to the transport field.
   */
  function setAuthors(authors, options = {}) {
    const normalizedAuthors = normalizeAuthorsInput(authors);
    let keptPersonAddButton = false;
    let keptInstitutionAddButton = false;

    stack.find('[data-affiliation-editor]').each(function () { this.affiliationEditor?.destroy(); });
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
      if (options.restoreUiState) row.find('[data-affiliation-editor]')[0]?.affiliationEditor.setPendingInput(author._ui?.affiliationInput || '');
      initializeTooltips(row);
    });

    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }

    applyAuthorHelpStatus();
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
    const contactToggleWrapper = contactToggle.closest('.input-group-append');
    const contactFields = row.find('.contact-person-input');

    function updateFields() {
      contactToggleWrapper
        .addClass('d-flex align-self-stretch')
        .css('min-height', 'calc(3.5rem + 2px)');
      contactToggle
        .addClass('btn d-inline-flex align-items-center gap-1 h-100 mb-0')
        .removeClass('btn-outline-primary btn-primary btn-outline-warning btn-warning text-dark lh-sm round-corners-left con-reduce')
        .addClass(checkbox.prop('checked') ? 'btn-warning text-dark' : 'btn-outline-warning')
        .attr('data-author-contact-toggle', '')
        .removeAttr('aria-pressed')
        .css('min-height', 'calc(3.5rem + 2px)')
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
      applyAuthorHelpStatus();
    }

    checkbox.off('change.authorStack click.authorStack');
    checkbox.on('change.authorStack', function () {
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

  function buildAffiliations(row, affiliationName, rorName, keepEmpty = false) {
    const affiliationInput = row.find(`input[name="${affiliationName}"]`);
    const rorIds = parseRorIds(row.find(`input[name="${rorName}"]`).val());

    return parseAffiliationValues(affiliationInput)
      .map(function (affiliation, index) {
        const label = affiliation.label ?? affiliation.name ?? affiliation.value ?? '';
        const rorId = affiliation.rorId || affiliation.id || rorIds[index] || '';
        return { label, rorId };
      })
      .filter(function (affiliation) {
        return keepEmpty || affiliation.label !== '' || affiliation.rorId !== '';
      });
  }

  function getRowAffiliations(row) {
    const config = getAffiliationFieldConfig(row);
    return buildAffiliations(row, config.affiliationName, config.rorName, true);
  }

  function renderAffiliationEditor(row) {
    row.find('[data-affiliation-editor]')[0]?.affiliationEditor?.render();
  }

  function validateAffiliationEditor(row) {
    return row.find('[data-affiliation-editor]')[0]?.affiliationEditor?.validate() ?? true;
  }

  function validateAuthorAffiliationEditors() {
    let isValid = true;

    stack.children('[data-author-entry-row]').each(function () {
      if (!validateAffiliationEditor($(this))) {
        isValid = false;
      }
    });

    return isValid;
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
    if (row.find('[data-affiliation-editor]')[0]?.affiliationEditor.getPendingInput().trim()) return true;
    return getEntryType(row) === 'institution'
      ? readInstitution(row, 0) !== null
      : readPerson(row, 0) !== null;
  }

  // Affiliations belong to both card types; only type-specific fields prevent a safe switch.
  function rowHasTypeSpecificContent(row) {
    const institution = getEntryType(row) === 'institution';
    const author = institution ? readInstitution(row, 0, true) : readPerson(row, 0, true);
    author.affiliations = [];
    return institution ? hasInstitutionContent(author) : hasPersonContent(author);
  }

  function updateTypeSwitcher(row) {
    const switcher = row.find('[data-author-type-switcher]').first();
    if (!switcher.length) {
      return;
    }

    const currentType = getEntryType(row);
    const isLocked = rowHasTypeSpecificContent(row);
    const lockText = translate('authors.typeSwitchLocked', 'Clear the name, ORCID and contact details to change the type. Affiliations will be kept.');

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

    if (rowHasTypeSpecificContent(row)) {
      updateTypeSwitcher(row);
      return row;
    }

    const entryKey = getEntryKey(row);
    const editor = row.find('[data-affiliation-editor]')[0]?.affiliationEditor;
    const affiliations = editor?.getAffiliations() || getRowAffiliations(row);
    const pendingInput = editor?.getPendingInput() || '';
    const isExpanded = row.find('[data-author-edit-panel]').first().hasClass('show');
    const template = targetType === 'institution' ? institutionTemplate : personTemplate;
    const replacement = prepareClone(template, targetType);

    if (!replacement) {
      return row;
    }

    editor?.destroy();
    row.replaceWith(replacement);
    authorUiState.delete(entryKey);
    setExpanded(replacement, isExpanded);
    initializeAffiliationAutocomplete(replacement);
    const replacementEditor = replacement.find('[data-affiliation-editor]')[0]?.affiliationEditor;
    if (affiliations.length) replacementEditor?.setAffiliations(affiliations);
    if (pendingInput) replacementEditor?.setPendingInput(pendingInput);
    initializeTooltips(replacement);
    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    updatePayload();
    applyAuthorHelpStatus();
    focusFirstEditableField(replacement);
    return replacement;
  }

  function readPerson(row, order, includeEmpty = false) {
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

    return includeEmpty || hasPersonContent(author) ? author : null;
  }

  function readInstitution(row, order, includeEmpty = false) {
    const author = {
      type: 'institution',
      entryKey: row.attr('data-author-entry-key') || `author-institution-${order}`,
      order,
      institutionname: String(row.find('input[name="authorinstitutionName[]"]').val() || '').trim(),
      affiliations: buildAffiliations(row, 'institutionAffiliation[]', 'authorInstitutionRorIds[]')
    };

    return includeEmpty || hasInstitutionContent(author) ? author : null;
  }

  /**
   * Collect cards in DOM order, including pending-only cards and invalid empty label slots.
   * @returns {Array<Object>} Draft copies with optional _ui.affiliationInput, never export payloads.
   */
  function collectDraftEntries() {
    const entries = [];
    stack.children('[data-author-entry-row]').each(function () {
      const row = $(this);
      const input = row.find('[data-affiliation-editor]')[0]?.affiliationEditor.getPendingInput() || '';
      const entry = getEntryType(row) === 'person' ? readPerson(row, entries.length, true) : readInstitution(row, entries.length, true);
      entry.affiliations = row.find('[data-affiliation-editor]')[0]?.affiliationEditor.getAffiliations() || entry.affiliations;
      if (!input.trim() && !(entry.type === 'person' ? hasPersonContent(entry) : hasInstitutionContent(entry))) return;
      if (input) entry._ui = { affiliationInput: input };
      entries.push(entry);
    });
    return entries;
  }

  /**
   * Synchronize ORCID/import affiliations through the editor so fields and summaries agree.
   * @param {HTMLElement|jQuery} card Target author card.
   * @param {Array<string|Object>} values Ordered affiliation values.
   * @returns {void}
   */
  function setEntryAffiliations(card, values) {
    $(card).find('[data-affiliation-editor]')[0]?.affiliationEditor.setAffiliations(values);
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

    if (typeof window.updateSharedContactStatus === 'function') {
      window.updateSharedContactStatus();
      return;
    }

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


  function getInitials(givenname, familyname) {
    const initials = [givenname, familyname]
      .map(function (part) { return part.trim().charAt(0).toUpperCase(); })
      .filter(Boolean)
      .join('');
    return initials;
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
      const initials = getInitials(givenname, familyname);
      if (initials) {
        avatar.text(initials);
      } else {
        avatar.html('<i class="bi bi-person" aria-hidden="true"></i>');
      }
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
    applyAuthorHelpStatus();
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

  stack.children('[data-author-entry-row]').each(function () {
    const row = $(this);
    if (!rowHasContent(row)) {
      authorUiState.delete(getEntryKey(row));
      row.find('[data-affiliation-editor]')[0]?.affiliationEditor?.destroy();
    row.remove();
    }
  });

  if (typeof stack.sortable === 'function') {
    stack.sortable({
      items: '> [data-author-entry-row]',
      handle: '.drag-handle',
      cancel: 'input, textarea, select, option',
      axis: 'y',
      tolerance: 'pointer',
      containment: 'parent',
      update: function () {
        updatePayload();
        applyAuthorHelpStatus();
      }
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

  stack.on('click', '[data-author-contact-toggle]', function (event) {
    event.preventDefault();
    const row = $(this).closest('[data-author-entry-row]');
    const checkbox = row.find('input[name="contacts[]"]').first();
    checkbox.prop('checked', !checkbox.prop('checked')).trigger('change');
  });

  stack.on('click', '[data-author-move-up], [data-author-move-down]', function (event) {
    event.preventDefault();
    const button = $(this);
    if (button.prop('disabled')) {
      return;
    }

    moveEntry(button.closest('[data-author-entry-row]'), button.is('[data-author-move-up]') ? -1 : 1);
  });

  stack.on('author-affiliations:changed', '[data-author-entry-row]', function () {
    const row = $(this);
    renderAffiliationEditor(row);
    updatePayload();
  });

  stack.on('click', '.removeButton', function () {
    const row = $(this).closest('[data-author-entry-row]');
    const entryKey = getEntryKey(row);
    const nextFocusTarget = row.next('[data-author-entry-row]').find('[data-author-toggle-edit]').first();
    row.find('[data-affiliation-editor]')[0]?.affiliationEditor?.destroy();
    row.remove();
    authorUiState.delete(entryKey);
    updatePayload();
    applyAuthorHelpStatus();
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
    applyAuthorHelpStatus();
  });

  document.addEventListener('helpStatus:changed', function () {
    applyAuthorHelpStatus();
  });

  window.validateAuthorAffiliationEditors = validateAuthorAffiliationEditors;

  window.authorStack = {
    supportsType: type => type === 'person' ? personTemplate.length > 0 : type === 'institution' && institutionTemplate.length > 0,
    addPerson: function () { return addRow('person'); },
    addInstitution: function () { return addRow('institution'); },
    setAuthors,
    updatePayload,
    collectPayload,
    collectDraftEntries,
    setEntryAffiliations,
    validateAffiliationEditors: validateAuthorAffiliationEditors
  };

  updatePayload();
});
