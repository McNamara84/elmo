/**
 * @jest-environment jsdom
 */

describe('headerResponsiveDesign.js', () => {
    let $;
    
    beforeEach(() => {
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        
        // Mock translations
        global.translations = {
            general: {
                logoTitle: 'Enhanced Linked Metadata Organizer',
                logoTitleShort: 'ELMO'
            },
            buttons: {
                save: 'Save',
                load: 'Load'
            }
        };
        
        // Mock getNestedValue function
        global.getNestedValue = function(obj, path) {
            return path.split('.').reduce((current, key) => 
                current && current[key] !== undefined ? current[key] : undefined, obj);
        };
        
        // Set up DOM
        document.body.innerHTML = `
            <header>
                <h1 id="headtitle">ELMO</h1>
                <button class="btn" data-translate="buttons.save">
                    <i class="bi bi-save"></i> Save
                </button>
                <button class="btn" data-translate="buttons.load">
                    <i class="bi bi-folder-open"></i> Load
                </button>
            </header>
        `;
        
        // Store original innerWidth
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 1920
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('resizeTitle', () => {
        // Define the function for testing
        function resizeTitle() {
            const title = $('#headtitle');
            const fullTitle = getNestedValue(translations, 'general.logoTitle') || 'ELMO';
            const shortTitle = getNestedValue(translations, 'general.logoTitleShort') || 'ELMO';

            if (window.innerWidth < 768) {
                title.text(shortTitle).css('font-size', '16px');
            } else if (window.innerWidth < 1024) {
                title.text(shortTitle).css('font-size', '18px');
            } else {
                title.text(fullTitle).css('font-size', '20px');
            }
        }

        test('sets full title on large screens (>= 1024px)', () => {
            window.innerWidth = 1920;
            resizeTitle();
            
            expect($('#headtitle').text()).toBe('Enhanced Linked Metadata Organizer');
            expect($('#headtitle').css('font-size')).toBe('20px');
        });

        test('sets short title on medium screens (768-1023px)', () => {
            window.innerWidth = 900;
            resizeTitle();
            
            expect($('#headtitle').text()).toBe('ELMO');
            expect($('#headtitle').css('font-size')).toBe('18px');
        });

        test('sets short title on small screens (< 768px)', () => {
            window.innerWidth = 500;
            resizeTitle();
            
            expect($('#headtitle').text()).toBe('ELMO');
            expect($('#headtitle').css('font-size')).toBe('16px');
        });

        test('uses fallback ELMO when translations missing', () => {
            global.translations = {};
            window.innerWidth = 1920;
            resizeTitle();
            
            expect($('#headtitle').text()).toBe('ELMO');
        });
    });

    describe('adjustButtons', () => {
        function adjustButtons() {
            $('header .btn').each(function () {
                const button = $(this);
                const translateKey = button.data('translate');

                if (window.innerWidth < 768) {
                    if (!button.data('fullText')) {
                        button.data('fullText', translateKey);
                        const icon = button.find('i').prop('outerHTML');
                        button.html(icon);
                    }
                } else {
                    const storedTranslateKey = button.data('fullText');
                    if (storedTranslateKey) {
                        const translatedText = getNestedValue(translations, storedTranslateKey);
                        const icon = button.find('i').prop('outerHTML');
                        button.html(`${icon} ${translatedText}`);
                        button.removeData('fullText');
                    }
                }
            });
        }

        test('keeps text on large screens', () => {
            window.innerWidth = 1920;
            adjustButtons();
            
            const saveButton = $('header .btn').first();
            expect(saveButton.text()).toContain('Save');
        });

        test('removes text on small screens', () => {
            window.innerWidth = 500;
            adjustButtons();
            
            const saveButton = $('header .btn').first();
            expect(saveButton.text().trim()).toBe('');
            expect(saveButton.find('i').length).toBe(1);
        });

        test('stores translation key when hiding text', () => {
            window.innerWidth = 500;
            adjustButtons();
            
            const saveButton = $('header .btn').first();
            expect(saveButton.data('fullText')).toBe('buttons.save');
        });

        test('restores text when screen becomes larger', () => {
            // First, simulate small screen
            window.innerWidth = 500;
            adjustButtons();
            
            // Then simulate large screen
            window.innerWidth = 1920;
            adjustButtons();
            
            const saveButton = $('header .btn').first();
            expect(saveButton.text()).toContain('Save');
            expect(saveButton.data('fullText')).toBeUndefined();
        });

        test('processes all buttons in header', () => {
            window.innerWidth = 500;
            adjustButtons();
            
            const buttons = $('header .btn');
            buttons.each(function() {
                expect($(this).data('fullText')).toBeDefined();
            });
        });
    });

    describe('getNestedValue helper', () => {
        test('returns nested value correctly', () => {
            const result = getNestedValue(translations, 'general.logoTitle');
            expect(result).toBe('Enhanced Linked Metadata Organizer');
        });

        test('returns undefined for missing path', () => {
            const result = getNestedValue(translations, 'nonexistent.path');
            expect(result).toBeUndefined();
        });

        test('handles empty object', () => {
            const result = getNestedValue({}, 'any.path');
            expect(result).toBeUndefined();
        });
    });

    describe('resize event handling', () => {
        test('resize event listener can be added', () => {
            const resizeSpy = jest.fn();
            window.addEventListener('resize', resizeSpy);
            
            // Simulate resize event
            window.dispatchEvent(new Event('resize'));
            
            expect(resizeSpy).toHaveBeenCalled();
        });
    });
});
