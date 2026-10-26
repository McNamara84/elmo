/**
 * Shared affiliation UI; stacks own the compatible fields and metadata payloads.
 * @module affiliationEditor
 */
let affiliationEditorCount = 0;

/**
 * @typedef {Object} Affiliation
 * @property {string} label Displayed organization or department name.
 * @property {string} rorId Short ROR identifier, or an empty string for free text.
 */

/**
 * @typedef {Object} AffiliationEditor
 * @property {jQuery} element Root to append to the owning card.
 * @property {function(): void} render Refresh labels and confirmed affiliations from the stack.
 * @property {function(): boolean} validate Check all confirmed labels.
 * @property {function(): Array<Affiliation>} getAffiliations Read ordered pairs, including invalid empty slots.
 * @property {function(Array<string|Object>): void} setAffiliations Replace confirmed pairs and notify the stack.
 * @property {function(): string} getPendingInput Read unconfirmed input without trimming it.
 * @property {function(string): void} setPendingInput Restore draft input without confirming it.
 * @property {function(): void} clearPendingInput Discard input and invalidate its search.
 * @property {function(): void} showPendingWarning Request a decision before a form action.
 * @property {function(): void} focus Focus the unconfirmed input field.
 * @property {function(): void} destroy Cancel searches and detach listeners before removing the card.
 */

/**
 * Strip a ROR URL prefix while accepting identifiers already stored in short form.
 * @param {*} value Raw identifier or ROR URL.
 * @returns {string} Short ROR identifier.
 */
