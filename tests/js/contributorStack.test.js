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
            <input id="input-contributor-orcid" name="cbORCID[]">
            <input id="input-contributor-personrole" name="cbPersonRoles[]">
            <input id="input-contributorpersons-affiliation" name="cbAffiliation[]">
            <input id="input-contributor-personrorid" name="cbpRorIds[]">
            <div class="col-2"><button class="addContributorPerson">+</button></div>
          </div>
        </template>
        <template id="contributor-institution-template">
          <div class="row" contributors-row>
            <input id="input-contributor-name" name="cbOrganisationName[]">
            <input id="input-contributor-organisationrole" name="cbOrganisationRoles[]">
            <input id="input-contributor-organisationaffiliation" name="OrganisationAffiliation[]">
            <input id="input-contributor-organisationrorid" name="hiddenOrganisationRorId[]">
            <div class="col-2"><button class="addContributor">+</button></div>
          </div>
        </template>
      </div>`;
    const $ = require('jquery');
    global.$ = global.jQuery = window.$ = window.jQuery = $;
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

  test('keeps mixed order and moves entries with keyboard controls', () => {
    controller.setContributors([
      { type: 'person', familyname: 'First', roles: [] },
      { type: 'institution', institutionname: 'Institute', roles: ['Producer'] },
      { type: 'person', familyname: 'Last', roles: [] }
    ]);
    expect(payload().map(entry => entry.type)).toEqual(['person', 'institution', 'person']);
    cards()[2].querySelector('[data-contributor-move-up]').click();
    expect(payload().map(entry => entry.type)).toEqual(['person', 'person', 'institution']);
    expect(payload().map(entry => entry.order)).toEqual([0, 1, 2]);
    cards()[1].querySelector('[data-contributor-remove]').click();
    expect(payload().map(entry => entry.familyname || entry.institutionname)).toEqual(['First', 'Institute']);
  });

  test('allows type switching only for an empty card', () => {
    controller.addPerson();
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
});
