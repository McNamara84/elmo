/** Separate DOI metadata prefill from DOI reuse in the submission. */
$(document).ready(function () {
  const $doiInput = $('#input-resourceinformation-doi');
  const $sourceInput = $('#input-resourceinformation-source-doi');
  if (!$doiInput.length || !$sourceInput.length) return;

  const lookupService = new DoiLookupService();
  let isLookupActive = false;
  let validationToken = 0;
  let verifiedDoi = '';
  let expectedVersion = '';
  const translate = (key, fallback) => window.elmo?.translate?.(key) || fallback;
  const isValidDoiFormat = doi => /^10\.\d{4,9}\/\S+$/.test(doi);

  function submissionStatus(key, fallback, severity = 'muted') {
    $('#submission-doi-status').attr('class', `form-text text-${severity}`)
      .text(translate(key, fallback).replace(/\{version\}/g, expectedVersion));
  }

  function toggleSpinner(show) {
    $('#doi-lookup-spinner').remove();
    if (!show) return;
    $('#source-doi-status').before(
      '<div id="doi-lookup-spinner" class="doi-lookup-loading" role="status" aria-live="polite">' +
      '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> ' +
      '<span data-translate="doiPrefill.loading">Looking up DOI…</span></div>'
    );
  }

  function showPrefillModal(attributes) {
    $('#doi-prefill-preview').html(typeof buildPrefillPreview === 'function'
      ? buildPrefillPreview(attributes) : '');
    const modalEl = document.getElementById('modal-doi-prefill');
    if (!modalEl) return;
    bootstrap.Modal.getInstance(modalEl)?.dispose();
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    const confirmBtn = document.getElementById('button-doi-prefill-confirm');
    const freshConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(freshConfirm, confirmBtn);
    freshConfirm.addEventListener('click', function () {
      $(modalEl).one('hidden.bs.modal', async function () {
        toggleSpinner(true);
        try {
          await applyDoiPrefill(attributes, lookupService);
        } finally {
          toggleSpinner(false);
        }
      });
      modal.hide();
    });
    const cancelBtn = document.getElementById('button-doi-prefill-cancel');
    const freshCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(freshCancel, cancelBtn);
    freshCancel.addEventListener('click', () => modal.hide());
    modal.show();
  }

  $('#button-resourceinformation-prefill-doi').on('click', async function () {
    const doi = String($sourceInput.val() || '').trim();
    if (!isValidDoiFormat(doi)) {
      $('#source-doi-status').addClass('text-danger').text(
        translate('resourceInfo.sourceDoiInvalid', 'Enter a valid DOI to load metadata.'));
      return;
    }
    $('#source-doi-status').removeClass('text-danger').text('');
    if (isLookupActive) return;
    isLookupActive = true;
    toggleSpinner(true);
    try {
      const result = await lookupService.lookupDoi(doi);
      toggleSpinner(false);
      if (result?.found && result.attributes) showPrefillModal(result.attributes);
      else $('#source-doi-status').addClass('text-danger').text(
        translate('resourceInfo.sourceDoiNotFound', 'No public DataCite record was found for this DOI.'));
    } catch (error) {
      toggleSpinner(false);
      $('#source-doi-status').addClass('text-danger').text(
        translate('resourceInfo.sourceDoiLookupFailed', 'DataCite could not be reached. Please try again.'));
    } finally {
      isLookupActive = false;
    }
  });

  $('#button-resourceinformation-edit-doi').on('click', function () {
    window.resourceInformation?.enableDoiEditing?.(false);
    $doiInput.trigger('focus');
  });

  async function validateSubmissionDoi() {
    if (window.ELMO_FEATURES?.showGGMsProperties) return true;
    const doi = String($doiInput.val() || '').trim();
    const token = ++validationToken;
    if (!doi) {
      verifiedDoi = '';
      expectedVersion = '';
      submissionStatus('resourceInfo.newDoiNotice', 'GFZ Data Services will register a new DOI.');
      return true;
    }
    if (!isValidDoiFormat(doi)) {
      submissionStatus('resourceInfo.invalidSubmissionDoi',
        'Enter a valid DOI or clear the field to request a new one.', 'danger');
      return false;
    }
    if (!/^10\.5880\//i.test(doi)) {
      if ($doiInput.attr('data-imported-doi') !== 'true') {
        $doiInput.val('').trigger('input');
      }
      submissionStatus('resourceInfo.externalDoiBlocked',
        'Only an existing 10.5880 DOI can be reused. Remove this DOI to request a new one.', 'danger');
      return false;
    }
    if (verifiedDoi !== doi) {
      submissionStatus('resourceInfo.verifyingDoi', 'Checking this DOI with DataCite…');
      let result;
      try {
        result = await lookupService.lookupDoi(doi);
      } catch (error) {
        if (token === validationToken) submissionStatus('resourceInfo.doiLookupBlocked',
          'This DOI could not be verified. Please contact data curation.', 'danger');
        return false;
      }
      if (token !== validationToken) return false;
      if (!result?.found || !result.attributes) {
        submissionStatus('resourceInfo.doiNotFoundBlocked',
          'This DOI is not in public DataCite records. Please contact data curation.', 'danger');
        return false;
      }
      const sourceVersion = String(result.attributes.version || '').trim();
      if (sourceVersion && !/^\d+\.\d+$/.test(sourceVersion)) {
        submissionStatus('resourceInfo.doiVersionBlocked',
          'The published version is unclear. Please contact data curation.', 'danger');
        return false;
      }
      expectedVersion = sourceVersion ? `${Number(sourceVersion.split('.')[0]) + 1}.0` : '1.0';
      verifiedDoi = doi;
      $('#input-resourceinformation-version').val(expectedVersion).trigger('input');
    }
    if (String($('#input-resourceinformation-version').val() || '').trim() !== expectedVersion) {
      submissionStatus('resourceInfo.doiVersionMismatch', `This DOI requires version ${expectedVersion}.`, 'danger');
      return false;
    }
    submissionStatus('resourceInfo.existingDoiCuration',
      'Existing GFZ DOI: the same DOI and new major version will be sent for manual curation.', 'warning');
    return true;
  }

  $doiInput.on('change blur', validateSubmissionDoi);
  $doiInput.on('input', function () { verifiedDoi = ''; expectedVersion = ''; });
  document.addEventListener('resourceInformationDoi:cleared', () => {
    verifiedDoi = '';
    expectedVersion = '';
    submissionStatus('resourceInfo.newDoiNotice', 'GFZ Data Services will register a new DOI.');
  });
  window.resourceInformationDoiValidation = validateSubmissionDoi;
  if (window.resourceInformation) window.resourceInformation.validateSubmissionDoi = validateSubmissionDoi;
  validateSubmissionDoi();
});
