/**
 * @description Main entry point for initializing modular form group logic.
 * Loads all independent modules and sets up global UI interactions such as help toggles and Easter egg.
 * 
 * @module buttons
 */

// ─── Import form group modules ────────────────────────────────────────────────
import './formgroups/feedback.js';
import './formgroups/authorStack.js';
import './formgroups/contributor-person.js';
import './formgroups/contributor-organisation.js';
import './formgroups/resourceinformation-title.js';
import './formgroups/stc.js';
import './formgroups/relatedwork.js';
import './formgroups/fundingreference.js';
import './formgroups/ggms-modeltypes.js';
import './formgroups/ggms-definition.js';
import './formgroups/ggms-properties.js';
import './formgroups/ggms-datasources.js';
import './confirmationModal.js';


import { replaceHelpButtonInClonedRows, createRemoveButton, updateOverlayLabels } from './functions.js';

/**
 * Initializes global event handlers when the DOM is fully loaded.
 */
$(document).ready(function () {
  /**
   * Reads saved preference from localStorage to show/hide help icons.
   */
  if (localStorage.getItem("inputGroupTextVisible") === "false") {
    $(".input-group-text").hide();
  }

  /**
   * Show help tooltips (question mark icons) and save preference.
   */
  $('#buttonHelpOn').click(() => {
    $(".input-group-text").show();
    localStorage.setItem("inputGroupTextVisible", "true");
  });

  /**
   * Hide help tooltips and save preference.
   */
  $('#buttonHelpOff').click(() => {
    $(".input-group-text").hide();
    localStorage.setItem("inputGroupTextVisible", "false");
  });

  /**
   * Easter Egg Hover Tracker
   * Tracks hover events on certain elements and triggers an Easter egg
   * if hovered 30 times within 1-second intervals.
   */
  let hoverCount = 0;
  let timer = null;

  /**
   * Resets the internal hover counter.
   */
  function resetHoverCount() {
    hoverCount = 0;
  }

  /**
   * Hover handler for help icon / theme switch to trigger hidden surprise.
   */
  $("#buttonHelp, #bd-theme").hover(function () {
    hoverCount++;

    if (hoverCount === 30) {
      window.open(
        "doc/egg.html",
        "Egg",
        "width=650,height=450,scrollbars=no,resizable=no,location=no"
      );
      resetHoverCount();
    }

    clearTimeout(timer);
    timer = setTimeout(resetHoverCount, 1000);
  });

  // ─── Additional Global UI Handlers ─────────────────────────────────────────

  /**
   * Show confirmation modal before clearing all input fields.
   * Requires translations object and clearInputFields() function to be loaded.
   */
  $('#button-form-reset').on('click', function () {
    window.showConfirmationModal(
      'confirmations.clear.title',
      'confirmations.clear.message',
      'confirmations.clear.cancel',
      'confirmations.clear.confirm',
      clearInputFields
    );
  });

  /**
   * Show XML upload modal when clicking the load button.
   */
  $('#button-form-load').on('click', function () {
    $('#modal-uploadxml').modal('show');
  });

  /**
   * Show changelog modal and load its content.
   */
  $('#button-changelog-show').click(function (event) {
    event.preventDefault(); // Prevents the default behavior of the link.

    // Loads the content from 'doc/changelog.html' into the modal's content area.
    $('#panel-changelog-content').load('doc/changelog.html', function () {
      // Displays the modal after the content has been successfully loaded.
      $('#modal-changelog').modal('show');
    });
  });

  /**
   * Initialize all tooltips on the page.
   */
  const tooltipContainer = window.getTooltipContainer ? window.getTooltipContainer() : document.body;
  if (typeof $.fn.tooltip === 'function') {
    $('[data-bs-toggle="tooltip"]').tooltip({ container: tooltipContainer });
  }

  /**
   * Treat fields with "js-required-on-submit" as required only
   * when the Submit button (data-action="submit") is used.
   * When Save is clicked, those fields behave like optional fields.
   */
  const form = document.getElementById('form-mde');
  if (form) {
    const $form = $(form);

    // Reset submit-only required fields
    function resetSubmitOnlyFields() {
      form.querySelectorAll('.js-required-on-submit').forEach(el => {
        el.removeAttribute('required');
        el.classList.remove('is-invalid');
        const tagifyEl = el.closest('.tagify') || el.parentElement?.querySelector('.tagify');
        if (tagifyEl) {
          tagifyEl.classList.remove('is-invalid');
        }
      });
    }

    /** Applies required only to enabled js-required-on-submit fields (skips hidden/disabled rows). */
    function applySubmitRequiredFields() {
      form.querySelectorAll('.js-required-on-submit').forEach(el => {
        if (el.disabled) {
          el.removeAttribute('required');
          return;
        }
        el.setAttribute('required', 'required');
      });
    }

    // For Save: no validation
    $('#button-form-save, #button-form-save-jsonld').on('click', function () {
      resetSubmitOnlyFields();
    });

    // For Submit: enforce required and run HTML5 validation
    $('#button-form-submit').on('click', function (e) {
      resetSubmitOnlyFields();

      // Apply specific rules
      validateFundingReferenceRequirements();
      validateRelatedWorkRequirements();
      validateSpatialTemporalCoverageRequirements();
      validateContributorOrganisationRequirements();
      validateContributorPersonRequirements();
  

      applySubmitRequiredFields();

      // Validation is handled by submitHandler.handleSubmit() in validation.js.
      // The form has novalidate, so no native browser validation occurs.
      // Do NOT call e.preventDefault() here – the submit event must fire
      // so that validation.js can route it to handleSubmit(), which shows
      // the validation-failed modal when fields are invalid.
    });
  }
});
