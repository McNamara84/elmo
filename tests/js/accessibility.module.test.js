/**
 * @jest-environment jsdom
 * 
 * Tests for accessibility.js using require() for proper coverage tracking
 */

describe('accessibility module coverage', () => {
    let accessibility;

    beforeEach(() => {
        // Reset document
        document.body.innerHTML = `
            <main id="main-content">
                <div class="form-group">
                    <label for="test-input">Test Label</label>
                    <input type="text" id="test-input" placeholder="Enter value">
                    <div class="invalid-feedback">This field is required</div>
                    <div class="valid-feedback">Looks good!</div>
                    <div class="form-text">Helper text here</div>
                </div>
                <div class="tagify-wrapper">
                    <input type="text" id="tagify-input" required aria-describedby="existing-desc">
                    <div class="tagify__scope">
                        <span class="tagify__input" contenteditable="true"></span>
                    </div>
                </div>
                <div id="existing-desc">Existing description</div>
            </main>
        `;

        // Clear module cache
        jest.resetModules();

        // Delete any previous window exports
        delete window.applyTagifyAccessibilityAttributes;
        delete window.getTooltipContainer;

        // Require the module - this sets up window exports
        accessibility = require('../../js/accessibility.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete window.applyTagifyAccessibilityAttributes;
        delete window.getTooltipContainer;
    });

    describe('module exports', () => {
        test('exports applyTagifyAccessibilityAttributes function', () => {
            expect(typeof accessibility.applyTagifyAccessibilityAttributes).toBe('function');
        });

        test('exports getTooltipContainer function', () => {
            expect(typeof accessibility.getTooltipContainer).toBe('function');
        });

        test('sets applyTagifyAccessibilityAttributes on window', () => {
            expect(typeof window.applyTagifyAccessibilityAttributes).toBe('function');
        });

        test('sets getTooltipContainer on window', () => {
            expect(typeof window.getTooltipContainer).toBe('function');
        });
    });

    describe('getTooltipContainer', () => {
        test('returns main-content element when present', () => {
            const container = accessibility.getTooltipContainer();
            expect(container.id).toBe('main-content');
        });

        test('returns main element when main-content is missing', () => {
            document.getElementById('main-content').removeAttribute('id');
            const container = accessibility.getTooltipContainer();
            expect(container.tagName.toLowerCase()).toBe('main');
        });

        test('returns document.body when no main element exists', () => {
            document.body.innerHTML = '<div>No main element</div>';
            // Re-require the module to get fresh functions
            jest.resetModules();
            delete window.applyTagifyAccessibilityAttributes;
            delete window.getTooltipContainer;
            accessibility = require('../../js/accessibility.js');
            
            const container = accessibility.getTooltipContainer();
            expect(container).toBe(document.body);
        });
    });

    describe('applyTagifyAccessibilityAttributes', () => {
        test('does nothing when tagifyInstance is null', () => {
            expect(() => {
                accessibility.applyTagifyAccessibilityAttributes(null, document.getElementById('test-input'));
            }).not.toThrow();
        });

        test('does nothing when inputElement is null', () => {
            const mockTagify = { DOM: { scope: document.createElement('div') } };
            expect(() => {
                accessibility.applyTagifyAccessibilityAttributes(mockTagify, null);
            }).not.toThrow();
        });

        test('applies attributes to tagify interactive input', () => {
            const inputElement = document.getElementById('test-input');
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            interactiveInput.setAttribute('contenteditable', 'true');
            scope.appendChild(interactiveInput);
            
            const mockTagify = {
                DOM: { scope },
                settings: { placeholder: 'Test placeholder' }
            };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement, {
                placeholder: 'Custom placeholder'
            });

            expect(interactiveInput.getAttribute('role')).toBe('textbox');
            expect(interactiveInput.getAttribute('aria-multiline')).toBe('false');
            expect(interactiveInput.getAttribute('aria-autocomplete')).toBe('list');
            expect(interactiveInput.getAttribute('aria-haspopup')).toBe('listbox');
        });

        test('sets aria-required when input has required attribute', () => {
            const inputElement = document.getElementById('tagify-input');
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            scope.appendChild(interactiveInput);
            
            const mockTagify = { DOM: { scope } };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement);

            expect(interactiveInput.getAttribute('aria-required')).toBe('true');
        });

        test('removes aria-required when options.isRequired is false', () => {
            const inputElement = document.getElementById('tagify-input');
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            interactiveInput.setAttribute('aria-required', 'true');
            scope.appendChild(interactiveInput);
            
            const mockTagify = { DOM: { scope } };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement, {
                isRequired: false
            });

            expect(interactiveInput.getAttribute('aria-required')).toBeNull();
        });

        test('sets aria-labelledby when label exists', () => {
            const inputElement = document.getElementById('test-input');
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            scope.appendChild(interactiveInput);
            
            const mockTagify = { DOM: { scope } };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement);

            expect(interactiveInput.getAttribute('aria-labelledby')).toBeTruthy();
        });

        test('sets aria-label when no label exists', () => {
            const inputElement = document.createElement('input');
            inputElement.setAttribute('placeholder', 'Placeholder text');
            document.body.appendChild(inputElement);
            
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            scope.appendChild(interactiveInput);
            
            const mockTagify = {
                DOM: { scope },
                settings: { placeholder: 'Settings placeholder' }
            };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement, {
                placeholder: 'Options placeholder'
            });

            // Should use one of the placeholder values as aria-label
            const ariaLabel = interactiveInput.getAttribute('aria-label');
            expect(ariaLabel).toBe('Options placeholder');
        });

        test('sets data-placeholder attribute', () => {
            const inputElement = document.createElement('input');
            document.body.appendChild(inputElement);
            
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            scope.appendChild(interactiveInput);
            
            const mockTagify = { DOM: { scope } };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement, {
                placeholder: 'Test placeholder'
            });

            expect(interactiveInput.getAttribute('data-placeholder')).toBe('Test placeholder');
        });

        test('collects aria-describedby from existing attribute', () => {
            const inputElement = document.getElementById('tagify-input');
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            scope.appendChild(interactiveInput);
            
            const mockTagify = { DOM: { scope } };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement);

            const describedBy = interactiveInput.getAttribute('aria-describedby');
            expect(describedBy).toContain('existing-desc');
        });

        test('adds describedByIds from options', () => {
            const inputElement = document.createElement('input');
            document.body.appendChild(inputElement);
            
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            scope.appendChild(interactiveInput);
            
            const mockTagify = { DOM: { scope } };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement, {
                describedByIds: ['custom-desc-1', 'custom-desc-2']
            });

            const describedBy = interactiveInput.getAttribute('aria-describedby');
            expect(describedBy).toContain('custom-desc-1');
            expect(describedBy).toContain('custom-desc-2');
        });

        test('generates ids for feedback elements without ids', () => {
            const inputElement = document.createElement('input');
            const scope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.textContent = 'Error message';
            scope.appendChild(interactiveInput);
            scope.appendChild(feedback);
            document.body.appendChild(inputElement);
            
            const mockTagify = { DOM: { scope } };

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement);

            // Feedback element should now have an id
            expect(feedback.id).toMatch(/^tagify-feedback-\d+$/);
        });

        test('uses existing input parentElement as scope when DOM.scope is missing', () => {
            const inputElement = document.createElement('input');
            const parentScope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            parentScope.appendChild(inputElement);
            parentScope.appendChild(interactiveInput);
            document.body.appendChild(parentScope);
            
            const mockTagify = { DOM: {} }; // No scope property

            accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement, {
                placeholder: 'Test'
            });

            expect(interactiveInput.getAttribute('role')).toBe('textbox');
        });

        test('handles tagify with null DOM property', () => {
            const inputElement = document.createElement('input');
            const parentScope = document.createElement('div');
            const interactiveInput = document.createElement('span');
            interactiveInput.className = 'tagify__input';
            parentScope.appendChild(inputElement);
            parentScope.appendChild(interactiveInput);
            document.body.appendChild(parentScope);
            
            const mockTagify = {}; // No DOM property

            expect(() => {
                accessibility.applyTagifyAccessibilityAttributes(mockTagify, inputElement);
            }).not.toThrow();
        });
    });
});
