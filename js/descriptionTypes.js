/**
 * Dynamically loads description types from ERNIE API and builds
 * accordion items for the Descriptions form group.
 * Abstract is always static (hardcoded in HTML). All other types
 * are rendered dynamically based on ERNIE configuration.
 */

/**
 * Mapping: ERNIE slug -> translation key for the label
 */
const SLUG_TO_TRANSLATION_KEY = {
  'Methods': 'descriptions.methods',
  'TechnicalInfo': 'descriptions.technicalInfo',
  'Other': 'descriptions.other',
  'SeriesInformation': 'descriptions.seriesInformation',
  'TableOfContents': 'descriptions.tableOfContents'
};

/**
 * Mapping: ERNIE slug -> translation key for the placeholder
 */
const SLUG_TO_PLACEHOLDER_KEY = {
  'Methods': 'descriptions.methodsPlaceholder',
  'TechnicalInfo': 'descriptions.technicalinfoPlaceholder',
  'Other': 'descriptions.otherPlaceholder',
  'SeriesInformation': 'descriptions.seriesInformationPlaceholder',
  'TableOfContents': 'descriptions.tableOfContentsPlaceholder'
};

/**
 * Mapping: ERNIE slug -> help section ID in help.html
 */
const SLUG_TO_HELP_ID = {
  'Methods': 'help-description-methods',
  'TechnicalInfo': 'help-description-technicalinfo',
  'Other': 'help-description-other',
  'SeriesInformation': 'help-description-seriesinformation',
  'TableOfContents': 'help-description-tableofcontents'
};

/**
 * Loads description types from the API and builds dynamic accordion items.
 * Abstract is skipped (already present as static HTML).
 * Stores active slugs in window.ELMO_ACTIVE_DESCRIPTION_TYPES for the help system.
 *
 * @returns {Promise<string[]>} Resolves with array of active description type slugs
 */
function initDescriptionTypes() {
  return new Promise(function (resolve) {
    $.ajax({
      url: 'api/v2/vocabs/descriptiontypes',
      method: 'GET',
      dataType: 'json',
      success: function (types) {
        var accordion = $('#accordion-description');
        var activeSlugs = [];

        if (Array.isArray(types)) {
          types.forEach(function (type) {
            // Abstract is always static in HTML – skip it
            if (type.slug === 'Abstract') return;

            activeSlugs.push(type.slug);
            var accordionItem = buildAccordionItem(type);
            accordion.append(accordionItem);
          });
        }

        // Store active slugs globally for the help system
        window.ELMO_ACTIVE_DESCRIPTION_TYPES = activeSlugs;

        // Re-apply translations to newly added elements
        if (typeof window.applyTranslations === 'function') {
          window.applyTranslations();
        }

        // Sync help icon visibility with current help status
        if (typeof updateHelpStatus === 'function') {
          updateHelpStatus();
        }

        resolve(activeSlugs);
      },
      error: function () {
        console.warn('Failed to load description types from ERNIE');
        window.ELMO_ACTIVE_DESCRIPTION_TYPES = [];
        resolve([]);
      }
    });
  });
}

/**
 * Builds a single accordion item for a description type.
 *
 * @param {{id: number, name: string, slug: string}} type - The description type object from ERNIE
 * @returns {jQuery} The accordion item jQuery element
 */
function buildAccordionItem(type) {
  var slug = type.slug;
  var collapseId = 'collapse-description-' + slug;
  var inputId = 'input-description-' + slug;
  var translationKey = SLUG_TO_TRANSLATION_KEY[slug] || '';
  var placeholderKey = SLUG_TO_PLACEHOLDER_KEY[slug] || '';
  var helpId = SLUG_TO_HELP_ID[slug] || '';

  var item = $('<div>', { class: 'accordion-item', 'data-description-slug': slug });

  // Header with toggle button
  var header = $('<h2>', { class: 'accordion-header' });
  var button = $('<button>', {
    class: 'accordion-button collapsed',
    type: 'button',
    'data-bs-toggle': 'collapse',
    'data-bs-target': '#' + collapseId,
    'aria-expanded': 'false',
    'aria-controls': collapseId,
    text: type.name
  });
  if (translationKey) {
    button.attr('data-translate', translationKey);
  }
  header.append(button);

  // Collapsible body with textarea
  var collapse = $('<div>', {
    id: collapseId,
    class: 'accordion-collapse collapse',
    'data-bs-parent': '#accordion-description'
  });

  var body = $('<div>', { class: 'accordion-body' });
  var inputGroup = $('<div>', { class: 'input-group has-validation' });

  var textarea = $('<textarea>', {
    class: 'form-control input-with-help input-right-no-round-corners textarea-description',
    id: inputId,
    name: 'description[' + slug + ']'
  });
  if (placeholderKey) {
    textarea.attr('data-translate-placeholder', placeholderKey);
  }

  var label = $('<label>', {
    for: inputId,
    class: 'visually-hidden',
    text: type.name
  });
  if (translationKey) {
    label.attr('data-translate', translationKey);
  }

  var helpSpan = $('<span>', { class: 'input-group-text' });
  var helpIcon = $('<i>', { class: 'bi bi-question-circle-fill' });
  if (helpId) {
    helpIcon.attr('data-help-section-id', helpId);
  }
  helpSpan.append(helpIcon);

  inputGroup.append(textarea, helpSpan);
  body.append(label, inputGroup);
  collapse.append(body);
  item.append(header, collapse);

  return item;
}

// Auto-initialize on DOM ready
$(document).ready(function () {
  window.descriptionTypesReady = initDescriptionTypes();
});

// Export for testing and external usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDescriptionTypes: initDescriptionTypes,
    buildAccordionItem: buildAccordionItem,
    SLUG_TO_TRANSLATION_KEY: SLUG_TO_TRANSLATION_KEY,
    SLUG_TO_PLACEHOLDER_KEY: SLUG_TO_PLACEHOLDER_KEY,
    SLUG_TO_HELP_ID: SLUG_TO_HELP_ID
  };
}
