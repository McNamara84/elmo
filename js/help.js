$(document).ready(function () {
  // Funktion zum Setzen des Hilfezustands
  function setHelpStatus(status) {
    localStorage.setItem("helpStatus", status);
    updateHelpStatus();
  }

  // Funktion zum Aktualisieren des Hilfezustands
  function updateHelpStatus() {
    var status = localStorage.getItem("helpStatus") || "help-on";
    $("#buttonHelpOn").toggleClass("active", status === "help-on");
    $("#bd-help-icon").toggleClass("bi bi-question-square-fill", status === "help-on");
    $("#buttonHelpOff").toggleClass("active", status === "help-off");
    $("#bd-help-icon").toggleClass("bi bi-question-square", status === "help-off");
    // CSS-Klasse input-right-no-round-corners hinzufügen oder entfernen
    // um die runden Ecken des Eingabefeldes zu entfernen oder wiederherzustellen
    $(".input-with-help").toggleClass("input-right-no-round-corners", status === "help-on");
    $(".input-with-help").toggleClass("input-right-with-round-corners", status === "help-off");
  }

  // Initiales Setzen des Hilfezustands
  updateHelpStatus();


  // Event-Handler für Klicks auf die Hilfe-Ein/Aus-Buttons
  $("#buttonHelpOn").click(function (event) {
    event.preventDefault();
    setHelpStatus("help-on");
  });

  $("#buttonHelpOff").click(function (event) {
    event.preventDefault();
    setHelpStatus("help-off");
  });

  $(".bi-question-circle-fill").click(function () {
    var sectionId = $(this).data("help-section-id");
    loadHelpContent(sectionId);
  });

  function loadHelpContent(sectionId) {
    $.get("doc/help.php", function (data) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(data, "text/html");
      var content = $(doc)
        .find("#" + sectionId)
        .html();
      $("#modal-help .modal-body").html(content);
      $("#modal-help").modal("show");
    }).fail(function () {
      console.error("Fehler beim Laden der help.html");
    });
  }

  document.getElementById("buttonHelp").addEventListener("click", function (event) {
    event.preventDefault();
    window.open("doc/help.php", "_blank");
  });
});
