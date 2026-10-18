const AutosaveService = require('../../js/services/autosaveService');
const { mountAuthorStack, mountContributorStack } = require('./utils/peopleStacks');
const { migratePeopleDraft } = require('../../js/services/authorContributorDraftMigration');

describe('unfinished affiliation drafts', () => {
  beforeEach(() => { document.body.innerHTML = '<form id="form-mde"></form>'; window.ELMO_FEATURES = {}; });
  afterEach(() => { delete window.ELMO_FEATURES; });
  test.each([
    ['author', 'person'], ['author', 'institution'],
    ['contributor', 'person'], ['contributor', 'institution']
  ])('%s %s switches type with affiliation data and preserves the draft and card order', (group, type) => {
    const entries = [
      {type: 'person', familyname: 'Before'}, {type},
      {type: 'institution', institutionname: 'After'}
    ];
    const stack = group === 'author' ? mountAuthorStack(entries) : mountContributorStack(entries);
    const cards = () => Array.from(document.querySelectorAll(`[data-${group}-card]`));
    const editor = card => card.querySelector('[data-affiliation-editor]').affiliationEditor;
    const affiliations = [
      {label: 'GFZ, Department', rorId: '04z8jg394'}, {label: 'Working group', rorId: ''},
      {label: '', rorId: '012m9bp23'}, {label: '', rorId: ''}
    ];
    const original = editor(cards()[1]);
    original.setAffiliations(affiliations);
    original.setPendingInput('  Unconfirmed lab  ');
    const destroy = jest.spyOn(original, 'destroy');
    const opposite = type === 'person' ? 'institution' : 'person';
    for (const target of [opposite, type]) {
      const button = cards()[1].querySelector(`[data-${group}-type-option="${target}"]`);
      expect(button.disabled).toBe(false);
      button.click();
      expect(cards()).toHaveLength(3);
      expect(stack.collectDraftEntries().map(entry => entry.type)).toEqual(['person', target, 'institution']);
      expect(editor(cards()[1]).getAffiliations()).toEqual(affiliations);
      expect(editor(cards()[1]).getPendingInput()).toBe('  Unconfirmed lab  ');
      expect(stack.collectDraftEntries()[1]).toMatchObject({affiliations, _ui: {affiliationInput: '  Unconfirmed lab  '}});
      expect(stack.collectPayload()[1]).not.toHaveProperty('_ui');
    }
    expect(destroy).toHaveBeenCalledTimes(1);
  });
  test.each(['author', 'contributor'])('%s can switch with only pending affiliation input without confirming it', group => {
    const stack = group === 'author' ? mountAuthorStack([{type: 'person'}]) : mountContributorStack([{type: 'person'}]);
    document.querySelector('[data-affiliation-editor]').affiliationEditor.setPendingInput('Pending lab');
    const button = document.querySelector(`[data-${group}-type-option="institution"]`);
    expect(button.disabled).toBe(false);
    button.click();
    expect(stack.collectPayload()).toEqual([]);
    expect(stack.collectDraftEntries()[0]).toMatchObject({type: 'institution', _ui: {affiliationInput: 'Pending lab'}});
  });
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
  test.each(['author', 'contributor'])('ORCID prefill keeps %s label/ROR pairs when names or IDs repeat', group => {
    if (group === 'author') mountAuthorStack([{type: 'person'}]);
    else mountContributorStack([{type: 'person'}]);
    const {fillRowFromOrcidRecord, AUTHOR_FIELD_MAPPING, CONTRIBUTOR_FIELD_MAPPING} = require('../../js/autocomplete');
    const employment = (name, id) => ({summaries: [{'employment-summary': {organization: {
      name, 'disambiguated-organization': {'disambiguation-source': 'ROR', 'disambiguated-organization-identifier': id}
    }}}]});
    const record = {person: {name: {'family-name': {value: 'Doe'}}}, 'activities-summary': {employments: {'affiliation-group': [
      employment('Department A', '04z8jg394'), employment('Department B', '04z8jg394'),
      employment('Department A', '012m9bp23'), employment('Department A', '04z8jg394')
    ]}}};
    fillRowFromOrcidRecord($(`[data-${group}-card]`), record, group === 'author' ? AUTHOR_FIELD_MAPPING : CONTRIBUTOR_FIELD_MAPPING);
    const expected = [
      {label: 'Department A', rorId: '04z8jg394'}, {label: 'Department B', rorId: '04z8jg394'},
      {label: 'Department A', rorId: '012m9bp23'}
    ];
    const editor = document.querySelector('[data-affiliation-editor]').affiliationEditor;
    expect(editor.getAffiliations()).toEqual(expected);
    const stack = window[`${group}Stack`];
    expect(stack.collectPayload()[0].affiliations).toEqual(expected);
    expect(editor.element.find('[data-affiliation-chip]')).toHaveLength(3);
  });
});
