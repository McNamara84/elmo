const fs = require('fs');
const path = require('path');

class MockTagify {
  constructor(el, options = {}) {
    this.el = el;
    this.settings = options;
    this.on = jest.fn();
    this.destroy = jest.fn();
  }
}

const flushPromises = () => new Promise(res => setTimeout(res, 0));

describe('roles.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="wrapper1">
        <input id="input-contributor-personrole" />
        <div class="tagify__input"></div>
      </div>
      <div id="wrapper2">
        <input id="input-contributor-organisationrole" />
        <div class="tagify__input"></div>
      </div>
    `;

    global.Tagify = MockTagify;
    global.fetch = jest.fn();
    global.translations = { general: { roleLabel: 'Role' } };

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

  test('refreshRoleTagifyInstances updates placeholders', () => {
    const personInput = document.getElementById('input-contributor-personrole');
    const orgInput = document.getElementById('input-contributor-organisationrole');
    personInput._tagify = new MockTagify(personInput, { placeholder: '' });
    orgInput._tagify = new MockTagify(orgInput, { placeholder: '' });
    const placeholder1 = personInput.parentElement.querySelector('.tagify__input');
    const placeholder2 = orgInput.parentElement.querySelector('.tagify__input');
    placeholder1.setAttribute('data-placeholder', 'old');
    placeholder2.setAttribute('data-placeholder', 'old');

    window.refreshRoleTagifyInstances();

    expect(personInput._tagify.settings.placeholder).toBe('Role');
    expect(orgInput._tagify.settings.placeholder).toBe('Role');
    expect(placeholder1.getAttribute('data-placeholder')).toBe('Role');
    expect(placeholder2.getAttribute('data-placeholder')).toBe('Role');
  });
});