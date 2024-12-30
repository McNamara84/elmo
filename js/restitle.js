$(document).ready(function () {
    /**
     * Adjusts the size and content of the title and header buttons based on screen width.
     * Changes title text, font size, and header button sizes depending on current window width.
     * 
     * @function resizeElements
     * @description Dynamically adapts UI elements for different device screen sizes
     */
    function resizeElements() {
        let title = document.getElementById("headtitle");
        let headerButtons = document.querySelectorAll("header .btn");
        let fullTitle = title.dataset.fullTitle;
        let shortTitle = title.dataset.shortTitle;

        if (window.innerWidth < 768) {
            // For mobile devices
            title.textContent = shortTitle;
            title.style.fontSize = "16px";

            headerButtons.forEach(function (button) {
                button.style.fontSize = "10px";
                button.style.padding = "6px 12px";
            });
        } else if (window.innerWidth < 1024) {
            // For tablets and smaller desktops
            title.textContent = shortTitle;
            title.style.fontSize = "18px";

            headerButtons.forEach(function (button) {
                button.style.fontSize = "14px";
                button.style.padding = "8px 16px";
            });
        } else {
            // For larger desktops
            title.textContent = fullTitle;
            title.style.fontSize = "20px";

            headerButtons.forEach(function (button) {
                button.style.fontSize = "16px";
                button.style.padding = "10px 20px";
            });
        }
    }

    // Initial execution
    resizeElements();

    // Execute on window resize
    window.addEventListener('resize', resizeElements);
});
