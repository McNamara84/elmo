$(document).ready(function () {
  /**
   * Event handler for the "Send Feedback" button click.
   * Collects feedback data and sends it via AJAX to the server.
   */
  $("#button-feedback-send").click(function (event) {
    event.preventDefault();
    var feedbackForm = $("#form-feedback");
    var feedbackData = feedbackForm.serialize();


    // Disable the button and show a loading spinner
    $("#button-feedback-send")
      .prop("disabled", true)
      .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...');


    $.ajax({
      url: "send_feedback_mail.php",
      type: "POST",
      data: feedbackData,
      success: function (response) {

        // Formular ausblenden
        feedbackForm.hide();

        // Erfolgsmeldung und Danke-Nachricht anzeigen
        $("#panel-feedback-message").show();
        $("#panel-feedback-status").html('<div class="alert alert-success">Feedback sent successfully!</div>');

        // Modal schließen nach 3 Sekunden
        setTimeout(function () {
          $("#modal-feedback").modal("hide");
        }, 3000);


      },
      error: function (xhr, status, error) {
        // Display error message
        $("#panel-feedback-status").html(
          '<div class="alert alert-danger">Error when sending feedback: ' + error + "</div>"
        );
        // Enable the send button
        $("#button-feedback-send").prop("disabled", false).html("Send");
      },
      complete: function () {
        // Modal zurücksetzen, wenn es geschlossen wird
        $("#modal-feedback").on("hidden.bs.modal", function () {
          feedbackForm[0].reset();
          feedbackForm.show();
          $("#panel-feedback-message").hide();
          $("#panel-feedback-status").html("");
          $("#button-feedback-send").prop("disabled", false).html("Senden");
        });
      }
    });
  });


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

  /////////////////////////////// HELP BUTTONS /////////////////////////////////////////////////////////////////

});
