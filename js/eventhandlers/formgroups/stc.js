/**
 * @description Handles dynamic addition and removal of TSC (Temporal Spatial Coverage) rows.
 * 
 * @module stc
 */

import { createRemoveButton, replaceHelpButtonInClonedRows, updateOverlayLabels } from '../functions.js';

const STC_FIELD_NAMES = new Set([
  'tscLatitudeMin[]',
  'tscLatitudeMax[]',
  'tscLongitudeMin[]',
  'tscLongitudeMax[]',
  'tscDescription[]',
  'tscDateStart[]',
  'tscTimeStart[]',
  'tscDateEnd[]',
  'tscTimeEnd[]',
  'tscTimezone[]'
]);

function escapeSelector(value) {
  if (typeof value !== 'string') {
    return '';
  }

  if (typeof window.CSS !== 'undefined' && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }

  return value.replace(/([\0-\x1F\x7F"'\\#.:;,!?+*~=<>^$\[\](){}|\/\s-])/g, '\\$1');
}

$(document).ready(function () {
  /**
  * Global variable to keep track of unique tsc-row-ids.
  * This ensures each row has a unique identifier.
  */
  let tscRowIdCounter = 1;

  function addTscRow() {
    const tscGroup = $("#group-stc");
    const lastTscLine = tscGroup.children().last();

    if (!lastTscLine.length) {
      return null;
    }

    const selectedTimezone = lastTscLine.find('select[name="tscTimezone[]"]').find(':selected').text();

    tscRowIdCounter += 1;

    const newTscLine = lastTscLine.clone();

    newTscLine.attr("tsc-row-id", tscRowIdCounter);

    newTscLine.find("input, select, textarea").each(function () {
      const oldId = $(this).attr("id");
      if (oldId) {
        const newId = oldId.replace(/_\d+$/, "_" + tscRowIdCounter);
        $(this).attr("id", newId);
      }
    });

    newTscLine.find("input:not(#input-stc-timezone), textarea")
      .val("")
      .removeClass("is-invalid is-valid")
      .removeAttr("required");

    newTscLine.find('select:not([name="tscTimezone[]"])').each(function () {
      $(this).val('');
      $(this).removeClass('is-invalid is-valid');
      $(this).removeAttr('required');
    });

    replaceHelpButtonInClonedRows(newTscLine);

    newTscLine.find("#button-stc-add").replaceWith(createRemoveButton());

    tscGroup.append(newTscLine);

    updateOverlayLabels();

    const timezoneSelect = newTscLine.find('select[name="tscTimezone[]"]');
    timezoneSelect.find('option').each(function () {
      if ($(this).text() === selectedTimezone) {
        $(this).prop('selected', true);
      } else {
        $(this).prop('selected', false);
      }
    });

    return newTscLine;
  }

  $("#button-stc-add").click(function () {
    addTscRow();
  });

  $(document).on("click", ".removeButton", function () {
    const row = $(this).closest("[tsc-row-id]");
    const rowId = row.attr("tsc-row-id");

    if (typeof window.deleteDrawnOverlaysForRow === 'function') {
      window.deleteDrawnOverlaysForRow(rowId);
    }

    row.remove();

    updateOverlayLabels();

    if (typeof window.fitMapBounds === 'function') {
      window.fitMapBounds();
    }
  });

  document.addEventListener('autosave:ensure-array-field', (event) => {
    const { detail, target } = event || {};
    const { name, requiredCount } = detail || {};

    if (!name || !STC_FIELD_NAMES.has(name) || !requiredCount || requiredCount <= 1) {
      return;
    }

    const group = $("#group-stc");
    if (!group.length) {
      return;
    }

    if (target && !group[0].contains(target)) {
      return;
    }

    const selector = `[name="${escapeSelector(name)}"]`;
    let currentCount = group.find(selector).length;

    while (currentCount < requiredCount) {
      const newRow = addTscRow();
      if (!newRow) {
        break;
      }
      currentCount = group.find(selector).length;
    }
  });
});