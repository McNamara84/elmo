/**
 * @description Form validation and submission handling for dataset metadata
 * @requires bootstrap
 * @requires jquery
 */

document.addEventListener('DOMContentLoaded', function () {
  /**
   * Main form element containing the dataset metadata
   * @type {HTMLFormElement}
   */
  const form = document.getElementById('form-mde');

  /**
   * Bootstrap modals for notifications and file saving
   * @type {Object.<string, bootstrap.Modal>}
   */
  const modals = {
    notification: new bootstrap.Modal(document.getElementById('notificationModal')),
    saveAs: new bootstrap.Modal(document.getElementById('modal-saveas'))
  };

  /**
   * Form control buttons
   * @type {Object.<string, HTMLButtonElement>}
   */
  const buttons = {
    save: document.getElementById('button-form-save'),
    submit: document.getElementById('button-form-submit'),
    saveAsConfirm: document.getElementById('button-saveas-save')
  };

  // Initialize buttons and event listeners
  initializeFormControls();

  /**
   * Initialize form controls and event listeners
   */
  function initializeFormControls() {
    buttons.save.disabled = false;
    buttons.submit.disabled = false;

    document.getElementById('modal-saveas').addEventListener('hidden.bs.modal', () => {
      modals.notification.hide();
    });

    form.addEventListener('submit', handleFormSubmit);
    buttons.saveAsConfirm.addEventListener('click', handleSaveConfirm);
  }

  /**
   * Handle form submission
   * @param {Event} e - The submit event
   */
  function handleFormSubmit(e) {
    e.preventDefault();
    const action = document.activeElement.dataset.action;

    if (!form.checkValidity()) {
      handleInvalidForm();
    } else {
      handleValidForm(action);
    }
  }

  /**
   * Handle form validation errors
   */
  function handleInvalidForm() {
    form.classList.add('was-validated');
    const firstInvalid = form.querySelector(':invalid');

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.focus();
      showNotification('danger', translations.alerts.validationErrorheading, translations.alerts.validationError);
    }
  }

  /**
   * Handle valid form submission
   * @param {string} action - The form action ('save' or 'submit')
   */
  async function handleValidForm(action) {
    if (action === 'save') {
      showNotification('info', 'Processing...', 'Preparing file for download.');
      const suggestedFilename = await generateFilename();
      if (suggestedFilename) {
        document.getElementById('input-saveas-filename').value = suggestedFilename;
        modals.saveAs.show();
      }
    } else if (action === 'submit') {
      showNotification('info', translations.alerts.processingHeading, translations.alerts.processingInfo);
      submitViaAjax();
    }
  }

  /**
   * Generate filename for saving
   * @returns {Promise<string|null>} The generated filename or null if error
   */
  async function generateFilename() {
    try {
      const timestamp = new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace(/[T.]/g, '_')
        .slice(0, 15);
      return `dataset_${timestamp}`;
    } catch (error) {
      console.error('Error generating filename:', error);
      showNotification('danger', 'Error', 'Failed to generate filename');
      return null;
    }
  }

  /**
   * Handle save confirmation
   */
  async function handleSaveConfirm() {
    const filename = document.getElementById('input-saveas-filename').value.trim();
    if (!filename) {
      showNotification('danger', 'Error', 'Please enter a filename');
      return;
    }

    modals.saveAs.hide();
    await saveAndDownload(filename);
  }

  /**
   * Save data and trigger download
   * @param {string} filename - The chosen filename
   */
  async function saveAndDownload(filename) {
    showNotification('info', 'Processing...', 'Saving dataset and preparing download...');

    try {
      const formData = new FormData(form);
      formData.append('filename', filename);
      formData.append('action', 'save_and_download');

      const response = await fetch('save/save_data.php', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle the XML file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotification('success', 'Success!', translations.alerts.savingHeading, translations.alerts.savingSuccess);
    } catch (error) {
      console.error('Error saving dataset:', error);
      showNotification('danger', 'Error', 'Failed to save dataset');
    }
  }

  /**
   * Submit form data via AJAX
   */
  function submitViaAjax() {
    $.ajax({
      url: 'send_xml_file.php',
      type: 'POST',
      data: $(form).serialize(),
      dataType: 'json',
      success: function (response) {
        if (response.success) {
          showNotification('success', 'Success!', response.message);
        } else {
          showNotification('danger', 'Error!', response.message);
          console.error('Error details:', response.debug);
        }
      },
      error: function (xhr, status, error) {
        handleAjaxError(xhr, error);
      }
    });
  }

  /**
   * Handle AJAX errors
   * @param {XMLHttpRequest} xhr - The XHR object
   * @param {string} error - The error message
   */
  function handleAjaxError(xhr, error) {
    let errorMessage = 'Failed to submit dataset';
    try {
      const response = JSON.parse(xhr.responseText);
      errorMessage = response.message || errorMessage;
      console.error('Error details:', response.debug);
    } catch (e) {
      errorMessage += ': ' + error;
      console.error('Response:', xhr.responseText);
    }
    showNotification('danger', 'Error!', errorMessage);
  }

  /**
   * Show notification modal
   * @param {string} type - Message type ('success', 'danger', 'info')
   * @param {string} title - Modal title
   * @param {string} message - Notification message
   */
  function showNotification(type, title, message) {
    const modalTitle = document.getElementById('notificationModalLabel');
    const modalBody = document.getElementById('notificationModalBody');

    modalTitle.textContent = title;
    modalBody.innerHTML = `
          <div class="alert alert-${type} mb-0">
              ${message}
          </div>
      `;

    modals.notification.show();

    if (type === 'success') {
      setTimeout(() => modals.notification.hide(), 3000);
    }
  }
});