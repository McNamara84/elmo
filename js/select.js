/**
 * This script handles the setup and initialization of various dropdowns, event listeners, and autocomplete functions for the metadata editor.
 */

$(document).ready(function () {
  /**
   * Loads time zones and populates the time zone select field.
   */
  $.getJSON("json/timezones.json", function (data) {
    var timezoneSelect = $("#input-stc-timezone");
    $.each(data, function (index, timezone) {
      var label = timezone.label;
      var utcOffset = label.substring(3, 9); // Extracts "+01:00" or "-04:00"

      var option = $("<option></option>").attr("value", utcOffset).text(label);
      timezoneSelect.append(option);
    });
  }).fail(function () {
    console.error("Error loading time zones. Did you execute API call getTimezones (see documentation)?");
  });

  /**
  * Populates the select field with ID input-rights-license with options created via an API call.
  * @param {boolean} isSoftware - Determines whether to retrieve licenses for software or all resource types.
  */
  function setupLicenseDropdown(isSoftware) {
    $("#input-rights-license").empty();

    const endpoint = isSoftware ? "vocabs/licenses/software" : "vocabs/licenses/all";
    $.getJSON(`./api/v2/${endpoint}`, function (data) {
      var defaultOptionSet = false;

      $.each(data, function (key, val) {
        var option = $("<option>", {
          value: val.rights_id,
          text: val.text + " (" + val.rightsIdentifier + ")",
        });

        if (val.rightsIdentifier === "CC-BY-4.0") {
          option.prop("selected", true);
          defaultOptionSet = true;
        }

        $("#input-rights-license").append(option);
      });

      // Trigger change event to ensure any listeners are notified
      $("#input-rights-license").trigger("change");
    }).fail(function (jqXHR, textStatus, errorThrown) {
      console.error("Fehler beim Laden der Lizenzen:", textStatus, errorThrown);
      // Fallback: Default-Option hinzufügen
      $("#input-rights-license").append($("<option>", {
        value: "CC-BY-4.0",
        text: "Creative Commons Attribution 4.0 International (CC-BY-4.0)",
        selected: true,
      }));
      $("#input-rights-license").trigger("change");
    });
  }

  // Initialize the license dropdown
  setupLicenseDropdown(false);

  // Event handler to monitor if the resource type is changed
  $("#input-resourceinformation-resourcetype").change(function () {
    var selectedResourceType = $("#input-resourceinformation-resourcetype option:selected").text().trim();

    // Check if "Software" is selected
    if (selectedResourceType === "Software") {
      setupLicenseDropdown(true);
    } else {
      setupLicenseDropdown(false);
    }
  });

  /**
   * Global variable to store funder data.
   * @type {Array<Object>}
   */
  let fundersData = [];

  // Load funder data and set up autocomplete for funder inputs
  $.getJSON("json/funders.json", function (data) {
    fundersData = data;
    $(".inputFunder").each(function () {
      setUpAutocompleteFunder(this);
    });
  }).fail(function () {
    console.error("Error loading funders.json");
  });

  /**
   * Sets up the autocomplete functionality for funder input elements.
   * @param {HTMLElement} inputElement - The input element to attach autocomplete to.
   */
  window.setUpAutocompleteFunder = function (inputElement) {
    $(inputElement)
      .autocomplete({
        source: function (request, response) {
          var matcher = new RegExp($.ui.autocomplete.escapeRegex(request.term), "i");
          response(
            $.grep(fundersData, function (item) {
              return matcher.test(item.name);
            })
          );
        },
        minLength: 2,
        select: function (event, ui) {
          $(this).val(ui.item.name);
          $(this).siblings(".inputFunderId").val(ui.item.crossRefId);
          $(this).siblings(".inputFunderIdTyp").val("crossref");
          return false;
        },
        position: { my: "left bottom", at: "left top", collision: "flip" },
      })
      .autocomplete("instance")._renderItem = function (ul, item) {
        return $("<li>")
          .append("<div>" + item.name + "</div>")
          .appendTo(ul);
      };
  };

  // Populate the relation dropdown field
  $.ajax({
    url: "api/v2/vocabs/relations",
    method: "GET",
    dataType: "json",
    beforeSend: function () {
      var select = $("#input-relatedwork-relation");
      select.prop('disabled', true);
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Loading...",
        })
      );
    },
    success: function (response) {
      var select = $("#input-relatedwork-relation");
      select.empty();

      // Placeholder option
      select.append(
        $("<option>", {
          value: "",
          text: "Choose...",
          "data-translate": "general.choose"
        })
      );

      if (response && response.relations && response.relations.length > 0) {
        // Sortiere die Relationen alphabetisch nach Namen
        response.relations
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach(function (relation) {
            select.append(
              $("<option>", {
                value: relation.id,
                text: relation.name,
                title: relation.description
              })
            );
          });
      } else {
        select.append(
          $("<option>", {
            value: "",
            text: "No relations available",
          })
        );
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading relations:", textStatus, errorThrown);
      var select = $("#input-relatedwork-relation");
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Error loading relations",
        })
      );
    },
    complete: function () {
      $("#input-relatedwork-relation").prop('disabled', false);
    }
  });

  /**
   * Updates the validation pattern of the identifier input field based on the selected identifier type.
   * @param {HTMLElement} selectElement - The changed select element.
   */
  function updateValidationPattern(selectElement) {
    var selectedType = $(selectElement).find("option:selected").text();
    var inputIdentifier = $(selectElement).closest(".row").find('input[name^="rIdentifier"]');

    $.ajax({
      url: "api/v2/validation/patterns/" + encodeURIComponent(selectedType),
      method: "GET",
      dataType: "json",
      success: function (response) {
        if (response && response.pattern) {
          var pattern = response.pattern;

          // Remove quotes at the start and end, if present
          pattern = pattern.replace(/^"|"$/g, "");

          // Remove modifiers at the end, if present
          pattern = pattern.replace(/\/[a-z]*$/, "");

          // Set the pattern attribute of the input field
          inputIdentifier.attr("pattern", pattern);
        } else {
          inputIdentifier.removeAttr("pattern");
        }
      },
      error: function (xhr, status, error) {
        inputIdentifier.removeAttr("pattern");
      },
    });
  }
});


