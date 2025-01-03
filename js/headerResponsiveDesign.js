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
        /**
         * The title element.
         * @type {HTMLElement}
         */
        let title = document.getElementById("headtitle");

        /**
         * The full title text for larger screens.
         * @type {string}
         */
        let fullTitle = title.dataset.fullTitle;

        /**
         * The short title text for smaller screens.
         * @type {string}
         */
        let shortTitle = title.dataset.shortTitle;

        if (window.innerWidth < 768) {
            // For mobile devices
            title.textContent = shortTitle;
            title.style.fontSize = "16px";
        } else if (window.innerWidth < 1024) {
            // For tablets and smaller desktops
            title.textContent = shortTitle;
            title.style.fontSize = "18px";
        } else {
            // For larger desktops
            title.textContent = fullTitle;
            title.style.fontSize = "20px";
        }
    }

    /**
     * Adjusts the header buttons to show only icons on small screens.
     * 
     * @function adjustButtons
     * @description Hides button text on small screens and shows only icons.
     */
    function adjustButtons() {
        /**
         * A list of all header buttons.
         * @type {NodeListOf<HTMLElement>}
         */
        let headerButtons = document.querySelectorAll("header .btn");

        headerButtons.forEach(function (button) {
            /**
             * The icon element inside the button (if available).
             * @type {HTMLElement | null}
             */
            let buttonIcon = button.querySelector("i");

            /**
             * The text node of the button (if available).
             * @type {Node | null}
             */
            let buttonText = button.childNodes[buttonIcon ? 2 : 1];

            if (window.innerWidth < 768) {
                if (buttonText && buttonText.nodeType === Node.TEXT_NODE) {
                    if (!button.dataset.fullText) {
                        // Save the original text content
                        button.dataset.fullText = buttonText.textContent.trim();
                    }
                    // Hide text content for small screens
                    buttonText.textContent = "";
                }
            } else {
                if (button.dataset.fullText) {
                    // Restore text content for larger screens
                    buttonText.textContent = " " + button.dataset.fullText;
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
