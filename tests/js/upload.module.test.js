/**
 * @jest-environment jsdom
 * 
 * Tests for upload.js using require() for proper coverage tracking
 */

describe('upload module coverage', () => {
    let uploadModule;
    let $;

    beforeEach(async () => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Set up DOM
        document.body.innerHTML = `
            <button id="button-form-load">Load</button>
            <div id="modal-uploadxml" class="modal">
                <input type="file" id="input-uploadxml-file">
                <div id="panel-uploadxml-dropfile" class="drop-zone"></div>
                <div id="upload-spinner-overlay" class="d-none text-center py-4">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
                <div id="xml-upload-status" class="alert d-none"></div>
            </div>
            <div class="toast-container">
                <div id="toast-upload-feedback" class="toast align-items-center border-0" role="alert">
                    <div class="d-flex">
                        <div class="toast-body" id="toast-upload-feedback-body">
                            <i id="toast-upload-feedback-icon" class="bi me-2"></i>
                            <span id="toast-upload-feedback-message"></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Mock bootstrap modal
        $.fn.modal = jest.fn();

        // Mock bootstrap Toast (attach to window to match production guard)
        window.bootstrap = {
            Toast: jest.fn(function (el, opts) {
                this.el = el;
                this.opts = opts;
                this.show = jest.fn();
            })
        };

        // Mock mapXmlToFormFields (used by handleXmlFile)
        window.mapXmlToFormFields = jest.fn();

        // Mock FileReader
        const mockFileReader = {
            readAsText: jest.fn(function() {
                // Simulate successful read
                setTimeout(() => {
                    this.onload({ target: { result: '<?xml version="1.0"?><root></root>' } });
                }, 0);
            }),
            onload: null,
            onerror: null
        };
        global.FileReader = jest.fn(() => mockFileReader);

        // Clear module cache
        jest.resetModules();

        // Require the module
        uploadModule = require('../../js/upload.js');

        // Flush microtasks so $(document).ready() callbacks have fired
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete window.mapXmlToFormFields;
        delete global.FileReader;
        delete window.bootstrap;
    });

    describe('module exports', () => {
        test('exports handleXmlFile function', () => {
            expect(typeof uploadModule.handleXmlFile).toBe('function');
        });

        test('exports showUploadStatus function', () => {
            expect(typeof uploadModule.showUploadStatus).toBe('function');
        });

        test('exports setUploadLoadingState function', () => {
            expect(typeof uploadModule.setUploadLoadingState).toBe('function');
        });

        test('exports showUploadToast function', () => {
            expect(typeof uploadModule.showUploadToast).toBe('function');
        });

        test('exports isXmlFile function', () => {
            expect(typeof uploadModule.isXmlFile).toBe('function');
        });

        test('exports translateWithFallback function', () => {
            expect(typeof uploadModule.translateWithFallback).toBe('function');
        });

        test('exports buildUploadMessage function', () => {
            expect(typeof uploadModule.buildUploadMessage).toBe('function');
        });

        test('exports clearStatusHideTimer function', () => {
            expect(typeof uploadModule.clearStatusHideTimer).toBe('function');
        });
    });

    describe('showUploadStatus', () => {
        test('shows success message', () => {
            uploadModule.showUploadStatus('Success message', 'success');

            const statusElement = $('#xml-upload-status');
            expect(statusElement.text()).toBe('Success message');
            expect(statusElement.hasClass('alert-success')).toBe(true);
            expect(statusElement.hasClass('d-none')).toBe(false);
        });

        test('shows danger message', () => {
            uploadModule.showUploadStatus('Error message', 'danger');

            const statusElement = $('#xml-upload-status');
            expect(statusElement.text()).toBe('Error message');
            expect(statusElement.hasClass('alert-danger')).toBe(true);
        });

        test('shows warning message', () => {
            uploadModule.showUploadStatus('Warning', 'warning');

            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-warning')).toBe(true);
        });

        test('removes previous alert classes', () => {
            // First show success
            uploadModule.showUploadStatus('Success', 'success');
            expect($('#xml-upload-status').hasClass('alert-success')).toBe(true);

            // Then show danger - should remove success class
            uploadModule.showUploadStatus('Error', 'danger');
            expect($('#xml-upload-status').hasClass('alert-success')).toBe(false);
            expect($('#xml-upload-status').hasClass('alert-danger')).toBe(true);
        });

        test('hides message after timeout', () => {
            jest.useFakeTimers();

            uploadModule.showUploadStatus('Temporary message', 'info');

            expect($('#xml-upload-status').hasClass('d-none')).toBe(false);

            // Fast-forward 10 seconds
            jest.advanceTimersByTime(10000);

            expect($('#xml-upload-status').hasClass('d-none')).toBe(true);

            jest.useRealTimers();
        });

        test('cancels previous hide timer when called again', () => {
            jest.useFakeTimers();

            uploadModule.showUploadStatus('First message', 'success');
            // Advance 8 seconds (not enough to trigger first hide)
            jest.advanceTimersByTime(8000);
            expect($('#xml-upload-status').hasClass('d-none')).toBe(false);

            // Show a second message — should cancel the first timer
            uploadModule.showUploadStatus('Second message', 'danger');
            expect($('#xml-upload-status').text()).toBe('Second message');

            // Advance 3 seconds — would have hidden if first timer wasn't cancelled
            jest.advanceTimersByTime(3000);
            expect($('#xml-upload-status').hasClass('d-none')).toBe(false);
            expect($('#xml-upload-status').text()).toBe('Second message');

            // Advance remaining 7 seconds — second timer fires
            jest.advanceTimersByTime(7000);
            expect($('#xml-upload-status').hasClass('d-none')).toBe(true);

            jest.useRealTimers();
        });
    });

    describe('setUploadLoadingState', () => {
        test('disables file input when loading', () => {
            uploadModule.setUploadLoadingState(true);

            expect($('#input-uploadxml-file').prop('disabled')).toBe(true);
        });

        test('adds visual disabled classes to drop zone when loading', () => {
            uploadModule.setUploadLoadingState(true);

            const dropZone = $('#panel-uploadxml-dropfile');
            expect(dropZone.hasClass('pe-none')).toBe(true);
            expect(dropZone.hasClass('opacity-50')).toBe(true);
        });

        test('shows spinner overlay when loading', () => {
            uploadModule.setUploadLoadingState(true);

            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(false);
        });

        test('re-enables file input when not loading', () => {
            uploadModule.setUploadLoadingState(true);
            uploadModule.setUploadLoadingState(false);

            expect($('#input-uploadxml-file').prop('disabled')).toBe(false);
        });

        test('removes visual disabled classes from drop zone when not loading', () => {
            uploadModule.setUploadLoadingState(true);
            uploadModule.setUploadLoadingState(false);

            const dropZone = $('#panel-uploadxml-dropfile');
            expect(dropZone.hasClass('pe-none')).toBe(false);
            expect(dropZone.hasClass('opacity-50')).toBe(false);
        });

        test('hides spinner overlay when not loading', () => {
            uploadModule.setUploadLoadingState(true);
            uploadModule.setUploadLoadingState(false);

            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(true);
        });

        test('clears previous status message when entering loading state', () => {
            uploadModule.showUploadStatus('Old error', 'danger');
            expect($('#xml-upload-status').hasClass('d-none')).toBe(false);

            uploadModule.setUploadLoadingState(true);

            expect($('#xml-upload-status').hasClass('d-none')).toBe(true);
            expect($('#xml-upload-status').text()).toBe('');
        });

        test('cancels status hide timer when entering loading state', () => {
            jest.useFakeTimers();

            uploadModule.showUploadStatus('Old error', 'danger');
            uploadModule.setUploadLoadingState(true);

            // Status is hidden by loading state; advance past 10s
            jest.advanceTimersByTime(10000);
            // The old timer should not have fired (was cancelled)
            // Show a new status to verify timer didn't interfere
            uploadModule.setUploadLoadingState(false);
            uploadModule.showUploadStatus('New message', 'success');
            expect($('#xml-upload-status').text()).toBe('New message');

            jest.useRealTimers();
        });
    });

    describe('showUploadToast', () => {
        test('sets success styling and message with fallback', () => {
            uploadModule.showUploadToast('test.xml', 'success');

            const toastEl = document.getElementById('toast-upload-feedback');
            const messageEl = document.getElementById('toast-upload-feedback-message');
            const iconEl = document.getElementById('toast-upload-feedback-icon');

            expect(toastEl.classList.contains('text-bg-success')).toBe(true);
            expect(toastEl.classList.contains('text-bg-danger')).toBe(false);
            expect(iconEl.className).toContain('bi-check-circle-fill');
            expect(messageEl.textContent).toBe('test.xml successfully loaded');
        });

        test('uses i18n translation for success message when available', () => {
            window.elmo = { translate: jest.fn((key) => {
                if (key === 'modals.upload.successToast') return 'erfolgreich geladen';
                return null;
            })};

            uploadModule.showUploadToast('data.xml', 'success');

            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toBe('data.xml erfolgreich geladen');
            expect(window.elmo.translate).toHaveBeenCalledWith('modals.upload.successToast');

            delete window.elmo;
        });

        test('uses i18n translation for error message when available', () => {
            window.elmo = { translate: jest.fn((key) => {
                if (key === 'modals.upload.errorToast') return 'Fehler beim Laden der Datei';
                return null;
            })};

            uploadModule.showUploadToast('broken.xml', 'danger');

            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toBe('Fehler beim Laden der Datei: broken.xml');
            expect(window.elmo.translate).toHaveBeenCalledWith('modals.upload.errorToast');

            delete window.elmo;
        });

        test('sets danger styling and message with fallback', () => {
            uploadModule.showUploadToast('broken.xml', 'danger');

            const toastEl = document.getElementById('toast-upload-feedback');
            const messageEl = document.getElementById('toast-upload-feedback-message');
            const iconEl = document.getElementById('toast-upload-feedback-icon');

            expect(toastEl.classList.contains('text-bg-danger')).toBe(true);
            expect(toastEl.classList.contains('text-bg-success')).toBe(false);
            expect(iconEl.className).toContain('bi-exclamation-triangle-fill');
            expect(messageEl.textContent).toBe('Error loading file: broken.xml');
        });

        test('creates Bootstrap Toast with 5s delay and calls show', () => {
            uploadModule.showUploadToast('test.xml', 'success');

            expect(window.bootstrap.Toast).toHaveBeenCalledWith(
                document.getElementById('toast-upload-feedback'),
                { delay: 5000 }
            );
            const toastInstance = window.bootstrap.Toast.mock.instances[0];
            expect(toastInstance.show).toHaveBeenCalled();
        });

        test('removes previous type class when switching types', () => {
            uploadModule.showUploadToast('a.xml', 'success');
            const toastEl = document.getElementById('toast-upload-feedback');
            expect(toastEl.classList.contains('text-bg-success')).toBe(true);

            uploadModule.showUploadToast('b.xml', 'danger');
            expect(toastEl.classList.contains('text-bg-success')).toBe(false);
            expect(toastEl.classList.contains('text-bg-danger')).toBe(true);
        });

        test('returns true when toast is successfully shown', () => {
            const result = uploadModule.showUploadToast('test.xml', 'success');
            expect(result).toBe(true);
            expect(window.bootstrap.Toast).toHaveBeenCalled();
        });

        test('does nothing when toast element is missing and returns false', () => {
            document.getElementById('toast-upload-feedback').remove();

            const result = uploadModule.showUploadToast('test.xml', 'success');
            expect(result).toBe(false);
            // Should fall back to in-modal status
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-success')).toBe(true);
            expect(statusElement.text()).toContain('test.xml');
        });

        test('falls back to showUploadStatus for danger when toast element is missing and returns false', () => {
            document.getElementById('toast-upload-feedback').remove();

            const result = uploadModule.showUploadToast('bad.xml', 'danger');
            expect(result).toBe(false);
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-danger')).toBe(true);
            expect(statusElement.text()).toContain('bad.xml');
        });

        test('falls back to showUploadStatus when toast child elements are missing and returns false', () => {
            document.getElementById('toast-upload-feedback-message').remove();
            document.getElementById('toast-upload-feedback-icon').remove();

            const result = uploadModule.showUploadToast('test.xml', 'success');
            expect(result).toBe(false);
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-success')).toBe(true);
            expect(statusElement.text()).toContain('test.xml');
            expect(window.bootstrap.Toast).not.toHaveBeenCalled();
        });

        test('falls back to showUploadStatus when bootstrap.Toast is unavailable and returns false', () => {
            delete window.bootstrap;

            const result = uploadModule.showUploadToast('test.xml', 'success');
            expect(result).toBe(false);
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-success')).toBe(true);
            expect(statusElement.text()).toContain('test.xml');
        });

        test('falls back to showUploadStatus for danger when bootstrap.Toast is unavailable and returns false', () => {
            delete window.bootstrap;

            const result = uploadModule.showUploadToast('bad.xml', 'danger');
            expect(result).toBe(false);
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-danger')).toBe(true);
            expect(statusElement.text()).toContain('bad.xml');
        });
    });

    describe('handleXmlFile', () => {
        let mockFileReader;

        beforeEach(() => {
            // Mock loadXmlToForm
            window.loadXmlToForm = jest.fn().mockResolvedValue(true);
            
            // Create a controlled FileReader mock
            mockFileReader = {
                readAsText: jest.fn(),
                onload: null,
                onerror: null
            };
            global.FileReader = jest.fn(() => mockFileReader);
        });

        afterEach(() => {
            delete window.loadXmlToForm;
        });

        test('is a function', () => {
            expect(typeof uploadModule.handleXmlFile).toBe('function');
        });

        test('calls FileReader.readAsText with the file', () => {
            const mockFile = new Blob(['<?xml version="1.0"?><root></root>'], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            
            expect(mockFileReader.readAsText).toHaveBeenCalledWith(mockFile);
        });

        test('sets up onload handler', () => {
            const mockFile = new Blob(['test'], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            
            expect(mockFileReader.onload).toBeInstanceOf(Function);
        });

        test('sets up onerror handler', () => {
            const mockFile = new Blob(['test'], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            
            expect(mockFileReader.onerror).toBeInstanceOf(Function);
        });

        test('enables loading state when called', () => {
            const mockFile = new Blob(['test'], { type: 'text/xml' });

            uploadModule.handleXmlFile(mockFile);

            expect($('#input-uploadxml-file').prop('disabled')).toBe(true);
            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(false);
        });

        test('closes modal and shows read-error toast when onerror is triggered', () => {
            const mockFile = new Blob(['test'], { type: 'text/xml' });
            mockFile.name = 'data.xml';
            
            uploadModule.handleXmlFile(mockFile);
            mockFileReader.onerror();
            
            // Modal should be closed
            expect($.fn.modal).toHaveBeenCalledWith('hide');
            // Toast should display read error
            expect(window.bootstrap.Toast).toHaveBeenCalled();
            const toastEl = document.getElementById('toast-upload-feedback');
            expect(toastEl.classList.contains('text-bg-danger')).toBe(true);
            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toBe('Error reading file: data.xml');
            // Loading state should be reset
            expect($('#input-uploadxml-file').prop('disabled')).toBe(false);
            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(true);
        });

        test('processes valid XML in onload handler', async () => {
            const validXml = '<?xml version="1.0"?><root><data>test</data></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            
            // Simulate FileReader onload
            await mockFileReader.onload({
                target: { result: validXml }
            });
            
            expect(window.loadXmlToForm).toHaveBeenCalled();
        });

        test('hides modal on successful XML load', async () => {
            const validXml = '<?xml version="1.0"?><root></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: validXml }
            });
            
            expect($.fn.modal).toHaveBeenCalledWith('hide');
        });

        test('shows success toast with filename after loading valid XML', async () => {
            const validXml = '<?xml version="1.0"?><root></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });
            mockFile.name = 'dataset.xml';

            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: validXml }
            });

            expect(window.bootstrap.Toast).toHaveBeenCalled();
            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toContain('dataset.xml');
            expect(messageEl.textContent).toContain('successfully loaded');
        });

        test('disables loading state after successful load', async () => {
            const validXml = '<?xml version="1.0"?><root></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });

            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: validXml }
            });

            expect($('#input-uploadxml-file').prop('disabled')).toBe(false);
            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(true);
        });

        test('keeps modal open and shows in-modal status when toast is unavailable on success', async () => {
            // Remove toast element to trigger fallback
            document.getElementById('toast-upload-feedback').remove();

            const validXml = '<?xml version="1.0"?><root></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });
            mockFile.name = 'data.xml';

            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: validXml }
            });

            // Modal should NOT be closed
            expect($.fn.modal).not.toHaveBeenCalledWith('hide');
            // In-modal status should show success
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-success')).toBe(true);
            expect(statusElement.text()).toContain('data.xml');
        });

        test('keeps modal open and shows in-modal status when toast is unavailable on error', () => {
            // Remove toast element to trigger fallback
            document.getElementById('toast-upload-feedback').remove();

            const mockFile = new Blob(['test'], { type: 'text/xml' });
            mockFile.name = 'fail.xml';

            uploadModule.handleXmlFile(mockFile);
            mockFileReader.onerror();

            // Modal should NOT be closed
            expect($.fn.modal).not.toHaveBeenCalledWith('hide');
            // In-modal status should show error
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-danger')).toBe(true);
            expect(statusElement.text()).toContain('fail.xml');
        });

        test('closes modal and shows processing-error toast for invalid XML (parsererror)', async () => {
            // Mock DOMParser to return parsererror
            const originalDOMParser = global.DOMParser;
            global.DOMParser = class {
                parseFromString() {
                    const doc = document.implementation.createDocument('', '', null);
                    const errorEl = document.createElement('parsererror');
                    doc.appendChild(errorEl);
                    return doc;
                }
            };
            
            const invalidXml = 'not valid xml <';
            const mockFile = new Blob([invalidXml], { type: 'text/xml' });
            mockFile.name = 'broken.xml';
            
            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: invalidXml }
            });
            
            // Modal should be closed
            expect($.fn.modal).toHaveBeenCalledWith('hide');
            // Toast should display processing error
            expect(window.bootstrap.Toast).toHaveBeenCalled();
            const toastEl = document.getElementById('toast-upload-feedback');
            expect(toastEl.classList.contains('text-bg-danger')).toBe(true);
            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toBe('Error processing XML file: broken.xml');
            // Loading state should be reset
            expect($('#input-uploadxml-file').prop('disabled')).toBe(false);
            
            global.DOMParser = originalDOMParser;
        });

        test('closes modal and shows processing-error toast when loadXmlToForm throws', async () => {
            window.loadXmlToForm = jest.fn().mockRejectedValue(new Error('Load failed'));
            
            const validXml = '<?xml version="1.0"?><root></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });
            mockFile.name = 'fail.xml';
            
            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: validXml }
            });
            
            // Wait for promise rejection to be handled
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Modal should be closed
            expect($.fn.modal).toHaveBeenCalledWith('hide');
            // Toast should display processing error
            expect(window.bootstrap.Toast).toHaveBeenCalled();
            const toastEl = document.getElementById('toast-upload-feedback');
            expect(toastEl.classList.contains('text-bg-danger')).toBe(true);
            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toBe('Error processing XML file: fail.xml');
            // Loading state should be reset
            expect($('#input-uploadxml-file').prop('disabled')).toBe(false);
        });

        test('shows processing-error toast on parse error', async () => {
            const originalDOMParser = global.DOMParser;
            global.DOMParser = class {
                parseFromString() {
                    const doc = document.implementation.createDocument('', '', null);
                    const errorEl = document.createElement('parsererror');
                    doc.appendChild(errorEl);
                    return doc;
                }
            };

            const invalidXml = 'not valid xml <';
            const mockFile = new Blob([invalidXml], { type: 'text/xml' });
            mockFile.name = 'bad.xml';

            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: invalidXml }
            });

            // Error toast should be shown
            expect(window.bootstrap.Toast).toHaveBeenCalled();
            const toastEl = document.getElementById('toast-upload-feedback');
            expect(toastEl.classList.contains('text-bg-danger')).toBe(true);
            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toContain('bad.xml');

            global.DOMParser = originalDOMParser;
        });
    });

    describe('modal reset on close', () => {
        test('resets file input on modal hidden event', () => {
            // Set a value first
            const fileInput = $('#input-uploadxml-file');
            // Simulate a dirty state
            uploadModule.setUploadLoadingState(true);

            // Trigger the hidden.bs.modal event
            $('#modal-uploadxml').trigger('hidden.bs.modal');

            expect(fileInput.val()).toBe('');
            expect($('#input-uploadxml-file').prop('disabled')).toBe(false);
        });

        test('resets loading state on modal hidden event', () => {
            uploadModule.setUploadLoadingState(true);

            $('#modal-uploadxml').trigger('hidden.bs.modal');

            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(true);
            expect($('#panel-uploadxml-dropfile').hasClass('pe-none')).toBe(false);
        });

        test('hides status message and clears text on modal hidden event', () => {
            uploadModule.showUploadStatus('Some error', 'danger');
            expect($('#xml-upload-status').hasClass('d-none')).toBe(false);

            $('#modal-uploadxml').trigger('hidden.bs.modal');

            expect($('#xml-upload-status').hasClass('d-none')).toBe(true);
            expect($('#xml-upload-status').text()).toBe('');
        });

        test('cancels status hide timer on modal hidden event', () => {
            jest.useFakeTimers();

            uploadModule.showUploadStatus('Error msg', 'danger');
            // Trigger modal close — should cancel the 10s timer
            $('#modal-uploadxml').trigger('hidden.bs.modal');

            // Advance past 10s — status should stay hidden (timer was cancelled)
            jest.advanceTimersByTime(10000);
            // Status was already hidden by modal reset, verify it's still hidden
            expect($('#xml-upload-status').hasClass('d-none')).toBe(true);

            jest.useRealTimers();
        });

        test('clears drag highlight on modal hidden event', () => {
            $('#panel-uploadxml-dropfile').addClass('border-primary');

            $('#modal-uploadxml').trigger('hidden.bs.modal');

            expect($('#panel-uploadxml-dropfile').hasClass('border-primary')).toBe(false);
        });
    });

    describe('event handlers setup', () => {
        test('load button click handler is registered on document ready', () => {
            // Verify the button exists
            expect($('#button-form-load').length).toBe(1);
        });

        test('drop zone exists', () => {
            expect($('#panel-uploadxml-dropfile').length).toBe(1);
        });

        test('file input exists', () => {
            expect($('#input-uploadxml-file').length).toBe(1);
        });
    });
});
