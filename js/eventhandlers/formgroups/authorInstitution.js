
import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';


$(document).ready(function () {

  $("#button-authorinstitution-add").click(function () {
    const authorInstitutionGroup = $("#group-authorinstitution");
    const firstauthorInstitutionLine = authorInstitutionGroup.children().first();
    const newauthorInstitutionRow = firstauthorInstitutionLine.clone();

    newauthorInstitutionRow.find("input").val("").removeClass("is-invalid");

    newauthorInstitutionRow.find("input, select").removeAttr("required");

    replaceHelpButtonInClonedRows(newauthorInstitutionRow);

    newauthorInstitutionRow.find("#button-authorinstitution-add").replaceWith(createRemoveButton());

    authorInstitutionGroup.append(newauthorInstitutionRow);

    newauthorInstitutionRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });
  });
});
