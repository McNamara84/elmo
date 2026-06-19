/**
 * @jest-environment jsdom
 * 
 * Tests for headerResponsiveDesign.js using require() for proper coverage tracking
 */

describe('headerResponsiveDesign module coverage', () => {
    let headerModule;
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
            <header>
                <h1 id="headtitle">ELMO - Enhanced Linked Metadata Organizer</h1>
                <button class="btn" data-translate="general.save">
                    <i class="bi bi-save"></i> Save
                </button>
                <button class="btn" data-translate="general.submit">
                    <i class="bi bi-send"></i> Submit
                </button>
            </header>
        `;

        // Mock translations
        global.translations = {
            general: {
                logoTitle: 'ELMO - Enhanced Linked Metadata Organizer',
                logoTitleShort: 'ELMO',
                save: 'Save',
                submit: 'Submit'
            }
        };

        // Mock getNestedValue function
        global.getNestedValue = jest.fn((obj, path) => {
            const keys = path.split('.');
            let value = obj;
            for (const key of keys) {
                if (value && typeof value === 'object') {
                    value = value[key];
                } else {
                    return undefined;
                }
            }
            return value;
        });

        // Clear module cache
        jest.resetModules();

        // Require the module
        headerModule = require('../../js/headerResponsiveDesign.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete global.translations;
        delete global.getNestedValue;
    });

    describe('module exports', () => {
        test('exports resizeTitle function', () => {
            expect(typeof headerModule.resizeTitle).toBe('function');
        });

        test('exports adjustButtons function', () => {
            expect(typeof headerModule.adjustButtons).toBe('function');
        });
    });

    describe('resizeTitle', () => {
        test('shows short title on mobile (< 768px)', () => {
            // Mock window width
            Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
            
            headerModule.resizeTitle();
            
            const title = document.getElementById('headtitle');
            expect(title.textContent).toBe('ELMO');
            expect(title.style.fontSize).toBe('16px');
        });

        test('shows short title on tablet (768-1024px)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
            
            headerModule.resizeTitle();
            
            const title = document.getElementById('headtitle');
            expect(title.textContent).toBe('ELMO');
            expect(title.style.fontSize).toBe('18px');
        });

        test('shows full title on desktop (>= 1024px)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
            
            headerModule.resizeTitle();
            
            const title = document.getElementById('headtitle');
            expect(title.textContent).toBe('ELMO - Enhanced Linked Metadata Organizer');
            expect(title.style.fontSize).toBe('20px');
        });

        test('uses default title when translation missing', () => {
            global.getNestedValue = jest.fn(() => undefined);
            Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
            
            headerModule.resizeTitle();
            
            const title = document.getElementById('headtitle');
            expect(title.textContent).toBe('ELMO');
        });
    });

    describe('adjustButtons', () => {
        test('shows only icons on mobile (< 768px)', () => {
            Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
            
            headerModule.adjustButtons();
            
            const buttons = document.querySelectorAll('header .btn');
            buttons.forEach(btn => {
                // Should only contain icon, no text
                expect(btn.innerHTML).toContain('<i class="bi');
                expect(btn.innerHTML).not.toContain('Save');
            });
        });

        test('shows text with icons on desktop (>= 768px)', () => {
            // First go to mobile to store the text
            Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
            headerModule.adjustButtons();
            
            // Then go to desktop
            Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
            headerModule.adjustButtons();
            
            const buttons = document.querySelectorAll('header .btn');
            buttons.forEach(btn => {
                // Should contain icon
                expect(btn.innerHTML).toContain('<i class="bi');
            });
        });

        test('handles missing translations gracefully', () => {
            global.getNestedValue = jest.fn(() => undefined);
            Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
            
            expect(() => {
                headerModule.adjustButtons();
            }).not.toThrow();
        });
    });
});
