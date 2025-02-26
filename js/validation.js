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

    // Validate dates before
    validateDates()
    // if (!validateDates()) {
    // preventDefault();
    //};
    if (!validateDates()) {
      // If validation fails, show in console
      console.error(`Date validation failed`);
      this.showNotification('Error');
      return;
    }

    if (action === 'save') {
      saveHandler.handleSave();
    } else if (action === 'submit') {
      submitHandler.handleSubmit();
    }

  });
});

/**
 * Validates the Formgroup Dates.
 * Emargo date should not be before Date created
 * */

var createDateInput = document.getElementById("input-date-created");
var embargoDateInput = document.getElementById("input-date-embargo");
var form = document.getElementById("#group-dates");

function validateDates() {
  var createDate = new Date(createDateInput.value);
  var embargoDate = new Date(embargoDateInput.value);
  console.log(embargoDate);
  if (embargoDate < createDate) {
    return false;
  } else {
    return true;
  }
}

createDateInput.addEventListener("change", validateDates);
embargoDateInput.addEventListener("change", validateDates);
