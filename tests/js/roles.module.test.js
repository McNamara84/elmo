/**
 * @jest-environment jsdom
 * 
 * Tests for roles.js using require() for proper coverage tracking
 */

describe('roles module coverage', () => {
    let rolesModule;
    let $;

    beforeEach(() => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Set up DOM
        document.body.innerHTML = `
            <div id="group-contributorperson">
                <input type="text" id="input-contributor-personrole" name="cbPersonRoles[]">
            </div>
            <div id="group-contributororganisation">
                <input type="text" id="input-contributor-organisationrole" name="cbOrganisationRoles[]">
            </div>
        `;

        // Mock translations
        window.translations = {
            general: {
                roleLabel: 'Select roles'
            }
        };

        // Mock Tagify
        global.Tagify = jest.fn().mockImplementation((input, options) => {
            const instance = {
                settings: { ...options },
                on: jest.fn(),
                destroy: jest.fn(),
                value: []
            };
            input._tagify = instance;
            return instance;
        });

        // Mock applyTagifyAccessibilityAttributes
        window.applyTagifyAccessibilityAttributes = jest.fn();

        // Clear module cache
        jest.resetModules();

        // Require the module
        rolesModule = require('../../js/roles.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete global.Tagify;
        delete window.translations;
        delete window.applyTagifyAccessibilityAttributes;
    });

    describe('module exports', () => {
        test('exports setupRolesDropdown function', () => {
            expect(typeof rolesModule.setupRolesDropdown).toBe('function');
        });

        test('exports refreshRoleTagifyInstances function', () => {
            expect(typeof rolesModule.refreshRoleTagifyInstances).toBe('function');
        });

        test('exports getPersonRoles function', () => {
            expect(typeof rolesModule.getPersonRoles).toBe('function');
        });

        test('exports getOrganizationRoles function', () => {
            expect(typeof rolesModule.getOrganizationRoles).toBe('function');
        });

        test('exports setPersonRoles function', () => {
            expect(typeof rolesModule.setPersonRoles).toBe('function');
        });

        test('exports setOrganizationRoles function', () => {
            expect(typeof rolesModule.setOrganizationRoles).toBe('function');
        });
    });

    describe('role data management', () => {
        test('getPersonRoles returns empty array initially', () => {
            expect(rolesModule.getPersonRoles()).toEqual([]);
        });

        test('getOrganizationRoles returns empty array initially', () => {
            expect(rolesModule.getOrganizationRoles()).toEqual([]);
        });

        test('setPersonRoles updates person roles', () => {
            const testRoles = [
                { value: 'DataCurator', name: 'Data Curator' },
                { value: 'ProjectLeader', name: 'Project Leader' }
            ];
            
            rolesModule.setPersonRoles(testRoles);
            
            expect(rolesModule.getPersonRoles()).toEqual(testRoles);
        });

        test('setOrganizationRoles updates organization roles', () => {
            const testRoles = [
                { value: 'HostingInstitution', name: 'Hosting Institution' },
                { value: 'Sponsor', name: 'Sponsor' }
            ];
            
            rolesModule.setOrganizationRoles(testRoles);
            
            expect(rolesModule.getOrganizationRoles()).toEqual(testRoles);
        });
    });

    describe('setupRolesDropdown', () => {
        beforeEach(() => {
            // Set up roles data
            rolesModule.setPersonRoles([
                { value: 'DataCurator', name: 'Data Curator' },
                { value: 'ProjectLeader', name: 'Project Leader' }
            ]);
            rolesModule.setOrganizationRoles([
                { value: 'HostingInstitution', name: 'Hosting Institution' },
                { value: 'Sponsor', name: 'Sponsor' }
            ]);
        });

        test('initializes Tagify for person roles', () => {
            rolesModule.setupRolesDropdown(['person'], '#input-contributor-personrole');
            
            expect(Tagify).toHaveBeenCalled();
        });

        test('initializes Tagify for institution roles', () => {
            rolesModule.setupRolesDropdown(['institution'], '#input-contributor-organisationrole');
            
            expect(Tagify).toHaveBeenCalled();
        });

        test('initializes Tagify with both role types', () => {
            rolesModule.setupRolesDropdown(['person', 'institution'], '#input-contributor-personrole');
            
            expect(Tagify).toHaveBeenCalled();
        });

        test('does nothing when input not found', () => {
            Tagify.mockClear();
            
            rolesModule.setupRolesDropdown(['person'], '#nonexistent-input');
            
            expect(Tagify).not.toHaveBeenCalled();
        });

        test('destroys existing Tagify instance before reinitializing', () => {
            // First initialization
            rolesModule.setupRolesDropdown(['person'], '#input-contributor-personrole');
            
            const firstInstance = document.querySelector('#input-contributor-personrole')._tagify;
            
            // Second initialization
            rolesModule.setupRolesDropdown(['person'], '#input-contributor-personrole');
            
            expect(firstInstance.destroy).toHaveBeenCalled();
        });

        test('uses correct whitelist for person roles', () => {
            rolesModule.setupRolesDropdown(['person'], '#input-contributor-personrole');
            
            const callArgs = Tagify.mock.calls[Tagify.mock.calls.length - 1];
            const options = callArgs[1];
            
            // personRoles are strings like "Data Curator", "Project Leader"
            expect(options.whitelist).toContain('Data Curator');
        });

        test('uses correct whitelist for both role types', () => {
            rolesModule.setupRolesDropdown(['both'], '#input-contributor-personrole');
            
            const callArgs = Tagify.mock.calls[Tagify.mock.calls.length - 1];
            const options = callArgs[1];
            
            expect(options.whitelist.length).toBe(4); // 2 person + 2 organization
        });

        test('applies accessibility attributes', () => {
            rolesModule.setupRolesDropdown(['person'], '#input-contributor-personrole');
            
            expect(window.applyTagifyAccessibilityAttributes).toHaveBeenCalled();
        });

        test('uses translation for placeholder', () => {
            rolesModule.setupRolesDropdown(['person'], '#input-contributor-personrole');
            
            const callArgs = Tagify.mock.calls[Tagify.mock.calls.length - 1];
            const options = callArgs[1];
            
            expect(options.placeholder).toBe('Select roles');
        });
    });

    describe('refreshRoleTagifyInstances', () => {
        test('updates placeholder in existing Tagify instances', () => {
            // Set up a mock Tagify instance
            const mockTagify = {
                settings: { placeholder: 'Old placeholder' }
            };
            const input = document.querySelector('#input-contributor-personrole');
            input._tagify = mockTagify;
            
            // Create placeholder element
            const placeholderElem = document.createElement('span');
            placeholderElem.className = 'tagify__input';
            input.parentElement.appendChild(placeholderElem);
            
            window.translations.general.roleLabel = 'New Placeholder';
            
            rolesModule.refreshRoleTagifyInstances();
            
            expect(mockTagify.settings.placeholder).toBe('New Placeholder');
            expect(placeholderElem.getAttribute('data-placeholder')).toBe('New Placeholder');
        });

        test('calls applyTagifyAccessibilityAttributes', () => {
            const mockTagify = {
                settings: { placeholder: 'Old' }
            };
            const input = document.querySelector('#input-contributor-personrole');
            input._tagify = mockTagify;
            
            rolesModule.refreshRoleTagifyInstances();
            
            expect(window.applyTagifyAccessibilityAttributes).toHaveBeenCalled();
        });

        test('handles missing Tagify instances gracefully', () => {
            // No _tagify on inputs
            expect(() => {
                rolesModule.refreshRoleTagifyInstances();
            }).not.toThrow();
        });
    });
});
