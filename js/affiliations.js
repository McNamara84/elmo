// Global array to store affiliations data
var affiliationsData = [];

/**
 * Refreshes all Tagify instances when translations are changed.
 * This function updates the whitelist and restores any previously selected values without destroying instances.
 * 
 * @returns {void}
 */
function refreshTagifyInstances() {
  if (!window.affiliationsData) return;

  const allPairs = [
    { input: "input-author-affiliation", hidden: "input-author-rorid" },
    { input: "input-contactperson-affiliation", hidden: "input-contactperson-rorid" },
    { input: "input-contributorpersons-affiliation", hidden: "input-contributor-personrorid" },
    { input: "input-contributor-organisationaffiliation", hidden: "input-contributor-organisationrorid" }
  ];

  allPairs.forEach(pair => {
    const inputElement = document.getElementById(pair.input);
    if (!inputElement || !inputElement.tagify) return;

    // Save current values
    const currentValues = [...inputElement.tagify.value]; // Create a copy

    // Update whitelist without destroying the instance
    inputElement.tagify.settings.whitelist = window.affiliationsData.map(item => item.name);

    // Update placeholder if translations are available
    if (translations?.general?.affiliation) {
      inputElement.tagify.settings.placeholder = translations.general.affiliation;
      const placeholderElement = inputElement.parentElement.querySelector('.tagify__input');
      if (placeholderElement) {
        placeholderElement.setAttribute('data-placeholder', translations.general.affiliation);
      }
    }

    // Restore previously selected values
    inputElement.tagify.removeAllTags();
    inputElement.tagify.addTags(currentValues);
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
    autocompleteAffiliations("input-contributorpersons-affiliation", "input-contributor-personrorid", affiliationsData);
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
  const inputElement = $("#" + inputFieldId);
  if (!inputElement.length) return;

  const hiddenField = $("#" + hiddenFieldId);

  const placeholderValue = (typeof translations !== 'undefined' && translations.general?.affiliation)
    ? translations.general.affiliation
    : 'Affiliation';

  const tagify = new Tagify(inputElement[0], {
    enforceWhitelist: false,
    duplicates: false,
    placeholder: placeholderValue,
    whitelist: data.map(item => item.name),
    dropdown: {
      maxItems: 20,
      classname: "affiliation",
      enabled: 3,
      closeOnSelect: true
    },
    editTags: false,
    keepInvalidTags: false,
    autoComplete: {
      enabled: true
    }
  });

  /**
   * Updates the hidden input field with the IDs of the selected affiliations.
   */
  function updateHiddenField() {
    const allSelectedItems = tagify.value.map(tag => {
      const item = data.find(affiliationItem => affiliationItem.name === tag.value);
      return item ? item.id : "";
    });
    hiddenField.val(allSelectedItems.join(','));
  }

  /**
   * Hides the Tagify dropdown menu.
   */
  function closeDropdown() {
    tagify.dropdown.hide.call(tagify.dropdown);
  }

  // Event listener for when a tag is added
  tagify.on("add", function (e) {
    updateHiddenField();

    const selectedName = e.detail.data.value;
    const isOnWhitelist = tagify.whitelist.includes(selectedName);
    if (!isOnWhitelist) {
      closeDropdown();
    }
  });

  // Event listener for when a tag is removed
  tagify.on("remove", function () {
    updateHiddenField();

    // Clear tags if no contact person is selected
    if (!contactField) {
      return;
    }
    if (!contactField.value) {
      tagify.removeAllTags();
    }
  });

  // Event listener for input changes to adjust the input field width dynamically
  tagify.on("input", function (e) {
    tagify.DOM.input.style.width = (e.detail.value.length + 1) * 8 + "px";
  });

  // Store the Tagify instance in the DOM element for later access
  inputElement[0].tagify = tagify;
}