/**
 * @description Handles the DOI prefill workflow: blur event on DOI field → API lookup
 * → preview modal → apply prefill on confirmation.
 *
 * Loaded as a plain script (not ES module) after doiPrefill.js and doiLookupService.js.
 *
 * @module doiPrefillHandler
 */

$(document).ready(function () {
  const $doiInput = $('#input-resourceinformation-doi');
  if (!$doiInput.length) return;

  const lookupService = new DoiLookupService();
  let lastLookedUpDoi = '';
  let isLookupActive = false;

  /**
   * Validates whether a string looks like a DOI (10.xxxx/...).
   * @param {string} value
   * @returns {boolean}
   */
  function isValidDoiFormat(value) {
    return /^10\.\d{4,9}\/[^\s]+$/.test(value.trim());
  }

  /**
   * Shows or hides the inline loading spinner next to the DOI field.
   * @param {boolean} show
   */
  function toggleSpinner(show) {
    let $spinner = $('#doi-lookup-spinner');
    if (show) {
      if (!$spinner.length) {
        $doiInput.closest('.input-group').after(
          '<div id="doi-lookup-spinner" class="doi-lookup-loading" role="status" aria-live="polite">' +
          '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' +
          ' <span data-translate="doiPrefill.loading">Looking up DOI…</span></div>'
        );
      }
    } else {
      $spinner.remove();
    }
  }

  /**
   * Creates and shows the prefill confirmation modal with a data preview.
   * @param {Object} attributes - The DataCite attributes object.
   */
  function showPrefillModal(attributes) {
    const previewHtml = typeof buildPrefillPreview === 'function'
      ? buildPrefillPreview(attributes)
      : '';

    $('#doi-prefill-preview').html(previewHtml);

    const modalEl = document.getElementById('modal-doi-prefill');
    if (!modalEl) return;

    let modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.dispose();
    modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

    // Wire confirm button — clone to remove old handlers
    const confirmBtn = document.getElementById('button-doi-prefill-confirm');
    const freshConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(freshConfirm, confirmBtn);

    freshConfirm.addEventListener('click', function () {
      // Wait for the modal to be fully hidden (transition + backdrop removed)
      // before manipulating the DOM, to avoid breaking Bootstrap's transitionend.
      $(modalEl).one('hidden.bs.modal', async function () {
        lastLookedUpDoi = '';
        toggleSpinner(true);
        try {
          await applyDoiPrefill(attributes, lookupService);
        } finally {
          toggleSpinner(false);
        }
      });
      modal.hide();
    });

    // Wire cancel button
    const cancelBtn = document.getElementById('button-doi-prefill-cancel');
    const freshCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(freshCancel, cancelBtn);
    freshCancel.addEventListener('click', function () {
      modal.hide();
    });

    modal.show();
  }

  /**
   * Main blur handler on the DOI input field.
   */
  $doiInput.on('blur', async function () {
    const doi = $(this).val().trim();

    // Skip if empty, invalid format, same DOI already loaded, or lookup in progress
    if (!doi || !isValidDoiFormat(doi) || doi === lastLookedUpDoi || isLookupActive) return;

    isLookupActive = true;
    toggleSpinner(true);
    try {
      const result = await lookupService.lookupDoi(doi);
      if (result && result.attributes) {
        lastLookedUpDoi = doi;
        toggleSpinner(false);
        showPrefillModal(result.attributes);
      } else {
        toggleSpinner(false);
      }
    } catch (err) {
      console.warn('DOI lookup failed:', err);
      toggleSpinner(false);
    } finally {
      isLookupActive = false;
    }
  });
});
