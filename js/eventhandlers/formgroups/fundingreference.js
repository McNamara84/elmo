/**
 * @description Handles dynamic addition and removal of funding reference entries in the form.
 * 
 * @module fundingreference
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

const FUNDING_FIELD_NAMES = new Set([
  'funder[]',
  'funderId[]',
  'funderidtyp[]',
  'grantNummer[]',
  'grantName[]',
  'awardURI[]'
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
  const fundingreferenceGroup = $("#group-fundingreference");

  function initialiseAutocomplete(input) {
    if (typeof setUpAutocompleteFunder === 'function' && input) {
      setUpAutocompleteFunder(input);
    }
  }

  function addFundingReferenceRow() {
    const firstFundingReferenceLine = fundingreferenceGroup.children().first();
    if (!firstFundingReferenceLine.length) {
      return null;
    }

    const newFundingReferenceRow = firstFundingReferenceLine.clone();

    newFundingReferenceRow.find("input")
      .val("")
      .removeClass("is-invalid is-valid");

    newFundingReferenceRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    newFundingReferenceRow.find("input, select").removeAttr("required");

    newFundingReferenceRow.find(".addFundingReference").replaceWith(createRemoveButton());

    replaceHelpButtonInClonedRows(newFundingReferenceRow);

    fundingreferenceGroup.append(newFundingReferenceRow);

    const newInput = newFundingReferenceRow.find(".inputFunder");
    if (newInput.data('ui-autocomplete')) {
      newInput.autocomplete('destroy');
    }

    initialiseAutocomplete(newInput[0]);

    newFundingReferenceRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      if (typeof checkMandatoryFields === 'function') {
        checkMandatoryFields();
      }
    });

    return newFundingReferenceRow;
  }

  $("#button-fundingreference-add").click(function () {
    addFundingReferenceRow();
  });

  document.addEventListener('autosave:ensure-array-field', (event) => {
    const { detail, target } = event || {};
    const { name, requiredCount } = detail || {};

    if (!name || !FUNDING_FIELD_NAMES.has(name) || !requiredCount || requiredCount <= 1) {
      return;
    }

    if (!fundingreferenceGroup.length) {
      return;
    }

    if (target && !fundingreferenceGroup[0].contains(target)) {
      return;
    }

    const selector = `[name="${escapeSelector(name)}"]`;
    let currentCount = fundingreferenceGroup.find(selector).length;

    while (currentCount < requiredCount) {
      const newRow = addFundingReferenceRow();
      if (!newRow) {
        break;
      }
      currentCount = fundingreferenceGroup.find(selector).length;
    }
  });
});
