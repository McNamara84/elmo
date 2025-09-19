const fs = require('fs');
const path = require('path');

class MockTagify {
  constructor(el, options = {}) {
    this.el = el;
    this.settings = options;
    this.on = jest.fn();
    this.destroy = jest.fn();
    this.DOM = { scope: el.parentElement };
  }
}

const flushPromises = () => new Promise(res => setTimeout(res, 0));

describe('roles.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="wrapper1">
        <label for="input-contributor-personrole">Role</label>
        <input id="input-contributor-personrole" name="cbPersonRoles[]" />
        <div class="tagify__input"></div>
      </div>
      <div id="wrapper2">
        <label for="input-contributor-organisationrole">Role</label>
        <input id="input-contributor-organisationrole" name="cbOrganisationRoles[]" />
        <div class="tagify__input"></div>
      </div>
    `;

    global.Tagify = MockTagify;
    global.fetch = jest.fn();
    global.translations = { general: { roleLabel: 'Role' } };

    const accessibilityScript = fs.readFileSync(path.resolve(__dirname, '../../js/accessibility.js'), 'utf8');
    window.eval(accessibilityScript);
    jest.spyOn(window, 'applyTagifyAccessibilityAttributes');

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/roles.js'), 'utf8');
    window.eval(script);
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.personRoles;
    delete global.organizationRoles;
  });

  test('initializeTagifyWithRoles attaches Tagify instance', () => {
    const input = document.getElementById('input-contributor-personrole');
    window.initializeTagifyWithRoles('#input-contributor-personrole', [{ name: 'Author' }, 'Editor']);

    expect(input._tagify).toBeInstanceOf(MockTagify);
    expect(input._tagify.settings.whitelist).toEqual(['Author', 'Editor']);
    expect(input._tagify.settings.placeholder).toBe('Role');
    expect(input._tagify.on).toHaveBeenCalledWith('invalid', expect.any(Function));
    expect(window.applyTagifyAccessibilityAttributes).toHaveBeenCalledWith(expect.any(MockTagify), input, {
      placeholder: 'Role'
    });
  });

  test('setupRolesDropdown uses cached roles and destroys existing Tagify', () => {
    const input = document.getElementById('input-contributor-personrole');
    input._tagify = new MockTagify(input, {});
    window.personRoles = ['Cached'];

    const spy = jest.spyOn(window, 'initializeTagifyWithRoles').mockImplementation(() => {});
    window.setupRolesDropdown(['person'], '#input-contributor-personrole');

    expect(input._tagify.destroy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('#input-contributor-personrole', ['Cached']);
    expect(fetch).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('setupRolesDropdown fetches roles and caches them', async () => {
    const input = document.getElementById('input-contributor-personrole');
    const resp1 = { ok: true, json: () => Promise.resolve(['A']) };
    const resp2 = { ok: true, json: () => Promise.resolve(['B']) };
    fetch.mockResolvedValueOnce(resp1).mockResolvedValueOnce(resp2);

    const spy = jest.spyOn(window, 'initializeTagifyWithRoles').mockImplementation(() => {});
    window.setupRolesDropdown(['person', 'institution'], '#input-contributor-personrole');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('./api/v2/vocabs/roles?type=person');
    expect(fetch).toHaveBeenCalledWith('./api/v2/vocabs/roles?type=institution');
    expect(window.personRoles).toEqual(['A']);
    expect(window.organizationRoles).toEqual(['B']);
    expect(spy).toHaveBeenCalledWith('#input-contributor-personrole', ['A', 'B']);
    spy.mockRestore();
  });

  test('refreshRoleTagifyInstances updates placeholders for all rows', () => {
    const personInput = document.getElementById('input-contributor-personrole');
    const orgInput = document.getElementById('input-contributor-organisationrole');
    const clonedInput = document.createElement('input');
    clonedInput.name = 'cbPersonRoles[]';
    clonedInput.id = 'input-contributor-personrole2';
    personInput.parentElement.appendChild(clonedInput);

    personInput._tagify = new MockTagify(personInput, { placeholder: '' });
    orgInput._tagify = new MockTagify(orgInput, { placeholder: '' });
    clonedInput._tagify = new MockTagify(clonedInput, { placeholder: '' });

    const placeholder1 = personInput.parentElement.querySelector('.tagify__input');
    const placeholder2 = orgInput.parentElement.querySelector('.tagify__input');
    const placeholder3 = clonedInput.parentElement.querySelector('.tagify__input');
    placeholder1.setAttribute('data-placeholder', 'old');
    placeholder2.setAttribute('data-placeholder', 'old');
    placeholder3.setAttribute('data-placeholder', 'old');

    window.refreshRoleTagifyInstances();

    expect(personInput._tagify.settings.placeholder).toBe('Role');
    expect(orgInput._tagify.settings.placeholder).toBe('Role');
    expect(clonedInput._tagify.settings.placeholder).toBe('Role');
    expect(placeholder1.getAttribute('data-placeholder')).toBe('Role');
    expect(placeholder2.getAttribute('data-placeholder')).toBe('Role');
    expect(placeholder3.getAttribute('data-placeholder')).toBe('Role');
    expect(window.applyTagifyAccessibilityAttributes).toHaveBeenCalledTimes(3);
  });

  test('DOM initialization creates Tagify and reacts to translationsLoaded', () => {
    window.personRoles = ['p'];
    window.organizationRoles = ['o'];

    document.dispatchEvent(new Event('DOMContentLoaded'));
    const personInput = document.getElementById('input-contributor-personrole');
    const orgInput = document.getElementById('input-contributor-organisationrole');

    expect(personInput._tagify).toBeInstanceOf(MockTagify);
    expect(orgInput._tagify).toBeInstanceOf(MockTagify);

    translations.general.roleLabel = 'Updated';
    document.dispatchEvent(new Event('translationsLoaded'));

    expect(personInput._tagify.settings.placeholder).toBe('Updated');
    expect(orgInput._tagify.settings.placeholder).toBe('Updated');
    expect(window.applyTagifyAccessibilityAttributes).toHaveBeenCalled();
  });
});