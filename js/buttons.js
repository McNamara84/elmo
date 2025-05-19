$(document).ready(function () {
  /**
* Event listener for the clear button that resets all input fields
* @requires jQuery
* @requires Bootstrap
* 
*/
  $(document).ready(function () {
    $('#button-form-reset').on('click', function () {
      clearInputFields();
    });
  });

  // Optional: Formular zurücksetzen, wenn das Modal geöffnet wird
  $('#modal-feedback').on('show.bs.modal', function () {
    $("#form-feedback")[0].reset();
    $("#form-feedback").show();
    $("#panel-feedback-message").hide();
    $("#panel-feedback-status").html("");
    $("#button-feedback-send").prop("disabled", false).html("Senden");
  });
  // Tooltip initialisieren
  $('[data-bs-toggle="tooltip"]').tooltip();

  //////////////////////////// ADD AND REMOVE BUTTONS ///////////////////////////////////////////////////////////////
  /**
  * Event listener for the load button that opens the XML upload modal
  * @requires jQuery
  * @requires Bootstrap
  * 
  */
  $(document).ready(function () {
    $('#button-form-load').on('click', function () {
      $('#modal-uploadxml').modal('show');
    });
  });

  /**
  * Initializes the event handler once the document is fully loaded.
  */
  $(document).ready(function () {
    /**
     * Click event handler for showing the changelog modal.
     *
     * @param {Event} event - The event object associated with the click action.
     */
    $('#button-changelog-show').click(function (event) {
      event.preventDefault(); // Prevents the default behavior of the link.

      // Loads the content from 'doc/changelog.html' into the modal's content area.
      $('#panel-changelog-content').load('doc/changelog.html', function () {
        // Displays the modal after the content has been successfully loaded.
        $('#modal-changelog').modal('show');
      });
    });
  });

});
