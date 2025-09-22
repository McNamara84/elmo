/**
 * @description Main form validation and handler initialization
 * @requires bootstrap
 * @requires jquery
 */

import SaveHandler from './saveHandler.js';
import SubmitHandler from './submitHandler.js';
import AutosaveService from './services/autosaveService.js';

$(() => {
  const autosaveService = new AutosaveService('form-mde', {
    statusElementId: 'autosave-status',
    statusTextId: 'autosave-status-text',
    restoreModalId: 'modal-restore-draft',
    restoreApplyButtonId: 'button-restore-apply',
    restoreDismissButtonId: 'button-restore-dismiss'
  });
  autosaveService.start();

  const saveHandler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification', autosaveService);
  const submitHandler = new SubmitHandler('form-mde', 'modal-submit', 'modal-notification', autosaveService);

  // Keep track of the clicked submit button. Safari does not retain the
  // activeElement during form submission, which causes document.activeElement
  // to point to the form instead of the button that triggered the submit event.
  // Fix: Store the action on click and fall back to the submitter property when available.
  let pendingAction = null;
  $('button[type="submit"][form="form-mde"], #form-mde button[type="submit"]').on('click', function () {
    pendingAction = this.dataset.action;
  });

  // Form submit event handler
  $('#form-mde').on('submit', function (e) {
    // Prevent default form submission
    e.preventDefault();
    e.stopPropagation();

    const action = e.originalEvent?.submitter?.dataset.action ?? pendingAction;

    if (action === 'save') {
      saveHandler.handleSave();
    } else if (action === 'submit') {
      submitHandler.handleSubmit();
    }

    // Reset stored action
    pendingAction = null;
  });
});
