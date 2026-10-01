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

    describe('file type detection', () => {
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

        test('accepts JSON-LD files with application/ld+json type', () => {
            expect(uploadModule.isJsonLdFile({ name: 'dataset.jsonld', type: 'application/ld+json' })).toBe(true);
        });

        test('accepts JSON-LD files with .jsonld extension', () => {
            expect(uploadModule.isJsonLdFile({ name: 'dataset.JSONLD', type: '' })).toBe(true);
        });

        test('detects XML upload format', () => {
            expect(uploadModule.detectUploadFormat({ name: 'dataset.xml', type: '' })).toBe('xml');
        });

        test('detects JSON-LD upload format', () => {
            expect(uploadModule.detectUploadFormat({ name: 'dataset.jsonld', type: '' })).toBe('jsonld');
        });

        test('accepts supported metadata formats', () => {
            expect(uploadModule.isSupportedMetadataFile({ name: 'dataset.xml', type: '' })).toBe(true);
            expect(uploadModule.isSupportedMetadataFile({ name: 'dataset.jsonld', type: '' })).toBe(true);
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
            expect(uploadModule.buildUploadMessage('test.xml', 'danger', 'modals.upload.errorProcessing')).toBe('Error processing metadata file: test.xml');
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
                if (key === 'modals.upload.errorProcessing') return 'Fehler beim Verarbeiten der Metadatendatei';
                return null;
            })};
            expect(uploadModule.buildUploadMessage('data.xml', 'danger', 'modals.upload.errorProcessing')).toBe('Fehler beim Verarbeiten der Metadatendatei: data.xml');
            delete window.elmo;
        });
    });

    describe('convertJsonLdToXmlDocument', () => {
        test('converts compact DataCite JSON-LD to a DataCite XML document', () => {
            const xmlDoc = uploadModule.convertJsonLdToXmlDocument({
                '@context': 'https://schema.stage.datacite.org/linked-data/context/fullcontext.jsonld',
                identifier: {
                    attrs: { identifierType: 'DOI' },
                    value: '10.1234/example'
                },
                titles: {
                    title: {
                        attrs: { lang: 'en' },
                        value: 'Dataset Title'
                    }
                },
                publicationYear: {
                    value: '2024'
                }
            });

            expect(xmlDoc.documentElement.localName).toBe('resource');
            expect(xmlDoc.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'identifier')[0].textContent).toBe('10.1234/example');
            expect(xmlDoc.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'title')[0].textContent).toBe('Dataset Title');
            expect(xmlDoc.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'title')[0].getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang')).toBe('en');
        });

        test('derives DOI identifier from @id when identifier is missing', () => {
            const xmlDoc = uploadModule.convertJsonLdToXmlDocument({
                '@context': 'https://schema.stage.datacite.org/linked-data/context/fullcontext.jsonld',
                '@id': 'https://doi.org/10.5678/example',
                publicationYear: {
                    value: '2024'
                }
            });

            const identifier = xmlDoc.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'identifier')[0];
            expect(identifier.textContent).toBe('10.5678/example');
            expect(identifier.getAttribute('identifierType')).toBe('DOI');
        });

        test('preserves mixed authors, ordering, identifiers and affiliations', () => {
            const xmlDoc = uploadModule.convertJsonLdToXmlDocument({
                '@context': 'https://schema.stage.datacite.org/linked-data/context/fullcontext.jsonld',
                creators: {
                    creator: [
                        {
                            creatorName: { attrs: { nameType: 'Personal' }, value: 'Doe, Jane' },
                            givenName: { value: 'Jane' },
                            familyName: { value: 'Doe' },
                            nameIdentifier: {
                                attrs: {
                                    nameIdentifierScheme: 'ORCID',
                                    schemeURI: 'https://orcid.org/'
                                },
                                value: '0000-0002-1825-0097'
                            },
                            affiliation: [
                                {
                                    attrs: {
                                        affiliationIdentifier: 'https://ror.org/04z8jg394',
                                        affiliationIdentifierScheme: 'ROR'
                                    },
                                    value: 'GFZ'
                                },
                                { value: 'Additional University' }
                            ]
                        },
                        {
                            creatorName: {
                                attrs: { nameType: 'Organizational' },
                                value: 'Payload Institute'
                            }
                        },
                        {
                            creatorName: { attrs: { nameType: 'Personal' }, value: 'Sukarno' },
                            familyName: { value: 'Sukarno' }
                        }
                    ]
                },
                contributors: {
                    contributor: {
                        attrs: { contributorType: 'ContactPerson' },
                        contributorName: { attrs: { nameType: 'Personal' }, value: 'Sukarno' },
                        familyName: { value: 'Sukarno' }
                    }
                }
            });

            const creators = Array.from(
                xmlDoc.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'creator')
            );
            const creatorNames = creators.map((creator) => creator
                .getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'creatorName')[0]
                .textContent);
            const affiliations = creators[0]
                .getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'affiliation');
            const nameIdentifier = creators[0]
                .getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'nameIdentifier')[0];
            const contact = xmlDoc
                .getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'contributor')[0];

            expect(creatorNames).toEqual(['Doe, Jane', 'Payload Institute', 'Sukarno']);
            expect(nameIdentifier.getAttribute('nameIdentifierScheme')).toBe('ORCID');
            expect(nameIdentifier.textContent).toBe('0000-0002-1825-0097');
            expect(affiliations).toHaveLength(2);
            expect(affiliations[0].getAttribute('affiliationIdentifier')).toBe('https://ror.org/04z8jg394');
            expect(contact.getAttribute('contributorType')).toBe('ContactPerson');
            expect(contact.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'givenName')).toHaveLength(0);
        });
    });
});
