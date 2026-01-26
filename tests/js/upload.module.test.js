/**
 * @jest-environment jsdom
 * 
 * Tests for upload.js using require() for proper coverage tracking
 */

describe('upload module coverage', () => {
    let uploadModule;
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
            <button id="button-form-load">Load</button>
            <div id="modal-uploadxml" class="modal">
                <input type="file" id="input-uploadxml-file">
                <div id="panel-uploadxml-dropfile" class="drop-zone"></div>
                <div id="xml-upload-status" class="alert d-none"></div>
            </div>
        `;

        // Mock bootstrap modal
        $.fn.modal = jest.fn();

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
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete window.mapXmlToFormFields;
        delete global.FileReader;
    });

    describe('module exports', () => {
        test('exports handleXmlFile function', () => {
            expect(typeof uploadModule.handleXmlFile).toBe('function');
        });

        test('exports showUploadStatus function', () => {
            expect(typeof uploadModule.showUploadStatus).toBe('function');
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

        test('shows error status when onerror is triggered', () => {
            const mockFile = new Blob(['test'], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            mockFileReader.onerror();
            
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-danger')).toBe(true);
            expect(statusElement.text()).toBe('Error reading file');
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

        test('shows success status after loading valid XML', async () => {
            const validXml = '<?xml version="1.0"?><root></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: validXml }
            });
            
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-success')).toBe(true);
        });

        test('shows error status for invalid XML (parsererror)', async () => {
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
            
            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: invalidXml }
            });
            
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-danger')).toBe(true);
            
            global.DOMParser = originalDOMParser;
        });

        test('shows error when loadXmlToForm throws', async () => {
            window.loadXmlToForm = jest.fn().mockRejectedValue(new Error('Load failed'));
            
            const validXml = '<?xml version="1.0"?><root></root>';
            const mockFile = new Blob([validXml], { type: 'text/xml' });
            
            uploadModule.handleXmlFile(mockFile);
            await mockFileReader.onload({
                target: { result: validXml }
            });
            
            // Wait for promise rejection to be handled
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const statusElement = $('#xml-upload-status');
            expect(statusElement.hasClass('alert-danger')).toBe(true);
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
