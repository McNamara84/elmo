// Global array to store affiliations data
var affiliationsData = [];

/**
 * Refreshes all Tagify instances when translations are changed.
 * This function destroys existing Tagify instances, reinitializes them with updated translations,
 * and restores any previously selected values.
 * 
 * @returns {void}
 */
function refreshTagifyInstances() {
  // Only proceed if affiliations data is available
  if (!window.affiliationsData) return;

  // Definition of input fields and their associated hidden fields
  const tagifyPairs = [
    { input: "input-author-affiliation", hidden: "input-author-rorid" },
    { input: "input-contactperson-affiliation", hidden: "input-contactperson-rorid" },
    { input: "input-contributor-personaffiliation", hidden: "input-contributor-personrorid" },
    { input: "input-contributor-organisationaffiliation", hidden: "input-contributor-organisationrorid" }
  ];

  // Process each field pair
  tagifyPairs.forEach(pair => {
    const inputElement = document.getElementById(pair.input);

    // Skip if element doesn't exist or doesn't have a Tagify instance
    if (!inputElement || !inputElement.tagify) return;

    // Save current values
    const currentValues = [...inputElement.tagify.value]; // Create a copy

    // Destroy current Tagify instance
    inputElement.tagify.destroy();

    // Reinitialize with updated translations
    autocompleteAffiliations(pair.input, pair.hidden, window.affiliationsData);

    // Restore previously selected values
    if (currentValues && currentValues.length > 0) {
      setTimeout(() => {
        if (inputElement.tagify) {
          inputElement.tagify.addTags(currentValues);
        }
      }, 50); // Small delay to ensure Tagify is fully initialized
    }
  });
}

/**
 * Loads affiliations data from a JSON file and initializes Tagify for specified input fields.
 */
$.getJSON("json/affiliations.json", function (data) {
  // Globale Variable mit den Daten befüllen
  window.affiliationsData = data;  // Explizit global verfügbar machen

  // Initialize Tagify for existing input fields when the document is ready
  $(document).ready(function () {
    autocompleteAffiliations("input-author-affiliation", "input-author-rorid", affiliationsData);
    autocompleteAffiliations("input-contactperson-affiliation", "input-contactperson-rorid", affiliationsData);
    autocompleteAffiliations("input-contributor-personaffiliation", "input-contributor-personrorid", affiliationsData);
    autocompleteAffiliations("input-contributor-organisationaffiliation", "input-contributor-organisationrorid", affiliationsData);
    document.addEventListener('translationsLoaded', refreshTagifyInstances);
  });
});

/**
 * @typedef {Object} Affiliation
 * @property {string} id - The unique identifier of the affiliation.
 * @property {string} name - The name of the affiliation.
 */

/**
 * Initializes Tagify on a specified input field for affiliation autocompletion.
 *
 * @param {string} inputFieldId - The ID of the input field to initialize Tagify on.
 * @param {string} hiddenFieldId - The ID of the hidden input field to store selected affiliation IDs.
 * @param {Affiliation[]} data - The affiliation data array used for autocompletion.
 */
function autocompleteAffiliations(inputFieldId, hiddenFieldId, data) {
  var inputElement = $("#" + inputFieldId);
  var hiddenField = $("#" + hiddenFieldId);

  // Initialize Tagify on the input element with specified options
  var tagify = new Tagify(inputElement[0], {
    enforceWhitelist: false,
    duplicates: false,
    placeholder: translations.general.affiliation,
    whitelist: data.map((item) => item.name),
    dropdown: {
      maxItems: 20,
      classname: "affiliation",
      enabled: 3,
      closeOnSelect: true,
    },
    editTags: false,
    keepInvalidTags: false,
    autoComplete: {
      enabled: true,
    },
  });

  /**
   * Hides the Tagify dropdown menu.
   */
  function closeDropdown() {
    tagify.dropdown.hide.call(tagify.dropdown);
  }

  /**
   * Updates the hidden input field with the IDs of the selected affiliations.
   */
  function updateHiddenField() {
    var allSelectedItems = tagify.value
      .map(function (tag) {
        var item = data.find(function (affiliationItem) {
          return affiliationItem.name === tag.value;
        });
        return item ? item.id : "";
      })
    hiddenField.val(allSelectedItems.join(','));
  }

  // Event listener for when a tag is added
  tagify.on("add", function (e) {
    updateHiddenField();

    var selectedName = e.detail.data.value;
    var isOnWhitelist = tagify.whitelist.some((item) => item === selectedName);
    if (!isOnWhitelist) {
      closeDropdown();
    }
  });

  // Event listener for when a tag is removed
  tagify.on("remove", function (e) {
    updateHiddenField();
  });

  // Event listener for input changes to adjust the input field width
  tagify.on("input", function (e) {
    tagify.DOM.input.style.width = (e.detail.value.length + 1) * 8 + "px";
  });

  // Remove all tags if the input field is not among the known fields
  if (!["input-author-affiliation", "input-contactperson-affiliation", "input-contributor-personaffiliation", "input-contributor-organisationaffiliation"].includes(inputFieldId)) {
    tagify.removeAllTags();
  }

  // Store the Tagify instance in the DOM element for later access
  inputElement[0].tagify = tagify;
}