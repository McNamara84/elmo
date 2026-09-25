const fs = require('fs');
const path = require('path');

describe('combined contributor stack', () => {
  let controller;

  beforeEach(() => {
    document.body.innerHTML = `
      <div data-contributor-formgroup>
        <span data-contributor-summary-count></span>
        <div data-contributor-shell id="group-contributorperson">
          <input name="contributorsPayload" value="[]">
          <div data-contributor-stack></div>
          <div data-contributor-add-actions>
            <button id="button-contributor-addperson" data-contributor-add-type="person">Add Person</button>
            <button id="button-contributor-addorganisation" data-contributor-add-type="institution">Add Institution</button>
          </div>
        </div>
        <template id="contributor-person-template">
          <div class="row" contributor-person-row>
            <input id="input-contributor-lastname" name="cbPersonLastname[]"><label for="input-contributor-lastname">Last</label>
            <input id="input-contributor-firstname" name="cbPersonFirstname[]">
            <div class="col-12"><div class="input-group"><input id="input-contributor-orcid" name="cbORCID[]"><span class="input-group-text"><i data-help-section-id="help-contributorpersons-orcid"></i></span></div></div>
            <div class="col-12"><div class="input-group"><input id="input-contributor-personrole" name="cbPersonRoles[]"><span class="input-group-text"><i data-help-section-id="help-contributorpersons-role"></i></span></div></div>
            <div class="col-12"><div class="input-group"><input id="input-contributorpersons-affiliation" name="cbAffiliation[]"><span class="input-group-text"><i data-help-section-id="help-contributorinstitutions-affiliation"></i></span><input id="input-contributor-personrorid" name="cbpRorIds[]" type="hidden"></div></div>
            <div class="col-2"><button class="addContributorPerson">+</button></div>
          </div>
        </template>
        <template id="contributor-institution-template">
          <div class="row" contributors-row>
            <div class="col-12"><div class="input-group"><input id="input-contributor-name" name="cbOrganisationName[]"><span class="input-group-text"><i data-help-section-id="help-contributorinstitutions-organisationname"></i></span></div></div>
            <div class="col-12"><div class="input-group"><input id="input-contributor-organisationrole" name="cbOrganisationRoles[]"><span class="input-group-text"><i data-help-section-id="help-contributorinstitutions-organisationrole"></i></span></div></div>
            <div class="col-12"><div class="input-group"><input id="input-contributor-organisationaffiliation" name="OrganisationAffiliation[]"><span class="input-group-text"><i data-help-section-id="help-contributorinstitutions-affiliation"></i></span><input id="input-contributor-organisationrorid" name="hiddenOrganisationRorId[]" type="hidden"></div></div>
            <div class="col-2"><button class="addContributor">+</button></div>
          </div>
        </template>
      </div>`;
    const $ = require('jquery');
    global.$ = global.jQuery = window.$ = window.jQuery = $;
    localStorage.setItem('helpStatus', 'help-on');
    window.ELMO_FEATURES = { showContactInstitution: false };
    window.setupRolesDropdown = jest.fn();
    window.autocompleteAffiliations = jest.fn();
    window.applyTranslations = jest.fn();
    let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/formgroups/contributorStack.js'), 'utf8');
    script = script.replace('$(document).ready(function () {', '(function () {').replace(/\n\}\);\s*$/, '\n})();');
    window.eval(script);
    controller = window.contributorStack;
  });

  afterEach(() => {
    delete window.contributorStack;
    delete window.ELMO_FEATURES;
    delete window.setupRolesDropdown;
    delete window.autocompleteAffiliations;
    delete window.applyTranslations;
  });

  const cards = () => document.querySelectorAll('[data-contributor-card]');
  const payload = () => JSON.parse(document.querySelector('[name="contributorsPayload"]').value);
  const change = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const helpIcon = (card, name) => card.querySelector(`[name="${name}"]`).closest('.input-group').querySelector('i[data-help-section-id]');
  const helpVisible = (card, name) => !helpIcon(card, name).classList.contains('d-none');

  test('starts empty and creates the first person only after Add Person', () => {
    expect(cards()).toHaveLength(0);
    expect(payload()).toEqual([]);
    document.querySelector('#button-contributor-addperson').click();
    expect(cards()).toHaveLength(1);
    expect(cards()[0].querySelector('[contributor-person-row]')).not.toBeNull();
    expect(cards()[0].querySelector('.addContributorPerson')).toBeNull();
    expect(window.setupRolesDropdown).toHaveBeenCalledWith(['person', 'both'], '#input-contributor-personrole-0');
    change(cards()[0].querySelector('[name="cbPersonLastname[]"]'), 'Doe');
    expect(payload()[0]).toMatchObject({ type: 'person', familyname: 'Doe', order: 0 });
  });

  test('uses accessible high-contrast type icons in contributor summaries', () => {
    controller.setContributors([
      { type: 'person', familyname: 'Doe', roles: [] },
      { type: 'institution', institutionname: 'Institute', roles: [] }
    ]);
    const personAvatar = cards()[0].querySelector('[data-contributor-avatar]');
    const institutionAvatar = cards()[1].querySelector('[data-contributor-avatar]');
    expect(personAvatar.classList.contains('bg-dark')).toBe(true);
    expect(personAvatar.getAttribute('aria-label')).toBe('Person');
    expect(personAvatar.querySelector('i').classList.contains('bi-person')).toBe(true);
    expect(institutionAvatar.getAttribute('aria-label')).toBe('Institution');
    expect(institutionAvatar.querySelector('i').classList.contains('bi-building')).toBe(true);
    expect(cards()[0].querySelector('[data-contributor-type]')).toBeNull();
  });

  test('shows help only for the first visible field of each contributor kind', () => {
    controller.setContributors([
      { type: 'person', familyname: 'First', roles: [] },
      { type: 'institution', institutionname: 'First Institute', roles: [] },
      { type: 'person', familyname: 'Second', roles: [] },
      { type: 'institution', institutionname: 'Second Institute', roles: [] }
    ]);
    for (const name of ['cbORCID[]', 'cbPersonRoles[]', 'cbAffiliation[]']) {
      expect(helpVisible(cards()[0], name)).toBe(true);
      expect(helpVisible(cards()[2], name)).toBe(false);
      expect(helpIcon(cards()[2], name).closest('.input-group-text').classList.contains('d-none')).toBe(true);
    }
    for (const name of ['cbOrganisationName[]', 'cbOrganisationRoles[]', 'OrganisationAffiliation[]']) {
      expect(helpVisible(cards()[1], name)).toBe(true);
      expect(helpVisible(cards()[3], name)).toBe(false);
    }

    cards()[0].querySelector('[data-contributor-remove]').click();
    expect(helpVisible(cards()[1], 'cbORCID[]')).toBe(true);
    cards()[0].querySelector('[data-contributor-toggle-edit]').click();
    expect(helpVisible(cards()[2], 'cbOrganisationName[]')).toBe(true);

    localStorage.setItem('helpStatus', 'help-off');
    document.dispatchEvent(new CustomEvent('helpStatus:changed'));
    expect(Array.from(document.querySelectorAll('[data-contributor-stack] i[data-help-section-id]'))
      .every(icon => icon.classList.contains('d-none'))).toBe(true);
    localStorage.setItem('helpStatus', 'help-on');
    document.dispatchEvent(new CustomEvent('helpStatus:changed'));
    expect(helpVisible(cards()[1], 'cbORCID[]')).toBe(true);
    expect(helpVisible(cards()[2], 'cbOrganisationName[]')).toBe(true);
  });

  test('moves the first institution help icon after type changes and reordering', () => {
    controller.addPerson();
    controller.addInstitution();
    cards()[0].querySelector('[data-contributor-type-option="institution"]').click();
    expect(helpVisible(cards()[0], 'cbOrganisationName[]')).toBe(true);
    expect(helpVisible(cards()[1], 'cbOrganisationName[]')).toBe(false);
    cards()[1].querySelector('[data-contributor-move-up]').click();
    expect(helpVisible(cards()[0], 'cbOrganisationName[]')).toBe(true);
    expect(helpVisible(cards()[1], 'cbOrganisationName[]')).toBe(false);
  });

  test('keeps mixed order and moves entries with keyboard controls', () => {
    controller.setContributors([
      { type: 'person', familyname: 'First', roles: [] },
      { type: 'institution', institutionname: 'Institute', roles: ['Producer'] },
      { type: 'person', familyname: 'Last', roles: [] }
    ]);
    expect(payload().map(entry => entry.type)).toEqual(['person', 'institution', 'person']);
    expect(cards()[0].querySelector('[data-contributor-remove]').classList.contains('btn-danger')).toBe(true);
    cards()[2].querySelector('[data-contributor-move-up]').click();
    expect(payload().map(entry => entry.type)).toEqual(['person', 'person', 'institution']);
    expect(payload().map(entry => entry.order)).toEqual([0, 1, 2]);
    cards()[1].querySelector('[data-contributor-remove]').click();
    expect(payload().map(entry => entry.familyname || entry.institutionname)).toEqual(['First', 'Institute']);
  });

  test('allows type switching only for an empty card', () => {
    controller.addPerson();
    expect(cards()[0].querySelector('[data-contributor-type-option="institution"]').classList.contains('btn-outline-dark'))
      .toBe(true);
    cards()[0].querySelector('[data-contributor-type-option="institution"]').click();
    expect(cards()[0].dataset.contributorType).toBe('institution');
    change(cards()[0].querySelector('[name="cbOrganisationName[]"]'), 'Institute');
    expect(cards()[0].querySelector('[data-contributor-type-option="person"]').disabled).toBe(true);
    cards()[0].querySelector('[data-contributor-type-option="person"]').click();
    expect(cards()[0].dataset.contributorType).toBe('institution');
  });

  test('reveals contact fields for a person contact and filters disabled institution contacts', () => {
    controller.setContributors([{ type: 'person', familyname: 'Contact', roles: ['Contact Person'] }]);
    expect(cards()[0].querySelector('[data-contributor-contact-fields]').classList.contains('d-none')).toBe(false);
    expect(cards()[0].querySelector('[name="cbContactEmail[]"]').required).toBe(true);
    controller.setContributors([{ type: 'institution', institutionname: 'Institute', roles: ['Contact Person', 'Producer'] }]);
    expect(payload()[0].roles).toEqual(['Producer']);
    window.ELMO_FEATURES.showContactInstitution = true;
    controller.setContributors([{ type: 'institution', institutionname: 'Institute', roles: ['Contact Person'], email: 'a@example.org' }]);
    expect(payload()[0].roles).toEqual(['Contact Person']);
    expect(payload()[0].email).toBe('a@example.org');
    expect(cards()[0].querySelector('[data-contributor-contact-fields]').classList.contains('d-none')).toBe(false);
  });

  test('collapses to a compact summary with an edit action', () => {
    controller.addPerson();
    const card = cards()[0];
    const toggle = card.querySelector('[data-contributor-toggle-edit]');
    expect(card.querySelector('[data-contributor-edit-panel]').classList.contains('show')).toBe(true);
    expect(card.querySelector('[data-contributor-remove]').parentElement.classList.contains('flex-sm-row')).toBe(true);
    toggle.click();
    expect(card.dataset.contributorExpanded).toBe('false');
    expect(card.querySelector('[data-contributor-edit-panel]').classList.contains('show')).toBe(false);
    expect(toggle.getAttribute('aria-label')).toBe('Edit contributor entry');
    expect(toggle.querySelector('i').classList.contains('bi-pencil')).toBe(true);
    toggle.click();
    expect(card.dataset.contributorExpanded).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
