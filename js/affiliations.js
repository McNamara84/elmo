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
  if (!["input-author-affiliation", "input-contributor-personaffiliation", "input-contributor-organisationaffiliation"].includes(inputFieldId)) {
    tagify.removeAllTags();
  }

  // Store the Tagify instance in the DOM element for later access
  inputElement[0].tagify = tagify;
}