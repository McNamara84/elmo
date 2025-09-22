/**
 * @description Handles dynamic addition and removal of related work entries in the form.
 * 
 * @module relatedwork
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

const RELATED_WORK_FIELD_NAMES = new Set([
  'relation[]',
  'rIdentifier[]',
  'rIdentifierType[]'
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
  const relatedworkGroup = $("#group-relatedwork");

  function addRelatedWorkRow() {
    const firstRelatedWorkLine = relatedworkGroup.children().first();
    if (!firstRelatedWorkLine.length) {
      return null;
    }

    const newRelatedWorkRow = firstRelatedWorkLine.clone();

    newRelatedWorkRow.find("input, select")
      .val("")
      .removeClass("is-invalid is-valid")
      .removeAttr("required");

    replaceHelpButtonInClonedRows(newRelatedWorkRow);

    newRelatedWorkRow.find("#button-relatedwork-add").replaceWith(createRemoveButton());

    relatedworkGroup.append(newRelatedWorkRow);

    newRelatedWorkRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });

    return newRelatedWorkRow;
  }

  $("#button-relatedwork-add").click(function () {
    addRelatedWorkRow();
  });

  document.addEventListener('autosave:ensure-array-field', (event) => {
    const { detail, target } = event || {};
    const { name, requiredCount } = detail || {};

    if (!name || !RELATED_WORK_FIELD_NAMES.has(name) || !requiredCount || requiredCount <= 1) {
      return;
    }

    if (!relatedworkGroup.length) {
      return;
    }

    if (target && !relatedworkGroup[0].contains(target)) {
      return;
    }

    const selector = `[name="${escapeSelector(name)}"]`;
    let currentCount = relatedworkGroup.find(selector).length;

    while (currentCount < requiredCount) {
      const newRow = addRelatedWorkRow();
      if (!newRow) {
        break;
      }
      currentCount = relatedworkGroup.find(selector).length;
    }
  });
})