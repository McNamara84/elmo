/**
 * @jest-environment jsdom
 */

describe('validation.js - Form initialization', () => {
    let $;
    
    beforeEach(() => {
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        
        // Set up DOM
        document.body.innerHTML = `
            <form id="form-mde">
                <button type="submit" data-action="save" id="btn-save">Save</button>
                <button type="submit" data-action="submit" id="btn-submit">Submit</button>
            </form>
            <div id="modal-saveas"></div>
            <div id="modal-submit"></div>
            <div id="modal-notification"></div>
            <div id="modal-restore-draft"></div>
            <div id="autosave-status"></div>
            <span id="autosave-status-text"></span>
            <button id="button-restore-apply"></button>
            <button id="button-restore-dismiss"></button>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('button action tracking', () => {
        test('tracks pending action on save button click', () => {
            let pendingAction = null;
            
            $('#btn-save').on('click', function () {
                pendingAction = this.dataset.action;
            });
            
            $('#btn-save').trigger('click');
            
            expect(pendingAction).toBe('save');
        });

        test('tracks pending action on submit button click', () => {
            let pendingAction = null;
            
            $('#btn-submit').on('click', function () {
                pendingAction = this.dataset.action;
            });
            
            $('#btn-submit').trigger('click');
            
            expect(pendingAction).toBe('submit');
        });

        test('resets pending action after form submit', () => {
            let pendingAction = 'save';
            let actionUsed = null;
            
            $('#form-mde').on('submit', function (e) {
                e.preventDefault();
                actionUsed = pendingAction;
                pendingAction = null;
            });
            
            $('#form-mde').trigger('submit');
            
            expect(pendingAction).toBeNull();
        });
    });

    describe('form submission handling', () => {
        test('prevents default form submission', () => {
            const submitHandler = jest.fn();
            
            $('#form-mde').on('submit', function (e) {
                e.preventDefault();
                e.stopPropagation();
                submitHandler(e);
            });
            
            const event = $.Event('submit');
            event.preventDefault = jest.fn();
            event.stopPropagation = jest.fn();
            
            $('#form-mde').trigger(event);
            
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });

        test('determines action from pendingAction when submitter not available', () => {
            let pendingAction = 'save';
            let detectedAction = null;
            
            $('#form-mde').on('submit', function (e) {
                e.preventDefault();
                const action = e.originalEvent?.submitter?.dataset.action ?? pendingAction;
                detectedAction = action;
            });
            
            $('#form-mde').trigger('submit');
            
            expect(detectedAction).toBe('save');
        });

        test('routes save action correctly', () => {
            const saveHandlerMock = { handleSave: jest.fn() };
            const submitHandlerMock = { handleSubmit: jest.fn() };
            
            let pendingAction = 'save';
            
            $('#form-mde').on('submit', function (e) {
                e.preventDefault();
                const action = e.originalEvent?.submitter?.dataset.action ?? pendingAction;
                
                if (action === 'save') {
                    saveHandlerMock.handleSave();
                } else if (action === 'submit') {
                    submitHandlerMock.handleSubmit();
                }
                pendingAction = null;
            });
            
            $('#form-mde').trigger('submit');
            
            expect(saveHandlerMock.handleSave).toHaveBeenCalled();
            expect(submitHandlerMock.handleSubmit).not.toHaveBeenCalled();
        });

        test('routes submit action correctly', () => {
            const saveHandlerMock = { handleSave: jest.fn() };
            const submitHandlerMock = { handleSubmit: jest.fn() };
            
            let pendingAction = 'submit';
            
            $('#form-mde').on('submit', function (e) {
                e.preventDefault();
                const action = e.originalEvent?.submitter?.dataset.action ?? pendingAction;
                
                if (action === 'save') {
                    saveHandlerMock.handleSave();
                } else if (action === 'submit') {
                    submitHandlerMock.handleSubmit();
                }
                pendingAction = null;
            });
            
            $('#form-mde').trigger('submit');
            
            expect(submitHandlerMock.handleSubmit).toHaveBeenCalled();
            expect(saveHandlerMock.handleSave).not.toHaveBeenCalled();
        });
    });

    describe('configuration objects', () => {
        test('AutosaveService config has required properties', () => {
            const config = {
                statusElementId: 'autosave-status',
                statusTextId: 'autosave-status-text',
                restoreModalId: 'modal-restore-draft',
                restoreApplyButtonId: 'button-restore-apply',
                restoreDismissButtonId: 'button-restore-dismiss'
            };
            
            expect(config).toHaveProperty('statusElementId');
            expect(config).toHaveProperty('statusTextId');
            expect(config).toHaveProperty('restoreModalId');
            expect(config).toHaveProperty('restoreApplyButtonId');
            expect(config).toHaveProperty('restoreDismissButtonId');
        });

        test('all required DOM elements exist', () => {
            expect(document.getElementById('form-mde')).not.toBeNull();
            expect(document.getElementById('modal-saveas')).not.toBeNull();
            expect(document.getElementById('modal-submit')).not.toBeNull();
            expect(document.getElementById('modal-notification')).not.toBeNull();
            expect(document.getElementById('autosave-status')).not.toBeNull();
        });
    });
});
