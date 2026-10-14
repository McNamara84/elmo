/**
 * @jest-environment jsdom
 * 
 * Tests for select.js using require() for proper coverage tracking
 */

describe('select module coverage', () => {
    let selectModule;
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
            <select id="input-stc-timezone">
                <option value="">Select timezone</option>
            </select>
            <select id="input-resourceinformation-resourcetype">
                <option value="">Select type</option>
            </select>
            <select id="input-resourceinformation-language">
                <option value="">Select language</option>
            </select>
            <select id="input-resourceinformation-titletype">
                <option value="">Select title type</option>
            </select>
            <select id="input-relatedwork-identifiertype">
                <option value="">Select identifier type</option>
            </select>
            <div id="group-relatedwork">
                <div class="row">
                    <select name="relation"></select>
                    <input name="rIdentifier[]" id="input-relatedwork-identifier0">
                    <select name="rIdentifierType[]" id="input-relatedwork-identifiertype0"></select>
                </div>
            </div>
            <div id="group-datasources">
                <div class="row">
                    <select name="datasource_type[]"></select>
                    <select name="datasource_details[]"></select>
                    <input name="dName[]">
                    <input name="dIdentifier[]">
                    <select name="dIdentifierType[]"></select>
                </div>
            </div>
        `;

        // Mock translations
        global.translations = {
            resourceTypes: {
                'type1': 'Dataset',
                'type2': 'Software'
            },
            languages: {
                'en': 'English',
                'de': 'German'
            },
            titleTypes: {
                'main': 'Main Title',
                'alternative': 'Alternative Title'
            },
            identifierTypes: {
                'doi': 'DOI',
                'url': 'URL'
            }
        };

        // Mock fetch
        global.fetch = jest.fn();

        const identifierTypesResponse = {
            identifierTypes: [
                { name: 'DOI', pattern: '^10\\.\\d{4,9}/.+$', description: 'Digital Object Identifier' },
                { name: 'URL', pattern: '^https?://.+$', description: 'Uniform Resource Locator' }
            ]
        };
        $.getJSON = jest.fn((url, success) => {
            if (typeof success === 'function') {
                success(identifierTypesResponse);
            }
            return { fail: jest.fn() };
        });
        $.ajax = jest.fn((options) => {
            if (typeof options?.success === 'function') {
                options.success(identifierTypesResponse);
            }
            return { fail: jest.fn(), always: jest.fn() };
        });

        // Clear module cache
        jest.resetModules();

        // Require the module
        selectModule = require('../../js/select.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete global.translations;
        delete global.fetch;
    });

    describe('module exports', () => {
        test('exports setupTimezoneDropdownAjax function', () => {
            expect(typeof selectModule.setupTimezoneDropdownAjax).toBe('function');
        });

        test('exports setupResourceTypeDropdownAjax function', () => {
            expect(typeof selectModule.setupResourceTypeDropdownAjax).toBe('function');
        });

        test('exports setupLanguageDropdownAjax function', () => {
            expect(typeof selectModule.setupLanguageDropdownAjax).toBe('function');
        });

        test('exports setupTitleTypeDropdownAjax function', () => {
            expect(typeof selectModule.setupTitleTypeDropdownAjax).toBe('function');
        });

        test('exports setupIdentifierTypesDropdown function', () => {
            expect(typeof selectModule.setupIdentifierTypesDropdown).toBe('function');
        });

        test('exports updateIdentifierType function', () => {
            expect(typeof selectModule.updateIdentifierType).toBe('function');
        });

        test('exports Related Work dropdown and pattern integration functions', () => {
            expect(typeof selectModule.applyRelatedWorkDropdowns).toBe('function');
            expect(typeof selectModule.updateValidationPattern).toBe('function');
        });

        test('exports debounce function', () => {
            expect(typeof selectModule.debounce).toBe('function');
        });

        test('exports updateDropdownPlaceholders function', () => {
            expect(typeof selectModule.updateDropdownPlaceholders).toBe('function');
        });
    });

    describe('debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('delays function execution', () => {
            const mockFn = jest.fn();
            const debouncedFn = selectModule.debounce(mockFn, 100);

            debouncedFn();
            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('only executes once for multiple rapid calls', () => {
            const mockFn = jest.fn();
            const debouncedFn = selectModule.debounce(mockFn, 100);

            debouncedFn();
            debouncedFn();
            debouncedFn();

            jest.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('resets timer on subsequent calls', () => {
            const mockFn = jest.fn();
            const debouncedFn = selectModule.debounce(mockFn, 100);

            debouncedFn();
            jest.advanceTimersByTime(50);
            debouncedFn();
            jest.advanceTimersByTime(50);
            
            expect(mockFn).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(50);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('conservative identifier detection', () => {
        test('requires registry proof for DOI syntax', () => {
            expect(selectModule.detectIdentifierType('10.60510/gf1211s-47', [{name:'DOI'}])).toBeNull();
        });
        test('does not decide an ISBN/EAN13 overlap by priority', () => {
            expect(selectModule.detectIdentifierType('9783831048069', [{name:'ISBN'}, {name:'EAN13'}])).toBeNull();
        });
        test('does not substitute URL for an unavailable arXiv type', () => {
            expect(selectModule.detectIdentifierType('https://arxiv.org/abs/2507.21532', [{name:'URL'}])).toBeNull();
        });
    });

    describe('updateIdentifierType', () => {
        test('handles input element without value', () => {
            const input = document.querySelector('input[name="rIdentifier[]"]');
            
            expect(() => {
                selectModule.updateIdentifierType(input);
            }).not.toThrow();
        });

        test('handles DOI identifier', () => {
            const input = document.querySelector('input[name="rIdentifier[]"]');
            input.value = '10.1234/test';
            
            expect(() => {
                selectModule.updateIdentifierType(input);
            }).not.toThrow();
        });

        test('handles URL identifier', () => {
            const input = document.querySelector('input[name="rIdentifier[]"]');
            input.value = 'https://example.com';
            
            expect(() => {
                selectModule.updateIdentifierType(input);
            }).not.toThrow();
        });
    });

    describe('setupIdentifierTypesDropdown', () => {
        test('can be called without errors', () => {
            expect(() => {
                selectModule.setupIdentifierTypesDropdown('#input-relatedwork-identifiertype');
            }).not.toThrow();
        });

        test('handles non-existent selector', () => {
            expect(() => {
                selectModule.setupIdentifierTypesDropdown('#nonexistent');
            }).not.toThrow();
        });
    });

    describe('setupTimezoneDropdownAjax', () => {
        test('returns early for non-existent dropdown', async () => {
            await expect(
                selectModule.setupTimezoneDropdownAjax('#nonexistent', 'json/timezones.json')
            ).resolves.toBeUndefined();
        });

        test('handles fetch error gracefully', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
            
            await expect(
                selectModule.setupTimezoneDropdownAjax('#input-stc-timezone', 'json/timezones.json')
            ).resolves.toBeUndefined();
        });
    });
});