/**
 * Function to populate the dropdown menu of identifier types.
 * @param {string} id - The ID selector of the dropdown to populate.
 */
function setupIdentifierTypesDropdown(id) {
  var select = $(id);

  // Add the "Choose..." placeholder option
  select.empty().append(
    $("<option>", {
      value: "",
      text: "Choose...", // Placeholder text
      "data-translate": "general.choose"
    })
  );

  // Fetch identifier types from the server
  $.getJSON("./api/v2/validation/identifiertypes", function (response) {
    if (response && response.identifierTypes) {
      response.identifierTypes.forEach(function (type) {
        select.append(
          $("<option>", {
            value: type.name,
            text: type.name,
            title: type.description, // Uses the description as a tooltip
          })
        );
      });
      // Update chosen-style dropdowns if necessary
      $(".chosen-select").trigger("chosen:updated");
    } else {
      console.warn("No identifier types available");
    }
  }).fail(function (jqXHR, textStatus, errorThrown) {
    console.error("Error loading identifier types:", textStatus, errorThrown);
  });
}


/**
 * Function to update the identifier type based on the entered identifier.
 * @param {HTMLElement} inputElement - The input element for the identifier.
 */
function updateIdentifierType(inputElement) {
  var identifier = $(inputElement).val();
  var selectElement = $(inputElement).closest(".row").find('select[name="rIdentifierType[]"]');

  if (identifier) {
    $.ajax({
      url: "api/v2/validation/identifiertypes",
      method: "GET",
      dataType: "json",
      success: function (response) {
        if (response && response.identifierTypes) {
          // Find the matching identifier type based on the pattern
          const matchingType = response.identifierTypes.find((type) => {
            try {
              // Clean up the pattern
              let pattern = type.pattern;
              // Remove leading and trailing slashes and modifiers
              pattern = pattern.replace(/^\/|\/[igm]*$/g, "");
              // Remove redundant escapes
              pattern = pattern.replace(/\\{2}/g, "\\");

              const regex = new RegExp(pattern);
              return regex.test(identifier);
            } catch (e) {
              console.warn(`Invalid pattern for ${type.name}:`, e);
              return false;
            }
          });

          if (matchingType) {
            selectElement.val(matchingType.name);
            selectElement.trigger("change");
          } else {
            selectElement.val(""); // Reset to empty if no pattern matches
          }
        } else {
          selectElement.val(""); // Reset to empty if no types are available
          console.warn("No identifier types found in the response");
        }
      },
      error: function (xhr, status, error) {
        console.error("Error retrieving identifier types:", status, error);
        selectElement.val(""); // Reset to empty in case of error
      },
    });
  } else {
    selectElement.val(""); // Reset to empty if no identifier is entered
  }
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The wait time in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounce(func, wait) {
  var timeout;
  return function () {
    var context = this,
      args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      func.apply(context, args);
    }, wait);
  };
}

// Event listener for input in the identifier input field with debounce
$(document).on(
  "input",
  'input[name="rIdentifier[]"]',
  debounce(function () {
    updateIdentifierType(this);
  }, 300)
);

// Event listener for leaving the identifier input field
$(document).on("blur", 'input[name="rIdentifier[]"]', function () {
  updateIdentifierType(this);
});

// Event listener for newly added fields
$(document).on("click", ".addRelatedWork", function () {
  // Update the IDs and names of elements in the new row
  updateIdsAndNames();
});

/**
 * Function to update the IDs and names of elements within the related work group.
 */
function updateIdsAndNames() {
  $("#group-relatedwork .row").each(function (index) {
    $(this)
      .find('select[name^="relation"]')
      .attr("id", "input-relatedwork-relation" + index);
    $(this)
      .find('input[name^="rIdentifier"]')
      .attr("id", "input-relatedwork-identifier" + index);
    $(this)
      .find('select[name^="rIdentifierType"]')
      .attr("id", "input-relatedwork-identifiertype" + index);
  });
}

// Initialize the dropdowns for identifier types
setupIdentifierTypesDropdown("#input-relatedwork-identifiertype");
