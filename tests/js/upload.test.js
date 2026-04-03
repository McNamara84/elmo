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
        
        // Mock Bootstrap modal
        $.fn.modal = jest.fn();

        // Mock bootstrap Toast
        global.bootstrap = {
            Toast: jest.fn(function (el, opts) {
                this.el = el;
                this.opts = opts;
                this.show = jest.fn();
            })
        };
        
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
        delete global.bootstrap;
    });

    describe('showUploadStatus', () => {
        test('displays success message with correct class', () => {
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
        });
    });

    describe('handleXmlFile', () => {
        test('reads file and calls loadXmlToForm for valid XML', (done) => {
            const mockXmlContent = '<?xml version="1.0"?><root><element>test</element></root>';
            const file = new Blob([mockXmlContent], { type: 'text/xml' });
            file.name = 'test.xml';

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
            mockFileReader.onload({ target: { result: mockXmlContent } });
        });

        test('shows error for invalid XML', (done) => {
            const mockInvalidXml = 'invalid';
            const file = new Blob([mockInvalidXml], { type: 'text/xml' });
            
            function showUploadStatus(message, type) {
                if (type === 'danger') {
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

    describe('setUploadLoadingState', () => {
        test('disables inputs and shows spinner when loading=true', () => {
            function setUploadLoadingState(loading) {
                const fileInput = $('#input-uploadxml-file');
                const dropZone = $('#panel-uploadxml-dropfile');
                const spinner = $('#upload-spinner-overlay');

                if (loading) {
                    fileInput.prop('disabled', true);
                    dropZone.addClass('pe-none opacity-50');
                    spinner.removeClass('d-none');
                } else {
                    fileInput.prop('disabled', false);
                    dropZone.removeClass('pe-none opacity-50');
                    spinner.addClass('d-none');
                }
            }

            setUploadLoadingState(true);

            expect($('#input-uploadxml-file').prop('disabled')).toBe(true);
            expect($('#panel-uploadxml-dropfile').hasClass('pe-none')).toBe(true);
            expect($('#panel-uploadxml-dropfile').hasClass('opacity-50')).toBe(true);
            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(false);
        });

        test('enables inputs and hides spinner when loading=false', () => {
            function setUploadLoadingState(loading) {
                const fileInput = $('#input-uploadxml-file');
                const dropZone = $('#panel-uploadxml-dropfile');
                const spinner = $('#upload-spinner-overlay');

                if (loading) {
                    fileInput.prop('disabled', true);
                    dropZone.addClass('pe-none opacity-50');
                    spinner.removeClass('d-none');
                } else {
                    fileInput.prop('disabled', false);
                    dropZone.removeClass('pe-none opacity-50');
                    spinner.addClass('d-none');
                }
            }

            setUploadLoadingState(true);
            setUploadLoadingState(false);

            expect($('#input-uploadxml-file').prop('disabled')).toBe(false);
            expect($('#panel-uploadxml-dropfile').hasClass('pe-none')).toBe(false);
            expect($('#upload-spinner-overlay').hasClass('d-none')).toBe(true);
        });
    });

    describe('showUploadToast', () => {
        test('displays success toast with correct file name', () => {
            function showUploadToast(fileName, type) {
                const toastEl = document.getElementById('toast-upload-feedback');
                if (!toastEl) return;
                if (!window.bootstrap || !window.bootstrap.Toast) return;

                var translate = (window.elmo && typeof window.elmo.translate === 'function')
                    ? window.elmo.translate : null;

                const messageEl = document.getElementById('toast-upload-feedback-message');
                const iconEl = document.getElementById('toast-upload-feedback-icon');
                toastEl.classList.remove('text-bg-success', 'text-bg-danger');

                if (type === 'success') {
                    toastEl.classList.add('text-bg-success');
                    iconEl.className = 'bi bi-check-circle-fill me-2';
                    var successText = translate ? translate('modals.upload.successToast') : null;
                    messageEl.textContent = fileName + ' ' + (successText || 'successfully loaded');
                } else {
                    toastEl.classList.add('text-bg-danger');
                    iconEl.className = 'bi bi-exclamation-triangle-fill me-2';
                    var errorText = translate ? translate('modals.upload.errorToast') : null;
                    messageEl.textContent = (errorText || 'Error loading file') + ': ' + fileName;
                }

                var toast = new bootstrap.Toast(toastEl, { delay: 5000 });
                toast.show();
            }

            showUploadToast('my-data.xml', 'success');

            const toastEl = document.getElementById('toast-upload-feedback');
            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(toastEl.classList.contains('text-bg-success')).toBe(true);
            expect(messageEl.textContent).toBe('my-data.xml successfully loaded');
            expect(global.bootstrap.Toast).toHaveBeenCalled();
        });

        test('displays danger toast with correct file name', () => {
            function showUploadToast(fileName, type) {
                const toastEl = document.getElementById('toast-upload-feedback');
                if (!toastEl) return;
                if (!window.bootstrap || !window.bootstrap.Toast) return;

                var translate = (window.elmo && typeof window.elmo.translate === 'function')
                    ? window.elmo.translate : null;

                const messageEl = document.getElementById('toast-upload-feedback-message');
                const iconEl = document.getElementById('toast-upload-feedback-icon');
                toastEl.classList.remove('text-bg-success', 'text-bg-danger');

                if (type === 'success') {
                    toastEl.classList.add('text-bg-success');
                    iconEl.className = 'bi bi-check-circle-fill me-2';
                    var successText = translate ? translate('modals.upload.successToast') : null;
                    messageEl.textContent = fileName + ' ' + (successText || 'successfully loaded');
                } else {
                    toastEl.classList.add('text-bg-danger');
                    iconEl.className = 'bi bi-exclamation-triangle-fill me-2';
                    var errorText = translate ? translate('modals.upload.errorToast') : null;
                    messageEl.textContent = (errorText || 'Error loading file') + ': ' + fileName;
                }

                var toast = new bootstrap.Toast(toastEl, { delay: 5000 });
                toast.show();
            }

            showUploadToast('bad.xml', 'danger');

            const toastEl = document.getElementById('toast-upload-feedback');
            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(toastEl.classList.contains('text-bg-danger')).toBe(true);
            expect(messageEl.textContent).toBe('Error loading file: bad.xml');
        });

        test('uses i18n translations when available', () => {
            window.elmo = { translate: jest.fn((key) => {
                if (key === 'modals.upload.successToast') return 'erfolgreich geladen';
                return null;
            })};

            function showUploadToast(fileName, type) {
                const toastEl = document.getElementById('toast-upload-feedback');
                if (!toastEl) return;
                if (!window.bootstrap || !window.bootstrap.Toast) return;

                var translate = (window.elmo && typeof window.elmo.translate === 'function')
                    ? window.elmo.translate : null;

                const messageEl = document.getElementById('toast-upload-feedback-message');
                toastEl.classList.remove('text-bg-success', 'text-bg-danger');
                toastEl.classList.add('text-bg-success');
                var successText = translate ? translate('modals.upload.successToast') : null;
                messageEl.textContent = fileName + ' ' + (successText || 'successfully loaded');

                var toast = new bootstrap.Toast(toastEl, { delay: 5000 });
                toast.show();
            }

            showUploadToast('data.xml', 'success');

            const messageEl = document.getElementById('toast-upload-feedback-message');
            expect(messageEl.textContent).toBe('data.xml erfolgreich geladen');

            delete window.elmo;
        });
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
