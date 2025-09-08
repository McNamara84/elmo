/**
 * @description Main form validation and handler initialization
 * @requires bootstrap
 * @requires jquery
 */

import SaveHandler from './saveHandler.js';
import SubmitHandler from './submitHandler.js';

$(() => {
  const saveHandler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification');
  const submitHandler = new SubmitHandler('form-mde', 'modal-submit', 'modal-notification');

  // Keep track of the clicked submit button. Safari does not retain the
  // activeElement during form submission, which causes document.activeElement
  // to point to the form instead of the button that triggered the submit event.
  // Fix: Store the action on click and fall back to the submitter property when available.
  let pendingAction = null;
  $('#form-mde button[type="submit"]').on('click', function () {
    pendingAction = $(this).data('action');
  });

  // Form submit event handler
  $('#form-mde').on('submit', function (e) {
    // Prevent default form submission
    e.preventDefault();
    e.stopPropagation();

    const action = $(document.activeElement).data('action');

    if (action === 'save') {
      saveHandler.handleSave();
    } else if (action === 'submit') {
      submitHandler.handleSubmit();
    }

  });
});
