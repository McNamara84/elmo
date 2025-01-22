// Global array to store affiliations data
var affiliationsData = [];

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
  const inputElement = $("#" + inputFieldId)[0]; // Direct DOM element
  const hiddenField = $("#" + hiddenFieldId);

  // Check if the input element is already Tagified
  if (inputElement._tagify) {
    // Update the whitelist of the existing Tagify instance
    inputElement._tagify.settings.whitelist = data.map((item) => item.name);
    inputElement._tagify.dropdown.show.call(inputElement._tagify); // Show updated dropdown if applicable
    return;
  }

  // Initialize Tagify on the input element
  const tagify = new Tagify(inputElement, {
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
   * Updates the hidden input field with the IDs of the selected affiliations.
   */
  function updateHiddenField() {
    if (!hiddenField.length) {
      return; // Hidden field is not present, skip updating it
    }

    const allSelectedItems = tagify.value.map((tag) => {
      const item = data.find((affiliationItem) => affiliationItem.name === tag.value);
      return item ? item.id : "";
    });
    hiddenField.val(allSelectedItems.join(","));
  }

  // Event listener for when a tag is added
  tagify.on("add", updateHiddenField);

  // Event listener for when a tag is removed
  tagify.on("remove", updateHiddenField);

  // Store the Tagify instance in the DOM element for later access
  inputElement._tagify = tagify;
}



