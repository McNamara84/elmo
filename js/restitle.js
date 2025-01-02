$(document).ready(function () {
    /**
     * Adjusts the size and content of the title based on screen width.
     * Changes title text and font size depending on current window width.
     * 
     * @function resizeTitle
     * @description Dynamically adapts the title for different device screen sizes
     */
    function resizeTitle() {
        let title = document.getElementById("headtitle");
        let fullTitle = title.dataset.fullTitle;
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
        let headerButtons = document.querySelectorAll("header .btn");

        headerButtons.forEach(function (button) {
            let buttonIcon = button.querySelector("i");
            let buttonText = button.childNodes[buttonIcon ? 2 : 1];

            if (window.innerWidth < 768) {
                if (buttonText && buttonText.nodeType === Node.TEXT_NODE) {
                    if (!button.dataset.fullText) {
                        button.dataset.fullText = buttonText.textContent.trim();
                    }
                    buttonText.textContent = "";
                }
            } else {
                if (button.dataset.fullText) {
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
