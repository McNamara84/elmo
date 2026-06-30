/**
 * @jest-environment jsdom
 * 
 * Tests for language.js using require() for proper coverage tracking
 */

describe('language module coverage', () => {
    let languageModule;
    let $;

    beforeEach(() => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Mock localStorage
        const localStorageMock = {
            store: {},
            getItem: jest.fn(key => localStorageMock.store[key] || null),
            setItem: jest.fn((key, value) => { localStorageMock.store[key] = value; }),
            removeItem: jest.fn(key => { delete localStorageMock.store[key]; }),
            clear: jest.fn(() => { localStorageMock.store = {}; })
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

        // Mock navigator.language
        Object.defineProperty(navigator, 'language', { value: 'de-DE', configurable: true });
        Object.defineProperty(navigator, 'languages', { value: ['de-DE', 'en-US'], configurable: true });

        // Set up DOM
        document.body.innerHTML = `
            <nav>
                <ul class="dropdown-menu">
                    <li><a data-bs-language-value="de">Deutsch</a></li>
                    <li><a data-bs-language-value="en">English</a></li>
                    <li><a data-bs-language-value="fr">Français</a></li>
                    <li><a data-bs-language-value="auto">Auto</a></li>
                </ul>
            </nav>
            <div data-translate="test.key">Original Text</div>
            <div data-translate-placeholder="test.placeholder">Placeholder</div>
            <input data-translate-placeholder="input.placeholder" placeholder="old">
            <div data-translate-title="test.title" title="old title">Title Element</div>
            <button id="dropdownLanguage">Language</button>
        `;

        // Mock bootstrap
        window.bootstrap = {
            Tooltip: jest.fn().mockImplementation(() => ({}))
        };

        // Mock translations object
        window.translations = {};
        window.setTranslations = jest.fn(value => { window.translations = value || {}; });

        // Mock $.getJSON
        $.getJSON = jest.fn();

        // Clear module cache
        jest.resetModules();

        // Require the module
        languageModule = require('../../js/language.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete window.bootstrap;
        delete window.translations;
        delete window.setTranslations;
    });

    describe('module exports', () => {
        test('exports loadTranslations function', () => {
            expect(typeof languageModule.loadTranslations).toBe('function');
        });

        test('exports applyTranslations function', () => {
            expect(typeof languageModule.applyTranslations).toBe('function');
        });

        test('exports changeLanguage function', () => {
            expect(typeof languageModule.changeLanguage).toBe('function');
        });

        test('exports getBrowserLanguage function', () => {
            expect(typeof languageModule.getBrowserLanguage).toBe('function');
        });

        test('exports updateActiveLanguage function', () => {
            expect(typeof languageModule.updateActiveLanguage).toBe('function');
        });
    });

    describe('getBrowserLanguage', () => {
        test('returns browser language code', () => {
            const lang = languageModule.getBrowserLanguage();
            expect(['de', 'en']).toContain(lang);
        });
    });

    describe('updateActiveLanguage', () => {
        test('updates active class on language dropdown items', () => {
            languageModule.updateActiveLanguage('de');
            
            const deItem = $('[data-bs-language-value="de"]');
            const enItem = $('[data-bs-language-value="en"]');
            
            expect(deItem.hasClass('active')).toBe(true);
            expect(enItem.hasClass('active')).toBe(false);
        });

        test('handles auto language setting', () => {
            languageModule.updateActiveLanguage('auto');
            
            const autoItem = $('[data-bs-language-value="auto"]');
            expect(autoItem.hasClass('active')).toBe(true);
        });
    });

    describe('applyTranslations', () => {
        beforeEach(() => {
            // Mock required global functions
            window.resizeTitle = jest.fn();
            window.adjustButtons = jest.fn();
            
            // Set up translations
            window.setTranslations({
                general: {
                    logoTitle: 'Test Title'
                },
                test: {
                    key: 'Übersetzter Text',
                    placeholder: 'Translated Placeholder',
                    title: 'Translated Title'
                }
            });
        });

        afterEach(() => {
            delete window.resizeTitle;
            delete window.adjustButtons;
        });

        test('sets document title from translations', () => {
            languageModule.applyTranslations();
            expect(document.title).toBe('Test Title');
        });

        test('updates elements with data-translate attribute', () => {
            languageModule.applyTranslations();
            const translatedElement = $('[data-translate="test.key"]');
            expect(translatedElement.text()).toBe('Übersetzter Text');
        });

        test('updates placeholder attributes', () => {
            document.body.innerHTML += '<input data-translate-placeholder="test.placeholder" placeholder="old">';
            languageModule.applyTranslations();
            const input = $('[data-translate-placeholder="test.placeholder"]');
            expect(input.attr('placeholder')).toBe('Translated Placeholder');
        });

        test('updates title and aria-label attributes', () => {
            languageModule.applyTranslations();
            const titleElement = $('[data-translate-title="test.title"]');
            expect(titleElement.attr('title')).toBe('Translated Title');
            expect(titleElement.attr('aria-label')).toBe('Translated Title');
        });

        test('calls resizeTitle after applying translations', () => {
            languageModule.applyTranslations();
            expect(window.resizeTitle).toHaveBeenCalled();
        });

        test('calls adjustButtons after applying translations', () => {
            languageModule.applyTranslations();
            expect(window.adjustButtons).toHaveBeenCalled();
        });

        test('dispatches translationsLoaded custom event', () => {
            const eventListener = jest.fn();
            document.addEventListener('translationsLoaded', eventListener);
            
            languageModule.applyTranslations();
            
            expect(eventListener).toHaveBeenCalled();
            document.removeEventListener('translationsLoaded', eventListener);
        });

        test('sets up window.elmo.translate function', () => {
            languageModule.applyTranslations();
            
            expect(typeof window.elmo.translate).toBe('function');
            expect(window.elmo.translate('test.key')).toBe('Übersetzter Text');
        });

        test('sets up window.elmo.getTranslations function', () => {
            languageModule.applyTranslations();
            
            expect(typeof window.elmo.getTranslations).toBe('function');
            const trans = window.elmo.getTranslations();
            expect(trans.general.logoTitle).toBe('Test Title');
        });

        test('can be called without errors when translations are set', () => {
            // applyTranslations should work without throwing
            expect(() => languageModule.applyTranslations()).not.toThrow();
        });

        test('returns early without errors when translations are empty object', () => {
            window.setTranslations({});
            const originalTitle = document.title;
            expect(() => languageModule.applyTranslations()).not.toThrow();
            expect(document.title).toBe(originalTitle);
            expect(window.resizeTitle).not.toHaveBeenCalled();
        });

        test('returns early without errors when translations.general is undefined', () => {
            window.setTranslations({ other: { key: 'value' } });
            const originalTitle = document.title;
            expect(() => languageModule.applyTranslations()).not.toThrow();
            expect(document.title).toBe(originalTitle);
            expect(window.adjustButtons).not.toHaveBeenCalled();
        });

        test('returns early without errors when translations are null', () => {
            window.setTranslations(null);
            expect(() => languageModule.applyTranslations()).not.toThrow();
        });
    });

    describe('loadTranslations', () => {
        beforeEach(() => {
            // Mock global functions used by applyTranslations
            window.resizeTitle = jest.fn();
            window.adjustButtons = jest.fn();
        });

        afterEach(() => {
            delete window.resizeTitle;
            delete window.adjustButtons;
        });

        test('calls $.getJSON with correct URL', () => {
            $.getJSON.mockReturnValue({
                then: jest.fn(() => ({ fail: jest.fn() }))
            });

            languageModule.loadTranslations('de');

            expect($.getJSON).toHaveBeenCalledWith('lang/de.json');
        });

        test('handles en language', () => {
            $.getJSON.mockReturnValue({
                then: jest.fn(() => ({ fail: jest.fn() }))
            });

            languageModule.loadTranslations('en');

            expect($.getJSON).toHaveBeenCalledWith('lang/en.json');
        });

        test('handles fr language', () => {
            $.getJSON.mockReturnValue({
                then: jest.fn(() => ({ fail: jest.fn() }))
            });

            languageModule.loadTranslations('fr');

            expect($.getJSON).toHaveBeenCalledWith('lang/fr.json');
        });

        test('applies translations on success', () => {
            const mockTranslations = {
                general: { logoTitle: 'Test App' },
                test: { key: 'Test Value' }
            };
            
            let thenCallback;
            $.getJSON.mockReturnValue({
                then: jest.fn((cb) => {
                    thenCallback = cb;
                    return { fail: jest.fn() };
                })
            });

            languageModule.loadTranslations('de');
            thenCallback(mockTranslations);

            // applyTranslations should have been called, which sets document.title
            expect(document.title).toBe('Test App');
        });

        test('updates active language on success', () => {
            const mockTranslations = {
                general: { logoTitle: 'App' }
            };
            
            let thenCallback;
            $.getJSON.mockReturnValue({
                then: jest.fn((cb) => {
                    thenCallback = cb;
                    return { fail: jest.fn() };
                })
            });

            languageModule.loadTranslations('en');
            thenCallback(mockTranslations);

            const enItem = $('[data-bs-language-value="en"]');
            expect(enItem.hasClass('active')).toBe(true);
        });

        test('falls back to English on failure for non-English language', () => {
            let failCallback;
            $.getJSON.mockReturnValue({
                then: jest.fn(() => ({
                    fail: jest.fn((cb) => {
                        failCallback = cb;
                        return { fail: jest.fn() };
                    })
                }))
            });

            languageModule.loadTranslations('xy');
            
            // Reset mock to track fallback call
            $.getJSON.mockClear();
            $.getJSON.mockReturnValue({
                then: jest.fn(() => ({ fail: jest.fn() }))
            });
            
            failCallback();

            expect($.getJSON).toHaveBeenCalledWith('lang/en.json');
        });
    });

    describe('changeLanguage', () => {
        test('saves language preference to localStorage', () => {
            $.getJSON.mockReturnValue({
                then: jest.fn(() => ({ fail: jest.fn() }))
            });

            languageModule.changeLanguage('fr');

            expect(localStorage.setItem).toHaveBeenCalledWith('userLanguage', 'fr');
        });

        test('loads translations for selected language', () => {
            $.getJSON.mockReturnValue({
                then: jest.fn(() => ({ fail: jest.fn() }))
            });

            languageModule.changeLanguage('en');

            expect($.getJSON).toHaveBeenCalledWith('lang/en.json');
        });
    });

    describe('getNestedValue', () => {
        test('retrieves shallow nested value', () => {
            const obj = { test: 'value' };
            expect(languageModule.getNestedValue(obj, 'test')).toBe('value');
        });

        test('retrieves deeply nested value', () => {
            const obj = { level1: { level2: { level3: 'deep value' } } };
            expect(languageModule.getNestedValue(obj, 'level1.level2.level3')).toBe('deep value');
        });

        test('returns undefined for non-existent path', () => {
            const obj = { test: 'value' };
            expect(languageModule.getNestedValue(obj, 'nonexistent.path')).toBeUndefined();
        });

        test('handles empty object', () => {
            expect(languageModule.getNestedValue({}, 'test.path')).toBeUndefined();
        });

        test('handles null in path', () => {
            const obj = { test: null };
            // When accessing test.nested, it returns undefined because test is null
            const result = languageModule.getNestedValue(obj, 'test.nested');
            expect(result === undefined || result === null).toBe(true);
        });
    });

    describe('translatePlaceholders', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="container">
                    <input placeholder="labels.input" id="input1">
                    <textarea placeholder="labels.textarea" id="textarea1"></textarea>
                    <input placeholder="notranslation" id="input2">
                </div>
            `;
            
            // Set up translations
            window.setTranslations({
                labels: {
                    input: 'Translated Input',
                    textarea: 'Translated Textarea'
                }
            });
        });

        test('translates input placeholder', () => {
            const container = $('#container');
            languageModule.translatePlaceholders(container);
            
            expect($('#input1').attr('placeholder')).toBe('Translated Input');
        });

        test('translates textarea placeholder', () => {
            const container = $('#container');
            languageModule.translatePlaceholders(container);
            
            expect($('#textarea1').attr('placeholder')).toBe('Translated Textarea');
        });

        test('keeps original placeholder when no translation exists', () => {
            const container = $('#container');
            languageModule.translatePlaceholders(container);
            
            expect($('#input2').attr('placeholder')).toBe('notranslation');
        });

        test('handles empty container', () => {
            const emptyContainer = $('<div></div>');
            
            // Should not throw
            expect(() => {
                languageModule.translatePlaceholders(emptyContainer);
            }).not.toThrow();
        });
    });

    describe('dropdownsReady event listener', () => {
        beforeEach(() => {
            window.resizeTitle = jest.fn();
            window.adjustButtons = jest.fn();
        });

        afterEach(() => {
            delete window.resizeTitle;
            delete window.adjustButtons;
        });

        test('updates dropdown placeholders when translations are loaded', () => {
            document.body.innerHTML += `
                <select id="dropdown1">
                    <option value="" data-translate="general.choose">Choose...</option>
                    <option value="1">Option 1</option>
                </select>
                <select id="dropdown2">
                    <option value="" data-translate="general.choose">Choose...</option>
                    <option value="2">Option 2</option>
                </select>
            `;

            window.setTranslations({
                general: {
                    logoTitle: 'ELMO',
                    choose: 'Auswählen...'
                }
            });
            languageModule.applyTranslations();

            languageModule.handleDropdownsReady();

            expect($('#dropdown1 option[data-translate="general.choose"]').text()).toBe('Auswählen...');
            expect($('#dropdown2 option[data-translate="general.choose"]').text()).toBe('Auswählen...');
        });

        test('does nothing when translations are not loaded', () => {
            document.body.innerHTML += `
                <select id="dropdown3">
                    <option value="" data-translate="general.choose">Choose...</option>
                </select>
            `;

            window.setTranslations(null);

            languageModule.handleDropdownsReady();

            expect($('#dropdown3 option[data-translate="general.choose"]').text()).toBe('Choose...');
        });

        test('does nothing when translations.general is undefined', () => {
            document.body.innerHTML += `
                <select id="dropdown4">
                    <option value="" data-translate="general.choose">Choose...</option>
                </select>
            `;

            window.setTranslations({ other: { key: 'value' } });

            languageModule.handleDropdownsReady();

            expect($('#dropdown4 option[data-translate="general.choose"]').text()).toBe('Choose...');
        });

        test('does nothing when general.choose translation is missing', () => {
            document.body.innerHTML += `
                <select id="dropdown5">
                    <option value="" data-translate="general.choose">Choose...</option>
                </select>
            `;

            window.setTranslations({
                general: {
                    logoTitle: 'ELMO'
                    // 'choose' key is missing
                }
            });

            languageModule.handleDropdownsReady();

            expect($('#dropdown5 option[data-translate="general.choose"]').text()).toBe('Choose...');
        });

        test('only updates options with data-translate="general.choose" attribute', () => {
            document.body.innerHTML += `
                <select id="dropdown6">
                    <option value="" data-translate="general.choose">Choose...</option>
                    <option value="1">Regular Option</option>
                </select>
            `;

            window.setTranslations({
                general: {
                    logoTitle: 'ELMO',
                    choose: 'Auswählen...'
                }
            });
            languageModule.applyTranslations();

            languageModule.handleDropdownsReady();

            expect($('#dropdown6 option[data-translate="general.choose"]').text()).toBe('Auswählen...');
            expect($('#dropdown6 option[value="1"]').text()).toBe('Regular Option');
        });

        test('exports handleDropdownsReady function', () => {
            expect(typeof languageModule.handleDropdownsReady).toBe('function');
        });
    });
});
