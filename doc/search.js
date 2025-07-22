document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('help-search');
    if (!input) return;
    const markInstance = new Mark(document.querySelector('body'));

    input.addEventListener('input', function () {
        const term = this.value.trim();
        markInstance.unmark({
            done: function () {
                if (term !== '') {
                    markInstance.mark(term, { 'separateWordSearch': false });
                }
            }
        });
    });
});