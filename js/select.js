const { updateDropdownPlaceholders, filterDataByGEM } =
  (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./dropdownUtils.js')
    : {
        updateDropdownPlaceholders: window.updateDropdownPlaceholders,
        filterDataByGEM: window.filterDataByGEM,
      };

/**
 * Fills the timezone dropdown and sets the default timezone based on system settings and user's location
 * @async
 * @function setupTimezoneDropdownAjax
 * @param {string|jQuery|HTMLElement} dropdownSelector - The selector for the timezone dropdown element
 * @param {string} jsonPath - Path to the timezones JSON file
 * @returns {Promise<void>}
 */
async function setupTimezoneDropdownAjax(dropdownSelector = '#input-stc-timezone', jsonPath = 'json/timezones.json') {
  try {
    const $dropdown = $(dropdownSelector);
    if ($dropdown.length === 0) return;

    /**
     * Gets system timezone from browser settings
     * @param {jQuery} $select - The jQuery select element
     * @returns {string} Timezone offset in format "+HH:MM" or "-HH:MM"
     */
    function getSystemTimezone($select) {
      try {
        const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (timezoneName) {
          const options = $select.find('option').get();
          const date = new Date();
          const offset = -date.getTimezoneOffset();
          const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
          const minutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
          const offsetStr = `${offset >= 0 ? '+' : '-'}${hours}:${minutes}`;

          let bestMatch = null;

          for (const option of options) {
            const optionText = $(option).text();
            const optionValue = $(option).val();

            if (optionText.includes(`(${timezoneName})`)) {
              return optionValue;
            }

            if (optionValue === offsetStr && optionText.includes(timezoneName.split('/')[0])) {
              bestMatch = optionValue;
              break;
            }

            if (optionValue === offsetStr && !bestMatch) {
              bestMatch = optionValue;
            }
          }

          if (bestMatch) return bestMatch;
        }

        const date = new Date();
        const offset = -date.getTimezoneOffset();
        const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
        const minutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
        return `${offset >= 0 ? '+' : '-'}${hours}:${minutes}`;

      } catch (error) {
        console.error('Error getting system timezone:', error);
        return null;
      }
    }

    if ($dropdown.find('option').length > 0) {
      const systemTimezone = getSystemTimezone($dropdown);
      setTimezoneInDropdown($dropdown, systemTimezone);
      return;
    }

    const response = await fetch(jsonPath);
    const timezones = await response.json();

    /**
     * Extracts UTC offset from timezone label
     * @param {string} label - The timezone label (e.g., "UTC+00:00 (Africa/Abidjan)")
     * @returns {string} The UTC offset (e.g., "+00:00")
     */
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

    /**
     * Sets the dropdown value to the specified timezone option
     * @param {jQuery} $select - The jQuery select element
     * @param {string} timezoneName - The timezone name (e.g., "Europe/Berlin")
     * @returns {boolean} True if timezone was set successfully
     */
    function setTimezoneInDropdown($select, timezoneName) {
      if (!timezoneName) return false;

      const allOptions = Array.from($select.find('option'));
      const exactMatch = allOptions.find(option =>
        option.text.includes(`(${timezoneName})`)
      );

      if (exactMatch) {
        $select.find('option').prop('selected', false);
        $(exactMatch).prop('selected', true);
        return true;
      }

      const region = timezoneName.split('/')[0];
      const regionMatch = allOptions.find(option =>
        option.text.includes(`(${region}/`)
      );

      if (regionMatch) {
        $select.find('option').prop('selected', false);
        $(regionMatch).prop('selected', true);
        return true;
      }

      return false;
    }

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimezone) {
      setTimezoneInDropdown($dropdown, browserTimezone);
    }

  } catch (error) {
    console.error('Error initializing timezone dropdown:', error);
  }
}

/**
 * This script handles the setup and initialization of various dropdowns, event listeners, and autocomplete functions for the metadata editor.
 */

