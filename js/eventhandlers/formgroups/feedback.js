/**
 * @description Handles feedback form submission with AJAX.
 *
 * @module feedback
 */

$(document).ready(function () {
  /**
   * Event handler for the "Send Feedback" button click.
   * Collects feedback data and sends it via AJAX to the server.
   */
  $("#button-feedback-send").click(function (event) {
    event.preventDefault();

    // Form and data setup
    const feedbackForm = $("#form-feedback");
    const feedbackData = feedbackForm.serialize();

    // Disable the button and show a loading spinner
    $("#button-feedback-send")
      .prop("disabled", true)
      .html(
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' +
        getNestedValue(translations, 'modals.feedback.sending') // localized "sending..."
      );

    // Send AJAX POST request
    $.ajax({
      url: "send_feedback_mail.php",
      type: "POST",
      data: feedbackData,
      success: function () {
        // Hide the form and show success message
        feedbackForm.hide();
        $("#panel-feedback-message").show();
        $("#panel-feedback-status").html(
          '<div class="alert alert-success">' +
          getNestedValue(translations, 'modals.feedback.success') +
          '</div>'
        );

        // Auto-close modal after 3 seconds
        setTimeout(function () {
          $("#modal-feedback").modal("hide");
        }, 3000);
      },
      error: function (xhr, status, error) {
        // Show error message and re-enable send button
        $("#panel-feedback-status").html(
          '<div class="alert alert-danger">' +
          getNestedValue(translations, 'modals.feedback.error') + error +
          '</div>'
        );
        $("#button-feedback-send").prop("disabled", false)
          .html(getNestedValue(translations, 'modals.feedback.sendButton'))
          .trigger("focus");
      },
      complete: function () {
      }
    });
  });

  $('#modal-feedback')
    .on('show.bs.modal', function () {
      $("#form-feedback")[0].reset();
      $("#form-feedback").show();
      $("#panel-feedback-message").hide();
      $("#panel-feedback-status").html("");
      $("#button-feedback-send").prop("disabled", false)
        .html(getNestedValue(translations, 'modals.feedback.sendButton'));
    })
    .on('hidden.bs.modal', function () {
      $("#button-feedback-openmodalfooter").trigger("focus");
    });
});