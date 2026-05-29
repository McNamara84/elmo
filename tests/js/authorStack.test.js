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
    expect($('.contact-person-input').first().css('display')).toBe('none');
    expect($('[data-author-contact-toggle]').first().text()).toContain('Mark as contact');
  });

  test('builds authorsPayload in mixed person-institution-person DOM order', () => {
    $('#input-author-lastname').val('First').trigger('input');
    $('#input-author-firstname').val('Person').trigger('input');
    $('#checkbox-author-contactperson').prop('checked', true).trigger('change');
    $('#input-contactperson-email').val('first@example.com').trigger('input');
    $('#input-author-affiliation').val('[{"value":"GFZ"}]').trigger('input');
    $('#input-author-rorid').val('https://ror.org/04z8jg394').trigger('input');

    $('#input-authorinstitution-name').val('Payload Institute').trigger('input');

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

  test('updates summary badges when translations are loaded', () => {
    window.elmo = {
      translate: jest.fn((key) => ({
        'authors.authorSingular': 'Eintrag',
        'authors.authorPlural': 'Einträge',
        'authors.entrySingular': 'Eintrag',
        'authors.entryPlural': 'Einträge',
        'authors.contactSingular': 'Kontakt',
        'authors.contactPlural': 'Kontakte',
        'authors.contactPersonSingular': 'Kontaktperson',
        'authors.contactPersonPlural': 'Kontaktpersonen',
        'authors.contactPersonBadge': 'Kontaktperson',
        'authors.contactPersonLabel': 'Kontaktperson',
        'authors.markAsContact': 'Als Kontakt markieren',
        'authors.contactRequired': 'mindestens 1 Kontakt erforderlich',
        'authors.entriesSummary': '{count} {label}',
        'authors.contactsSummary': '{count} {label}'
      })[key])
    };

    document.dispatchEvent(new CustomEvent('translationsLoaded', { detail: { translations: {} } }));
    expect($('[data-author-summary-count]').text()).toBe('0 Einträge');
    expect($('[data-author-contact-summary]').text()).toBe('mindestens 1 Kontakt erforderlich');

    $('#input-author-lastname').val('Doe').trigger('input');
    $('#input-author-firstname').val('Jane').trigger('input');
    $('#checkbox-author-contactperson').prop('checked', true).trigger('change');

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
    expect(editor.find('[data-author-affiliation-chip]').length).toBe(2);
    expect(editor.find('[data-author-affiliation-chip]').first().find('[data-author-affiliation-ror]').text()).toBe('04z8jg394');

    editor.find('[data-author-affiliation-label]').first()
      .val('GFZ Helmholtz Centre for Geosciences, Potsdam, Germany')
      .trigger('input');
    expect(payload()[0].affiliations[0]).toEqual({
      label: 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
      rorId: '04z8jg394'
    });

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
});