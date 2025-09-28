/**
 * Event handlers for XML file upload functionality
 * @requires jQuery
 * @requires Bootstrap
 */
$(document).ready(function () {
  // Event listener for load button click
  $("#button-form-load").on("click", function () {
    $("#modal-uploadxml").modal("show");
  });

  // Event handler for file input change
  $("#input-uploadxml-file").on("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      handleXmlFile(file);
    }
  });

  // Event handlers for drag and drop
  const dropZone = $("#panel-uploadxml-dropfile");

  dropZone.on("dragover", function (event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.addClass("border-primary");
  });

  dropZone.on("dragleave", function (event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.removeClass("border-primary");
  });

  dropZone.on("drop", function (event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.removeClass("border-primary");

    const file = event.originalEvent.dataTransfer.files[0];
    if ((file && file.type === "text/xml") || file.name.endsWith(".xml")) {
      handleXmlFile(file);
    } else {
      showUploadStatus("Please upload an XML file.", "danger");
    }
  });
});

/**
 * Handles the uploaded XML file
 * @param {File} file - The uploaded XML file
 */
function handleXmlFile(file) {
  const reader = new FileReader();

  reader.onload = async function (event) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(event.target.result, "text/xml");

      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Invalid XML file");
      }

      // Load XML data into form
      await loadXmlToForm(xmlDoc);

      // Close modal and show success message
      $("#modal-uploadxml").modal("hide");
      showUploadStatus("XML file successfully loaded", "success");
    } catch (error) {
      console.error("Error:", error);
      showUploadStatus("Error processing XML file: " + error.message, "danger");
    }
  };

  reader.onerror = function () {
    showUploadStatus("Error reading file", "danger");
  };

  reader.readAsText(file);
}

/**
 * Shows upload status message
 * @param {string} message - The message to display
 * @param {string} type - Bootstrap alert type (success, danger, etc.)
 */
function showUploadStatus(message, type) {
  const statusElement = $("#xml-upload-status");
  statusElement.removeClass().addClass(`alert alert-${type}`).removeClass("d-none").text(message);

  // Hide message after 10 seconds
  setTimeout(() => {
    statusElement.addClass("d-none");
  }, 10000);
}