export function normalizeRorId(value) {
  if (!value) return '';

  return String(value).trim().replace(/^https?:\/\/ror\.org\//, '');
}

/**
 * Normalize legacy strings and structured affiliation values without splitting labels.
 * @param {Array<string|Object>|null|undefined} affiliations Values from a stack or import.
 * @param {Object} [options={}] Normalization settings.
 * @param {boolean} [options.keepEmpty=false] Preserve invalid editor slots until repaired or removed.
 * @returns {Array<Affiliation>} Ordered label/ROR pairs.
 */
export function normalizeAffiliations(affiliations, { keepEmpty = false } = {}) {
  if (!Array.isArray(affiliations)) return [];

  return affiliations
    .map(function (affiliation) {
      if (typeof affiliation === 'string') {
        return { label: affiliation, rorId: '' };
      }

      const label = affiliation.label ?? affiliation.name ?? affiliation.value ?? '';
      const rorId = normalizeRorId(affiliation.rorId || affiliation.id || affiliation.affiliationIdentifier || '');
      return { label, rorId };
    })
    .filter(function (affiliation) {
      return keepEmpty || affiliation.label !== '' || affiliation.rorId !== '';
    });
}

/**
 * Render a summary badge using text so imported labels cannot become markup.
 * @param {Affiliation} affiliation Confirmed label/ROR pair.
 * @returns {jQuery} Summary badge.
 */
export function createAffiliationBadge(affiliation) {
  const badge = $('<span class="badge elmo-badge border text-body-secondary"></span>');
  const label = affiliation.label || '';
  const rorId = normalizeRorId(affiliation.rorId || '');
  badge.text(rorId ? `${label} ${rorId}` : label);
  return badge;
}

/**
 * Create one editor per card. The owner appends its root and calls destroy() on removal.
 * Search state belongs to this instance; pending text remains separate from confirmed pairs.
 * @param {Object} options Stack integration callbacks and labels.
 * @param {'author'|'contributor'} [options.group='author'] Compatible selector aliases.
 * @param {function(string, string): string} options.translate Translation callback with fallback.
 * @param {jQuery} [options.helpButton] Help icon for the owning form group.
 * @param {function(): Array<Affiliation>} options.readAffiliations Read compatible stack fields.
 * @param {function(Array<Affiliation>): void} options.writeAffiliations Write compatible stack fields.
 * @param {function(): void} [options.onChange] Update metadata and schedule autosave.
 * @returns {AffiliationEditor} Editor API attached to the root DOM element.
 */
export function createAffiliationEditor(options) {
  const translate = options.translate;
  const affiliationSearchMinLength = 3;
  const affiliationSearchDebounceMs = 250;
  const affiliationSearchLimit = 7;
  const affiliationSearchTimers = new WeakMap();
  // Invalidate immediately on input, before debounce, so a slow previous response cannot reappear.
  let requestVersion = 0;
  let destroyed = false;
  let searchStatus = '';
  let activeResultIndex = -1;
  const resultsId = `affiliation-results-${++affiliationEditorCount}`;
  const element = createEditorMarkup();

  // Existing stack selectors remain usable after switching to the shared editor.
  function applyAliases() {
    element.find('*').addBack().each(function () {
      Array.from(this.attributes).forEach(attribute => {
        if (attribute.name.startsWith('data-affiliation-')) {
          this.setAttribute(attribute.name.replace('data-affiliation-', `data-${options.group || 'author'}-affiliation-`), attribute.value);
        }
      });
    });
  }

  function updatePayload() { options.onChange?.(); }
  function setAffiliations(values, settings = {}) {
    options.writeAffiliations(normalizeAffiliations(values, { keepEmpty: true }));
    if (settings.render !== false) {
      renderAffiliationEditor();
    } else {
      // Validate in place while typing to keep the active input and caret intact.
      validateAffiliationEditor();
    }
  }
  function createEditorMarkup() {
    const editor = $('<div class="col-12 mt-2" data-affiliation-editor></div>');
    const panel = $('<div class="border rounded bg-body-tertiary p-3"></div>');
    const header = $('<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2"></div>');
    const titleGroup = $('<div class="d-flex align-items-center gap-1"></div>');
    const title = $('<strong data-affiliation-title></strong>');
    const helpButton = options.helpButton || $('<i class="bi bi-question-circle-fill" data-help-section-id="help-author-affiliation"></i>');
    const count = $('<span class="badge elmo-badge border" data-affiliation-count>0</span>');
    const list = $('<div class="d-grid gap-2" data-affiliation-list></div>');
    const controls = $('<div class="input-group input-group-sm mt-2"></div>');
    const input = $('<input type="text" class="form-control" role="combobox" aria-autocomplete="list" aria-expanded="false" data-affiliation-input>')
      .attr('aria-controls', resultsId);
    const addButton = $('<button type="button" class="btn btn-primary d-inline-flex align-items-center gap-1" data-affiliation-add></button>')
      .append('<i class="bi bi-plus-lg" aria-hidden="true"></i>')
      .append('<span data-affiliation-add-label></span>');
    const results = $('<div class="list-group mt-2 d-none" role="listbox" data-affiliation-results></div>')
      .attr('id', resultsId);

    titleGroup.append(title, helpButton);
    header.append(titleGroup, count);
    controls.append(input, addButton);
    const status = $('<div class="small mt-1" role="status" aria-live="polite" data-affiliation-status></div>');
    const warning = $('<div class="alert alert-warning mt-2 mb-0 d-none" role="alert" data-affiliation-pending-warning><p class="mb-2" data-affiliation-pending-message></p><button type="button" class="btn btn-outline-secondary btn-sm" data-affiliation-discard></button></div>');
    panel.append(header, list, controls, status, results, warning);
    return editor.append(panel);
  }

  function updateAffiliationEditorTexts(editor) {
    editor.find('[data-affiliation-title]').text(translate('affiliations.title', 'Affiliations'));
    editor.find('[data-affiliation-results]').attr('aria-label', translate('affiliations.title', 'Affiliations'));
    editor.find('[data-affiliation-input]').attr({
      placeholder: translate('affiliations.searchPlaceholder', 'Enter at least 3 characters to see suggestions'),
      'aria-label': translate('general.affiliation', 'Affiliation')
    });
    editor.find('[data-affiliation-add]').attr('aria-label', translate('affiliations.addFreeText', 'Add without a ROR'));
    editor.find('[data-affiliation-add-label]').text(translate('affiliations.addFreeText', 'Add without a ROR'));
    editor.find('[data-affiliation-pending-message]').text(translate('affiliations.pending', 'An affiliation input is still open. Select a ROR result, add it without a ROR ID or discard it, then repeat your action.'));
    editor.find('[data-affiliation-discard]').text(translate('affiliations.discard', 'Discard input'));
    if (!String(editor.find('[data-affiliation-input]').val() || '').trim()) editor.find('[data-affiliation-pending-warning]').addClass('d-none');
    editor.find('[data-affiliation-add]').prop('disabled', !String(editor.find('[data-affiliation-input]').val() || '').trim());
    editor.find('[data-affiliation-status]').text(searchStatus ? translate(`affiliations.${searchStatus}`, {loading: 'Searching…', noResults: 'No ROR matches. You can add your input without a ROR ID.', error: 'Search unavailable. Try again or add your input without a ROR ID.'}[searchStatus]) : '');
  }

  function createAffiliationChip(affiliation, index, count) {
    const label = affiliation.label || '';
    const rorId = normalizeRorId(affiliation.rorId || '');
    const chip = $('<div class="border rounded bg-body p-2" data-affiliation-chip></div>')
      .attr('data-affiliation-index', String(index))
      .attr('data-affiliation-ror-id', rorId)
      .attr('data-affiliation-original-label', label);
    const group = $('<div class="input-group input-group-sm"></div>');
    const moveUp = $('<button type="button" class="btn btn-outline-secondary" data-affiliation-move-up></button>')
      .attr('aria-label', translate('affiliations.moveUp', 'Move affiliation up'))
      .prop('disabled', index === 0)
      .append('<i class="bi bi-chevron-up" aria-hidden="true"></i>');
    const moveDown = $('<button type="button" class="btn btn-outline-secondary" data-affiliation-move-down></button>')
      .attr('aria-label', translate('affiliations.moveDown', 'Move affiliation down'))
      .prop('disabled', index === count - 1)
      .append('<i class="bi bi-chevron-down" aria-hidden="true"></i>');
    const labelInput = $('<input type="text" class="form-control" data-affiliation-label>')
      .attr({
        'aria-label': translate('affiliations.edit', 'Edit affiliation'),
        required: 'required'
      })
      .val(label);
    const rorSegment = $('<span class="input-group-text small" data-affiliation-ror></span>')
      .attr('aria-label', rorId ? `${translate('affiliations.rorId', 'ROR ID')} ${rorId}` : translate('affiliations.rorId', 'ROR ID'))
      .toggleClass('d-none', rorId === '')
      .text(rorId);
    const remove = $('<button type="button" class="btn btn-outline-danger" data-affiliation-remove></button>')
      .attr('aria-label', translate('affiliations.remove', 'Remove affiliation'))
      .append('<i class="bi bi-x-lg" aria-hidden="true"></i>');

    const invalidFeedback = $('<div class="invalid-feedback mt-1" data-affiliation-invalid></div>');

    group.append(moveUp, moveDown, labelInput, rorSegment, remove);
    chip.append(group, invalidFeedback);
    validateAffiliationChip(chip);
    return chip;
  }

  function renderAffiliationEditor() {
    const editor = element;
    if (!editor.length) {
      return;
    }

    const affiliations = options.readAffiliations();
    const list = editor.find('[data-affiliation-list]').empty();
    updateAffiliationEditorTexts(editor);
    editor.find('[data-affiliation-count]').text(String(affiliations.length));

    affiliations.forEach(function (affiliation, index) {
      list.append(createAffiliationChip(affiliation, index, affiliations.length));
    });
    applyAliases();
  }

  function readEditorAffiliations() {
    return element.find('[data-affiliation-chip]').map(function () {
      const chip = $(this);
      return {
        label: String(chip.find('[data-affiliation-label]').val() || '').trim(),
        rorId: normalizeRorId(chip.attr('data-affiliation-ror-id') || chip.find('[data-affiliation-ror]').text())
      };
    }).get();
  }

  function getAffiliationInvalidMessage() {
    return translate('affiliations.invalid', 'Please provide an affiliation.');
  }

  function validateAffiliationChip(chip) {
    const labelInput = chip.find('[data-affiliation-label]').first();
    const inputElement = labelInput.get(0);
    const feedback = chip.find('[data-affiliation-invalid]').first();
    const label = String(labelInput.val() || '').trim();
    const isInvalid = label === '';
    const message = isInvalid ? getAffiliationInvalidMessage() : '';

    labelInput.toggleClass('is-invalid', isInvalid);
    chip.toggleClass('border-danger', isInvalid);

    if (inputElement) {
      inputElement.setCustomValidity(message);
      if (isInvalid) {
        inputElement.setAttribute('aria-invalid', 'true');
      } else {
        inputElement.removeAttribute('aria-invalid');
      }
    }

    feedback
      .text(message)
      .toggleClass('d-block', isInvalid)
      .toggleClass('d-none', !isInvalid);

    return !isInvalid;
  }

  function validateAffiliationEditor() {
    let isValid = true;

    element.find('[data-affiliation-chip]').each(function () {
      if (!validateAffiliationChip($(this))) {
        isValid = false;
      }
    });

    return isValid;
  }

  function addAffiliation(affiliation) {
    const editor = element;
    const input = editor.find('[data-affiliation-input]').first();
    const affiliations = readEditorAffiliations();
    const normalizedAffiliation = normalizeAffiliations([affiliation])[0];

    if (!normalizedAffiliation) {
      return;
    }

    affiliations.push(normalizedAffiliation);
    setAffiliations(affiliations);
    invalidateAffiliationSearch();
    clearPendingInput();
    input.trigger('focus');
    editor.find('[data-affiliation-results]').empty().addClass('d-none');
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

  function renderAffiliationSearchResults(results) {
    const editor = element;
    const resultContainer = editor.find('[data-affiliation-results]').empty();
    const normalizedResults = results.map(normalizeAffiliationSearchResult).filter(Boolean).slice(0, affiliationSearchLimit);
    activeResultIndex = -1;
    editor.find('[data-affiliation-input]')
      .attr('aria-expanded', String(normalizedResults.length > 0))
      .removeAttr('aria-activedescendant');

    if (!normalizedResults.length) {
      resultContainer.addClass('d-none');
      return;
    }

    normalizedResults.forEach(function (affiliation, index) {
      const button = $('<button type="button" role="option" tabindex="-1" aria-selected="false" class="list-group-item list-group-item-action d-flex flex-column flex-sm-row align-items-start justify-content-between gap-2" data-affiliation-result></button>')
        .attr('id', `${resultsId}-${index}`)
        .attr('data-affiliation-label-value', affiliation.label)
        .attr('data-affiliation-ror-value', affiliation.rorId);
      button.append($('<span class="text-break"></span>').text(affiliation.label));
      if (affiliation.rorId) {
        button.append($('<span class="badge elmo-badge border text-body-secondary"></span>').text(affiliation.rorId));
      }
      resultContainer.append(button);
    });

    resultContainer.removeClass('d-none');
    applyAliases();
  }

  function activateSearchResult(index) {
    const results = element.find('[data-affiliation-result]');
    activeResultIndex = index;
    results.each(function (resultIndex) {
      $(this).toggleClass('active', resultIndex === index)
        .attr('aria-selected', String(resultIndex === index));
    });
    const active = results.get(index);
    element.find('[data-affiliation-input]').attr('aria-activedescendant', active.id);
    active.scrollIntoView?.({ block: 'nearest' });
  }

  function invalidateAffiliationSearch() {
    requestVersion++;
  }

  async function searchAffiliations() {
    const editor = element;
    const input = editor.find('[data-affiliation-input]').first();
    const query = String(input.val() || '').trim();
    const searchFunction = getAffiliationSearchFunction();
    const requestId = ++requestVersion;

    if (!searchFunction || query.length < affiliationSearchMinLength) {
      renderAffiliationSearchResults([]);
      return;
    }

    searchStatus = 'loading';
    updateAffiliationEditorTexts(element);
    let results;
    try { results = await searchFunction(query, affiliationSearchLimit, { throwOnError: true }); }
    catch (_error) {
      if (!destroyed && requestVersion === requestId) {
        searchStatus = 'error';
        updateAffiliationEditorTexts(element);
      }
      return;
    }
    if (destroyed || requestVersion !== requestId || String(input.val() || '').trim() !== query) {
      return;
    }
    searchStatus = Array.isArray(results) && results.length ? '' : 'noResults';
    renderAffiliationSearchResults(Array.isArray(results) ? results : []);
    updateAffiliationEditorTexts(element);
  }

  function scheduleAffiliationSearch() {
    const inputElement = element.find('[data-affiliation-input]').get(0);
    if (!inputElement) {
      return;
    }

    const existingTimer = affiliationSearchTimers.get(inputElement);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    invalidateAffiliationSearch();
    searchStatus = '';
    renderAffiliationSearchResults([]);
    const query = String(inputElement.value || '').trim();
    if (query.length < affiliationSearchMinLength) {
      invalidateAffiliationSearch();
      renderAffiliationSearchResults([]);
      return;
    }

    const timer = setTimeout(function () {
      affiliationSearchTimers.delete(inputElement);
      searchAffiliations().catch(function (error) {
        console.error('Affiliation search error:', error);
      });
    }, affiliationSearchDebounceMs);
    affiliationSearchTimers.set(inputElement, timer);
  }

  element.on('input', '[data-affiliation-label]', function () {
    setAffiliations(readEditorAffiliations(), { render: false });
    updatePayload();
  });
  // The input event covers typing and paste; keyup would reset keyboard selection.
  element.on('input search', '[data-affiliation-input]', function () {
    scheduleAffiliationSearch();
    updateAffiliationEditorTexts(element);
    updatePayload();
  });
  element.on('keydown', '[data-affiliation-input]', function (event) {
    if (event.originalEvent?.isComposing) return;
    const results = element.find('[data-affiliation-result]');
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
      event.preventDefault();
      const index = event.key === 'ArrowDown'
        ? Math.min(activeResultIndex + 1, results.length - 1)
        : activeResultIndex < 0 ? results.length - 1 : Math.max(activeResultIndex - 1, 0);
      activateSearchResult(index);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      invalidateAffiliationSearch();
      clearTimeout(affiliationSearchTimers.get(this));
      renderAffiliationSearchResults([]);
      searchStatus = '';
      updateAffiliationEditorTexts(element);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeResultIndex >= 0) results.eq(activeResultIndex).trigger('click');
      else element.find('[data-affiliation-add]').trigger('click');
    }
  });
  element.on('click', '[data-affiliation-add]', function () {
    const label = String(element.find('[data-affiliation-input]').val() || '').trim();
    if (label) addAffiliation({ label, rorId: '' });
  });
  element.on('click', '[data-affiliation-discard]', function () {
    clearPendingInput();
    updatePayload();
    api.focus();
  });
  element.on('click', '[data-affiliation-result]', function () {
    addAffiliation({
      label: $(this).attr('data-affiliation-label-value') || '',
      rorId: $(this).attr('data-affiliation-ror-value') || ''
    });
  });
  element.on('click', '[data-affiliation-remove], [data-affiliation-move-up], [data-affiliation-move-down]', function () {
    const button = $(this);
    const values = readEditorAffiliations();
    const index = Number(button.closest('[data-affiliation-chip]').attr('data-affiliation-index'));
    if (button.is('[data-affiliation-remove]')) values.splice(index, 1);
    else {
      const target = index + (button.is('[data-affiliation-move-up]') ? -1 : 1);
      if (target < 0 || target >= values.length) return;
      [values[index], values[target]] = [values[target], values[index]];
    }
    setAffiliations(values);
    updatePayload();
  });

  function clearPendingInput() {
    invalidateAffiliationSearch();
    clearTimeout(affiliationSearchTimers.get(element.find('[data-affiliation-input]').get(0)));
    element.find('[data-affiliation-input]').val('');
    renderAffiliationSearchResults([]);
    searchStatus = '';
    updateAffiliationEditorTexts(element);
  }

  const api = {
    element,
    render: () => renderAffiliationEditor(),
    validate: () => validateAffiliationEditor(),
    getAffiliations: () => readEditorAffiliations(),
    setAffiliations: values => { setAffiliations(values); updatePayload(); },
    getPendingInput: () => String(element.find('[data-affiliation-input]').val() || ''),
    setPendingInput: value => {
      clearPendingInput();
      element.find('[data-affiliation-input]').val(value || '');
      updateAffiliationEditorTexts(element);
      updatePayload();
    },
    clearPendingInput: () => { clearPendingInput(); updatePayload(); },
    showPendingWarning: () => element.find('[data-affiliation-pending-warning]').removeClass('d-none'),
    focus: () => element.find('[data-affiliation-input]').trigger('focus'),
    destroy() {
      destroyed = true;
      invalidateAffiliationSearch();
      clearTimeout(affiliationSearchTimers.get(element.find('[data-affiliation-input]').get(0)));
      element.off();
    }
  };
  element[0].affiliationEditor = api;
  renderAffiliationEditor();
  return api;
}
