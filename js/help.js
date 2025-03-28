/**
 * @fileOverview This script handles the display and toggle of a "Help" feature using localStorage,
 * modifies UI elements based on the user's help status choice, and loads help content into a modal via AJAX.
 * It also provides a button to open the help page in a new tab.
 */

$(document).ready(function () {
    /**
     * Sets the help status and stores it in localStorage.
     * Then calls {@link updateHelpStatus} to immediately reflect the change in the UI.
     *
     * @function setHelpStatus
     * @param {string} status - The desired help status (e.g., "help-on" or "help-off").
     * @returns {void}
     */
    function setHelpStatus(status) {
        localStorage.setItem("helpStatus", status);
        updateHelpStatus();
    }

    /**
     * Retrieves the current help status from localStorage (or defaults to "help-on") and
     * updates the UI elements accordingly. This includes toggling CSS classes and button states.
     *
     * @function updateHelpStatus
     * @returns {void}
     */
    function updateHelpStatus() {
        var status = localStorage.getItem("helpStatus") || "help-on";

        // Toggle the "active" class for "Help On" and "Help Off" buttons
        $("#buttonHelpOn").toggleClass("active", status === "help-on");
        $("#bd-help-icon").toggleClass("bi bi-question-square-fill", status === "help-on");
        $("#buttonHelpOff").toggleClass("active", status === "help-off");
        $("#bd-help-icon").toggleClass("bi bi-question-square", status === "help-off");

        // Add or remove CSS classes to adjust input field corners based on help status
        $(".input-with-help").toggleClass("input-right-no-round-corners", status === "help-on");
        $(".input-with-help").toggleClass("input-right-with-round-corners", status === "help-off");
    }

    // Initial setting of the help status when the page loads
    updateHelpStatus();

    /**
     * Click event handler for the "Help On" button.
     * Sets the help status to "help-on" and updates the UI.
     *
     * @event click#buttonHelpOn
     * @param {jQuery.Event} event - The click event object.
     * @returns {void}
     */
    $("#buttonHelpOn").click(function (event) {
        event.preventDefault();
        setHelpStatus("help-on");
    });

    /**
     * Click event handler for the "Help Off" button.
     * Sets the help status to "help-off" and updates the UI.
     *
     * @event click#buttonHelpOff
     * @param {jQuery.Event} event - The click event object.
     * @returns {void}
     */
    $("#buttonHelpOff").click(function (event) {
        event.preventDefault();
        setHelpStatus("help-off");
    });

    /**
     * Global click event handler for help icons with the class "bi-question-circle-fill".
     * Retrieves a data attribute representing the ID of the help section, then calls {@link loadHelpContent}.
     *
     * @event document#click .bi-question-circle-fill
     * @param {jQuery.Event} event - The click event object.
     * @returns {void}
     */
    $(document).on("click", ".bi-question-circle-fill", function () {
        var sectionId = $(this).data("help-section-id");
        loadHelpContent(sectionId);
    });

    /**
     * Loads help content from the server and displays it in a modal dialog.
     *
     * @function loadHelpContent
     * @global
     * @param {string} sectionId - The ID of the help section to load and display in the modal.
     * @returns {void}
     */
    window.loadHelpContent = function (sectionId) {
        $.get("doc/help.php", function (data) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(data, "text/html");
            var content = $(doc).find("#" + sectionId).html();
            $("#helpModal .modal-body").html(content);
            $("#helpModal").modal("show");
        }).fail(function () {
            console.error("Error loading help content.");
        });
    };

    /**
     * Click event handler for the "Help" button that opens the help page in a new tab/window.
     *
     * @event buttonHelp:click
     * @param {Event} event - The click event object.
     * @returns {void}
     */
    document.getElementById("buttonHelp").addEventListener("click", function (event) {
        event.preventDefault();
        window.open("doc/help.php", "_blank");
    });
});
