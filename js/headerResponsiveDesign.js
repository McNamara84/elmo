/**
 * @fileoverview Dynamically adjusts the title size and header button content 
 *               based on screen width to improve responsiveness and usability.
 */

$(document).ready(function () {
    /**
     * Adjusts the size and content of the title based on screen width.
     * Changes title text and font size depending on current window width.
     * 
     * @function resizeTitle
     * @description Dynamically adapts the title for different device screen sizes
     */
    function resizeTitle() {
        const title = $('#headtitle');

        // Get translated titles from translations object
        const fullTitle = getNestedValue(translations, 'general.logoTitle') || 'ELMO';
        const shortTitle = getNestedValue(translations, 'general.logoTitleShort') || 'ELMO';

        if (window.innerWidth < 768) {
            // For mobile devices
            title.text(shortTitle)
                .css('font-size', '16px');
        } else if (window.innerWidth < 1024) {
            // For tablets and smaller desktops
            title.text(shortTitle)
                .css('font-size', '18px');
        } else {
            // For larger desktops
            title.text(fullTitle)
                .css('font-size', '20px');
        }
    }

    /**
     * Adjusts the header buttons to show only icons on small screens.
     * 
     * @function adjustButtons
     * @description Hides button text on small screens and shows only icons.
     */
    function adjustButtons() {
        $('header .btn').each(function () {
            const button = $(this);
            const translateKey = button.data('translate');

            if (window.innerWidth < 768) {
                // For mobile devices: show only icons
                if (!button.data('fullText')) {
                    // Store the current translation key
                    button.data('fullText', translateKey);

                    // Keep icon but remove text
                    const icon = button.find('i').prop('outerHTML');
                    button.html(icon);
                }
            } else {
                // For larger screens: restore text with icons
                const storedTranslateKey = button.data('fullText');
                if (storedTranslateKey) {
                    const translatedText = getNestedValue(translations, storedTranslateKey);
                    const icon = button.find('i').prop('outerHTML');
                    button.html(`${icon} ${translatedText}`);

                    // Clear stored text to allow future adjustments
                    button.removeData('fullText');
                }
            }
        });
    }

    // Initial execution
    resizeTitle();
    adjustButtons();

    // Execute on window resize
    window.addEventListener('resize', function () {
        resizeTitle();
        adjustButtons();
    });
});
