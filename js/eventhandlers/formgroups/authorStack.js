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

  if (!stack.length || !payloadInput.length) {
    return;
  }

  const personTemplate = stack.find('[data-creator-row]').first().clone(false);
  const institutionTemplate = stack.find('[data-authorinstitution-row]').first().clone(false);
  let entryIndex = stack.find('[data-author-entry-row]').length;

  function escapeSelector(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/[\0-\x1F\x7F"'\\#.:;,!?+*~=<>^$\[\](){}|\/\s-]/g, '\\$&');
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

  function prepareClone(template, type) {
    if (!template || !template.length) {
      return null;
    }

    const row = template.clone(false);
    const index = entryIndex++;
    row.attr('data-author-entry-key', `author-${type}-${index}`);
    updateIds(row, index);
    resetRow(row);
    row.find('.addAuthor, .addauthorinstitution').replaceWith(createRemoveButton());
    replaceHelpButtonInClonedRows(row);
    translateClonedRow(row);
    setupContactFields(row);
    return row;
  }

  function initializeAffiliationAutocomplete(row) {
    if (typeof window.autocompleteAffiliations !== 'function') {
      return;
    }

    const personAffiliation = row.find('input[name="personAffiliation[]"]');
    const personRor = row.find('input[name="authorPersonRorIds[]"]');
    if (personAffiliation.length && personRor.length) {
      window.autocompleteAffiliations(personAffiliation.attr('id'), personRor.attr('id'), window.affiliationsData);
    }

    const institutionAffiliation = row.find('input[name="institutionAffiliation[]"]');
    const institutionRor = row.find('input[name="authorInstitutionRorIds[]"]');
    if (institutionAffiliation.length && institutionRor.length) {
      window.autocompleteAffiliations(institutionAffiliation.attr('id'), institutionRor.attr('id'), window.affiliationsData);
    }
  }

  function addRow(type) {
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
    return row;
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
    const contactFields = row.find('.contact-person-input');

    function updateFields() {
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
      return [];
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

  function updateSummary(payload) {
    const authorCount = payload.length;
    const contactCount = payload.filter(function (author) {
      return author.type === 'person' && author.isContact === true;
    }).length;

    summaryCount.text(`${authorCount} ${authorCount === 1 ? 'author' : 'authors'}`);

    if (contactCount > 0) {
      contactSummary
        .removeClass('text-bg-warning')
        .addClass('text-bg-success')
        .text(`${contactCount} ${contactCount === 1 ? 'contact' : 'contacts'}`);
    } else {
      contactSummary
        .removeClass('text-bg-success')
        .addClass('text-bg-warning')
        .text('at least 1 contact required');
    }
  }

  function updatePayload() {
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
      const row = addRow(type);
      if (!row) {
        break;
      }
      currentCount = stack.find(selector).length;
    }
  }

  stack.children('[data-author-entry-row]').each(function () {
    setupContactFields($(this));
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

  stack.on('click', '#button-author-add, [data-author-add-type="person"]', function () {
    addRow('person');
  });

  stack.on('click', '#button-authorinstitution-add, [data-author-add-type="institution"]', function () {
    addRow('institution');
  });

  stack.on('click', '.removeButton', function () {
    $(this).closest('[data-author-entry-row]').remove();
    updatePayload();
  });

  stack.on('input change', 'input, select, textarea', function () {
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

  window.authorStack = {
    addPerson: function () { return addRow('person'); },
    addInstitution: function () { return addRow('institution'); },
    updatePayload,
    collectPayload
  };

  updatePayload();
});