// Dropdown helper functions exposed globally so tests can invoke them
function setupResourceTypeDropdownAjax() {
  const select = $("#input-resourceinformation-resourcetype");
  if (select.length === 0) return;

  select.prop('disabled', true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
    })
  );

  $.ajax({
    url: "api/v2/vocabs/resourcetypes",
    method: "GET",
    dataType: "json",
    success: function (data) {
      select.empty();
      addPlaceholder(select, true);

      if (Array.isArray(data)) {
        const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
        const filteredData = filterDataByGEM(data, 'resourceType', isGEM);

        filteredData.forEach(function (type) {
          select.append(
            $("<option>", {
              value: type.id,
              text: type.resource_type_general,
              title: type.description,
            })
          );
        });
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading resource types:", textStatus, errorThrown);
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Error loading data",
        })
      );
    },
    complete: function () {
      select.prop('disabled', false).trigger("change");
    },
  });
}

function setupLanguageDropdownAjax() {
  const select = $("#input-resourceinformation-language");
  if (select.length === 0) return;

  select.prop('disabled', true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
    })
  );

  $.ajax({
    url: "api/v2/vocabs/languages",
    method: "GET",
    dataType: "json",
    success: function (data) {
      select.empty();
      addPlaceholder(select, true);

      if (Array.isArray(data)) {
        const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
        const filteredData = filterDataByGEM(data, 'language', isGEM);

        filteredData.forEach(function (lang) {
          select.append(
            $("<option>", {
              value: lang.id,
              text: lang.name,
              title: lang.code,
            })
          );
        });

        // Pre-select English (code "en") as default
        const englishOption = filteredData.find(lang => lang.code === 'en');
        if (englishOption) {
          select.val(englishOption.id);
        }
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading languages:", textStatus, errorThrown);
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Error loading data",
        })
      );
    },
    complete: function () {
      select.prop('disabled', false);
    },
  });
}
// This function is a fallback implementation for the environments that don't have fetch in it.
function setupTitleTypeDropdownAjax() {
  const select = $("#input-resourceinformation-titletype");
  if (select.length === 0) {
    console.error("Title type dropdown not found. Ensure the element with ID 'input-resourceinformation-titletype' exists in the DOM.");
    return;
  }

  select.prop('disabled', true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
    })
  );

  $.ajax({
    url: "api/v2/vocabs/titletypes",
    method: "GET",
    dataType: "json",
    success: function (data) {
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Choose...",
          "data-translate": "general.choose",
        })
      );

      let mainTitleId = "";
      let alternativeTitleId = "";
      if (Array.isArray(data)) {
        data.forEach(function (type) {
          const option = $("<option>", {
            value: type.id,
            text: type.name,
          });

          select.append(option);

          if (type.name.toLowerCase() === "main title") {
            mainTitleId = type.id.toString();
          }
          if (type.name.toLowerCase() === "alternative title") {
            alternativeTitleId = type.id.toString();
          }
        });
      }

      if (mainTitleId) {
        select.val(mainTitleId);
        window.mainTitleTypeId = mainTitleId;
      }
      window.alternativeTitleTypeId = alternativeTitleId || "";

      window.titleTypeOptionsHtml = select.html();
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading title types:", textStatus, errorThrown);
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Error loading data",
        })
      );
    },
    complete: function () {
      select.prop('disabled', false);
    },
  });
}

