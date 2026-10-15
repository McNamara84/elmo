/** Require explicit decisions for unfinished affiliation inputs before a form action. */
function editors(root) {
  return Array.from(root.querySelectorAll('[data-affiliation-editor]'));
}

function reveal(element, input, { focus = true } = {}) {
  const card = element.closest('[data-author-card], [data-contributor-card]');
  const toggle = card?.querySelector('[data-author-toggle-edit], [data-contributor-toggle-edit]');
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  if (focus) input?.focus();
}

/**
 * Block a form action at the first unconfirmed input in DOM order, reveal it and focus it.
 * This check never confirms or discards input; the caller repeats its action after a decision.
 * @param {Document|Element} root Form or card whose editors are checked.
 * @returns {boolean} True when the action may proceed without an input decision.
 */
export function resolvePendingAffiliations(root) {
  const element = editors(root).find(item => item.affiliationEditor?.getPendingInput().trim());
  if (!element) return true;
  element.affiliationEditor.showPendingWarning();
  reveal(element, element.querySelector('[data-affiliation-input]'));
  return false;
}

/**
 * Validate confirmed labels and reveal the first invalid editor, including collapsed cards.
 * @param {Document|Element} root Form or card whose editors are checked.
 * @param {Object} [options={}] Validation settings.
 * @param {boolean} [options.focus=true] Also move keyboard focus to the first invalid label.
 * @returns {boolean} True when all confirmed affiliation labels are valid.
 */
export function validateAffiliationEditors(root, { focus = true } = {}) {
  let firstInvalid;
  for (const element of editors(root)) {
    if (!element.affiliationEditor?.validate() && !firstInvalid) firstInvalid = element;
  }
  if (firstInvalid) reveal(firstInvalid, firstInvalid.querySelector('[data-affiliation-label].is-invalid'), { focus });
  return !firstInvalid;
}
