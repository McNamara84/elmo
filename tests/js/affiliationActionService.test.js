const { resolvePendingAffiliations, validateAffiliationEditors } = require('../../js/services/affiliationActionService');
const { mountAuthorStack, mountContributorStack } = require('./utils/peopleStacks');

describe('affiliation action decisions', () => {
  beforeEach(() => { document.body.innerHTML = '<form></form>'; window.ELMO_FEATURES = {}; });
  afterEach(() => { delete window.ELMO_FEATURES; });
  function mount() {
    mountAuthorStack([{ type: 'person', familyname: 'Author' }]);
    mountContributorStack([{ type: 'person', familyname: 'Contributor' }]);
    return Array.from(document.querySelectorAll('[data-affiliation-editor]'));
  }
  test('requires decisions in document order and discard preserves confirmed metadata', () => {
    const [author, contributor] = mount();
    author.affiliationEditor.setAffiliations([{ label: 'GFZ', rorId: '04z8jg394' }]);
    author.affiliationEditor.setPendingInput('Pending author');
    contributor.affiliationEditor.setPendingInput('Pending contributor');
    expect(resolvePendingAffiliations(document)).toBe(false);
    expect(author.querySelector('[data-affiliation-pending-warning]').classList.contains('d-none')).toBe(false);
    expect(document.activeElement).toBe(author.querySelector('[data-affiliation-input]'));
    author.querySelector('[data-affiliation-discard]').click();
    expect(author.affiliationEditor.getAffiliations()).toEqual([{ label: 'GFZ', rorId: '04z8jg394' }]);
    expect(resolvePendingAffiliations(document)).toBe(false);
    expect(document.activeElement).toBe(contributor.querySelector('[data-affiliation-input]'));
    contributor.querySelector('[data-affiliation-add]').click();
    expect(resolvePendingAffiliations(document)).toBe(true);
  });
  test.each(['author', 'contributor'])('%s collapse is blocked until pending text is resolved', group => {
    const elements = mount();
    const editor = elements[group === 'author' ? 0 : 1].affiliationEditor;
    const card = editor.element[0].closest(`[data-${group}-card]`);
    const toggle = card.querySelector(`[data-${group}-toggle-edit]`);
    editor.setPendingInput('Pending');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    editor.element.find('[data-affiliation-discard]').trigger('click');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
  test('validation reveals invalid contributor labels in collapsed cards', () => {
    const [, element] = mount();
    element.affiliationEditor.setAffiliations([{ label: '', rorId: '04z8jg394' }]);
    const toggle = element.closest('[data-contributor-card]').querySelector('[data-contributor-toggle-edit]');
    toggle.click();
    expect(validateAffiliationEditors(document)).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(element.querySelector('[data-affiliation-label]'));
  });
  test('whitespace and disabled contributor feature need no decision', () => {
    mountAuthorStack([{ type: 'institution', institutionname: 'Lab' }]);
    document.querySelector('[data-affiliation-editor]').affiliationEditor.setPendingInput('  ');
    expect(resolvePendingAffiliations(document)).toBe(true);
    expect(validateAffiliationEditors(document)).toBe(true);
  });
});
