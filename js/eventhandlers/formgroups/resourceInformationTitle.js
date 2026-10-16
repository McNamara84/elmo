/**
 * @description Handles dynamic addition and removal of title rows in the resource information form group.
 * 
 * @module resourceInformationTitle
 */

import { replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {
  /**
   * Counter for the number of titles currently added.
   * @type {number}
   */
  let titlesNumber = 1;
  let nextTitleKey = 1;
  const $addButton = $('#button-resourceinformation-addtitle');
  const $mainRow = $addButton.closest('.row');
  $mainRow.attr('data-resource-title-row', 'main');

  function titleRows() {
    return $mainRow.parent().children('.row[data-resource-title-row]');
  }

  /** @returns {Object} Current fields and titles in display order. */
  function collectPayload() {
    return {
      doi: String($('#input-resourceinformation-doi').val() || '').trim(),
      year: String($('#input-resourceinformation-publicationyear').val() || '').trim(),
      resourceTypeId: String($('#input-resourceinformation-resourcetype').val() || ''),
      version: String($('#input-resourceinformation-version').val() || '').trim(),
      languageId: String($('#input-resourceinformation-language').val() || ''),
      titles: titleRows().toArray().map((row, position) => ({
        key: row.dataset.resourceTitleRow,
        text: String($(row).find('input[name="title[]"]').val() || '').trim(),
        typeId: String($(row).find('select[name="titleType[]"]').val() || ''),
        position
      }))
    };
  }

  function sync() {
    const payload = collectPayload();
    const field = document.getElementById('resource-information-payload');
    if (field) {
      const next = JSON.stringify(payload);
      if (field.value !== next) {
        field.value = next;
        document.dispatchEvent(new CustomEvent('resourceInformationPayload:updated'));
      }
    }
    return payload;
  }

  function updateOrder() {
    $addButton.prop('disabled', titleRows().length >= (Number(window.maxTitles) || 2));
    titleRows().each((position, row) => {
      row.dataset.titlePosition = String(position);
      $(row).find('.title-sort-handle').attr('aria-label',
        `${window.elmo?.translate?.('resourceInfo.moveTitle') || 'Move title'} ${position + 1}`);
    });
    sync();
  }

  /**
   * Apply an imported or restored payload through the same visible form controls.
   * @param {Object} data Fields to update; omitted fields keep their current value.
   */
  function setResourceInformation(data = {}) {
    const fields = {
      doi: '#input-resourceinformation-doi',
      year: '#input-resourceinformation-publicationyear',
      resourceTypeId: '#input-resourceinformation-resourcetype',
      version: '#input-resourceinformation-version',
      languageId: '#input-resourceinformation-language'
    };
    Object.entries(fields).forEach(([name, selector]) => {
      if (Object.prototype.hasOwnProperty.call(data, name)) {
        $(selector).val(data[name] == null ? '' : String(data[name]));
      }
    });
    if (Array.isArray(data.titles)) {
      titleRows().not($mainRow).remove();
      titlesNumber = 1;
      const titles = data.titles.slice(0, Number(window.maxTitles) || 2);
      titles.forEach((title, index) => {
        if (index > 0) $addButton.trigger('click');
        const $row = titleRows().eq(index);
        $row.find('input[name="title[]"]').val(title.text || '');
        if (title.typeId != null) $row.find('select[name="titleType[]"]').val(String(title.typeId));
        if (title.key && index > 0) $row.attr('data-resource-title-row', String(title.key));
      });
    }
    updateOrder();
  }

  function clear() {
    const englishOption = $('#input-resourceinformation-language option[title="en"]').first();
    setResourceInformation({ doi: '', year: '', resourceTypeId: '', version: '',
      languageId: englishOption.val() || '', titles: [{ text: '', typeId: window.mainTitleTypeId || '' }] });
    $('#input-resourceinformation-source-doi').val('');
    const $doi = $('#input-resourceinformation-doi');
    $doi.prop('readOnly', true).addClass('input-greyed-out').removeAttr('data-imported-doi');
    document.dispatchEvent(new CustomEvent('resourceInformationDoi:cleared'));
  }

  /** @param {boolean} imported Whether an XML import populated the DOI. */
  function enableDoiEditing(imported = false) {
    const $doi = $('#input-resourceinformation-doi');
    $doi.prop('readOnly', false).removeClass('input-greyed-out');
    if (imported) $doi.attr('data-imported-doi', 'true');
    else $doi.removeAttr('data-imported-doi');
    $doi.trigger('change');
  }

  window.resourceInformation = { collectPayload, setResourceInformation, clear, sync, enableDoiEditing,
    validateSubmissionDoi: window.resourceInformationDoiValidation };

  /**
   * Click event handler for the "Add Title" button.
   * Adds a new title row if the maximum number of titles has not been reached.
   */
  $("#button-resourceinformation-addtitle").click(function () {
    /**
     * Reference to the "Add Title" button.
     * @type {jQuery}
     */
    const $addTitleBtn = $(this);

    /**
     * Parsed maximum titles allowed, falling back to 2 if not provided.
     * @type {number}
     */
    const maxTitles = Number(window.maxTitles) || 2;

    // Check if the current number of titles is below the allowed maximum.
    if (titlesNumber >= maxTitles) return;

    // Clone the existing title row and reset its input fields.
    const newTitleRow = $addTitleBtn.closest(".row").clone();
    newTitleRow.find("input").val("");
    newTitleRow.attr('data-resource-title-row', `title-${nextTitleKey++}`);
    newTitleRow.attr('draggable', 'true');
    newTitleRow.find('[id]').each(function () {
      const oldId = this.id;
      const newId = `${oldId}-${newTitleRow.attr('data-resource-title-row')}`;
      $(this).attr('id', newId);
      newTitleRow.find(`label[for="${oldId}"]`).attr('for', newId);
    });

    // Rebind help button functionality for cloned rows
    replaceHelpButtonInClonedRows(
      newTitleRow,
      "input-right-with-round-corners",
      ["help-resourceinformation-titletype"]
    );

    // Adjust Title Input field width
    newTitleRow.find(".col-10.col-sm-11.col-md-11.col-lg-11")
      .removeClass("col-10 col-sm-11 col-md-11 col-lg-11")
      .addClass("col-12 col-sm-5 col-md-7 col-lg-8");

    // Adjust Title Type Dropdown width and make it visible
    newTitleRow.find("[id^='container-resourceinformation-titletype-']")
      .removeClass("col-10 col-md-3 unvisible")
      .addClass("col-12 col-sm-5 col-md-3 col-lg-3");

    newTitleRow.find('.addTitle').parent()
      .removeClass('col-2 col-md-1 col-lg-1')
      .addClass('col-12 col-sm-2 col-md-2 col-lg-1 title-row-actions');

    // Control the visibility of the title type dropdown.
    if (titlesNumber === 0) {
      $("#container-resourceinformation-titletype").removeClass("unvisible");
    } else {
      $("#container-resourceinformation-titletype").addClass("unvisible");
    }

    // Populate the title type dropdown with options and remove the main title type.
    const $select = newTitleRow.find("select");
    $select.html(window.titleTypeOptionsHtml || "");
    if (window.mainTitleTypeId) {
      $select.find(`option[value='${window.mainTitleTypeId}']`).remove();
    }
    // Pre-select "Alternative Title" by ID so the title type is never empty.
    // Falls back to the first non-empty option if the ID is unavailable.
    if (window.alternativeTitleTypeId && $select.find(`option[value='${window.alternativeTitleTypeId}']`).length) {
      $select.val(window.alternativeTitleTypeId);
    } else {
      const $firstOption = $select.find("option[value]").filter(function () {
        return $(this).val() !== "";
      }).first();
      $select.val($firstOption.val() || "");
    }
    // Explicitly set the disabled state based on whether valid options exist.
    // A "valid" option has a non-empty value — the placeholder (value="")
    // added by select.js does not count. When no valid options exist (e.g. the
    // user clicked "Add" while title types are still loading, or the API
    // returned no types), disable the select to prevent a required empty
    // control from blocking form submission.
    const hasValidOptions = $select.find("option").filter(function () {
      return $(this).val() !== "";
    }).length > 0;
    $select.prop("disabled", !hasValidOptions);

    // Create a remove button for the new row.
    const removeBtn = $("<button/>", {
      text: "-",
      type: "button",
      class: "btn btn-danger removeTitle",
    }).css({ "width": "36px", "margin-inline-end": "0.75rem" }).click(function () {
      // Remove the current row and decrement the titles counter.
      $(this).closest(".row").remove();
      titlesNumber--;

      // Enable the "Add Title" button if below the maximum limit.
      if (titlesNumber < maxTitles) {
        $addTitleBtn.prop("disabled", false);
      }
      updateOrder();
    });

    // Replace the "Add Title" button in the cloned row with the remove button.
    newTitleRow.find(".addTitle").replaceWith(removeBtn);
    const $handle = $('<button/>', {
      type: 'button',
      class: 'drag-handle title-sort-handle',
      html: '<i class="bi bi-grip-vertical" aria-hidden="true"></i>',
      title: window.elmo?.translate?.('resourceInfo.moveTitle') || 'Move title'
    });
    removeBtn.before($handle);

    // Append the new title row to the DOM.
    $addTitleBtn.closest(".row").parent().append(newTitleRow);
    titlesNumber++;

    // Disable the "Add Title" button if the maximum number of titles is reached.
    if (titlesNumber >= maxTitles) {
      $addTitleBtn.prop("disabled", true);
    }
    updateOrder();
  });

  $mainRow.parent().on('keydown', '.title-sort-handle', function (event) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const $row = $(this).closest('.row');
    const $neighbor = event.key === 'ArrowUp' ? $row.prev('.row[data-resource-title-row]') : $row.next('.row[data-resource-title-row]');
    if (!$neighbor.length || $neighbor.is($mainRow)) return;
    if (event.key === 'ArrowUp') $row.insertBefore($neighbor);
    else $row.insertAfter($neighbor);
    updateOrder();
    $(this).trigger('focus');
  });

  $mainRow.parent().on('dragstart', '.row[data-resource-title-row]:not([data-resource-title-row="main"])', function (event) {
    event.originalEvent?.dataTransfer?.setData('text/plain', this.dataset.resourceTitleRow);
  });
  $mainRow.parent().on('dragover', '.row[data-resource-title-row]:not([data-resource-title-row="main"])', event => event.preventDefault());
  $mainRow.parent().on('drop', '.row[data-resource-title-row]:not([data-resource-title-row="main"])', function (event) {
    event.preventDefault();
    const key = event.originalEvent?.dataTransfer?.getData('text/plain');
    const dragged = titleRows().toArray().find(row => row.dataset.resourceTitleRow === key);
    if (dragged && dragged !== this && dragged !== $mainRow[0]) {
      $(dragged).insertBefore(this);
      updateOrder();
    }
  });

  $mainRow.parent().on('input change', 'input[name="title[]"], select[name="titleType[]"]', sync);
  $('#input-resourceinformation-doi, #input-resourceinformation-publicationyear, #input-resourceinformation-resourcetype, #input-resourceinformation-version, #input-resourceinformation-language')
    .on('input change', sync);

  // Listen for clear event to reset title counter and button state
  $(document).on('elmo:clearTitles', function () {
    titlesNumber = 1;
    $("#button-resourceinformation-addtitle").prop("disabled", false);
    updateOrder();
  });
  sync();
});
