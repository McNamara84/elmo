function updateActiveTheme(items, choice) {
  items.forEach(item => {
    const active = item.getAttribute('data-bs-theme-value') === choice;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
}

function initThemeMenu(doc, controller) {
  const dropdown = doc.getElementById('bd-theme');
  if (!dropdown || !dropdown.parentElement || !controller) return;
  const items = dropdown.parentElement.querySelectorAll('[data-bs-theme-value]');
  controller.subscribe(choice => updateActiveTheme(items, choice));
  items.forEach(item => {
    item.addEventListener('click', event => {
      event.preventDefault();
      controller.setChoice(item.getAttribute('data-bs-theme-value'));
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { updateActiveTheme, initThemeMenu };
} else {
  document.addEventListener('DOMContentLoaded', () => initThemeMenu(document, window.elmoTheme));
}
