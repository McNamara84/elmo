const AutosaveService = require('../../js/services/autosaveService');
const { mountAuthorStack, mountContributorStack } = require('./utils/peopleStacks');
const { migratePeopleDraft } = require('../../js/services/authorContributorDraftMigration');

describe('unfinished affiliation drafts', () => {
  beforeEach(() => { document.body.innerHTML = '<form id="form-mde"></form>'; window.ELMO_FEATURES = {}; });
  afterEach(() => { delete window.ELMO_FEATURES; });
  test.each(['author', 'contributor'])('%s drafts preserve an empty edited label without losing neighboring affiliations', group => {
    const stack = group === 'author' ? mountAuthorStack([{type: 'person', familyname: 'Doe', affiliations: [{label: 'First'}, {label: 'Second'}]}])
      : mountContributorStack([{type: 'person', familyname: 'Doe', affiliations: [{label: 'First'}, {label: 'Second'}]}]);
    const editor = document.querySelector('[data-affiliation-editor]').affiliationEditor;
    editor.element.find('[data-affiliation-label]').first().val('').trigger('input');
    editor.element.find('[data-affiliation-remove]').last().trigger('click');
    expect(editor.getAffiliations()).toEqual([{label: '', rorId: ''}]);
    expect(editor.validate()).toBe(false);
    const entries = stack.collectDraftEntries();
    if (group === 'author') stack.setAuthors(entries, {restoreUiState: true});
    else stack.setContributors(entries, {restoreUiState: true});
    const restored = document.querySelector('[data-affiliation-editor]').affiliationEditor;
    expect(restored.getAffiliations()).toEqual([{label: '', rorId: ''}]);
    expect(restored.validate()).toBe(false);
  });
  test('autosave preserves pending-only cards and card order without exporting UI metadata', () => {
    const authors = mountAuthorStack([{type: 'person', familyname: 'Doe', affiliations: [{label: 'GFZ', rorId: '04z8jg394'}]}]);
    const contributors = mountContributorStack([]);
    authors.addInstitution(); contributors.addPerson();
    const editors = Array.from(document.querySelectorAll('[data-affiliation-editor]'));
    editors[0].affiliationEditor.setPendingInput('Author pending');
    editors[1].affiliationEditor.setPendingInput('Pending-only institution');
    editors[2].affiliationEditor.setPendingInput('Pending-only contributor');
    const service = new AutosaveService('form-mde', { fetch: jest.fn() });
    const values = service.serializeValues();
    expect(JSON.parse(values.authorsPayload).map(entry => entry._ui.affiliationInput)).toEqual(['Author pending','Pending-only institution']);
    expect(JSON.parse(values.contributorsPayload)[0]._ui.affiliationInput).toBe('Pending-only contributor');
    expect(authors.collectPayload()).toHaveLength(1);
    expect(contributors.collectPayload()).toEqual([]);
    expect(document.querySelector('[name="authorsPayload"]').value).not.toContain('_ui');
    service.applyDraftValues(values);
    expect(Array.from(document.querySelectorAll('[data-affiliation-editor]'), element => element.affiliationEditor.getPendingInput())).toEqual(['Author pending','Pending-only institution','Pending-only contributor']);
    expect(authors.collectPayload()[0].affiliations).toEqual([{label: 'GFZ', rorId: '04z8jg394'}]);
    document.querySelector('[data-affiliation-discard]').click();
    expect(JSON.parse(service.serializeValues().authorsPayload)[0]._ui).toBeUndefined();
  });
  test('normal imports ignore draft UI and restored text follows a reordered card', () => {
    const stack = mountContributorStack([{type: 'institution', institutionname: 'First'},{type: 'person', familyname: 'Second'}]);
    const card = document.querySelector('[data-contributor-card]');
    card.querySelector('[data-affiliation-editor]').affiliationEditor.setPendingInput('First pending');
    card.querySelector('[data-contributor-move-down]').click();
    const entries = stack.collectDraftEntries();
    expect(entries[1]._ui.affiliationInput).toBe('First pending');
    stack.setContributors(entries);
    expect(document.querySelectorAll('[data-affiliation-editor]')[1].affiliationEditor.getPendingInput()).toBe('');
    stack.setContributors(entries, {restoreUiState: true});
    expect(document.querySelectorAll('[data-affiliation-editor]')[1].affiliationEditor.getPendingInput()).toBe('First pending');
  });
  test.each([[], 'invalid', {affiliationInput: 42}])('rejects malformed UI draft data: %j', ui => {
    expect(() => migratePeopleDraft({authorsPayload: [{type: 'person', _ui: ui}]})).toThrow();
  });
  test('ORCID prefill updates both shared editors and their summaries', () => {
    mountAuthorStack([{type: 'person'}]); mountContributorStack([{type: 'person'}]);
    const {fillRowFromOrcidRecord, AUTHOR_FIELD_MAPPING, CONTRIBUTOR_FIELD_MAPPING} = require('../../js/autocomplete');
    const record = {person: {name: {'family-name': {value: 'Doe'}, 'given-names': {value: 'Jane'}}},
      'activities-summary': {employments: {'affiliation-group': [{summaries: [{'employment-summary': {organization: {name: 'GFZ', 'disambiguated-organization': {'disambiguation-source': 'ROR', 'disambiguated-organization-identifier': 'https://ror.org/04z8jg394'}}}}]}]}}};
    fillRowFromOrcidRecord($('[data-author-card]'), record, AUTHOR_FIELD_MAPPING);
    fillRowFromOrcidRecord($('[data-contributor-card]'), record, CONTRIBUTOR_FIELD_MAPPING);
    for (const element of document.querySelectorAll('[data-affiliation-editor]')) {
      expect(element.affiliationEditor.getAffiliations()).toEqual([{label: 'GFZ', rorId: '04z8jg394'}]);
    }
    expect(document.querySelector('[data-contributor-summary-affiliations]').textContent).toBe('GFZ 04z8jg394');
  });
});
