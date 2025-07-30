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
});