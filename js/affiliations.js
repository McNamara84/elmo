var affiliationsData = [];

/**
 * Refreshes all Tagify instances when translations are changed.
 * This function destroys existing Tagify instances, reinitializes them with updated translations,
 * and restores any previously selected values.
 * 
 * @returns {void}
 */
function refreshTagifyInstances() {
  if (!window.affiliationsData) return;

  const allPairs = [
    { input: "input-author-affiliation", hidden: "input-author-rorid" },
    { input: "input-contactperson-affiliation", hidden: "input-contactperson-rorid" },
    { input: "input-contributor-personaffiliation", hidden: "input-contributor-personrorid" },
    { input: "input-contributor-organisationaffiliation", hidden: "input-contributor-organisationrorid" }
  ];

  const tagifyPairs = allPairs.filter(pair => {
    const inputElement = document.getElementById(pair.input);
    return inputElement !== null;
  });

  tagifyPairs.forEach(pair => {
    const inputElement = document.getElementById(pair.input);

    if (!inputElement || !inputElement.tagify) return;

    const currentValues = [...inputElement.tagify.value];

    inputElement.tagify.destroy();

    autocompleteAffiliations(pair.input, pair.hidden, window.affiliationsData);

    if (currentValues && currentValues.length > 0) {
      setTimeout(() => {
        if (inputElement.tagify) {
          inputElement.tagify.addTags(currentValues);
        }
      }, 50);
    }
  });
}

/**
 * Loads affiliations data from a JSON file and initializes Tagify for specified input fields.
 */
$.getJSON("json/affiliations.json", function (data) {
  window.affiliationsData = data;

  $(document).ready(function () {
    autocompleteAffiliations("input-author-affiliation", "input-author-rorid", affiliationsData);
    autocompleteAffiliations("input-contributor-personaffiliation", "input-contributor-personrorid", affiliationsData);
    autocompleteAffiliations("input-contributor-organisationaffiliation", "input-contributor-organisationrorid", affiliationsData);
    document.addEventListener('translationsLoaded', refreshTagifyInstances);
  });
}).fail(function (jqXHR, textStatus, errorThrown) {
  console.error('Error loading affiliations data:', textStatus, errorThrown);
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
  if (!inputElement.length) {
    return;
  }
  var hiddenField = $("#" + hiddenFieldId);

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

  function closeDropdown() {
    tagify.dropdown.hide.call(tagify.dropdown);
  }

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

  tagify.on("add", function (e) {
    updateHiddenField();

    var selectedName = e.detail.data.value;
    var isOnWhitelist = tagify.whitelist.some((item) => item === selectedName);
    if (!isOnWhitelist) {
      closeDropdown();
    }
  });

  tagify.on("remove", function (e) {
    updateHiddenField();
  });

  tagify.on("input", function (e) {
    tagify.DOM.input.style.width = (e.detail.value.length + 1) * 8 + "px";
  });

  if (!["input-author-affiliation", "input-contributor-personaffiliation", "input-contributor-organisationaffiliation"].includes(inputFieldId)) {
    tagify.removeAllTags();
  }

  inputElement[0].tagify = tagify;
}
