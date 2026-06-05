/**
 * @jest-environment jsdom
 * 
 * Tests for autocomplete.js using require() for proper coverage tracking
 */

describe('autocomplete module coverage', () => {
    let autocompleteModule;
    let $;

    beforeEach(() => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Set up basic DOM
        document.body.innerHTML = `
            <select id="input-rights-license">
                <option value="1">MIT License</option>
                <option value="2">Apache License 2.0</option>
                <option value="3">CC-BY 4.0</option>
            </select>
            <select id="input-resourceinformation-resourcetype">
                <option value="">Select...</option>
                <option value="software">Software</option>
                <option value="dataset">Dataset</option>
            </select>
            <div id="group-author"></div>
            <div id="group-contributorperson"></div>
        `;

        // Clear module cache
        jest.resetModules();

        // Require the module
        autocompleteModule = require('../../js/autocomplete.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
    });

    describe('module exports', () => {
        test('exports normalizeRorId function', () => {
            expect(typeof autocompleteModule.normalizeRorId).toBe('function');
        });

        test('exports collectAffiliation function', () => {
            expect(typeof autocompleteModule.collectAffiliation).toBe('function');
        });
    });

    describe('normalizeRorId', () => {
        test('returns empty string for null input', () => {
            expect(autocompleteModule.normalizeRorId(null)).toBe('');
        });

        test('returns empty string for undefined input', () => {
            expect(autocompleteModule.normalizeRorId(undefined)).toBe('');
        });

        test('returns empty string for empty string input', () => {
            expect(autocompleteModule.normalizeRorId('')).toBe('');
        });

        test('returns input unchanged if already has https://ror.org/ prefix', () => {
            const rorId = 'https://ror.org/012345678';
            expect(autocompleteModule.normalizeRorId(rorId)).toBe(rorId);
        });

        test('adds https://ror.org/ prefix to bare ROR ID', () => {
            expect(autocompleteModule.normalizeRorId('012345678')).toBe('https://ror.org/012345678');
        });

        test('adds prefix to ROR ID with different format', () => {
            expect(autocompleteModule.normalizeRorId('0abcd1234')).toBe('https://ror.org/0abcd1234');
        });
    });

    describe('collectAffiliation', () => {
        test('does nothing when affiliation is null', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            
            autocompleteModule.collectAffiliation(null, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(0);
            expect(rorIds.size).toBe(0);
        });

        test('does nothing when affiliation is undefined', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            
            autocompleteModule.collectAffiliation(undefined, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(0);
            expect(rorIds.size).toBe(0);
        });

        test('does nothing when affiliation has no organization', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            
            autocompleteModule.collectAffiliation({}, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(0);
            expect(rorIds.size).toBe(0);
        });

        test('does nothing when organization has no name', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            const affiliation = {
                organization: {
                    'disambiguated-organization': {
                        'disambiguation-source': 'ROR',
                        'disambiguated-organization-identifier': '012345678'
                    }
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(0);
            expect(rorIds.size).toBe(0);
        });

        test('does nothing when no disambiguated organization', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            const affiliation = {
                organization: {
                    name: 'Test University'
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(0);
            expect(rorIds.size).toBe(0);
        });

        test('does nothing when disambiguation source is not ROR', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            const affiliation = {
                organization: {
                    name: 'Test University',
                    'disambiguated-organization': {
                        'disambiguation-source': 'GRID',
                        'disambiguated-organization-identifier': '012345678'
                    }
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(0);
            expect(rorIds.size).toBe(0);
        });

        test('does nothing when no disambiguated organization identifier', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            const affiliation = {
                organization: {
                    name: 'Test University',
                    'disambiguated-organization': {
                        'disambiguation-source': 'ROR',
                        'disambiguated-organization-identifier': ''
                    }
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(0);
            expect(rorIds.size).toBe(0);
        });

        test('adds affiliation name and normalized ROR ID when valid', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            const affiliation = {
                organization: {
                    name: 'Test University',
                    'disambiguated-organization': {
                        'disambiguation-source': 'ROR',
                        'disambiguated-organization-identifier': '012345678'
                    }
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            
            expect(affiliationSet.has('Test University')).toBe(true);
            expect(rorIds.has('https://ror.org/012345678')).toBe(true);
        });

        test('adds multiple affiliations to same sets', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            
            const affiliation1 = {
                organization: {
                    name: 'University A',
                    'disambiguated-organization': {
                        'disambiguation-source': 'ROR',
                        'disambiguated-organization-identifier': 'aaa111111'
                    }
                }
            };
            
            const affiliation2 = {
                organization: {
                    name: 'University B',
                    'disambiguated-organization': {
                        'disambiguation-source': 'ROR',
                        'disambiguated-organization-identifier': 'bbb222222'
                    }
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation1, affiliationSet, rorIds);
            autocompleteModule.collectAffiliation(affiliation2, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(2);
            expect(rorIds.size).toBe(2);
            expect(affiliationSet.has('University A')).toBe(true);
            expect(affiliationSet.has('University B')).toBe(true);
        });

        test('handles ROR ID with https prefix', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            const affiliation = {
                organization: {
                    name: 'Test University',
                    'disambiguated-organization': {
                        'disambiguation-source': 'ROR',
                        'disambiguated-organization-identifier': 'https://ror.org/012345678'
                    }
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            
            expect(rorIds.has('https://ror.org/012345678')).toBe(true);
        });

        test('does not add duplicates', () => {
            const affiliationSet = new Set();
            const rorIds = new Set();
            const affiliation = {
                organization: {
                    name: 'Test University',
                    'disambiguated-organization': {
                        'disambiguation-source': 'ROR',
                        'disambiguated-organization-identifier': '012345678'
                    }
                }
            };
            
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            autocompleteModule.collectAffiliation(affiliation, affiliationSet, rorIds);
            
            expect(affiliationSet.size).toBe(1);
            expect(rorIds.size).toBe(1);
        });
    });
});
