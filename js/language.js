/**
 * Global object to load translations
 * @type {Object}
 */
let translations = {};

/**
 * Loads the translation file for the specified language
 * @param {string} lang - The language code (e.g., 'en', 'de', 'fr')
 * @returns {void}
 */
function loadTranslations(lang) {
    $.getJSON(`lang/${lang}.json`)
        .done(function (data) {
            translations = data;
            applyTranslations();
        })
        .fail(function () {
            // Fallback to English if requested language is not available
            if (lang !== 'en') {
                loadTranslations('en');
            } else {
                console.error(`Language file not found: ${lang}`);
            }
        });
}

/**
 * Gets a nested object value using a dot notation string
 * @param {Object} obj - The object to search in
 * @param {string} path - The path to the value (e.g., 'header.help')
 * @returns {string|undefined} The found value or undefined
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
}

/**
 * Applies the loaded translations to the UI elements
 * @returns {void}
 */
function applyTranslations() {
    // Set document title
    document.title = translations.general.logoTitle;

    // Update all elements with data-translate attribute
    $('[data-translate]').each(function () {
        const element = $(this);
        const translateKey = element.data('translate');
        const translatedText = getNestedValue(translations, translateKey);

        if (translatedText) {
            // Preserve existing icons if present
            const icon = element.find('i.bi').prop('outerHTML');
            element.html(icon ? `${icon} ${translatedText}` : translatedText);
        }
    });

    // Update tooltips for elements with data-translate-tooltip attribute
    $('[data-translate-tooltip]').each(function () {
        const element = $(this);
        const tooltipKey = element.data('translate-tooltip');
        const translatedTooltip = getNestedValue(translations, tooltipKey);
        // If a translation was found, update the tooltip
        if (translatedTooltip) {
            element.attr('data-bs-original-title', translatedTooltip);
            const tooltip = bootstrap.Tooltip.getInstance(element[0]);
            if (tooltip) {
                tooltip.dispose();
            }
            new bootstrap.Tooltip(element[0]);
        }
    });

    // Translate placeholders in the first row
    translatePlaceholders($("#group-stc").children().first());

    // Call resizeTitle and adjustButtons after translations are applied
    resizeTitle();
    adjustButtons();
    document.dispatchEvent(new Event('translationsLoaded'));
}
/**
 * Changes the application language and stores the selection
 * @param {string} lang - The language code to change to
 * @returns {void}
 */
function changeLanguage(lang) {
    loadTranslations(lang);
    localStorage.setItem('userLanguage', lang);
}

/**
 * Translates placeholders within a given row (or element)
 * @param {jQuery} row - The row to translate (e.g., new or first row)
 */
function translatePlaceholders(row) {
    row.find('[placeholder]').each(function () {
        const placeholderKey = $(this).attr('placeholder');
        const translatedPlaceholder = getNestedValue(translations, placeholderKey);

        if (translatedPlaceholder) {
            $(this).attr('placeholder', translatedPlaceholder);
        }
    });
}

/**
 * Initializes the language handling when the document is ready
 */
$(document).ready(function () {
    const savedLanguage = localStorage.getItem('userLanguage');
    // Set default to English or user setting if saved
    const initialLanguage = savedLanguage || 'en';

    loadTranslations(initialLanguage);

    $('[data-bs-language-value]').click(function (e) {
        e.preventDefault();
        const lang = $(this).data('bs-language-value');
        if (lang === 'auto') {
            // Load English als default language
            changeLanguage('en');
        } else {
            changeLanguage(lang);
        }
    });
});




