/**
 * @description Handles feedback form submission with AJAX.
 *
 * @module feedback
 */

import {
  fetchAndStoreCsrfToken,
  startInteraction,
  INTERACTION_SCOPES,
} from '../../services/csrfTokenService.js';

$(document).ready(function () {
  const feedbackForm = $("#form-feedback");
  const sendButton = $("#button-feedback-send");
  const statusPanel = $("#panel-feedback-status");
  const thankYouMessage = $("#panel-feedback-message");
  const timeSpentField = $("#input-feedback-time-spent");
  const csrfTokenField = $("#input-feedback-csrf-token");

  let modalOpenedAt = null;

  function applyBooleanAttribute($elements, attributeName, isActive) {
    $elements.each((_, element) => {
      if (isActive) {
        element.setAttribute(attributeName, "");
      } else {
        element.removeAttribute(attributeName);
      }
    });

    return $elements;
  }

  sendButton.click(async function (event) {
    event.preventDefault();

    if (modalOpenedAt) {
      const timeSpent = Math.floor((Date.now() - modalOpenedAt) / 1000);
      timeSpentField.val(timeSpent);
    }

    sendButton
      .prop("disabled", true)
      .attr("aria-busy", "true")
      .html(
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' +
        getNestedValue(translations, 'modals.feedback.sending')
      );

    feedbackForm.attr("aria-busy", "true");
    applyBooleanAttribute(thankYouMessage, "hidden", true).attr("aria-hidden", "true");
    applyBooleanAttribute(statusPanel, "hidden", true);

    const token = await fetchAndStoreCsrfToken('feedback');
    csrfTokenField.val(token);

    const feedbackData = feedbackForm.serialize();

    $.ajax({
      url: "send_feedback_mail.php",
      type: "POST",
      data: feedbackData,
      success: function () {
        feedbackForm.hide().attr("aria-hidden", "true").attr("aria-busy", "false");
        sendButton.attr("aria-busy", "false");
        applyBooleanAttribute(thankYouMessage, "hidden", false)
          .attr("aria-hidden", "false")
          .show()
          .trigger("focus");
        applyBooleanAttribute(statusPanel, "hidden", false)
          .attr("role", "status")
          .attr("aria-live", "polite")
          .attr("aria-atomic", "true")
          .html(
            '<div class="alert alert-success">' +
            getNestedValue(translations, 'modals.feedback.success') +
            '</div>'
          );
      },
      error: function (xhr, status, error) {
        let errorMessage = error;
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.message) {
            errorMessage = response.message;
          }
        } catch (e) {
          // Use default error message
        }

        applyBooleanAttribute(statusPanel, "hidden", false)
          .attr("role", "alert")
          .attr("aria-live", "assertive")
          .attr("aria-atomic", "true")
          .html(
            '<div class="alert alert-danger">' +
            getNestedValue(translations, 'modals.feedback.error') + errorMessage +
            '</div>'
          );
        sendButton
          .prop("disabled", false)
          .attr("aria-busy", "false")
          .html(getNestedValue(translations, 'modals.feedback.sendButton'))
          .trigger("focus");
        feedbackForm.attr({ "aria-busy": "false", "aria-hidden": "false" });
        thankYouMessage.hide();
        applyBooleanAttribute(thankYouMessage, "hidden", true).attr("aria-hidden", "true");
      },
      complete: function () {
      }
    });
  });

  $('#modal-feedback')
    .on('show.bs.modal', async function () {
      modalOpenedAt = Date.now();
      await startInteraction(INTERACTION_SCOPES.feedback);

      feedbackForm[0].reset();
      timeSpentField.val('0');
      csrfTokenField.val('');

      feedbackForm.show().attr({ "aria-hidden": "false", "aria-busy": "false" });
      thankYouMessage.hide();
      applyBooleanAttribute(thankYouMessage, "hidden", true).attr("aria-hidden", "true");
      statusPanel.empty();
      applyBooleanAttribute(statusPanel, "hidden", true)
        .removeAttr("role")
        .attr("aria-live", "polite")
        .attr("aria-atomic", "true");
      sendButton
        .prop("disabled", false)
        .attr("aria-busy", "false")
        .html(getNestedValue(translations, 'modals.feedback.sendButton'));
    })
    .on('hidden.bs.modal', function () {
      $("#button-feedback-openmodalfooter").trigger("focus");
    });
});
