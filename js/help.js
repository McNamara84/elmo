$(document).ready(function () {
  // Function to set the help status (store in localStorage)
  function setHelpStatus(status) {
      localStorage.setItem("helpStatus", status);
      updateHelpStatus();
  }

  // Function to update the help status (UI changes based on the stored status)
  function updateHelpStatus() {
      var status = localStorage.getItem("helpStatus") || "help-on";
      
      // Toggle the "active" class based on the help status
      $("#buttonHelpOn").toggleClass("active", status === "help-on");
      $("#bd-help-icon").toggleClass("bi bi-question-square-fill", status === "help-on");
      $("#buttonHelpOff").toggleClass("active", status === "help-off");
      $("#bd-help-icon").toggleClass("bi bi-question-square", status === "help-off");

      // Add or remove the CSS class to modify input field corners based on help status
      $(".input-with-help").toggleClass("input-right-no-round-corners", status === "help-on");
      $(".input-with-help").toggleClass("input-right-with-round-corners", status === "help-off");
  }

  // Initial setting of the help status when the page loads
  updateHelpStatus();

  // Event handler for the "Help On" button click
  $("#buttonHelpOn").click(function (event) {
      event.preventDefault();
      setHelpStatus("help-on");
  });

  // Event handler for the "Help Off" button click
  $("#buttonHelpOff").click(function (event) {
      event.preventDefault();
      setHelpStatus("help-off"); 
  });

  // Global event listener for help icon clicks (applies to both existing and cloned help buttons)
  $(document).on("click", ".bi-question-circle-fill", function () {
      var sectionId = $(this).data("help-section-id");  // Get the help section ID
      loadHelpContent(sectionId);  // Call the function to load the help content
  });

  // Function to load help content from the server and display it in a modal
  window.loadHelpContent = function (sectionId) {
      $.get("doc/help.php", function (data) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(data, "text/html");
          var content = $(doc).find("#" + sectionId).html();  // Extract the content based on the section ID
          $("#helpModal .modal-body").html(content);  // Set the content in the modal
          $("#helpModal").modal("show");  // Show the modal
      }).fail(function () {
          console.error("Error loading help content.");  // Log an error if the request fails
      });
  }

  // Event listener for the "Help" button that opens the help page in a new window
  document.getElementById("buttonHelp").addEventListener("click", function (event) {
      event.preventDefault();
      window.open("doc/help.php", "_blank");  // Open the help page in a new tab
  });
});
