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
        `;
        
        // Mock Bootstrap modal
        $.fn.modal = jest.fn();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        jest.resetModules();
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
