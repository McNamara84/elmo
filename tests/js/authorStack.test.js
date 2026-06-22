const fs = require('fs');
const path = require('path');

describe('authorStack.js', () => {
  let $;

  function loadAuthorStackScript() {
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/formgroups/authorStack.js'),
      'utf8'
    );
    script = script.replace(/^import.*$/gm, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <span data-author-summary-count>0 authors</span>
      <span data-author-contact-summary>at least 1 contact required</span>
      <input type="hidden" id="authors-payload" name="authorsPayload" value="[]">
      <div id="group-author" data-author-stack-shell>
        <div id="group-author-stack" data-author-stack>
          <div class="row" data-author-entry-row data-author-entry-type="person" data-author-entry-key="author-person-0" data-creator-row>
            <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]">
            <label for="checkbox-author-contactperson">Contact Person</label>
            <input id="input-author-orcid" name="orcids[]">
            <label for="input-author-orcid">ORCID</label>
            <input id="input-author-lastname" name="familynames[]">
            <label for="input-author-lastname">Last Name</label>
            <input id="input-author-firstname" name="givennames[]">
            <label for="input-author-firstname">First Name</label>
            <input id="input-author-affiliation" name="personAffiliation[]">
            <input id="input-author-rorid" name="authorPersonRorIds[]">
            <button type="button" class="drag-handle"></button>
            <button type="button" id="button-author-add" class="addAuthor" data-author-add-type="person">+</button>
            <div class="contact-person-input">
              <input id="input-contactperson-email" name="cpEmail[]">
              <label for="input-contactperson-email">Email</label>
            </div>
            <div class="contact-person-input">
              <input id="input-contactperson-website" name="cpOnlineResource[]">
              <label for="input-contactperson-website">Website</label>
            </div>
          </div>
          <div class="row" data-author-entry-row data-author-entry-type="institution" data-author-entry-key="author-institution-0" data-authorinstitution-row>
            <input id="input-authorinstitution-name" name="authorinstitutionName[]">
            <label for="input-authorinstitution-name">Institution</label>
            <input id="input-authorinstitution-affiliation" name="institutionAffiliation[]">
            <label for="input-authorinstitution-affiliation">Affiliation</label>
            <input id="input-author-institutionrorid" name="authorInstitutionRorIds[]">
            <button type="button" class="drag-handle"></button>
            <button type="button" id="button-authorinstitution-add" class="addauthorinstitution" data-author-add-type="institution">+</button>
          </div>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    $.fn.sortable = jest.fn(function () {
      return this;
    });

    window.createRemoveButton = jest.fn(() => $('<button type="button" class="removeButton"></button>'));
    window.replaceHelpButtonInClonedRows = jest.fn();
    window.translateClonedRow = jest.fn();
    window.autocompleteAffiliations = jest.fn();
    window.affiliationsData = [{ id: '04z8jg394', name: 'GFZ' }];
    window.bootstrap = { Tooltip: jest.fn() };

    loadAuthorStackScript();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.elmo;
  });

  function payload() {
    return JSON.parse(document.querySelector('input[name="authorsPayload"]').value);
  }

  test('initializes the combined sortable stack and empty summary', () => {
    expect($.fn.sortable).toHaveBeenCalledWith(expect.objectContaining({
      items: '> [data-author-entry-row]',
      handle: '.drag-handle',
      cancel: 'input, textarea, select, option'
    }));
    expect(payload()).toEqual([]);
    expect($('[data-author-summary-count]').text()).toBe('0 entries');
    expect($('[data-author-card]').length).toBe(0);
    expect($('[data-author-add-actions] #button-author-add').length).toBe(1);
    expect($('[data-author-add-actions] #button-authorinstitution-add').length).toBe(1);
    expect($('#button-author-add').hasClass('add-button')).toBe(false);
  });

  test('builds authorsPayload in mixed person-institution-person DOM order', () => {
    $('#button-author-add').trigger('click');
    const firstPerson = $('[data-creator-row]').first();
    firstPerson.find('input[name="familynames[]"]').val('First').trigger('input');
    firstPerson.find('input[name="givennames[]"]').val('Person').trigger('input');
    firstPerson.find('input[name="contacts[]"]').prop('checked', true).trigger('change');
    firstPerson.find('input[name="cpEmail[]"]').val('first@example.com').trigger('input');
    firstPerson.find('input[name="personAffiliation[]"]').val('[{"value":"GFZ"}]').trigger('input');
    firstPerson.find('input[name="authorPersonRorIds[]"]').val('https://ror.org/04z8jg394').trigger('input');

    $('#button-authorinstitution-add').trigger('click');
    $('[data-authorinstitution-row]').first().find('input[name="authorinstitutionName[]"]').val('Payload Institute').trigger('input');

    $('#button-author-add').trigger('click');
    const secondPerson = $('[data-creator-row]').last();
    secondPerson.find('input[name="familynames[]"]').val('Last').trigger('input');
    secondPerson.find('input[name="givennames[]"]').val('Person').trigger('input');

    expect(payload().map((author) => `${author.type}:${author.type === 'person' ? author.familyname : author.institutionname}`)).toEqual([
      'person:First',
      'institution:Payload Institute',
      'person:Last'
    ]);
    expect(payload()[0].isContact).toBe(true);
    expect(payload()[0].affiliations).toEqual([{ label: 'GFZ', rorId: '04z8jg394' }]);
    expect($('[data-author-summary-count]').text()).toBe('3 entries');
    expect($('[data-author-contact-summary]').text()).toBe('1 contact person');
    expect($('[data-author-contact-toggle]').first().text()).toContain('Contact person');
  });

  test('serializes person author with empty given name', () => {
    $('#button-author-add').trigger('click');
    const person = $('[data-creator-row]').first();
    person.find('input[name="familynames[]"]').val('Sukarno').trigger('input');
    person.find('input[name="givennames[]"]').val('').trigger('input');
    person.find('input[name="contacts[]"]').prop('checked', true).trigger('change');
    person.find('input[name="cpEmail[]"]').val('sukarno@example.org').trigger('input');

    expect(payload()).toEqual([
      expect.objectContaining({
        type: 'person',
        familyname: 'Sukarno',
        givenname: '',
        isContact: true,
        email: 'sukarno@example.org',
      })
    ]);
    expect($('[data-author-summary-name]').first().text()).toBe('Sukarno');
  });

  test('updates summary badges when translations are loaded', () => {
    window.elmo = {
      translate: jest.fn((key) => ({
        'authors.authorSingular': 'Eintrag',
        'authors.authorPlural': 'Einträge',
        'authors.entrySingular': 'Eintrag',
        'authors.entryPlural': 'Einträge',
        'authors.typeSwitcherLabel': 'Autorentyp',
        'authors.typeSwitchLocked': 'Der Typ kann nur geändert werden, solange dieser Eintrag leer ist.',
        'authors.editEntry': 'Autoreneintrag bearbeiten',
        'authors.collapseEntry': 'Autoreneintrag einklappen',
        'authors.removeEntry': 'Autoreneintrag entfernen',
        'authors.moveEntryUp': 'Autoreneintrag nach oben verschieben',
        'authors.moveEntryDown': 'Autoreneintrag nach unten verschieben',
        'authors.contactSingular': 'Kontakt',
        'authors.contactPlural': 'Kontakte',
        'authors.contactPersonSingular': 'Kontaktperson',
        'authors.contactPersonPlural': 'Kontaktpersonen',
        'authors.contactPersonBadge': 'Kontaktperson',
        'authors.contactPersonLabel': 'Kontaktperson',
        'authors.markAsContact': 'Als Kontakt markieren',
        'authors.contactRequired': 'mindestens 1 Kontakt erforderlich',
        'authors.entriesSummary': '{count} {label}',
        'authors.contactsSummary': '{count} {label}',
        'authors.affiliations': 'Affiliations',
        'authors.affiliationAdd': 'Affiliation hinzufügen',
        'authors.affiliationEdit': 'Affiliation bearbeiten',
        'authors.affiliationSearch': 'Affiliation in ROR suchen',
        'authors.affiliationMoveUp': 'Affiliation nach oben verschieben',
        'authors.affiliationMoveDown': 'Affiliation nach unten verschieben',
        'authors.affiliationRorId': 'ROR-ID',
        'authors.affiliationRemove': 'Affiliation entfernen',
        'general.affiliation': 'Affiliation',
        'general.orcid': 'ORCID'
      })[key])
    };

    $('#button-author-add').trigger('click');
    document.dispatchEvent(new CustomEvent('translationsLoaded', { detail: { translations: {} } }));
    expect($('[data-author-summary-count]').text()).toBe('0 Einträge');
    expect($('[data-author-contact-summary]').text()).toBe('mindestens 1 Kontakt erforderlich');
    expect($('[data-author-contact-toggle]').first().text()).toContain('Als Kontakt markieren');
    expect($('[data-author-toggle-edit]').first().attr('aria-label')).toBe('Autoreneintrag einklappen');
    expect($('[data-author-remove]').first().attr('aria-label')).toBe('Autoreneintrag entfernen');
    expect($('[data-author-move-down]').first().attr('aria-label')).toBe('Autoreneintrag nach unten verschieben');
    expect($('[data-author-type-switcher] [role="group"]').first().attr('aria-label')).toBe('Autorentyp');
    expect($('[data-author-affiliation-search]').first().attr('aria-label')).toBe('Affiliation in ROR suchen');
    expect($('[data-author-affiliation-add-label]').first().text()).toBe('Affiliation hinzufügen');

    const person = $('[data-creator-row]').first();
    person.find('input[name="familynames[]"]').val('Doe').trigger('input');
    person.find('input[name="givennames[]"]').val('Jane').trigger('input');
    person.find('input[name="contacts[]"]').prop('checked', true).trigger('change');

    expect($('[data-author-summary-count]').text()).toBe('1 Eintrag');
    expect($('[data-author-contact-summary]').text()).toBe('1 Kontaktperson');
    expect($('[data-author-contact-toggle]').first().text()).toContain('Kontaktperson');
  });

  test('adds removable institution rows for autosave array restoration', () => {
    document.dispatchEvent(new CustomEvent('autosave:ensure-array-field', {
      detail: { name: 'authorinstitutionName[]', requiredCount: 2 }
    }));

    expect($('[data-authorinstitution-row]').length).toBe(2);
    expect($('[data-authorinstitution-row]').last().find('.removeButton').length).toBe(1);
    expect($('[data-authorinstitution-row]').last().find('[data-author-affiliation-editor]').length).toBe(1);
    expect(window.autocompleteAffiliations).not.toHaveBeenCalled();

    $('[data-authorinstitution-row]').last().find('.removeButton').trigger('click');
    expect($('[data-authorinstitution-row]').length).toBe(1);
  });

  test('setAuthors rebuilds the mixed stack from a structured payload', () => {
    window.authorStack.setAuthors([
      {
        type: 'institution',
        institutionname: 'Payload Institute',
        affiliations: [{ label: 'Helmholtz', rorId: '03qjp1d79' }]
      },
      {
        type: 'person',
        familyname: 'Doe',
        givenname: 'Jane',
        orcid: 'https://orcid.org/0000-0001-2345-6789',
        isContact: true,
        email: 'jane@example.org',
        website: 'https://example.org/jane',
        affiliations: [{ label: 'GFZ', rorId: 'https://ror.org/04z8jg394' }]
      }
    ]);

    const authors = payload();
    expect(authors.map((author) => author.type)).toEqual(['institution', 'person']);
    expect(authors[0].institutionname).toBe('Payload Institute');
    expect(authors[0].affiliations).toEqual([{ label: 'Helmholtz', rorId: '03qjp1d79' }]);
    expect(authors[1]).toEqual(expect.objectContaining({
      familyname: 'Doe',
      givenname: 'Jane',
      orcid: '0000-0001-2345-6789',
      isContact: true,
      email: 'jane@example.org',
      website: 'https://example.org/jane'
    }));
    expect(authors[1].affiliations).toEqual([{ label: 'GFZ', rorId: '04z8jg394' }]);
    expect($('[data-author-contact-summary]').text()).toBe('1 contact person');
    expect($('[data-author-add-type="person"]').length).toBe(1);
    expect($('[data-author-add-type="institution"]').length).toBe(1);
  });

  test('renders the final card structure with summary, edit panel, and person-only contact affordances', () => {
    window.authorStack.setAuthors([
      {
        type: 'person',
        familyname: 'Doe',
        givenname: 'Jane',
        orcid: '0000-0001-2345-6789',
        isContact: true,
        affiliations: [{ label: 'GFZ Helmholtz Centre for Geosciences', rorId: '04z8jg394' }]
      },
      {
        type: 'institution',
        institutionname: 'European Plate Observatory',
        affiliations: [{ label: 'Universität Potsdam', rorId: '03bnmw459' }]
      }
    ]);

    const cards = $('[data-author-card]');
    expect(cards.length).toBe(2);

    const personCard = cards.eq(0);
    expect(personCard.find('[data-author-summary]').text()).toContain('Jane Doe');
    expect(personCard.find('[data-author-type-badge]').text()).toMatch(/person/i);
    expect(personCard.find('[data-author-contact-badge]').text()).toMatch(/contact person/i);
    expect(personCard.find('[data-author-contact-toggle]').text()).toMatch(/contact person/i);
    expect(personCard.find('[data-author-actions] [data-author-toggle-edit]').length).toBe(1);
    expect(personCard.attr('role')).toBe('group');
    expect(personCard.attr('aria-labelledby')).toContain(personCard.find('[data-author-summary-name]').attr('id'));
    expect(personCard.attr('aria-labelledby')).toContain(personCard.find('[data-author-type-badge]').attr('id'));
    expect(personCard.find('[data-author-toggle-edit]').attr('aria-controls')).toBe(personCard.find('[data-author-edit-panel]').attr('id'));
    expect(personCard.find('[data-author-toggle-edit]').attr('aria-expanded')).toBe('true');
    expect(personCard.find('[data-author-actions] [data-author-move-up]').length).toBe(1);
    expect(personCard.find('[data-author-actions] [data-author-move-down]').length).toBe(1);
    expect(personCard.find('[data-author-actions] [data-author-remove]').length).toBe(1);
    expect(personCard.find('[data-author-edit-panel].collapse').length).toBe(1);
    expect(personCard.find('[data-author-type-switcher]').length).toBe(1);
    expect(personCard.find('[data-author-type-option="person"]').hasClass('active')).toBe(true);
    expect(personCard.find('[data-author-type-option="institution"]').prop('disabled')).toBe(true);

    const institutionCard = cards.eq(1);
    expect(institutionCard.find('[data-author-summary]').text()).toContain('European Plate Observatory');
    expect(institutionCard.find('[data-author-type-badge]').text()).toMatch(/institution/i);
    expect(institutionCard.find('[data-author-contact-badge]').length).toBe(0);
    expect(institutionCard.find('[data-author-contact-toggle]').length).toBe(0);
    expect(institutionCard.find('[data-author-type-option="institution"]').hasClass('active')).toBe(true);
    expect(institutionCard.find('[data-author-type-option="person"]').prop('disabled')).toBe(true);
  });

  test('moves author cards with keyboard-friendly action buttons', () => {
    window.authorStack.setAuthors([
      { type: 'person', familyname: 'Doe', givenname: 'Jane', affiliations: [] },
      { type: 'institution', institutionname: 'European Plate Observatory', affiliations: [] }
    ]);

    const initialCards = $('[data-author-card]');
    expect(initialCards.eq(0).find('[data-author-move-up]').prop('disabled')).toBe(true);
    expect(initialCards.eq(1).find('[data-author-move-down]').prop('disabled')).toBe(true);

    initialCards.eq(1).find('[data-author-move-up]').trigger('click');

    const reorderedCards = $('[data-author-card]');
    expect(payload().map((author) => author.type)).toEqual(['institution', 'person']);
    expect(reorderedCards.eq(0).attr('data-author-entry-type')).toBe('institution');
    expect(reorderedCards.eq(0).find('[data-author-move-up]').prop('disabled')).toBe(true);
    expect(reorderedCards.eq(1).find('[data-author-move-down]').prop('disabled')).toBe(true);
    expect(document.activeElement).toBe(reorderedCards.eq(0).find('[data-author-move-down]').get(0));
  });

  test('switches empty cards between person and institution without discarding filled entries', () => {
    window.authorStack.setAuthors([
      { type: 'person', familyname: 'Doe', givenname: 'Jane', affiliations: [] },
      { type: 'institution', institutionname: 'European Plate Observatory', affiliations: [] }
    ]);

    const filledPerson = $('[data-author-card]').first();
    const filledPersonPayload = payload();
    expect(filledPerson.find('[data-author-type-option="institution"]').prop('disabled')).toBe(true);
    filledPerson.find('[data-author-type-option="institution"]').trigger('click');
    expect(payload()).toEqual(filledPersonPayload);
    expect(filledPerson.attr('data-author-entry-type')).toBe('person');

    window.authorStack.addPerson();
    const emptyPerson = $('[data-author-card]').last();
    expect(emptyPerson.attr('data-author-entry-type')).toBe('person');
    expect(emptyPerson.find('[data-author-type-option="institution"]').prop('disabled')).toBe(false);

    emptyPerson.find('[data-author-type-option="institution"]').trigger('click');
    const switchedCard = $('[data-author-card]').last();
    expect(switchedCard.attr('data-author-entry-type')).toBe('institution');
    expect(switchedCard.find('[data-author-type-option="institution"]').hasClass('active')).toBe(true);
    expect(document.activeElement).toBe(switchedCard.find('input[name="authorinstitutionName[]"]').get(0));
    expect(payload()).toEqual(filledPersonPayload);

    switchedCard.find('input[name="authorinstitutionName[]"]').val('New Institute').trigger('input');
    expect(payload().map((author) => author.type)).toEqual(['person', 'institution', 'institution']);
    expect(switchedCard.find('[data-author-type-option="person"]').prop('disabled')).toBe(true);
  });

  test('keeps multiple edit panels open and opens newly added cards by default', () => {
    window.authorStack.setAuthors([
      { type: 'person', familyname: 'Doe', givenname: 'Jane', affiliations: [] },
      { type: 'institution', institutionname: 'European Plate Observatory', affiliations: [] }
    ]);

    const cards = $('[data-author-card]');
    const initialPayload = payload();

    expect(cards.eq(0).find('[data-author-edit-panel]').hasClass('show')).toBe(true);
    cards.eq(0).find('[data-author-toggle-edit]').trigger('click');
    expect(cards.eq(0).find('[data-author-edit-panel]').hasClass('show')).toBe(false);
    expect(payload()).toEqual(initialPayload);

    cards.eq(0).find('[data-author-toggle-edit]').trigger('click');
    cards.eq(1).find('[data-author-toggle-edit]').trigger('click');
    expect(cards.eq(1).find('[data-author-edit-panel]').hasClass('show')).toBe(false);
    cards.eq(1).find('[data-author-toggle-edit]').trigger('click');

    expect(cards.eq(0).find('[data-author-edit-panel]').hasClass('show')).toBe(true);
    expect(cards.eq(1).find('[data-author-edit-panel]').hasClass('show')).toBe(true);

    window.authorStack.addPerson();
    const newCard = $('[data-author-card]').last();
    expect(newCard.attr('data-author-entry-type')).toBe('person');
    expect(newCard.find('[data-author-edit-panel]').hasClass('show')).toBe(true);
    expect(document.activeElement).toBe(newCard.find('input[name="familynames[]"]').get(0));
  });

  test('moves focus to the next card or add button after removing a card', () => {
    window.authorStack.setAuthors([
      { type: 'person', familyname: 'Doe', givenname: 'Jane', affiliations: [] },
      { type: 'institution', institutionname: 'European Plate Observatory', affiliations: [] }
    ]);

    $('[data-author-card]').first().find('[data-author-remove]').trigger('click');
    expect($('[data-author-card]').length).toBe(1);
    expect(document.activeElement).toBe($('[data-author-card]').first().find('[data-author-toggle-edit]').get(0));

    $('[data-author-card]').first().find('[data-author-remove]').trigger('click');
    expect($('[data-author-card]').length).toBe(0);
    expect(document.activeElement).toBe($('[data-author-add-type="person"]').get(0));
  });

  test('updates payload through the dedicated authors affiliation editor', () => {
    window.authorStack.setAuthors([
      {
        type: 'person',
        familyname: 'Doe',
        givenname: 'Jane',
        affiliations: [
          { label: 'GFZ Helmholtz Centre for Geosciences', rorId: '04z8jg394' },
          { label: 'Universität Potsdam', rorId: '03bnmw459' }
        ]
      }
    ]);

    const editor = $('[data-author-card]').first().find('[data-author-affiliation-editor]');
    expect(editor.length).toBe(1);
    expect(editor.parent().is('[data-author-fields]')).toBe(true);
    expect(editor.prevAll('[data-author-type-switcher]').length).toBe(0);
    expect(editor.find('[data-author-affiliation-chip]').length).toBe(2);
    expect(editor.find('[data-author-affiliation-chip]').first().find('[data-author-affiliation-ror]').text()).toBe('04z8jg394');
    expect(editor.find('[data-author-affiliation-chip]').first().find('[data-author-affiliation-ror]').attr('aria-label')).toContain('04z8jg394');

    editor.find('[data-author-affiliation-label]').first()
      .val('GFZ Helmholtz Centre for Geosciences, Potsdam, Germany')
      .trigger('input');
    expect(payload()[0].affiliations[0]).toEqual({
      label: 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
      rorId: ''
    });
    expect(editor.find('[data-author-affiliation-ror]').first().hasClass('d-none')).toBe(true);

    editor.find('[data-author-affiliation-input]').val('Visiting researcher, ETH Zürich (2025)').trigger('input');
    editor.find('[data-author-affiliation-add]').trigger('click');
    expect(payload()[0].affiliations[2]).toEqual({
      label: 'Visiting researcher, ETH Zürich (2025)',
      rorId: ''
    });

    editor.find('[data-author-affiliation-move-down]').first().trigger('click');
    expect(payload()[0].affiliations.map((affiliation) => affiliation.label)).toEqual([
      'Universität Potsdam',
      'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
      'Visiting researcher, ETH Zürich (2025)'
    ]);

    editor.find('[data-author-affiliation-remove]').last().trigger('click');
    expect(payload()[0].affiliations).toHaveLength(2);
  });

  test('searches affiliation suggestions while typing at least three characters', async () => {
    jest.useFakeTimers();
    window.searchAffiliationsFromServer = jest.fn().mockResolvedValue([
      { label: 'GFZ Helmholtz Centre for Geosciences', rorId: '04z8jg394' }
    ]);

    try {
      window.authorStack.addPerson();
      const editor = $('[data-author-card]').first().find('[data-author-affiliation-editor]');
      const input = editor.find('[data-author-affiliation-input]');

      input.val('gf').trigger('input');
      await jest.advanceTimersByTimeAsync(300);
      expect(window.searchAffiliationsFromServer).not.toHaveBeenCalled();
      expect(editor.find('[data-author-affiliation-results]').hasClass('d-none')).toBe(true);

      input.val('gfz').trigger('input');
      await jest.advanceTimersByTimeAsync(300);

      expect(window.searchAffiliationsFromServer).toHaveBeenCalledWith('gfz', 20);
      expect(editor.find('[data-author-affiliation-result]').length).toBe(1);
      expect(editor.find('[data-author-affiliation-result]').text()).toContain('GFZ Helmholtz Centre for Geosciences');
    } finally {
      delete window.searchAffiliationsFromServer;
      jest.useRealTimers();
    }
  });

  test('searches affiliations again after clearing a selected affiliation', async () => {
    jest.useFakeTimers();
    window.searchAffiliationsFromServer = jest.fn((query) => Promise.resolve([
      query === 'gfz'
        ? { label: 'GFZ Helmholtz Centre for Geosciences', rorId: '04z8jg394' }
        : { label: 'University of Potsdam', rorId: '03bnmw459' }
    ]));

    try {
      window.authorStack.addPerson();
      const editor = $('[data-author-card]').first().find('[data-author-affiliation-editor]');
      const input = editor.find('[data-author-affiliation-input]');

      input.val('gfz').trigger('input');
      await jest.advanceTimersByTimeAsync(300);
      editor.find('[data-author-affiliation-result]').first().trigger('click');
      expect(payload()[0].affiliations).toEqual([{ label: 'GFZ Helmholtz Centre for Geosciences', rorId: '04z8jg394' }]);

      editor.find('[data-author-affiliation-remove]').first().trigger('click');
      expect(payload()).toEqual([]);

      input.val('pot').trigger('input');
      await jest.advanceTimersByTimeAsync(300);

      expect(window.searchAffiliationsFromServer).toHaveBeenLastCalledWith('pot', 20);
      expect(editor.find('[data-author-affiliation-result]').text()).toContain('University of Potsdam');
    } finally {
      delete window.searchAffiliationsFromServer;
      jest.useRealTimers();
    }
  });
});
