/** Shared affiliation UI. Stacks own the compatible fields and ordered metadata payloads. */
export function normalizeRorId(value) {
    if (!value) {
      return '';
    }

    return String(value).trim().replace(/^https?:\/\/ror\.org\//, '');
  }

export function normalizeAffiliations(affiliations) {
    if (!Array.isArray(affiliations)) {
      return [];
    }

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
        return affiliation.label !== '' || affiliation.rorId !== '';
      });
  }

export function createAffiliationBadge(affiliation) {
    const badge = $('<span class="badge elmo-badge border text-body-secondary"></span>');
    const label = affiliation.label || '';
    const rorId = normalizeRorId(affiliation.rorId || '');
    badge.text(rorId ? `${label} ${rorId}` : label);
    return badge;
  }

export function createAffiliationEditor(options) {
  const row = $(options.card);
  const translate = options.translate;
  const affiliationSearchMinLength = 3;
  const affiliationSearchDebounceMs = 250;
  const affiliationSearchTimers = new WeakMap();
  let requestVersion = 0;
  let destroyed = false;
  let searchStatus = '';
  const element = createEditorMarkup();

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
  function setRowAffiliations(_row, values, settings = {}) {
    options.writeAffiliations(normalizeAffiliations(values));
    if (settings.render !== false) renderAffiliationEditor(row);
    else validateAffiliationEditor(row);
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
    const input = $('<input type="text" class="form-control" data-affiliation-input>');
    const addButton = $('<button type="button" class="btn btn-primary d-inline-flex align-items-center gap-1" data-affiliation-add></button>')
      .append('<i class="bi bi-plus-lg" aria-hidden="true"></i>')
      .append('<span data-affiliation-add-label></span>');
    const results = $('<div class="list-group mt-2 d-none" data-affiliation-results></div>');

    titleGroup.append(title, helpButton);
    header.append(titleGroup, count);
    controls.append(input, addButton);
    const hint = $('<p class="small text-body-secondary mt-2 mb-0" data-affiliation-hint></p>');
    const status = $('<div class="small mt-1" role="status" aria-live="polite" data-affiliation-status></div>');
    panel.append(header, list, controls, hint, status, results);
    return editor.append(panel);
  }


  function updateAffiliationEditorTexts(editor) {
    editor.find('[data-affiliation-title]').text(translate('affiliations.title', 'Affiliations'));
    editor.find('[data-affiliation-input]').attr({
      placeholder: translate('general.affiliation', 'Affiliation'),
      'aria-label': translate('general.affiliation', 'Affiliation')
    });
    editor.find('[data-affiliation-add]').attr('aria-label', translate('affiliations.addFreeText', 'Add free text'));
    editor.find('[data-affiliation-add-label]').text(translate('affiliations.addFreeText', 'Add free text'));
    editor.find('[data-affiliation-hint]').text(translate('affiliations.hint', 'ROR suggestions appear after three characters. Select a result or add your input as free text.'));
    editor.find('[data-affiliation-add]').prop('disabled', !String(editor.find('[data-affiliation-input]').val() || '').trim());
    editor.find('[data-affiliation-status]').text(searchStatus ? translate(`affiliations.${searchStatus}`, {loading: 'Searching…', noResults: 'No ROR matches. You can add free text.', error: 'Search unavailable. Try again or add free text.'}[searchStatus]) : '');
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


  function renderAffiliationEditor(row) {
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


  function readEditorAffiliations(row) {
    return element.find('[data-affiliation-chip]').map(function () {
      const chip = $(this);
      return {
        label: String(chip.find('[data-affiliation-label]').val() || '').trim(),
        rorId: normalizeRorId(chip.attr('data-affiliation-ror-id') || chip.find('[data-affiliation-ror]').text())
      };
    }).get().filter(function (affiliation) {
      return affiliation.label !== '' || affiliation.rorId !== '';
    });
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


  function validateAffiliationEditor(row) {
    let isValid = true;

    element.find('[data-affiliation-chip]').each(function () {
      if (!validateAffiliationChip($(this))) {
        isValid = false;
      }
    });

    return isValid;
  }


  function addAffiliation(row, affiliation) {
    const editor = element;
    const input = editor.find('[data-affiliation-input]').first();
    const affiliations = readEditorAffiliations(row);
    const normalizedAffiliation = normalizeAffiliations([affiliation])[0];

    if (!normalizedAffiliation) {
      return;
    }

    affiliations.push(normalizedAffiliation);
    setRowAffiliations(row, affiliations);
    invalidateAffiliationSearch(row);
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


  function renderAffiliationSearchResults(row, results) {
    const editor = element;
    const resultContainer = editor.find('[data-affiliation-results]').empty();
    const normalizedResults = results.map(normalizeAffiliationSearchResult).filter(Boolean);

    if (!normalizedResults.length) {
      resultContainer.addClass('d-none');
      return;
    }

    normalizedResults.forEach(function (affiliation) {
      const button = $('<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between gap-2" data-affiliation-result></button>')
        .attr('data-affiliation-label-value', affiliation.label)
        .attr('data-affiliation-ror-value', affiliation.rorId);
      button.append($('<span></span>').text(affiliation.label));
      if (affiliation.rorId) {
        button.append($('<span class="badge elmo-badge border text-body-secondary"></span>').text(affiliation.rorId));
      }
      resultContainer.append(button);
    });

    resultContainer.removeClass('d-none');
    applyAliases();
  }


  function invalidateAffiliationSearch(row) {
    requestVersion++;
  }


  async function searchAffiliations(row) {
    const editor = element;
    const input = editor.find('[data-affiliation-input]').first();
    const query = String(input.val() || '').trim();
    const searchFunction = getAffiliationSearchFunction();
    const requestId = ++requestVersion;

    if (!searchFunction || query.length < affiliationSearchMinLength) {
      renderAffiliationSearchResults(row, []);
      return;
    }

    searchStatus = 'loading';
    updateAffiliationEditorTexts(element);
    let results;
    try { results = await searchFunction(query, 20); }
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
    renderAffiliationSearchResults(row, Array.isArray(results) ? results : []);
    updateAffiliationEditorTexts(element);
  }


  function scheduleAffiliationSearch(row) {
    const inputElement = element.find('[data-affiliation-input]').get(0);
    if (!inputElement) {
      return;
    }

    const existingTimer = affiliationSearchTimers.get(inputElement);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    invalidateAffiliationSearch(row);
    searchStatus = '';
    renderAffiliationSearchResults(row, []);
    const query = String(inputElement.value || '').trim();
    if (query.length < affiliationSearchMinLength) {
      invalidateAffiliationSearch(row);
      renderAffiliationSearchResults(row, []);
      return;
    }

    const timer = setTimeout(function () {
      affiliationSearchTimers.delete(inputElement);
      searchAffiliations(row).catch(function (error) {
        console.error('Affiliation search error:', error);
      });
    }, affiliationSearchDebounceMs);
    affiliationSearchTimers.set(inputElement, timer);
  }


  element.on('input', '[data-affiliation-label]', function () {
    setRowAffiliations(row, readEditorAffiliations(row), { render: false });
    updatePayload();
  });
  element.on('input keyup search paste', '[data-affiliation-input]', function () {
    scheduleAffiliationSearch(row);
    updateAffiliationEditorTexts(element);
    updatePayload();
  });
  element.on('keydown', '[data-affiliation-input]', function (event) {
    if (event.key === 'Enter' && !event.originalEvent?.isComposing) {
      event.preventDefault();
      element.find('[data-affiliation-add]').trigger('click');
    }
  });
  element.on('click', '[data-affiliation-add]', function () {
    const label = String(element.find('[data-affiliation-input]').val() || '').trim();
    if (label) addAffiliation(row, { label, rorId: '' });
  });
  element.on('click', '[data-affiliation-result]', function () {
    addAffiliation(row, {
      label: $(this).attr('data-affiliation-label-value') || '',
      rorId: $(this).attr('data-affiliation-ror-value') || ''
    });
  });
  element.on('click', '[data-affiliation-remove], [data-affiliation-move-up], [data-affiliation-move-down]', function () {
    const button = $(this);
    const values = readEditorAffiliations(row);
    const index = Number(button.closest('[data-affiliation-chip]').attr('data-affiliation-index'));
    if (button.is('[data-affiliation-remove]')) values.splice(index, 1);
    else {
      const target = index + (button.is('[data-affiliation-move-up]') ? -1 : 1);
      if (target < 0 || target >= values.length) return;
      [values[index], values[target]] = [values[target], values[index]];
    }
    setRowAffiliations(row, values);
    updatePayload();
  });

  function clearPendingInput() {
    invalidateAffiliationSearch(row);
    clearTimeout(affiliationSearchTimers.get(element.find('[data-affiliation-input]').get(0)));
    element.find('[data-affiliation-input]').val('');
    renderAffiliationSearchResults(row, []);
    searchStatus = '';
    updateAffiliationEditorTexts(element);
  }

  const api = {
    element,
    render: () => renderAffiliationEditor(row),
    validate: () => validateAffiliationEditor(row),
    getAffiliations: () => readEditorAffiliations(row),
    setAffiliations: values => { setRowAffiliations(row, values); updatePayload(); },
    getPendingInput: () => String(element.find('[data-affiliation-input]').val() || ''),
    setPendingInput: value => { clearPendingInput(); element.find('[data-affiliation-input]').val(value || ''); updateAffiliationEditorTexts(element); updatePayload(); },
    clearPendingInput: () => { clearPendingInput(); updatePayload(); },
    focus: () => element.find('[data-affiliation-input]').trigger('focus'),
    destroy() {
      destroyed = true;
      invalidateAffiliationSearch(row);
      clearTimeout(affiliationSearchTimers.get(element.find('[data-affiliation-input]').get(0)));
      element.off();
    }
  };
  element[0].affiliationEditor = api;
  renderAffiliationEditor(row);
  return api;
}
