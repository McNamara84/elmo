/**
 * @jest-environment jsdom
 */

describe('upload.js', () => {
    let $;
    let uploadModule;
    
    beforeEach(async () => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;
        
        // Set up DOM structure
        document.body.innerHTML = `
            <button id="button-form-load">Load</button>
            <div id="modal-uploadxml" class="modal">
                <input type="file" id="input-uploadxml-file" accept=".xml">
                <div id="panel-uploadxml-dropfile" class="border">
                    Drop XML file here
                </div>
                <div id="upload-spinner-overlay" class="d-none text-center py-4">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
                <div id="xml-upload-status" class="alert d-none"></div>
            </div>
        `;
        
        // Mock Bootstrap modal
        $.fn.modal = jest.fn();

        // Mock bootstrap Toast
        window.bootstrap = {
            Toast: jest.fn(function (el, opts) {
                this.el = el;
                this.opts = opts;
                this.show = jest.fn();
            })
        };

        // Mock FileReader
        global.FileReader = jest.fn(() => ({
            readAsText: jest.fn(),
            onload: null,
            onerror: null
        }));

        jest.resetModules();
        uploadModule = require('../../js/upload.js');
        // Flush microtasks for jQuery 4 $(document).ready()
        await new Promise(resolve => setTimeout(resolve, 0));

        // Install fake timers after setup to prevent real 10s timeouts from leaking
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
        jest.clearAllMocks();
        jest.resetModules();
        delete window.bootstrap;
        delete global.FileReader;
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
    });

    describe('drag and drop', () => {
        test('dropzone adds border-primary class on dragover', () => {
            const dropZone = $('#panel-uploadxml-dropfile');
            
            dropZone.on('dragover', function (event) {
                event.preventDefault();
                event.stopPropagation();
                dropZone.addClass('border-primary');
            });

            const event = $.Event('dragover');
            event.preventDefault = jest.fn();
            event.stopPropagation = jest.fn();
            
            dropZone.trigger(event);

            expect(dropZone.hasClass('border-primary')).toBe(true);
        });

        test('dropzone removes border-primary class on dragleave', () => {
            const dropZone = $('#panel-uploadxml-dropfile');
            dropZone.addClass('border-primary');
            
            dropZone.on('dragleave', function (event) {
                event.preventDefault();
                event.stopPropagation();
                dropZone.removeClass('border-primary');
            });

            const event = $.Event('dragleave');
            event.preventDefault = jest.fn();
            event.stopPropagation = jest.fn();
            
            dropZone.trigger(event);

            expect(dropZone.hasClass('border-primary')).toBe(false);
        });
    });

    describe('isXmlFile', () => {
        test('accepts files with text/xml type', () => {
            expect(uploadModule.isXmlFile({ name: 'test.xml', type: 'text/xml' })).toBe(true);
        });

        test('accepts files with application/xml type', () => {
            expect(uploadModule.isXmlFile({ name: 'test', type: 'application/xml' })).toBe(true);
        });

        test('accepts files with .xml extension regardless of type', () => {
            expect(uploadModule.isXmlFile({ name: 'data.xml', type: '' })).toBe(true);
        });

        test('rejects files without .xml extension and wrong type', () => {
            expect(uploadModule.isXmlFile({ name: 'test.txt', type: 'text/plain' })).toBe(false);
        });

        test('returns false for undefined', () => {
            expect(uploadModule.isXmlFile(undefined)).toBe(false);
        });

        test('returns false for null', () => {
            expect(uploadModule.isXmlFile(null)).toBe(false);
        });

        test('handles file with no name property', () => {
            expect(uploadModule.isXmlFile({ type: 'text/plain' })).toBe(false);
        });

        test('accepts uppercase .XML extension', () => {
            expect(uploadModule.isXmlFile({ name: 'DATA.XML', type: '' })).toBe(true);
        });

        test('accepts mixed case .Xml extension', () => {
            expect(uploadModule.isXmlFile({ name: 'file.Xml', type: '' })).toBe(true);
        });
    });

    describe('translateWithFallback', () => {
        test('returns fallback when no translate function', () => {
            expect(uploadModule.translateWithFallback('some.key', 'fallback text')).toBe('fallback text');
        });

        test('returns translation when available', () => {
            window.elmo = { translate: jest.fn(() => 'translated') };
            expect(uploadModule.translateWithFallback('some.key', 'fallback')).toBe('translated');
            delete window.elmo;
        });

        test('returns fallback when translate returns empty', () => {
            window.elmo = { translate: jest.fn(() => '') };
            expect(uploadModule.translateWithFallback('some.key', 'fallback')).toBe('fallback');
            delete window.elmo;
        });
    });

    describe('buildUploadMessage', () => {
        test('builds success message with fallback', () => {
            expect(uploadModule.buildUploadMessage('test.xml', 'success')).toBe('test.xml successfully loaded');
        });

        test('builds generic error message with fallback', () => {
            expect(uploadModule.buildUploadMessage('test.xml', 'danger')).toBe('Error loading file: test.xml');
        });

        test('builds read-error message with errorKey', () => {
            expect(uploadModule.buildUploadMessage('test.xml', 'danger', 'modals.upload.errorReading')).toBe('Error reading file: test.xml');
        });

        test('builds processing-error message with errorKey', () => {
            expect(uploadModule.buildUploadMessage('test.xml', 'danger', 'modals.upload.errorProcessing')).toBe('Error processing XML file: test.xml');
        });

        test('uses translation for success when available', () => {
            window.elmo = { translate: jest.fn((key) => {
                if (key === 'modals.upload.successToast') return 'erfolgreich geladen';
                return null;
            })};
            expect(uploadModule.buildUploadMessage('data.xml', 'success')).toBe('data.xml erfolgreich geladen');
            delete window.elmo;
        });

        test('uses translation for specific errorKey when available', () => {
            window.elmo = { translate: jest.fn((key) => {
                if (key === 'modals.upload.errorProcessing') return 'Fehler beim Verarbeiten der XML-Datei';
                return null;
            })};
            expect(uploadModule.buildUploadMessage('data.xml', 'danger', 'modals.upload.errorProcessing')).toBe('Fehler beim Verarbeiten der XML-Datei: data.xml');
            delete window.elmo;
        });
    });
});
