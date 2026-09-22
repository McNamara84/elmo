/**
 * @description Handles the Related Work card stack and its structured payload.
 *
 * @module relatedwork
 */

/**
 * @typedef {Object} RelatedWorkEntry
 * @property {string} [entryKey] Stable client-side card key.
 * @property {number} [order] Zero-based card order.
 * @property {string} [identifier] Related resource identifier.
 * @property {string} [relation] Canonical DataCite relation token.
 * @property {string} [relationId] Relation vocabulary identifier.
 * @property {string} [identifierType] DataCite identifier type.
 */

import { createRemoveButton, replaceHelpButtonInClonedRows, translateClonedRow } from '../functions.js';

const RELATED_WORK_FIELD_NAMES = new Set([
  'relation[]',
  'rIdentifier[]',
  'rIdentifierType[]'
]);
const RELATED_WORK_HELP_SECTION_IDS = new Set([
  'help-relatedwork-relation',
  'help-relatedwork-identifier',
  'help-relatedwork-identifiertype'
]);

$(document).ready(function () {
  let stack = $('[data-related-work-stack]').first();
  if (!stack.length) {
    stack = $('#group-relatedwork').first().attr('data-related-work-stack', '');
  }

  if (!stack.length) {
    return;
  }

  let shell = stack.closest('[data-related-work-stack-shell]');
  if (!shell.length) {
    shell = stack.parent();
  }
  const eventRoot = shell.length ? shell : stack;
  let payloadInput = $('input[name="relatedWorksPayload"]').first();
  if (!payloadInput.length) {
    payloadInput = $('<input type="hidden" name="relatedWorksPayload" value="[]">');
    stack.before(payloadInput);
  }
  let summaryCount = $('[data-related-work-summary-count]').first();
  if (!summaryCount.length) {
    summaryCount = $('<span class="visually-hidden" data-related-work-summary-count></span>');
    stack.before(summaryCount);
  }

  const initialRows = stack.children('[data-related-work-entry], [related-work-row], .row');
  const template = initialRows.first().clone(false);
  if (!template.length) {
    return;
  }

  let addActions = shell.find('[data-related-work-add-actions]').first();
  if (!addActions.length) {
    addActions = $('<div class="d-flex flex-wrap gap-2 mt-2" data-related-work-add-actions></div>');
    stack.after(addActions);
  }

  let addButton = initialRows.first().find('#button-relatedwork-add, [data-related-work-add]').first().detach();
  if (!addButton.length) {
    addButton = shell.find('#button-relatedwork-add, [data-related-work-add]').first().detach();
  }
  if (addButton.length) {
    addButton
      .attr({
        id: 'button-relatedwork-add',
        'data-related-work-add': '',
        'data-translate-title': 'relatedWork.addEntry',
        title: translate('relatedWork.addEntry', 'Add related work'),
        'aria-label': translate('relatedWork.addEntry', 'Add related work')
      })
      .removeClass('add-button addRelatedWork')
      .addClass('text-nowrap px-3');
    addButton.html(
      '<i class="bi bi-plus-lg" aria-hidden="true"></i>' +
      '<span data-translate="relatedWork.addEntry">' + translate('relatedWork.addEntry', 'Add related work') + '</span>'
    );
    addActions.empty().append(addButton);
  }

  const initialEntries = initialRows.map(function () {
    return readEntry($(this), 0);
  }).get().filter(Boolean);
  initialRows.remove();

  let entryIndex = 0;

  function translate(key, fallback, variables = {}) {
    const translated = window.elmo && typeof window.elmo.translate === 'function'
      ? window.elmo.translate(key)
      : null;
    const templateText = typeof translated === 'string' && translated !== '' ? translated : fallback;

    return Object.keys(variables).reduce(function (result, variableName) {
      return result.replace(new RegExp(`\\{${variableName}\\}`, 'g'), String(variables[variableName]));
    }, templateText);
  }

  function normalizeBaseId(id) {
    return id ? id.replace(/-\d+$/, '') : id;
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
      label.attr('for', idMap.get(oldFor) || `${normalizeBaseId(oldFor)}-${index}`);
    });
  }

  function resetRow(row) {
    row.find('input, select, textarea').each(function () {
      const field = $(this);
      if (field.is(':checkbox, :radio')) {
        field.prop('checked', false);
      } else {
        field.val('');
      }
      field.removeClass('is-invalid is-valid').removeAttr('required aria-invalid disabled');
    });
  }

  function createActionButton(attributeName, iconClass, label, translationKey) {
    return $(
      `<button type="button" class="btn btn-outline-secondary btn-sm" ${attributeName}>
        <i class="bi ${iconClass}" aria-hidden="true"></i>
      </button>`
    ).attr({
      'data-bs-toggle': 'tooltip',
      'data-bs-placement': 'top',
      'data-translate-title': translationKey,
      title: label,
      'aria-label': label
    });
  }

  function createCardRemoveButton() {
    const button = createRemoveButton();
    return button
      .attr({
        'data-related-work-remove': '',
        'data-bs-toggle': 'tooltip',
        'data-bs-placement': 'top',
        'data-translate-title': 'relatedWork.removeEntry',
        title: translate('relatedWork.removeEntry', 'Remove related work entry'),
        'aria-label': translate('relatedWork.removeEntry', 'Remove related work entry')
      })
      .addClass('btn-sm')
      .removeAttr('style')
      .html('<i class="bi bi-x-lg" aria-hidden="true"></i>');
  }

  function createSummary() {
    return $(
      `<div class="d-flex flex-wrap align-items-center gap-2 p-2" data-related-work-summary>
        <span class="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-tertiary border text-body-secondary" style="width: 2rem; height: 2rem;">
          <i class="bi bi-link-45deg" aria-hidden="true"></i>
        </span>
        <strong class="me-1" data-related-work-summary-identifier></strong>
        <span class="badge text-bg-light border" data-related-work-summary-relation></span>
        <span class="badge text-bg-light border" data-related-work-summary-identifier-type></span>
      </div>`
    );
  }

  function getEntryKey(row) {
    let key = row.attr('data-related-work-entry-key');
    if (!key) {
      key = `related-work-${entryIndex++}`;
      row.attr('data-related-work-entry-key', key);
    }
    return key;
  }

  function getEditPanelId(row) {
    return `${getEntryKey(row)}-edit`.replace(/[^A-Za-z0-9_-]/g, '-');
  }

  function createUniqueEntryKey(preferredKey, fallbackIndex) {
    let candidate = preferredKey ? String(preferredKey) : `related-work-${fallbackIndex}`;
    const keyExists = function (key) {
      return stack.children('[data-related-work-entry]').filter(function () {
        return $(this).attr('data-related-work-entry-key') === key;
      }).length > 0;
    };

    while (keyExists(candidate)) {
      candidate = `related-work-${entryIndex++}`;
    }
    return candidate;
  }

  function createReservedEntryKey(preferredKey, fallbackIndex, reservedKeys) {
    let candidate = preferredKey ? String(preferredKey) : `related-work-${fallbackIndex}`;
    while (reservedKeys.has(candidate)) {
      candidate = `related-work-${entryIndex++}`;
    }
    reservedKeys.add(candidate);
    return candidate;
  }

  function ensureCardScaffold(row) {
    row.attr({
      'data-related-work-entry': '',
      'related-work-row': '',
      role: 'group'
    });
    row.removeClass('row g-1 p-2').addClass('d-flex align-items-stretch border rounded bg-body overflow-hidden');

    const editPanelId = getEditPanelId(row);
    const summaryIdentifierId = `${editPanelId}-summary-identifier`;
    let dragButton = row.find('.drag-handle').first().detach();
    row.find('#button-relatedwork-add, [data-related-work-add]').remove();
    row.children().filter(function () {
      const child = $(this);
      return child.text().trim() === '' && child.find('input, select, textarea, button, label').length === 0;
    }).remove();

    if (!dragButton.length) {
      dragButton = $('<button type="button" class="drag-handle"><i class="bi bi-grip-vertical" aria-hidden="true"></i></button>');
    }
    dragButton.attr({
      'data-related-work-drag': '',
      'data-bs-toggle': 'tooltip',
      'data-bs-placement': 'top',
      'data-translate-title': 'relatedWork.dragHandle',
      title: translate('relatedWork.dragHandle', 'Drag & drop or use arrow keys to change order'),
      'aria-label': translate('relatedWork.dragHandle', 'Drag & drop or use arrow keys to change order')
    });

    const fields = row.children().detach();
    const dragZone = $('<div class="d-flex align-items-center justify-content-center px-2 border-end bg-body-tertiary" data-related-work-drag-zone></div>')
      .append(dragButton);
    const editPanel = $('<div class="collapse show border-top" data-related-work-edit-panel></div>')
      .attr({ id: editPanelId, 'aria-labelledby': summaryIdentifierId, 'aria-hidden': 'false' })
      .append($('<div class="row g-1 p-2" data-related-work-fields></div>').append(fields));
    const content = $('<div class="flex-grow-1 min-width-0" data-related-work-card-content></div>')
      .append(createSummary(), editPanel);
    const actions = $('<div class="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-1 p-2 border-start bg-body-tertiary" data-related-work-actions></div>');
    actions.append(
      createActionButton(
        'data-related-work-toggle-edit',
        'bi-chevron-left',
        translate('relatedWork.collapseEntry', 'Collapse related work entry'),
        'relatedWork.collapseEntry'
      ).attr({
        'aria-controls': editPanelId,
        'aria-expanded': 'true'
      }),
      createCardRemoveButton()
    );

    row.empty().append(dragZone, content, actions);
    row.attr('aria-labelledby', summaryIdentifierId);
    row.find('[data-related-work-summary-identifier]').attr('id', summaryIdentifierId);
    return row;
  }

  function initializeTooltips(row) {
    if (!window.bootstrap || typeof window.bootstrap.Tooltip !== 'function') {
      return;
    }
    const tooltipContainer = window.getTooltipContainer ? window.getTooltipContainer() : document.body;
    row.find('[data-bs-toggle="tooltip"]').each(function () {
      new window.bootstrap.Tooltip(this, { container: tooltipContainer });
    });
  }

  function hideTooltip(element) {
    if (
      !element
      || !window.bootstrap
      || typeof window.bootstrap.Tooltip !== 'function'
      || typeof window.bootstrap.Tooltip.getInstance !== 'function'
    ) {
      return;
    }
    const tooltip = window.bootstrap.Tooltip.getInstance(element);
    if (tooltip && typeof tooltip.hide === 'function') {
      tooltip.hide();
    }
  }

  function disposeTooltips(row) {
    if (
      !window.bootstrap
      || typeof window.bootstrap.Tooltip !== 'function'
      || typeof window.bootstrap.Tooltip.getInstance !== 'function'
    ) {
      return;
    }
    row.find('[data-bs-toggle="tooltip"]').each(function () {
      const tooltip = window.bootstrap.Tooltip.getInstance(this);
      if (tooltip && typeof tooltip.dispose === 'function') {
        tooltip.dispose();
      }
    });
  }

  function selectedText(select) {
    const value = String(select.val() || '').trim();
    return value === '' ? '' : String(select.find('option:selected').text() || '').trim();
  }

  function selectedRelationName(select) {
    const value = String(select.val() || '').trim();
    if (value === '') {
      return '';
    }
    const selectedOption = select.find('option:selected').first();
    return String(selectedOption.attr('data-relation-name') || selectedOption.text() || '').trim();
  }

  function updateTooltipLabel(button, label) {
    button.attr('aria-label', label);
    const currentLabel = button.attr('data-bs-original-title') || button.attr('title') || '';
    if (currentLabel === label) {
      return;
    }

    const element = button[0];
    const Tooltip = window.bootstrap && window.bootstrap.Tooltip;
    const tooltip = element && Tooltip && typeof Tooltip.getInstance === 'function'
      ? Tooltip.getInstance(element)
      : null;
    if (tooltip && typeof tooltip.dispose === 'function') {
      tooltip.dispose();
    }

    button.attr({ title: label, 'data-bs-original-title': label });
    if (tooltip && typeof Tooltip === 'function') {
      const tooltipContainer = window.getTooltipContainer ? window.getTooltipContainer() : document.body;
      new Tooltip(element, { container: tooltipContainer });
    }
  }

  function readEntry(row, order) {
    const relationSelect = row.find('select[name="relation[]"]').first();
    const identifier = String(row.find('input[name="rIdentifier[]"]').first().val() || '').trim();
    const relationId = String(relationSelect.val() || '').trim();
    const relation = selectedRelationName(relationSelect);
    const identifierType = String(row.find('select[name="rIdentifierType[]"]').first().val() || '').trim();

    if (identifier === '' && relationId === '' && relation === '' && identifierType === '') {
      return null;
    }

    return {
      entryKey: row.attr('data-related-work-entry-key') || `related-work-${order}`,
      order,
      identifier,
      relation,
      relationId,
      identifierType
    };
  }

  /** @returns {RelatedWorkEntry[]} Non-empty cards in their current visual order. */
  function collectPayload() {
    const payload = [];
    stack.children('[data-related-work-entry]').each(function () {
      const entry = readEntry($(this), payload.length);
      if (entry) {
        payload.push(entry);
      }
    });
    return payload;
  }

  function countSummary(count) {
    const label = count === 1
      ? translate('relatedWork.entrySingular', 'entry')
      : translate('relatedWork.entryPlural', 'entries');
    return translate('relatedWork.entriesSummary', '{count} {label}', { count, label });
  }

  function renderEntrySummary(row) {
    const relationSelect = row.find('select[name="relation[]"]').first();
    const identifier = String(row.find('input[name="rIdentifier[]"]').first().val() || '').trim();
    const relation = selectedText(relationSelect);
    const identifierType = String(row.find('select[name="rIdentifierType[]"]').first().val() || '').trim();
    const fallback = translate('relatedWork.incompleteEntry', 'Incomplete related work');

    row.find('[data-related-work-summary-identifier]').text(identifier || fallback);
    row.find('[data-related-work-summary-relation]').text(relation).toggleClass('d-none', relation === '');
    row.find('[data-related-work-summary-identifier-type]').text(identifierType).toggleClass('d-none', identifierType === '');
  }

  function updateActionLabels(row) {
    const isExpanded = row.find('[data-related-work-edit-panel]').hasClass('show');
    updateTooltipLabel(row.find('[data-related-work-toggle-edit]'), isExpanded
      ? translate('relatedWork.collapseEntry', 'Collapse related work entry')
      : translate('relatedWork.editEntry', 'Edit related work entry'));
    updateTooltipLabel(
      row.find('[data-related-work-remove]'),
      translate('relatedWork.removeEntry', 'Remove related work entry')
    );
    updateTooltipLabel(
      row.find('[data-related-work-drag]'),
      translate('relatedWork.dragHandle', 'Drag & drop or use arrow keys to change order')
    );
  }

  function updateCardActions() {
    stack.children('[data-related-work-entry]').each(function () {
      updateActionLabels($(this));
    });
  }

  function updateHelpButtonVisibility() {
    stack.children('[data-related-work-entry]').each(function (index) {
      const row = $(this);
      const showHelp = index === 0;

      row.find('span.input-group-text').each(function () {
        const helpButton = $(this);
        const helpIcon = helpButton.find('i[data-help-section-id]').first();
        const helpSectionId = String(helpIcon.attr('data-help-section-id') || '');
        if (!RELATED_WORK_HELP_SECTION_IDS.has(helpSectionId)) {
          return;
        }

        helpButton
          .toggleClass('help-placeholder', !showHelp)
          .attr('data-help-section-id', helpSectionId)
          .css({
            visibility: showHelp ? '' : 'hidden',
            width: showHelp ? '' : '42px',
            height: showHelp ? '' : '38px'
          });
        helpButton
          .closest('.input-group')
          .find('.input-with-help')
          .toggleClass('input-right-no-round-corners', showHelp)
          .toggleClass('input-right-with-round-corners', !showHelp);
      });
    });
  }

  /**
   * Synchronizes summaries, ordering controls, and the hidden structured payload.
   * @param {Object} [options] - Synchronization options.
   * @param {boolean} [options.notify=true] - Dispatch the payload update event.
   * @returns {RelatedWorkEntry[]} Fresh payload in visual order.
   */
  function updatePayload(options = {}) {
    stack.children('[data-related-work-entry]').each(function () {
      renderEntrySummary($(this));
    });
    updateHelpButtonVisibility();
    updateCardActions();
    const payload = collectPayload();
    payloadInput.val(JSON.stringify(payload));
    summaryCount.text(countSummary(payload.length)).attr({ 'aria-live': 'polite', 'aria-atomic': 'true' });
    if (options.notify !== false) {
      document.dispatchEvent(new CustomEvent('relatedWorksPayload:updated', { detail: { payload } }));
    }
    return payload;
  }

  function setExpanded(row, isExpanded) {
    const panel = row.find('[data-related-work-edit-panel]').first();
    const toggle = row.find('[data-related-work-toggle-edit]').first();
    panel.toggleClass('show', isExpanded).attr('aria-hidden', isExpanded ? 'false' : 'true');
    row.attr('data-related-work-expanded', isExpanded ? 'true' : 'false');
    toggle.attr('aria-expanded', isExpanded ? 'true' : 'false');
    toggle.find('i').toggleClass('bi-pencil', !isExpanded).toggleClass('bi-chevron-left', isExpanded);
    updateActionLabels(row);
  }

  /**
   * Expands a card and optionally focuses its first incomplete field.
   * @param {number|string|Element|jQuery} target - Card index, key, or descendant.
   * @param {Object} [options] - Expansion options.
   * @param {boolean} [options.focus=false] - Focus the first incomplete field.
   * @returns {boolean} Whether a matching card was expanded.
   */
  function expandEntry(target, options = {}) {
    const row = resolveRow(target);
    if (!row.length) {
      return false;
    }
    setExpanded(row, true);
    if (options.focus) {
      const firstIncompleteField = row.find('select[name="relation[]"], input[name="rIdentifier[]"], select[name="rIdentifierType[]"]').filter(function () {
        return String($(this).val() || '').trim() === '';
      }).first();
      firstIncompleteField.trigger('focus');
    }
    return true;
  }

  function ensureSelectValue(select, value, label = value) {
    const normalizedValue = String(value || '').trim();
    const normalizedLabel = String(label || '').trim();
    const isRelationSelect = select.is('select[name="relation[]"]');
    const relationLookupKey = function (candidate) {
      return String(candidate || '').replace(/\s+/g, '').toLowerCase();
    };
    if (normalizedValue !== '') {
      const valueOption = select.find('option').filter(function () {
        return String($(this).val()) === normalizedValue;
      }).first();
      if (valueOption.length) {
        select.val(normalizedValue);
        return;
      }
    }
    if (normalizedLabel !== '') {
      const matchingOption = select.find('option').filter(function () {
        const relationName = String($(this).attr('data-relation-name') || '').trim();
        const visibleText = String($(this).text()).trim();
        return relationName === normalizedLabel
          || visibleText === normalizedLabel
          || (isRelationSelect && (
            relationLookupKey(relationName) === relationLookupKey(normalizedLabel)
            || relationLookupKey(visibleText) === relationLookupKey(normalizedLabel)
          ));
      }).first();
      if (matchingOption.length) {
        if (isRelationSelect) {
          matchingOption.attr('data-relation-name', normalizedLabel);
        }
        select.val(matchingOption.val());
        return;
      }
    }
    if (normalizedValue !== '' || normalizedLabel !== '') {
      const optionValue = normalizedValue || normalizedLabel;
      select.append($('<option></option>').val(optionValue).text(normalizedLabel || optionValue));
      select.val(optionValue);
    }
  }

  function populateRow(row, entry) {
    if (!entry) {
      return;
    }
    row.find('input[name="rIdentifier[]"]').val(entry.identifier || '');
    ensureSelectValue(row.find('select[name="relation[]"]'), entry.relationId || entry.relation || '', entry.relation || '');
    ensureSelectValue(row.find('select[name="rIdentifierType[]"]'), entry.identifierType || '');
    renderEntrySummary(row);
  }

  /**
   * Creates one Related Work card from an optional payload entry.
   * @param {RelatedWorkEntry|null} [entry=null] - Initial card values.
   * @param {Object} [options] - Rendering and focus options used by bulk imports.
   * @returns {jQuery} Created card.
   */
  function addRelatedWork(entry = null, options = {}) {
    const row = template.clone(false);
    const index = entryIndex++;
    const entryKey = options.reservedEntryKeys
      ? createReservedEntryKey(entry && entry.entryKey, index, options.reservedEntryKeys)
      : createUniqueEntryKey(entry && entry.entryKey, index);
    row.attr('data-related-work-entry-key', entryKey);
    updateIds(row, index);
    resetRow(row);
    row.find('#button-relatedwork-add, [data-related-work-add]').remove();
    replaceHelpButtonInClonedRows(
      row,
      'input-right-with-round-corners',
      (options.isFirstEntry ?? stack.children('[data-related-work-entry]').length === 0)
        ? ['help-relatedwork-relation', 'help-relatedwork-identifier', 'help-relatedwork-identifiertype']
        : []
    );
    translateClonedRow(row);
    ensureCardScaffold(row);
    if (window.elmo && typeof window.elmo.applyRelatedWorkDropdowns === 'function') {
      window.elmo.applyRelatedWorkDropdowns(row[0], {
        notify: false,
        refreshChosen: options.refreshChosen !== false
      });
    }
    populateRow(row, entry);
    if (options.appendTarget && typeof options.appendTarget.appendChild === 'function') {
      options.appendTarget.appendChild(row[0]);
    } else {
      stack.append(row);
    }
    if (options.updateValidation !== false
      && window.elmo
      && typeof window.elmo.updateIdentifierValidationPattern === 'function') {
      window.elmo.updateIdentifierValidationPattern(row.find('select[name="rIdentifierType[]"]')[0]);
    }
    if (options.initializeTooltips !== false) {
      initializeTooltips(row);
    }
    if (options.refreshSortable !== false && typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    if (options.update !== false) {
      updatePayload();
    }
    if (options.focus !== false) {
      row.find('[data-related-work-edit-panel] select, [data-related-work-edit-panel] input').first().trigger('focus');
    }
    return row;
  }

  function normalizeEntries(entries) {
    if (typeof entries === 'string') {
      try {
        entries = JSON.parse(entries);
      } catch (error) {
        entries = [];
      }
    }
    return Array.isArray(entries) ? entries : [];
  }

  function yieldForRelatedWorkRendering() {
    const view = stack[0] && stack[0].ownerDocument
      ? stack[0].ownerDocument.defaultView
      : window;
    if (view && typeof view.requestAnimationFrame === 'function') {
      return new Promise(function (resolve) {
        view.requestAnimationFrame(function () { resolve(); });
      });
    }
    return new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  /**
   * Rebuilds the stack in batches so large XML imports can yield to the browser.
   * @param {RelatedWorkEntry[]} entries - Entries in source-document order.
   * @param {Object} [options] - Batch size, progress, and scheduling hooks.
   * @returns {Promise<RelatedWorkEntry[]>} Synchronized payload.
   */
  async function setRelatedWorksBulk(entries, options = {}) {
    disposeTooltips(stack);
    stack.children('[data-related-work-entry]').remove();
    const batchSize = Number.isInteger(options.batchSize) && options.batchSize > 0
      ? options.batchSize
      : 50;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const yieldControl = typeof options.yieldControl === 'function'
      ? options.yieldControl
      : yieldForRelatedWorkRendering;
    const reservedEntryKeys = new Set();
    const total = entries.length;

    if (onProgress) {
      onProgress({ processed: 0, total });
    }

    for (let start = 0; start < total; start += batchSize) {
      const fragment = document.createDocumentFragment();
      const end = Math.min(start + batchSize, total);
      for (let index = start; index < end; index++) {
        addRelatedWork(entries[index], {
          appendTarget: fragment,
          focus: false,
          update: false,
          refreshSortable: false,
          refreshChosen: false,
          updateValidation: false,
          initializeTooltips: false,
          isFirstEntry: index === 0,
          reservedEntryKeys
        });
      }
      stack[0].appendChild(fragment);
      if (onProgress) {
        onProgress({ processed: end, total });
      }
      if (end < total) {
        await yieldControl();
      }
    }

    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    $('.chosen-select').trigger('chosen:updated');
    initializeTooltips(stack);
    return updatePayload();
  }

  /**
   * Replaces all cards, optionally delegating to the batched renderer.
   * @param {RelatedWorkEntry[]|string} entries - Entries or their JSON representation.
   * @param {Object} [options] - Rendering options.
   * @returns {RelatedWorkEntry[]|Promise<RelatedWorkEntry[]>} Synchronized payload.
   */
  function setRelatedWorks(entries, options = {}) {
    const normalizedEntries = normalizeEntries(entries);
    if (options.bulk === true) {
      return setRelatedWorksBulk(normalizedEntries, options);
    }

    disposeTooltips(stack);
    stack.children('[data-related-work-entry]').remove();
    const reservedEntryKeys = new Set();
    normalizedEntries.forEach(function (entry, index) {
      addRelatedWork(entry, {
        focus: false,
        update: false,
        isFirstEntry: index === 0,
        reservedEntryKeys
      });
    });
    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    return updatePayload();
  }

  function resolveRow(target) {
    if (typeof target === 'number') {
      return stack.children('[data-related-work-entry]').eq(target);
    }
    if (typeof target === 'string') {
      return stack.children('[data-related-work-entry]').filter(function () {
        return $(this).attr('data-related-work-entry-key') === target;
      }).first();
    }
    return $(target).closest('[data-related-work-entry]');
  }

  /**
   * Moves one card and immediately persists the new visual order.
   * @param {number|string|Element|jQuery} target - Card index, key, or descendant.
   * @param {'up'|'down'|number} direction - Requested movement direction.
   * @returns {boolean} Whether the card was moved.
   */
  function moveEntry(target, direction) {
    const row = resolveRow(target);
    const numericDirection = direction === 'up' ? -1 : direction === 'down' ? 1 : Number(direction);
    const sibling = numericDirection < 0
      ? row.prev('[data-related-work-entry]')
      : row.next('[data-related-work-entry]');
    if (!row.length || !sibling.length) {
      return false;
    }
    if (numericDirection < 0) {
      sibling.before(row);
    } else {
      sibling.after(row);
    }
    if (typeof stack.sortable === 'function') {
      stack.sortable('refresh');
    }
    updatePayload();
    row.find('[data-related-work-drag]').trigger('focus');
    return true;
  }

  function ensureRowsForField(requiredCount) {
    let currentCount = stack.children('[data-related-work-entry]').length;
    while (currentCount < requiredCount) {
      addRelatedWork(null, { focus: false, update: false });
      currentCount = stack.children('[data-related-work-entry]').length;
    }
    updatePayload();
  }

  if (typeof stack.sortable === 'function') {
    stack.sortable({
      items: '> [data-related-work-entry]',
      handle: '.drag-handle',
      cancel: 'input, textarea, select, option, button:not(.drag-handle)',
      axis: 'y',
      tolerance: 'pointer',
      containment: 'parent',
      start: function (event, ui) {
        hideTooltip(ui.item.find('[data-related-work-drag]')[0]);
      },
      update: updatePayload
    });
  }

  eventRoot.on('click', '#button-relatedwork-add, [data-related-work-add]', function () {
    addRelatedWork();
  });

  stack.on('click', '[data-related-work-toggle-edit]', function () {
    const row = $(this).closest('[data-related-work-entry]');
    setExpanded(row, !row.find('[data-related-work-edit-panel]').hasClass('show'));
  });

  stack.on('pointerdown', '[data-related-work-drag]', function () {
    hideTooltip(this);
  });

  stack.on('keydown', '[data-related-work-drag]', function (event) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    moveEntry(this, event.key === 'ArrowUp' ? -1 : 1);
  });

  stack.on('click', '[data-related-work-remove], .removeButton', function () {
    const row = $(this).closest('[data-related-work-entry]');
    const nextFocus = row.next('[data-related-work-entry]').find('[data-related-work-toggle-edit]').first();
    const previousFocus = row.prev('[data-related-work-entry]').find('[data-related-work-toggle-edit]').first();
    disposeTooltips(row);
    row.remove();
    updatePayload();
    const focusTarget = nextFocus.length
      ? nextFocus
      : previousFocus.length
        ? previousFocus
        : addActions.find('#button-relatedwork-add, [data-related-work-add]').first();
    focusTarget.trigger('focus');
  });

  stack.on('input change', 'input, select, textarea', updatePayload);

  document.addEventListener('autosave:ensure-array-field', function (event) {
    const detail = event.detail || {};
    if (!detail.name || !RELATED_WORK_FIELD_NAMES.has(detail.name) || !detail.requiredCount || detail.requiredCount <= 1) {
      return;
    }
    ensureRowsForField(detail.requiredCount);
  });

  document.addEventListener('translationsLoaded', function () {
    const addLabel = translate('relatedWork.addEntry', 'Add related work');
    addActions.find('#button-relatedwork-add, [data-related-work-add]').attr({ title: addLabel, 'aria-label': addLabel });
    addActions.find('[data-translate="relatedWork.addEntry"]').text(addLabel);
    stack.children('[data-related-work-entry]').each(function () {
      renderEntrySummary($(this));
      updateActionLabels($(this));
    });
    updatePayload();
  });

  document.addEventListener('relatedWorkDropdowns:updated', updatePayload);

  window.relatedWorkStack = {
    addRelatedWork,
    setRelatedWorks,
    collectPayload,
    updatePayload,
    moveEntry,
    expandEntry
  };

  if (initialEntries.length) {
    setRelatedWorks(initialEntries);
  } else {
    updatePayload();
  }
});
