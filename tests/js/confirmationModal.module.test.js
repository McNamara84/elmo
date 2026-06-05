/**
 * @jest-environment jsdom
 * 
 * Tests for confirmationModal.js using require() for proper coverage tracking
 */

describe('confirmationModal module coverage', () => {
    let confirmationModalModule;
    let mockModal;

    beforeEach(() => {
        // Set up DOM
        document.body.innerHTML = `
            <div id="modal-confirm" class="modal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modal-confirm-label">Title</h5>
                        </div>
                        <div class="modal-body" id="modal-confirm-description">Body</div>
                        <div class="modal-footer">
                            <button id="button-confirm-cancel">Cancel</button>
                            <button id="button-confirm-action">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Mock Bootstrap Modal
        mockModal = {
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        };

        global.bootstrap = {
            Modal: jest.fn().mockImplementation(() => mockModal)
        };
        
        // Add getInstance static method
        global.bootstrap.Modal.getInstance = jest.fn().mockReturnValue(null);

        // Mock translations
        global.translations = {
            confirmations: {
                clear: {
                    title: 'Clear Form',
                    message: 'Are you sure you want to clear the form?',
                    cancel: 'Cancel',
                    confirm: 'Clear'
                },
                submit: {
                    title: 'Submit Form',
                    message: 'Are you sure you want to submit?',
                    cancel: 'Cancel',
                    confirm: 'Submit'
                }
            }
        };

        // Clear module cache
        jest.resetModules();

        // Require the module
        confirmationModalModule = require('../../js/eventhandlers/confirmationModal.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.bootstrap;
        delete global.translations;
        delete window.elmo;
        delete window.showConfirmationModal;
    });

    describe('module exports', () => {
        test('exports showConfirmationModal function', () => {
            expect(typeof confirmationModalModule.showConfirmationModal).toBe('function');
        });

        test('makes function available on window', () => {
            expect(typeof window.showConfirmationModal).toBe('function');
        });
    });

    describe('showConfirmationModal', () => {
        test('shows modal with translated title', () => {
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'confirmations.clear.title',
                'confirmations.clear.message',
                'confirmations.clear.cancel',
                'confirmations.clear.confirm',
                onConfirm
            );

            expect(mockModal.show).toHaveBeenCalled();
            expect(document.getElementById('modal-confirm-label').textContent).toBe('Clear Form');
        });

        test('shows modal with translated message', () => {
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'confirmations.clear.title',
                'confirmations.clear.message',
                'confirmations.clear.cancel',
                'confirmations.clear.confirm',
                onConfirm
            );

            expect(document.getElementById('modal-confirm-description').textContent).toBe('Are you sure you want to clear the form?');
        });

        test('sets cancel button text', () => {
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'confirmations.clear.title',
                'confirmations.clear.message',
                'confirmations.clear.cancel',
                'confirmations.clear.confirm',
                onConfirm
            );

            expect(document.getElementById('button-confirm-cancel').textContent).toBe('Cancel');
        });

        test('sets confirm button text', () => {
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'confirmations.clear.title',
                'confirmations.clear.message',
                'confirmations.clear.cancel',
                'confirmations.clear.confirm',
                onConfirm
            );

            expect(document.getElementById('button-confirm-action').textContent).toBe('Clear');
        });

        test('calls onConfirm callback when confirm button clicked', () => {
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'confirmations.clear.title',
                'confirmations.clear.message',
                'confirmations.clear.cancel',
                'confirmations.clear.confirm',
                onConfirm
            );

            // Click confirm button
            document.getElementById('button-confirm-action').click();

            expect(onConfirm).toHaveBeenCalled();
            expect(mockModal.hide).toHaveBeenCalled();
        });

        test('hides modal when cancel button clicked', () => {
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'confirmations.clear.title',
                'confirmations.clear.message',
                'confirmations.clear.cancel',
                'confirmations.clear.confirm',
                onConfirm
            );

            // Click cancel button
            document.getElementById('button-confirm-cancel').click();

            expect(onConfirm).not.toHaveBeenCalled();
            expect(mockModal.hide).toHaveBeenCalled();
        });

        test('falls back to key if translation not found', () => {
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'nonexistent.key',
                'another.missing.key',
                'cancel.missing',
                'confirm.missing',
                onConfirm
            );

            expect(document.getElementById('modal-confirm-label').textContent).toBe('nonexistent.key');
        });

        test('uses window.elmo.translations if available', () => {
            window.elmo = {
                translations: {
                    test: {
                        title: 'Elmo Title'
                    }
                }
            };
            
            const onConfirm = jest.fn();
            
            confirmationModalModule.showConfirmationModal(
                'test.title',
                'test.message',
                'test.cancel',
                'test.confirm',
                onConfirm
            );

            expect(document.getElementById('modal-confirm-label').textContent).toBe('Elmo Title');
        });

        test('returns early if modal element not found', () => {
            document.body.innerHTML = '';
            
            const onConfirm = jest.fn();
            
            expect(() => {
                confirmationModalModule.showConfirmationModal(
                    'confirmations.clear.title',
                    'confirmations.clear.message',
                    'confirmations.clear.cancel',
                    'confirmations.clear.confirm',
                    onConfirm
                );
            }).not.toThrow();
            
            expect(mockModal.show).not.toHaveBeenCalled();
        });

        test('handles non-function onConfirm gracefully', () => {
            confirmationModalModule.showConfirmationModal(
                'confirmations.clear.title',
                'confirmations.clear.message',
                'confirmations.clear.cancel',
                'confirmations.clear.confirm',
                null
            );

            // Click confirm button - should not throw
            expect(() => {
                document.getElementById('button-confirm-action').click();
            }).not.toThrow();
        });
    });
});
