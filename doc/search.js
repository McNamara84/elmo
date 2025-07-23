+37
-5

document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('help-search');
    if (!input) return;
    const markInstance = new Mark(document.querySelector('body'));

    let marks = [];
    let currentIndex = -1;
    let lastTerm = '';

    function scrollToMark(element) {
        if (element && typeof element.scrollIntoView === 'function') {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function performSearch() {
        const term = input.value.trim();
        currentIndex = -1;
        marks = [];
        lastTerm = term;
        markInstance.unmark({
            done: function () {
                if (term !== '') {
                    markInstance.mark(term, {
                        separateWordSearch: false,
                        done: function () {
                            marks = Array.from(document.querySelectorAll('mark'));
                            if (marks.length) {
                                currentIndex = 0;
                                scrollToMark(marks[currentIndex]);
                            }
                        }
                    });
                }
            }
        });
    }

    function nextResult() {
        if (!marks.length) return;
        currentIndex = (currentIndex + 1) % marks.length;
        scrollToMark(marks[currentIndex]);
    }

    const searchButton = document.getElementById('help-search-btn');
    if (searchButton) {
        searchButton.addEventListener('click', function (e) {
            e.preventDefault();
            performSearch();
        });
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (input.value.trim() !== lastTerm || !marks.length) {
                performSearch();
            } else {
                nextResult();
            }
        }
    });
});