/**
* Populates the select field with ID input-rights-license with options created via an API call.
* @param {boolean} isSoftware - Determines whether to retrieve licenses for software or all resource types.
*/
function setupLicenseDropdown(isSoftware) {
  const $select = $("#input-rights-license"); // Defined as $select for consistency
  const top_licenseId = "CC-BY-4.0"; //Should be the first
  const copyleftLicenses = ['GPL-3.0-or-later', 'EUPL-1.2']; // Should be the last

  // 1. Determine the endpoint FIRST
  const endpoint = isSoftware ? "vocabs/licenses/software" : "vocabs/licenses/all";

  // Loading state
  $select.prop("disabled", true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
      "data-translate": "general.loading",
    })
  );

  // 2. Start the API call
  $.getJSON(`./api/v2/${endpoint}`, function (data) {
    let processedLicenses = [];

    // Prepare the options for the dropdown menu
    if (!isSoftware) {
      // Non-software
      processedLicenses = data
        .filter(item => item.forSoftware === "0") // Only non-software
        .sort((a, b) => {
          // Custom Priority: If it's our target ID, move it to the top (-1)
          if (a.rightsIdentifier === top_licenseId) return -1;
          if (b.rightsIdentifier === top_licenseId) return 1;

          // Otherwise: Standard alphabetical sort
          return a.rightsIdentifier.localeCompare(b.rightsIdentifier);
        });
    } else {
      // Software
      processedLicenses = data
        .filter(item => item.forSoftware === "1") // Only software licenses
        .sort((a, b) => {
          const aIsCopyleft = copyleftLicenses.includes(a.rightsIdentifier);
          const bIsCopyleft = copyleftLicenses.includes(b.rightsIdentifier);
          
          if (aIsCopyleft !== bIsCopyleft) {
            return aIsCopyleft ? 1 : -1; // Non-copyleft first
          }
          return a.rightsIdentifier.localeCompare(b.rightsIdentifier);
        });
    }
    // Clear existing options
    $select.empty()

    // Include them into the dropdown
    processedLicenses.forEach(license => {
      const option = $("<option>", {
        value: license.rights_id,
        text: `${license.text} (${license.rightsIdentifier})`,
        title: license.description || license.text
      });

      if (license.rightsIdentifier === "CC-BY-4.0") {
        option.prop("selected", true);
      }

      $select.append(option);
    });

    $select.prop("disabled", false).trigger("change");

  }).fail(function (jqXHR, textStatus, errorThrown) {
    // Fallback: use CC-BY-4.0 (rights_id=1) if API call fails
    console.error("Error loading licenses:", textStatus, errorThrown);
    $select.empty().append(
      $("<option>", {
        value: "1",
        text: "Creative Commons Attribution 4.0 International (CC-BY-4.0)",
        selected: true
      })
    );

    $select.prop("disabled", false).trigger("change");
  });
}

/**
 * Adds a "Choose..." placeholder option to a dropdown
 * For ICGEM-specific dropdowns, skips placeholder when ICGEM mode is enabled
 * @param {jQuery} $select - The jQuery select element
 * @param {boolean} isGEMDropdown - Whether this is a ICGEM-specific dropdown (skips placeholder if ICGEM enabled)
 */
function addPlaceholder($select, isGEMDropdown = false) {
  const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
  
  // For GEM dropdowns, don't add placeholder when GEM is enabled. For others, always add.
  if (isGEMDropdown && isGEM) return;
  
  // Use translated text if translations are already loaded, otherwise fall back to English
  const translatedText = window.elmo?.translate?.('general.choose') || 'Choose...';
  
  $select.append(
    $("<option>", { value: "", text: translatedText, "data-translate": "general.choose" })
  );
}

// Make AJAX fallback dropdown setup functions available globally (important for tests)
window.setupTimezoneDropdownAjax = setupTimezoneDropdownAjax;
window.setupLicenseDropdown = setupLicenseDropdown;
window.setupLanguageDropdownAjax = setupLanguageDropdownAjax;
window.setupResourceTypeDropdownAjax = setupResourceTypeDropdownAjax;
window.setupTitleTypeDropdownAjax = setupTitleTypeDropdownAjax;

/**
 * Helper to run legacy sequential fallbacks in one place.
 */
function runSequentialFallback() {
  console.warn("Falling back to legacy sequential dropdown initialization.");
  setupTimezoneDropdownAjax();
  setupResourceTypeDropdownAjax();
  setupLanguageDropdownAjax();
  setupTitleTypeDropdownAjax();
}

/**
 * Initializes all dropdowns in parallel for faster page load.
 */
