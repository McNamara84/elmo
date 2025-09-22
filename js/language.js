/**
 * Global object to store translations
 * @type {Object}
 */
let translations = {};

/**
 * Loads the translation file for the specified language
 * @param {string} lang - The language code (e.g., 'en', 'de', 'fr')
 * @returns {Promise} A promise that resolves when translations are loaded
 */
function loadTranslations(lang) {
    return $.getJSON(`lang/${lang}.json`)
        .then(function (data) {
            translations = data;
            applyTranslations();
            updateActiveLanguage(lang);
        })
        .fail(function () {
            console.error(`Failed to load language file: ${lang}`);
            // Fallback to English if requested language is not available
            if (lang !== 'en') {
                return loadTranslations('en');
            }
        });
}

/**
 * Updates the active state in the language dropdown menu
 * @param {string} lang - The active language code
 */
function updateActiveLanguage(lang) {
    // Remove active class from all language options
    $('[data-bs-language-value]').removeClass('active');

    // Add active class to the selected language
    $(`[data-bs-language-value="${lang}"]`).addClass('active');
}

/**
 * Gets a nested object value using dot notation
 * @param {Object} obj - The object to search in
 * @param {string} path - The dot-notated path to the value
 * @returns {*} The found value or undefined
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
}

/**
 * Applies the loaded translations to all UI elements
 */
function applyTranslations() {
    // Set document title
    document.title = translations.general.logoTitle;

    // Update elements with data-translate attribute
    $('[data-translate]').each(function () {
        const element = $(this);
        const translateKey = element.data('translate');
        const translatedText = getNestedValue(translations, translateKey);

        if (translatedText) {
            const icon = element.find('i.bi').prop('outerHTML');
            element.html(icon ? `${icon} ${translatedText}` : translatedText);
        }
    });

    // Update tooltips
    $('[data-translate-tooltip]').each(function () {
        const element = $(this);
        const tooltipKey = element.data('translate-tooltip');
        const translatedTooltip = getNestedValue(translations, tooltipKey);

        if (translatedTooltip) {
            element.attr('data-bs-original-title', translatedTooltip);
            const tooltip = bootstrap.Tooltip.getInstance(element[0]);
            if (tooltip) {
                tooltip.dispose();
            }
            new bootstrap.Tooltip(element[0]);
        }
    });

    // Update placeholders
    $('[data-translate-placeholder]').each(function () {
        const element = $(this);
        const placeholderKey = element.data('translate-placeholder');
        const translatedPlaceholder = getNestedValue(translations, placeholderKey);

        if (translatedPlaceholder) {
            element.attr('placeholder', translatedPlaceholder);
        }
    });

    translatePlaceholders($("#group-stc").children().first());

    // Trigger necessary UI updates
    resizeTitle();
    adjustButtons();

    if (typeof window !== 'undefined') {
        window.elmo = window.elmo || {};
        window.elmo.translate = function (key) {
            return getNestedValue(translations, key);
        };
        window.elmo.getTranslations = function () {
            return translations;
        };
        window.elmo.translations = translations;
    }

    const translationEvent = new CustomEvent('translationsLoaded', {
        detail: { translations }
    });
    document.dispatchEvent(translationEvent);
}

/**
 * Changes the application language and stores the selection
 * @param {string} lang - The language code to change to
 */
function changeLanguage(lang) {
    loadTranslations(lang);
    localStorage.setItem('userLanguage', lang);
}

/**
 * Gets the user's browser language
 * @returns {string} The two-letter language code
 */
function getBrowserLanguage() {
    return navigator.language.split('-')[0];
}

/**
 * Translates placeholders within a given container
 * @param {jQuery} container - The container element whose placeholders should be translated
 */
function translatePlaceholders(container) {
    container.find('[placeholder]').each(function () {
        const placeholderKey = $(this).attr('placeholder');
        const translatedPlaceholder = getNestedValue(translations, placeholderKey);

        if (translatedPlaceholder) {
            $(this).attr('placeholder', translatedPlaceholder);
        }
    });
}

/**
 * Initializes the language handling system
 */
$(document).ready(function () {
    // Initialize tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(
        tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl)
    );

    // Load initial language
    const savedLanguage = localStorage.getItem('userLanguage') || 'auto';
    if (savedLanguage === 'auto') {
        const browserLang = getBrowserLanguage();
        loadTranslations(browserLang)
            .catch(() => loadTranslations('en'));
    } else {
        loadTranslations(savedLanguage);
    }

    // Handle language selection
    $('[data-bs-language-value]').click(function (e) {
        e.preventDefault();
        const lang = $(this).data('bs-language-value');

        if (lang === 'auto') {
            // Speichern der Einstellung "auto" im localStorage
            localStorage.setItem('userLanguage', 'auto');
            const browserLang = getBrowserLanguage();
            // Try to load browser language, fallback to English if not available
            loadTranslations(browserLang)
                .catch(() => loadTranslations('en'));
        } else {
            changeLanguage(lang);
        }
    });
});