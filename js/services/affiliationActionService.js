/** Require explicit decisions for unfinished affiliation inputs before a form action. */
function editors(root) {
  return Array.from(root.querySelectorAll('[data-affiliation-editor]'));
}

function reveal(element, input) {
  const card = element.closest('[data-author-card], [data-contributor-card]');
  const toggle = card?.querySelector('[data-author-toggle-edit], [data-contributor-toggle-edit]');
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  input?.focus();
}

export function resolvePendingAffiliations(root) {
  const element = editors(root).find(item => item.affiliationEditor?.getPendingInput().trim());
  if (!element) return true;
  element.affiliationEditor.showPendingWarning();
  reveal(element, element.querySelector('[data-affiliation-input]'));
  return false;
}

export function validateAffiliationEditors(root, { focus = true } = {}) {
  let firstInvalid;
  for (const element of editors(root)) {
    if (!element.affiliationEditor?.validate() && !firstInvalid) firstInvalid = element;
  }
  if (firstInvalid && focus) reveal(firstInvalid, firstInvalid.querySelector('[data-affiliation-label].is-invalid'));
  return !firstInvalid;
}
