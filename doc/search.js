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
                            toggleNavButtons(marks.length > 0);
                        }
                    });
                } else {
                    toggleNavButtons(false);
                }
            }
        });
    }

    function nextResult() {
        if (!marks.length) return;
        currentIndex = (currentIndex + 1) % marks.length;
        scrollToMark(marks[currentIndex]);
    }

    function prevResult() {
        if (!marks.length) return;
        currentIndex = (currentIndex - 1 + marks.length) % marks.length;
        scrollToMark(marks[currentIndex]);
    }

    const searchButton = document.getElementById('help-search-btn');
    const nextButton = document.getElementById('help-search-next');
    const prevButton = document.getElementById('help-search-prev');

    function toggleNavButtons(show) {
        if (!nextButton || !prevButton) return;
        if (show) {
            nextButton.classList.remove('d-none');
            prevButton.classList.remove('d-none');
        } else {
            nextButton.classList.add('d-none');
            prevButton.classList.add('d-none');
        }
    }

    if (searchButton) {
        searchButton.addEventListener('click', function (e) {
            e.preventDefault();
            performSearch();
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', function (e) {
            e.preventDefault();
            if (input.value.trim() !== lastTerm || !marks.length) {
                performSearch();
            } else {
                nextResult();
            }
        });
    }

    if (prevButton) {
        prevButton.addEventListener('click', function (e) {
            e.preventDefault();
            if (input.value.trim() !== lastTerm || !marks.length) {
                performSearch();
            } else {
                prevResult();
            }
        });
    }

    input.addEventListener('input', function () {
        if (input.value.trim() === '') {
            toggleNavButtons(false);
        }
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (input.value.trim() !== lastTerm || !marks.length) {
                performSearch();
            } else {
                if (e.shiftKey) {
                    prevResult();
                } else {
                    nextResult();
                }
            }
        }
    });
});