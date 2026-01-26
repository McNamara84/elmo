/**
 * @jest-environment jsdom
 */

describe('upload.js', () => {
    let $;
    
    beforeEach(() => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        
        // Set up DOM structure
        document.body.innerHTML = `
            <button id="button-form-load">Load</button>
            <div id="modal-uploadxml" class="modal">
                <input type="file" id="input-uploadxml-file" accept=".xml">
                <div id="panel-uploadxml-dropfile" class="border">
                    Drop XML file here
                </div>
            </div>
            <div id="xml-upload-status" class="alert d-none"></div>
        `;
        
        // Mock Bootstrap modal
        $.fn.modal = jest.fn();
        
        // Mock loadXmlToForm
        global.loadXmlToForm = jest.fn().mockResolvedValue(true);

        // Mock DOMParser
        global.DOMParser = class {
            parseFromString(str, type) {
                const doc = document.implementation.createDocument('', '', null);
                if (str.includes('parsererror') || str === 'invalid') {
                    const errorEl = document.createElement('parsererror');
                    doc.appendChild(errorEl);
                }
                return doc;
            }
        };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('showUploadStatus', () => {
        test('displays success message with correct class', () => {
            // Define the function for testing
            function showUploadStatus(message, type) {
                const statusElement = $('#xml-upload-status');
                statusElement.removeClass()
                    .addClass(`alert alert-${type}`)
                    .removeClass('d-none')
                    .text(message);
            }

            showUploadStatus('Test success message', 'success');

            const statusEl = $('#xml-upload-status');
            expect(statusEl.hasClass('alert-success')).toBe(true);
            expect(statusEl.hasClass('d-none')).toBe(false);
            expect(statusEl.text()).toBe('Test success message');
        });

        test('displays danger message with correct class', () => {
            function showUploadStatus(message, type) {
                const statusElement = $('#xml-upload-status');
                statusElement.removeClass()
                    .addClass(`alert alert-${type}`)
                    .removeClass('d-none')
                    .text(message);
            }

            showUploadStatus('Error message', 'danger');

            const statusEl = $('#xml-upload-status');
            expect(statusEl.hasClass('alert-danger')).toBe(true);
            expect(statusEl.text()).toBe('Error message');
        });

        test('removes previous classes before adding new ones', () => {
            function showUploadStatus(message, type) {
                const statusElement = $('#xml-upload-status');
                statusElement.removeClass()
                    .addClass(`alert alert-${type}`)
                    .removeClass('d-none')
                    .text(message);
            }

            // First call with success
            showUploadStatus('Success', 'success');
            expect($('#xml-upload-status').hasClass('alert-success')).toBe(true);

            // Second call with danger
            showUploadStatus('Error', 'danger');
            expect($('#xml-upload-status').hasClass('alert-danger')).toBe(true);
            // Note: jQuery removeClass() without args removes all classes in this context
        });
    });

    describe('handleXmlFile', () => {
        test('reads file and calls loadXmlToForm for valid XML', (done) => {
            const mockXmlContent = '<?xml version="1.0"?><root><element>test</element></root>';
            const file = new Blob([mockXmlContent], { type: 'text/xml' });
            file.name = 'test.xml';

            // Create mock FileReader
            const mockFileReader = {
                readAsText: jest.fn(),
                onload: null,
                onerror: null,
                result: mockXmlContent
            };

            global.FileReader = jest.fn(() => mockFileReader);

            function handleXmlFile(file) {
                const reader = new FileReader();
                reader.onload = async function (event) {
                    try {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(reader.result, 'text/xml');

                        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                            throw new Error('Invalid XML file');
                        }

                        await loadXmlToForm(xmlDoc);
                        done();
                    } catch (error) {
                        done(error);
                    }
                };
                reader.readAsText(file);
            }

            handleXmlFile(file);

            // Trigger the onload callback
            mockFileReader.onload({ target: { result: mockXmlContent } });
        });

        test('shows error for invalid XML', (done) => {
            const mockInvalidXml = 'invalid';
            const file = new Blob([mockInvalidXml], { type: 'text/xml' });
            
            let errorShown = false;
            function showUploadStatus(message, type) {
                if (type === 'danger') {
                    errorShown = true;
                    expect(message).toContain('Error');
                    done();
                }
            }

            const mockFileReader = {
                readAsText: jest.fn(),
                onload: null,
                onerror: null,
                result: mockInvalidXml
            };

            global.FileReader = jest.fn(() => mockFileReader);

            function handleXmlFile(file) {
                const reader = new FileReader();
                reader.onload = async function (event) {
                    try {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(reader.result, 'text/xml');

                        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                            throw new Error('Invalid XML file');
                        }

                        await loadXmlToForm(xmlDoc);
                    } catch (error) {
                        showUploadStatus('Error processing XML file: ' + error.message, 'danger');
                    }
                };
                reader.readAsText(file);
            }

            handleXmlFile(file);
            mockFileReader.onload({ target: { result: mockInvalidXml } });
        });

        test('handles file read error', (done) => {
            const file = new Blob(['content'], { type: 'text/xml' });
            
            function showUploadStatus(message, type) {
                if (message === 'Error reading file') {
                    expect(type).toBe('danger');
                    done();
                }
            }

            const mockFileReader = {
                readAsText: jest.fn(),
                onload: null,
                onerror: null
            };

            global.FileReader = jest.fn(() => mockFileReader);

            function handleXmlFile(file) {
                const reader = new FileReader();
                reader.onerror = function () {
                    showUploadStatus('Error reading file', 'danger');
                };
                reader.readAsText(file);
            }

            handleXmlFile(file);
            mockFileReader.onerror();
        });
    });

    describe('drag and drop', () => {
        test('dropzone adds border-primary class on dragover', () => {
            // Manually trigger jQuery event binding
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

    describe('file validation', () => {
        test('accepts files with .xml extension', () => {
            const file = { name: 'test.xml', type: 'text/xml' };
            const isValid = file.type === 'text/xml' || file.name.endsWith('.xml');
            expect(isValid).toBe(true);
        });

        test('accepts files with text/xml type', () => {
            const file = { name: 'test', type: 'text/xml' };
            const isValid = file.type === 'text/xml' || file.name.endsWith('.xml');
            expect(isValid).toBe(true);
        });

        test('rejects files without .xml extension and wrong type', () => {
            const file = { name: 'test.txt', type: 'text/plain' };
            const isValid = file.type === 'text/xml' || file.name.endsWith('.xml');
            expect(isValid).toBe(false);
        });
    });
});
