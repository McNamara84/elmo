/**
 * @description Handles feedback form submission with AJAX.
 *
 * @module feedback
 */

import {
  fetchAndStoreCsrfToken,
  startScopedInteraction,
  CSRF_SCOPES,
} from '../../services/csrfTokenService.js';

$(document).ready(function () {
  /**
   * Event handler for the "Send Feedback" button click.
   * Collects feedback data and sends it via AJAX to the server.
   */
  const feedbackForm = $("#form-feedback");
  const sendButton = $("#button-feedback-send");
  const statusPanel = $("#panel-feedback-status");
  const thankYouMessage = $("#panel-feedback-message");
  const timeSpentField = $("#input-feedback-time-spent");
  const csrfTokenField = $("#input-feedback-csrf-token");

  // Track when the modal was opened for minimum time validation
  let modalOpenedAt = null;

  /**
   * Applies or removes a boolean attribute while ensuring an empty string value for accessibility checks.
   *
   * @param {JQuery} $elements - The jQuery collection to update.
   * @param {string} attributeName - The boolean attribute that should be toggled.
   * @param {boolean} isActive - Whether the attribute should be present (true) or removed (false).
   * @returns {JQuery} The original jQuery collection for chaining.
   */
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

    // Calculate time spent filling the form (in seconds)
    if (modalOpenedAt) {
      const timeSpent = Math.floor((Date.now() - modalOpenedAt) / 1000);
      timeSpentField.val(timeSpent);
    }

    // Disable the button and show a loading spinner
    sendButton
      .prop("disabled", true)
      .attr("aria-busy", "true")
      .html(
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' +
        getNestedValue(translations, 'modals.feedback.sending') // localized "sending..."
      );

    feedbackForm.attr("aria-busy", "true");
    applyBooleanAttribute(thankYouMessage, "hidden", true).attr("aria-hidden", "true");
    applyBooleanAttribute(statusPanel, "hidden", true);

    const token = await fetchAndStoreCsrfToken(CSRF_SCOPES.feedback);
    csrfTokenField.val(token);

    const feedbackData = feedbackForm.serialize();

    // Send AJAX POST request
    $.ajax({
      url: "send_feedback_mail.php",
      type: "POST",
      data: feedbackData,
      success: function () {
        // Hide the form and show success message
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
        // Try to parse JSON error response
        let errorMessage = error;
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.message) {
            errorMessage = response.message;
          }
        } catch (e) {
          // Use default error message
        }
        
        // Show error message and re-enable send button
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
        thankYouMessage
          .hide();
        applyBooleanAttribute(thankYouMessage, "hidden", true).attr("aria-hidden", "true");
      },
      complete: function () {
      }
    });
  });

  $('#modal-feedback')
    .on('show.bs.modal', async function () {
      modalOpenedAt = Date.now();
      await startScopedInteraction(CSRF_SCOPES.feedback);

      feedbackForm[0].reset();
      timeSpentField.val('0');
      csrfTokenField.val('');

      feedbackForm.show().attr({ "aria-hidden": "false", "aria-busy": "false" });
      thankYouMessage.hide();
      applyBooleanAttribute(thankYouMessage, "hidden", true).attr("aria-hidden", "true");
      statusPanel
        .empty();
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