async function initializeAllDropdownsParallel() {
  // 1. Check environment availability immediately
  if (typeof fetch !== 'function') {
    return runSequentialFallback();
  }

  const dropdownSelectors = {
    resourceType: $("#input-resourceinformation-resourcetype"),
    language: $("#input-resourceinformation-language"),
    titleType: $("#input-resourceinformation-titletype"),
    license: $("#input-rights-license"),
    relation: $("#input-relatedwork-relation"),
    identifierType: $("#input-relatedwork-identifiertype")
  };

  // 2. Set loading state for existing dropdowns immediately
  Object.values(dropdownSelectors).forEach($el => {
    if ($el.length) {
      $el.prop('disabled', true).empty().append(
        $("<option>", { value: "", text: "Loading..." })
      );
    }
  });

  // 3. Define the critical fetches.
  // Note: We do NOT catch errors inline here. If these fail, we want them to bubble up
  // to Promise.all so we can cleanly trigger the fallback instead of showing empty dropdowns.
  const fetchOperations = {
    timezones: fetch('json/timezones.json').then(r => r.ok ? r.json() : Promise.reject()),
    resourceTypes: fetch('api/v2/vocabs/resourcetypes').then(r => r.ok ? r.json() : Promise.reject()),
    languages: fetch('api/v2/vocabs/languages').then(r => r.ok ? r.json() : Promise.reject()),
    titleTypes: fetch('api/v2/vocabs/titletypes').then(r => r.ok ? r.json() : Promise.reject()),
    licenses: fetch('api/v2/vocabs/licenses/all').then(r => r.ok ? r.json() : Promise.reject()),
    relations: fetch('api/v2/vocabs/relations').then(r => r.ok ? r.json() : { relations: [] }),
    identifierTypes: fetch('api/v2/validation/identifiertypes/active').then(r => r.ok ? r.json() : { identifierTypes: [] }),
    
    // Lazy Evaluation: Only call fetch if the condition is met!
    funders: (window.ELMO_FEATURES?.funderPidMode === 'ROR')
      ? Promise.resolve([])
      : fetch('json/funders.json').then(r => r.ok ? r.json() : [])
  };

  try {
    // 4. Execute all in parallel.
    // If ANY critical fetch fails (rejects), Promise.all immediately rejects, 
    // skipping the population step and routing directly to the catch block.
    const results = await Promise.all(
      Object.entries(fetchOperations).map(async ([key, promise]) => {
        const data = await promise;
        return [key, data];
      })
    );

    const data = Object.fromEntries(results);

    // 5. Populate dropdowns with verified data
    populateTimezoneDropdownWithData(data.timezones);
    populateResourceTypeDropdownWithData(data.resourceTypes);
    populateLanguageDropdownWithData(data.languages);
    populateTitleTypeDropdownWithData(data.titleTypes);
    populateLicenseDropdownWithData(data.licenses);
    populateRelationsDropdownWithData(data.relations);
    populateIdentifierTypesDropdownWithData(data.identifierTypes);
    
    window.fundersData = data.funders;
    $(".inputFunder").each(function () {
      window.setUpAutocompleteFunder(this);
    });

    document.dispatchEvent(new CustomEvent('dropdownsReady'));
    
  } catch (error) {
    console.error('Error in parallel initialization:', error);
    // 6. If anything failed, trigger sequential AJAX backups exactly ONCE.
    runSequentialFallback();
  }
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
  addPlaceholder($select, true);
  
  if (Array.isArray(types)) {
    // Filter data based on GEM flag
    const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
    const filteredData = filterDataByGEM(types, 'resourceType', isGEM);
    
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
  addPlaceholder($select, true);
  
  if (Array.isArray(languages)) {
    // Filter data based on GEM flag
    const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
    const filteredData = filterDataByGEM(languages, 'language', isGEM);
    
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
  addPlaceholder($select);

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
  addPlaceholder($select);

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
  addPlaceholder($select);

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
document.addEventListener('translationsLoaded', updateDropdownPlaceholders);

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
    setupTimezoneDropdownAjax,
    initializeAllDropdownsParallel,
    setupResourceTypeDropdownAjax,
    setupLanguageDropdownAjax,
    setupTitleTypeDropdownAjax,
    setupIdentifierTypesDropdown,
    populateTimezoneDropdownWithData,
    populateResourceTypeDropdownWithData,
    populateLanguageDropdownWithData,
    populateTitleTypeDropdownWithData,
    populateLicenseDropdownWithData,
    populateRelationsDropdownWithData,
    populateIdentifierTypesDropdownWithData,
    addPlaceholder,
    updateDropdownPlaceholders,
    filterDataByGEM,
    getIdentifierPriority,
    updateIdentifierType,
    debounce,
    updateIdsAndNames,
    updateDataSourceIdsAndNames
  };
}