const dropdownUtils =
  (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./dropdownUtils.js')
    : {
        updateDropdownPlaceholders: window.updateDropdownPlaceholders,
        filterDataByGEM: window.filterDataByGEM,
      };

const dropdownAjax =
  (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./dropdownAjax.js')
    : {
        setupTimezoneDropdownAjax: window.setupTimezoneDropdownAjax,
        setupResourceTypeDropdownAjax: window.setupResourceTypeDropdownAjax,
        setupLanguageDropdownAjax: window.setupLanguageDropdownAjax,
        setupTitleTypeDropdownAjax: window.setupTitleTypeDropdownAjax,
        setupLicenseDropdown: window.setupLicenseDropdown,
        addPlaceholder: window.addPlaceholder,
        runSequentialFallback: window.runSequentialFallback,
      };

/**
 * This script handles the setup and initialization of various dropdowns, event listeners, and autocomplete functions for the metadata editor.
 */

/**
 * Initializes all dropdowns in parallel for faster page load.
 */
async function initializeAllDropdownsParallel() {
  if (typeof fetch !== 'function') {
    return dropdownAjax.runSequentialFallback();
  }

  const dropdownSelectors = {
    resourceType: $("#input-resourceinformation-resourcetype"),
    language: $("#input-resourceinformation-language"),
    titleType: $("#input-resourceinformation-titletype"),
    license: $("#input-rights-license"),
    relation: $("#input-relatedwork-relation"),
    identifierType: $("#input-relatedwork-identifiertype")
  };

  // Set loading state
  Object.values(dropdownSelectors).forEach($el => {
    if ($el.length) {
      $el.prop('disabled', true).empty().append(
        $("<option>", { value: "", text: "Loading..." })
      );
    }
  });

  // Define the operations. Note that we want failures to actually reject 
  // so we can identify them in the results.
  const fetchOperations = {
    timezones: fetch('json/timezones.json').then(r => r.ok ? r.json() : Promise.reject()),
    resourceTypes: fetch('api/v2/vocabs/resourcetypes').then(r => r.ok ? r.json() : Promise.reject()),
    languages: fetch('api/v2/vocabs/languages').then(r => r.ok ? r.json() : Promise.reject()),
    titleTypes: fetch('api/v2/vocabs/titletypes').then(r => r.ok ? r.json() : Promise.reject()),
    licenses: fetch('api/v2/vocabs/licenses/all').then(r => r.ok ? r.json() : Promise.reject()),
    relations: fetch('api/v2/vocabs/relations').then(r => r.ok ? r.json() : { relations: [] }),
    identifierTypes: fetch('api/v2/validation/identifiertypes/active').then(r => r.ok ? r.json() : { identifierTypes: [] }),
    funders: (window.ELMO_FEATURES?.funderPidMode === 'ROR')
      ? Promise.resolve([])
      : fetch('json/funders.json').then(r => r.ok ? r.json() : Promise.reject())
  };

  // We convert the dictionary into an array of entries: [[key, promise], [key, promise]...]
  const keys = Object.keys(fetchOperations);
  const promises = Object.values(fetchOperations);

  // Promise.allSettled will NEVER reject. It always resolves once everything is done.
  const results = await Promise.allSettled(promises);

  // We map the settled results back to our keys
  const data = {};
  const failures = [];

  results.forEach((result, index) => {
    const key = keys[index];
    if (result.status === 'fulfilled') {
      data[key] = result.value;
    } else {
      // Keep track of exactly which key failed
      failures.push(key);
      console.warn(`Failed to fetch ${key} in parallel. Will use fallback.`);
    }
  });

  // --- POPULATE SUCCESSFUL DROPDOWNS ---
  if ('timezones' in data) populateTimezoneDropdownWithData(data.timezones);
  if ('resourceTypes' in data) populateResourceTypeDropdownWithData(data.resourceTypes);
  if ('languages' in data) populateLanguageDropdownWithData(data.languages);
  if ('titleTypes' in data) populateTitleTypeDropdownWithData(data.titleTypes);
  if ('licenses' in data) populateLicenseDropdownWithData(data.licenses);
  if ('relations' in data) populateRelationsDropdownWithData(data.relations);
  if ('identifierTypes' in data) populateIdentifierTypesDropdownWithData(data.identifierTypes);
  
  if ('funders' in data) {
    window.fundersData = data.funders;
    $(".inputFunder").each(function () {
      window.setUpAutocompleteFunder(this);
    });
  }

  // --- TARGETED FALLBACKS ---
  // Only trigger the sequential AJAX fallbacks for the ones that actually failed!
  if (failures.includes('timezones')) dropdownAjax.setupTimezoneDropdownAjax();
  if (failures.includes('resourceTypes')) dropdownAjax.setupResourceTypeDropdownAjax();
  if (failures.includes('languages')) dropdownAjax.setupLanguageDropdownAjax();
  if (failures.includes('titleTypes')) dropdownAjax.setupTitleTypeDropdownAjax();
  
  // If licenses/relations/identifiers failed and don't have fallbacks,
  // we can at least restore their disabled state so they aren't stuck on "Loading..."
  failures.forEach(key => {
    if (dropdownSelectors[key]) {
      dropdownSelectors[key].prop('disabled', false).empty().append(
        $("<option>", { value: "", text: "Error loading options" })
      );
    }
  });

  document.dispatchEvent(new CustomEvent('dropdownsReady'));
}

/**
 * Populates timezone dropdown with pre-fetched data
 * @param {Array} timezones - Array of timezone objects
 */
function populateTimezoneDropdownWithData(timezones) {
  const $dropdown = $('#input-stc-timezone');
  if (!$dropdown.length || !timezones.length) return;

  function extractUTCOffset(label) {
    const match = label.match(/UTC([+-]\d{2}:\d{2})/);
    return match ? match[1] : '';
  }

  $dropdown.empty();
  timezones.forEach(timezone => {
    $dropdown.append(
      $('<option>', {
        value: extractUTCOffset(timezone.label),
        text: timezone.label
      })
    );
  });

  // Set browser timezone
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (browserTimezone) {
    const allOptions = Array.from($dropdown.find('option'));
    const exactMatch = allOptions.find(option => option.text.includes(`(${browserTimezone})`));
    if (exactMatch) {
      $(exactMatch).prop('selected', true);
    }
  }
}

/**
 * Populates resource type dropdown with pre-fetched data
 * @param {Array} types - Array of resource type objects
 */
function populateResourceTypeDropdownWithData(types) {
  const $select = $("#input-resourceinformation-resourcetype");
  if (!$select.length) return;
    
  // Always empty to remove "Loading..." option
  $select.empty();
  
  // Handle placeholder logic
  dropdownAjax.addPlaceholder($select, true);
  
  if (Array.isArray(types)) {
    // Filter data based on GEM flag
    const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
    const filteredData = typeof dropdownUtils.filterDataByGEM === 'function'
      ? dropdownUtils.filterDataByGEM(types, 'resourceType', isGEM)
      : types;
    
    filteredData.forEach(type => {
      $select.append(
        $("<option>", {
          value: type.id,
          text: type.resource_type_general,
          title: type.description
        })
      );
    });
  }
  $select.prop('disabled', false).trigger("change");
}

/**
 * Populates language dropdown with pre-fetched data
 * @param {Array} languages - Array of language objects
 */
function populateLanguageDropdownWithData(languages) {
  const $select = $("#input-resourceinformation-language");
  if (!$select.length) return;
  
  // Always empty to remove "Loading..." option
  $select.empty();
  
  // Handle placeholder logic
  dropdownAjax.addPlaceholder($select, true);
  
  if (Array.isArray(languages)) {
    // Filter data based on GEM flag
    const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
    const filteredData = typeof dropdownUtils.filterDataByGEM === 'function'
      ? dropdownUtils.filterDataByGEM(languages, 'language', isGEM)
      : languages;
    
    filteredData.forEach(lang => {
      $select.append(
        $("<option>", {
          value: lang.id,
          text: lang.name,
          title: lang.code
        })
      );
    });

    // Pre-select English (code "en") as default
    const englishOption = filteredData.find(lang => lang.code === 'en');
    if (englishOption) {
      $select.val(englishOption.id);
    }
  }
  $select.prop('disabled', false);
}

/**
 * Populates title type dropdown with pre-fetched data
 * @param {Array} types - Array of title type objects
 */
function populateTitleTypeDropdownWithData(types) {
  const $select = $("#input-resourceinformation-titletype");
  if (!$select.length) return;

  $select.empty();
  dropdownAjax.addPlaceholder($select);

  let mainTitleId = "";
  let alternativeTitleId = "";

  if (Array.isArray(types)) {
    types.forEach(type => {
      $select.append(
        $("<option>", {
          value: type.id,
          text: type.name
        })
      );
      if (type.name.toLowerCase() === "main title") {
        mainTitleId = type.id.toString();
      }
      if (type.name.toLowerCase() === "alternative title") {
        alternativeTitleId = type.id.toString();
      }
    });
  }

  if (mainTitleId) {
    $select.val(mainTitleId);
    window.mainTitleTypeId = mainTitleId;
  }
  window.alternativeTitleTypeId = alternativeTitleId || "";
  window.titleTypeOptionsHtml = $select.html();
  $select.prop('disabled', false);
}

/**
 * Populates license dropdown with pre-fetched data
 * @param {Array} licenses - Array of license objects
 */
function populateLicenseDropdownWithData(licenses) {
  const $select = $("#input-rights-license");
  if (!$select.length) return;

  $select.empty();

  if (Array.isArray(licenses) && licenses.length > 0) {
    licenses.forEach(val => {
      const $option = $("<option>", {
        value: val.rights_id,
        text: val.text + " (" + val.rightsIdentifier + ")"
      });
      if (val.rightsIdentifier === "CC-BY-4.0") {
        $option.prop("selected", true);
      }
      $select.append($option);
    });
  } else {
    // Fallback: use CC-BY-4.0 (rights_id=1)
    $select.append($("<option>", {
      value: "1",
      text: "Creative Commons Attribution 4.0 International (CC-BY-4.0)",
      selected: true
    }));
  }
  $select.prop('disabled', false).trigger("change");
}

/**
 * Populates relations dropdown with pre-fetched data
 * @param {Object} response - Response object containing relations array
 */
function populateRelationsDropdownWithData(response) {
  const $select = $("#input-relatedwork-relation");
  if (!$select.length) return;

  $select.empty();
  dropdownAjax.addPlaceholder($select);

  if (response && response.relations && response.relations.length > 0) {
    response.relations
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(relation => {
        $select.append(
          $("<option>", {
            value: relation.id,
            text: relation.name,
            title: relation.description
          })
        );
      });
  }
  $select.prop('disabled', false);
}

/**
 * Populates identifier types dropdown with pre-fetched data
 * @param {Object} response - Response object containing identifierTypes array
 */
function populateIdentifierTypesDropdownWithData(response) {
  const $select = $("#input-relatedwork-identifiertype");
  if (!$select.length) return;

  $select.empty();
  dropdownAjax.addPlaceholder($select);

  if (response && response.identifierTypes) {
    response.identifierTypes.forEach(type => {
      $select.append(
        $("<option>", {
          value: type.name,
          text: type.name,
          title: type.description
        })
      );
    });
  }
  $select.prop('disabled', false);
  $(".chosen-select").trigger("chosen:updated");
}

// Make parallel initialization function available globally
window.initializeAllDropdownsParallel = initializeAllDropdownsParallel;

// Update dropdown placeholders when translations are loaded or changed
if (typeof dropdownUtils.updateDropdownPlaceholders === 'function') {
  document.addEventListener('translationsLoaded', dropdownUtils.updateDropdownPlaceholders);
}

$(document).ready(function () {
  // Use parallel initialization for faster page load
  initializeAllDropdownsParallel();
  
  // Event handler to monitor if the resource type is changed
  // Only reload licenses when user actually selects a resource type (not on initial load)
  $("#input-resourceinformation-resourcetype").change(function () {
    var selectedValue = $(this).val();
    // Skip if no value selected (e.g., "Choose..." or initial trigger)
    if (!selectedValue) {
      return;
    }
    
    var selectedResourceType = $("#input-resourceinformation-resourcetype option:selected").text().trim();

    // Check if "Software" is selected
    if (selectedResourceType === "Software") {
      window.setupLicenseDropdown(true);
    } else {
      window.setupLicenseDropdown(false);
    }
  });

  /**
   * Sets up the autocomplete functionality for funder input elements.
   * Supports two modes based on ELMO_FEATURES.funderPidMode:
   * - 'CFID' (default): Uses local Crossref Funder Registry data
   * - 'ROR': Uses server-side ROR affiliation search
   * @param {HTMLElement} inputElement - The input element to attach autocomplete to.
   */
  window.setUpAutocompleteFunder = function (inputElement) {
    const isRorMode = window.ELMO_FEATURES && window.ELMO_FEATURES.funderPidMode === 'ROR';

    if (isRorMode) {
      setUpAutocompleteFunderRor(inputElement);
    } else {
      setUpAutocompleteFunderCfid(inputElement);
    }
  };

  /**
   * Sets up funder autocomplete using local Crossref Funder Registry data.
   * @param {HTMLElement} inputElement - The input element to attach autocomplete to.
   */
  function setUpAutocompleteFunderCfid(inputElement) {
    // Use globally stored fundersData from parallel load
    const fundersData = window.fundersData || [];
    let searchTimeout;
    const MAX_RESULTS = 30; // Limit dropdown results
    const MIN_LENGTH = 2; // Minimum characters before search
    
    $(inputElement)
      .autocomplete({
        source: function (request, response) {
          // Cancel previous search if still pending
          clearTimeout(searchTimeout);
          
          // Require at least MIN_LENGTH characters for search
          if (!request.term || request.term.length < MIN_LENGTH) {
            response([]);
            return;
          }
          
          // Debounce search: wait 300ms before executing
          searchTimeout = setTimeout(() => {
            // Search at start of name first (more specific), then anywhere
            const searchTerm = $.ui.autocomplete.escapeRegex(request.term).toLowerCase();
            const results = [];
            
            for (let i = 0; i < fundersData.length && results.length < MAX_RESULTS; i++) {
              const itemName = fundersData[i].name.toLowerCase();
              
              // Prioritize matches at the start of the name
              if (itemName.indexOf(searchTerm) === 0) {
                results.push(fundersData[i]);
              }
            }
            
          // If we need more results, search anywhere in the name
          if (results.length < MAX_RESULTS) {
            for (let i = 0; i < fundersData.length && results.length < MAX_RESULTS; i++) {
              const itemName = fundersData[i].name.toLowerCase();
              
              // Check if this funder is NOT already in the results array
              // AND Check if searchTerm exists anywhere in the funder name
              if (results.indexOf(fundersData[i]) === -1 && itemName.indexOf(searchTerm) !== -1) {
                results.push(fundersData[i]);
              }
            }
          }
            
            response(results);
          }, 200); // 200ms debounce
        },
        minLength: MIN_LENGTH,
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
  }

  /**
   * Sets up funder autocomplete using server-side ROR affiliation search.
   * @param {HTMLElement} inputElement - The input element to attach autocomplete to.
   */
  function setUpAutocompleteFunderRor(inputElement) {
    let searchTimeout;
    const MIN_LENGTH = 2;

    $(inputElement)
      .autocomplete({
        source: function (request, response) {
          clearTimeout(searchTimeout);

          if (!request.term || request.term.length < MIN_LENGTH) {
            response([]);
            return;
          }

          searchTimeout = setTimeout(() => {
            fetch('api/v2/affiliations/search?q=' + encodeURIComponent(request.term) + '&limit=30')
              .then(r => r.ok ? r.json() : [])
              .then(data => {
                response(data.map(item => ({
                  label: item.name,
                  value: item.name,
                  rorId: item.id,
                  name: item.name
                })));
              })
              .catch(() => response([]));
          }, 200);
        },
        minLength: MIN_LENGTH,
        select: function (event, ui) {
          $(this).val(ui.item.name);
          $(this).siblings(".inputFunderId").val(ui.item.rorId);
          $(this).siblings(".inputFunderIdTyp").val("ROR");
          return false;
        },
        position: { my: "left bottom", at: "left top", collision: "flip" },
      })
      .autocomplete("instance")._renderItem = function (ul, item) {
        return $("<li>")
          .append($("<div>").text(item.name))
          .appendTo(ul);
      };
  }

  // Note: Relations dropdown is now populated by initializeAllDropdownsParallel()

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
  $.getJSON("./api/v2/validation/identifiertypes/active", function (response) {
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
// Priority map for identifier types when multiple patterns match
const IDENTIFIER_TYPE_PRIORITY = {
  DOI: 10,
  URL: 0,
};

function getIdentifierPriority(name) {
  return IDENTIFIER_TYPE_PRIORITY.hasOwnProperty(name)
    ? IDENTIFIER_TYPE_PRIORITY[name]
    : 5;
}

function updateIdentifierType(inputElement) {
  var identifier = $(inputElement).val();
  // Apply the function to the identifier type select elements of related work and data sources
  var selectElement = $(inputElement).closest(".row").find('select[name="rIdentifierType[]"], select[name="dIdentifierType[]"]');

  if (identifier) {
    $.ajax({
      url: "api/v2/validation/identifiertypes/active",
      method: "GET",
      dataType: "json",
      success: function (response) {
        if (response && response.identifierTypes) {
          // Collect all identifier types that match the identifier
          const matchingTypes = response.identifierTypes.filter((type) => {
            try {
              // Clean up the pattern
              let pattern = type.pattern;
              // Remove leading and trailing slashes and modifiers
              pattern = pattern.replace(/^\/|\/[igm]*$/g, "");
              // Remove redundant escapes
              pattern = pattern.replace(/\\{2}/g, "\\");

              const regex = new RegExp(pattern, "i");
              return regex.test(identifier);
            } catch (e) {
              console.warn(`Invalid pattern for ${type.name}:`, e);
              return false;
            }
          });

          if (matchingTypes.length > 0) {
            // Choose the best match by custom priority, then pattern length
            matchingTypes.sort((a, b) => {
              const prioDiff =
                getIdentifierPriority(b.name) - getIdentifierPriority(a.name);
              if (prioDiff !== 0) return prioDiff;
              return b.pattern.length - a.pattern.length;
            });
            const bestMatch = matchingTypes[0];
            selectElement.val(bestMatch.name);
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
// Note: Identifier types dropdown is now populated by initializeAllDropdownsParallel()

function updateDataSourceIdsAndNames() {
  $("#group-datasources .row").each(function (index) {
    $(this)
      .find('select[name="datasource_type[]"]')
      .attr("id", "input-datasource-type" + index);
    $(this)
      .find('select[name="datasource_details[]"]')
      .attr("id", "input-datasource-details" + index);
    $(this)
      .find('input[name="dName[]"]')
      .attr("id", "input-datasource-modelname" + index);
    $(this)
      .find('input[name="dIdentifier[]"]')
      .attr("id", "input-datasource-identifier" + index);
    $(this)
      .find('select[name="dIdentifierType[]"]')
      .attr("id", "input-datasource-identifiertype" + index);
  });
}

// Event listener for input in the data source identifier input field with debounce
$(document).on(
  "input",
  'input[name="dIdentifier[]"]',
  debounce(function () {
    updateDataSourceIdsAndNames();
    updateIdentifierType(this);
  }, 300)
);

// Event listener for leaving the data source identifier input field
$(document).on("blur", 'input[name="dIdentifier[]"]', function () {
  updateIdentifierType(this);
});

// Export for testing (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setupTimezoneDropdownAjax: dropdownAjax.setupTimezoneDropdownAjax,
    initializeAllDropdownsParallel,
    setupResourceTypeDropdownAjax: dropdownAjax.setupResourceTypeDropdownAjax,
    setupLanguageDropdownAjax: dropdownAjax.setupLanguageDropdownAjax,
    setupTitleTypeDropdownAjax: dropdownAjax.setupTitleTypeDropdownAjax,
    setupLicenseDropdown: dropdownAjax.setupLicenseDropdown,
    setupIdentifierTypesDropdown,
    runSequentialFallback: dropdownAjax.runSequentialFallback,
    populateTimezoneDropdownWithData,
    populateResourceTypeDropdownWithData,
    populateLanguageDropdownWithData,
    populateTitleTypeDropdownWithData,
    populateLicenseDropdownWithData,
    populateRelationsDropdownWithData,
    populateIdentifierTypesDropdownWithData,
    addPlaceholder: dropdownAjax.addPlaceholder,
    updateDropdownPlaceholders: dropdownUtils.updateDropdownPlaceholders,
    filterDataByGEM: dropdownUtils.filterDataByGEM,
    getIdentifierPriority,
    updateIdentifierType,
    debounce,
    updateIdsAndNames,
    updateDataSourceIdsAndNames
  };
}