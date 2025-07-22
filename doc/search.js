document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('help-search');
    if (!input) return;
    const markInstance = new Mark(document.querySelector('body'));

    function performSearch() {
        const term = input.value.trim();
        markInstance.unmark({
            done: function () {
                if (term !== '') {
                    markInstance.mark(term, { separateWordSearch: false });
                }
            }
        });
    }

    input.addEventListener('input', performSearch);

    const searchButton = document.getElementById('help-search-btn');
    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }
});