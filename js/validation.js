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
