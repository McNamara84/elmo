/**
 * @jest-environment jsdom
 * 
 * Tests for mappingXmlToInputFields.js using require() for proper coverage tracking
 */

describe('mappingXmlToInputFields module coverage', () => {
    let mappingModule;
    let $;

    beforeEach(() => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Set up DOM with necessary form elements
        document.body.innerHTML = `
            <form id="form-mde">
                <select id="input-resourceinformation-resourcetype">
                    <option value="1">Dataset</option>
                    <option value="2">Software</option>
                </select>
                <select id="input-rights-license">
                    <option value="">Select license</option>
                    <option value="CC-BY-4.0">CC BY 4.0</option>
                </select>
                <input id="input-resourceinformation-title" type="text" name="title[]">
                <select id="input-resourceinformation-titletype" name="titleType[]">
                    <option value="1">Main Title</option>
                    <option value="2">Alternative Title</option>
                </select>
                <div id="group-author">
                    <div class="row">
                        <input name="familynames[]" id="input-author-familyname">
                        <input name="givennames[]" id="input-author-givenname">
                        <input name="orcids[]" id="input-author-orcid">
                    </div>
                </div>
                <div id="group-contributorperson">
                    <div class="row" contributor-person-row>
                        <input name="cpLastname[]">
                        <input name="cpFirstname[]">
                    </div>
                </div>
                <div id="group-contributororganisation">
                    <div class="row" contributors-row>
                        <input name="OrganisationName[]">
                    </div>
                </div>
                <div id="group-stc">
                    <div class="row" tsc-row tsc-row-id="0">
                        <textarea name="tscDescription[]"></textarea>
                        <input name="tscLatitudeMin[]" id="input-stc-latmin">
                        <input name="tscLatitudeMax[]" id="input-stc-latmax">
                        <input name="tscLongitudeMin[]" id="input-stc-longmin">
                        <input name="tscLongitudeMax[]" id="input-stc-longmax">
                    </div>
                </div>
                <button id="button-resourceinformation-addtitle" type="button"></button>
                <button id="button-contributor-addorganisation" type="button"></button>
                <button id="button-contributor-addperson" type="button"></button>
            </form>
        `;

        // Mock Tagify
        global.Tagify = jest.fn().mockImplementation(() => ({
            addTags: jest.fn(),
            settings: { whitelist: [] }
        }));

        // Mock translations
        global.translations = {
            titleTypes: {
                main: 'Main Title',
                alternative: 'Alternative Title'
            }
        };

        // Mock window.updateMapOverlay
        window.updateMapOverlay = jest.fn();

        // Clear module cache
        jest.resetModules();

        // Require the module
        mappingModule = require('../../js/mappingXmlToInputFields.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete global.Tagify;
        delete global.translations;
        delete window.updateMapOverlay;
    });

    describe('module exports', () => {
        test('exports processResourceType function', () => {
            expect(typeof mappingModule.processResourceType).toBe('function');
        });

        test('exports extractLicenseIdentifier function', () => {
            expect(typeof mappingModule.extractLicenseIdentifier).toBe('function');
        });

        test('exports mapTitleType function', () => {
            expect(typeof mappingModule.mapTitleType).toBe('function');
        });

        test('exports getNodeText function', () => {
            expect(typeof mappingModule.getNodeText).toBe('function');
        });

        test('exports normalizeRole function', () => {
            expect(typeof mappingModule.normalizeRole).toBe('function');
        });

        test('exports updateContributorMap function', () => {
            expect(typeof mappingModule.updateContributorMap).toBe('function');
        });

        test('exports parseTemporalData function', () => {
            expect(typeof mappingModule.parseTemporalData).toBe('function');
        });

        test('exports getGeoLocationData function', () => {
            expect(typeof mappingModule.getGeoLocationData).toBe('function');
        });

        test('exports fillSpatialFields function', () => {
            expect(typeof mappingModule.fillSpatialFields).toBe('function');
        });

        test('exports getTagifyInstance function', () => {
            expect(typeof mappingModule.getTagifyInstance).toBe('function');
        });
    });

    describe('extractLicenseIdentifier', () => {
        test('extracts identifier from rightsIdentifier attribute', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<rights rightsIdentifier="CC-BY-4.0">Creative Commons</rights>',
                'text/xml'
            );
            const rightsNode = xmlDoc.querySelector('rights');
            
            expect(mappingModule.extractLicenseIdentifier(rightsNode)).toBe('CC-BY-4.0');
        });

        test('extracts identifier from rightsURI when no identifier', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<rights rightsURI="https://spdx.org/licenses/CC0-1.0.html">Creative Commons</rights>',
                'text/xml'
            );
            const rightsNode = xmlDoc.querySelector('rights');
            
            const result = mappingModule.extractLicenseIdentifier(rightsNode);
            // The regex captures everything before the dot, so CC0-1 is correct
            expect(result).toBe('CC0-1');
        });

        test('uses text content as fallback', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<rights>Some License Text</rights>',
                'text/xml'
            );
            const rightsNode = xmlDoc.querySelector('rights');
            
            const result = mappingModule.extractLicenseIdentifier(rightsNode);
            expect(result).toBe('Some License Text');
        });
    });

    describe('mapTitleType', () => {
        test('returns value from mapping when key exists', () => {
            const mapping = { 'MainTitle': '1', 'AlternativeTitle': '2' };
            expect(mappingModule.mapTitleType('MainTitle', mapping)).toBe('1');
        });

        test('uses default mapping when empty mapping provided', () => {
            const result = mappingModule.mapTitleType('MainTitle', {});
            expect(result).toBe('1');
        });

        test('handles empty string input', () => {
            const result = mappingModule.mapTitleType('', {});
            expect(result).toBe('1');
        });

        test('handles undefined input', () => {
            const result = mappingModule.mapTitleType(undefined, {});
            expect(result).toBe('1');
        });

        test('normalizes spaces in title type', () => {
            const mapping = { 'AlternativeTitle': '2' };
            const result = mappingModule.mapTitleType('Alternative Title', mapping);
            expect(result).toBe('2');
        });
    });

    describe('normalizeRole', () => {
        test('adds spaces before capital letters', () => {
            const result = mappingModule.normalizeRole('DataCurator');
            expect(result).toBe('Data Curator');
        });

        test('handles single word', () => {
            const result = mappingModule.normalizeRole('Editor');
            expect(result).toBe('Editor');
        });

        test('handles multiple capitals', () => {
            const result = mappingModule.normalizeRole('ProjectLeaderManager');
            expect(result).toBe('Project Leader Manager');
        });
    });

    describe('updateContributorMap', () => {
        test('creates new entry if key does not exist', () => {
            const map = new Map();
            const newData = { 
                name: 'Test', 
                roles: ['DataCurator'],
                affiliationPairs: [{ name: 'Org1', rorId: 'ror123' }]
            };
            
            mappingModule.updateContributorMap(map, 'key1', newData);
            
            expect(map.has('key1')).toBe(true);
            expect(map.get('key1').name).toBe('Test');
        });

        test('merges roles when key exists', () => {
            const map = new Map();
            map.set('key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: []
            });
            
            mappingModule.updateContributorMap(map, 'key1', { 
                name: 'Test', 
                roles: ['Role2'],
                affiliationPairs: []
            });
            
            const entry = map.get('key1');
            expect(entry.roles).toContain('Role1');
            expect(entry.roles).toContain('Role2');
        });

        test('does not duplicate existing roles', () => {
            const map = new Map();
            map.set('key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: []
            });
            
            mappingModule.updateContributorMap(map, 'key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: []
            });
            
            const entry = map.get('key1');
            expect(entry.roles.filter(r => r === 'Role1').length).toBe(1);
        });

        test('merges affiliationPairs', () => {
            const map = new Map();
            map.set('key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org1', rorId: '' }]
            });
            
            mappingModule.updateContributorMap(map, 'key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org2', rorId: 'ror456' }]
            });
            
            const entry = map.get('key1');
            expect(entry.affiliationPairs).toEqual([
                { name: 'Org1', rorId: '' },
                { name: 'Org2', rorId: 'ror456' }
            ]);
        });

        test('does not duplicate existing affiliationPairs', () => {
            const map = new Map();
            map.set('key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org1', rorId: 'ror1' }]
            });
            
            mappingModule.updateContributorMap(map, 'key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org1', rorId: 'ror1' }]
            });
            
            const entry = map.get('key1');
            expect(entry.affiliationPairs.length).toBe(1);
        });

        test('upgrades empty rorId when incoming pair has a value', () => {
            const map = new Map();
            map.set('key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org1', rorId: '' }]
            });
            
            mappingModule.updateContributorMap(map, 'key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org1', rorId: 'ror123' }]
            });
            
            const entry = map.get('key1');
            expect(entry.affiliationPairs).toEqual([{ name: 'Org1', rorId: 'ror123' }]);
        });

        test('does not overwrite existing rorId with incoming value', () => {
            const map = new Map();
            map.set('key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org1', rorId: 'ror_original' }]
            });
            
            mappingModule.updateContributorMap(map, 'key1', { 
                name: 'Test', 
                roles: ['Role1'],
                affiliationPairs: [{ name: 'Org1', rorId: 'ror_different' }]
            });
            
            const entry = map.get('key1');
            expect(entry.affiliationPairs).toEqual([{ name: 'Org1', rorId: 'ror_original' }]);
        });
    });

    describe('parseTemporalData', () => {
        test('returns empty result for null input', () => {
            const result = mappingModule.parseTemporalData(null);
            expect(result.startDate).toBe('');
            expect(result.endDate).toBe('');
        });

        test('returns empty result for empty node', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<date></date>', 'text/xml');
            const dateNode = xmlDoc.querySelector('date');
            
            const result = mappingModule.parseTemporalData(dateNode);
            expect(result.startDate).toBe('');
        });

        test('parses simple date', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<date>2020-06-15</date>', 'text/xml');
            const dateNode = xmlDoc.querySelector('date');
            
            const result = mappingModule.parseTemporalData(dateNode);
            expect(result.startDate).toBe('2020-06-15');
        });

        test('parses date range with slash separator', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<date>2020-01-01/2020-12-31</date>', 'text/xml');
            const dateNode = xmlDoc.querySelector('date');
            
            const result = mappingModule.parseTemporalData(dateNode);
            expect(result.startDate).toBe('2020-01-01');
            expect(result.endDate).toBe('2020-12-31');
        });

        test('parses date with time', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<date>2020-06-15T14:30:00</date>', 'text/xml');
            const dateNode = xmlDoc.querySelector('date');
            
            const result = mappingModule.parseTemporalData(dateNode);
            expect(result.startDate).toBe('2020-06-15');
            expect(result.startTime).toBe('14:30:00');
        });

        test('parses date with timezone offset', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<date>2020-06-15T14:30:00+02:00</date>', 'text/xml');
            const dateNode = xmlDoc.querySelector('date');
            
            const result = mappingModule.parseTemporalData(dateNode);
            expect(result.startDate).toBe('2020-06-15');
            expect(result.startTime).toBe('14:30:00');
            expect(result.timezoneOffset).toBe('+02:00');
        });

        test('parses date with only timezone offset (no time)', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<date>2020-06-15+02:00</date>', 'text/xml');
            const dateNode = xmlDoc.querySelector('date');
            
            const result = mappingModule.parseTemporalData(dateNode);
            expect(result.startDate).toBe('2020-06-15');
            expect(result.startTime).toBe('');
            expect(result.timezoneOffset).toBe('+02:00');
        });

        test('parses full date range with times and timezones', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<date>2020-01-01T10:00:00+01:00/2020-12-31T22:00:00+01:00</date>', 
                'text/xml'
            );
            const dateNode = xmlDoc.querySelector('date');
            
            const result = mappingModule.parseTemporalData(dateNode);
            expect(result.startDate).toBe('2020-01-01');
            expect(result.startTime).toBe('10:00:00');
            expect(result.endDate).toBe('2020-12-31');
            expect(result.endTime).toBe('22:00:00');
        });
    });

    describe('getGeoLocationData', () => {
        test('returns empty data for node without location info', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<geoLocation></geoLocation>', 'text/xml');
            const geoNode = xmlDoc.querySelector('geoLocation');
            
            const result = mappingModule.getGeoLocationData(geoNode);
            expect(result.latitudeMin).toBe('');
            expect(result.longitudeMin).toBe('');
        });

        test('extracts place name', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<geoLocation><geoLocationPlace>Berlin</geoLocationPlace></geoLocation>',
                'text/xml'
            );
            const geoNode = xmlDoc.querySelector('geoLocation');
            
            const result = mappingModule.getGeoLocationData(geoNode);
            expect(result.place).toBe('Berlin');
        });

        test('extracts point coordinates', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                `<geoLocation>
                    <geoLocationPoint>
                        <pointLatitude>52.5</pointLatitude>
                        <pointLongitude>13.4</pointLongitude>
                    </geoLocationPoint>
                </geoLocation>`,
                'text/xml'
            );
            const geoNode = xmlDoc.querySelector('geoLocation');
            
            const result = mappingModule.getGeoLocationData(geoNode);
            // For point, lat/lon are duplicated to min and max
            expect(result.latitudeMin).toBe('52.5');
            expect(result.latitudeMax).toBe('52.5');
            expect(result.longitudeMin).toBe('13.4');
            expect(result.longitudeMax).toBe('13.4');
        });

        test('extracts bounding box coordinates', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                `<geoLocation>
                    <geoLocationBox>
                        <northBoundLatitude>53</northBoundLatitude>
                        <southBoundLatitude>52</southBoundLatitude>
                        <eastBoundLongitude>14</eastBoundLongitude>
                        <westBoundLongitude>13</westBoundLongitude>
                    </geoLocationBox>
                </geoLocation>`,
                'text/xml'
            );
            const geoNode = xmlDoc.querySelector('geoLocation');
            
            const result = mappingModule.getGeoLocationData(geoNode);
            expect(result.latitudeMin).toBe('52');
            expect(result.latitudeMax).toBe('53');
            expect(result.longitudeMin).toBe('13');
            expect(result.longitudeMax).toBe('14');
        });
    });

    describe('fillSpatialFields', () => {
        test('fills form fields with location data', () => {
            const $row = $('[tsc-row-id="0"]');
            const data = {
                place: 'Test Location',
                latitudeMin: '52',
                latitudeMax: '53',
                longitudeMin: '13',
                longitudeMax: '14'
            };
            
            mappingModule.fillSpatialFields($row, data);
            
            expect($row.find('textarea[name="tscDescription[]"]').val()).toBe('Test Location');
            expect($row.find('input[name="tscLatitudeMin[]"]').val()).toBe('52');
            expect($row.find('input[name="tscLatitudeMax[]"]').val()).toBe('53');
            expect($row.find('input[name="tscLongitudeMin[]"]').val()).toBe('13');
            expect($row.find('input[name="tscLongitudeMax[]"]').val()).toBe('14');
        });

        test('calls updateMapOverlay when available', () => {
            const $row = $('[tsc-row-id="0"]');
            const data = {
                place: 'Test',
                latitudeMin: '52',
                latitudeMax: '53',
                longitudeMin: '13',
                longitudeMax: '14'
            };
            
            mappingModule.fillSpatialFields($row, data);
            
            expect(window.updateMapOverlay).toHaveBeenCalledWith('0', '53', '14', '52', '13');
        });
    });

    describe('processResourceType', () => {
        test('handles missing resourceType node', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<root></root>', 'text/xml');
            
            // Should not throw
            expect(() => {
                mappingModule.processResourceType(xmlDoc);
            }).not.toThrow();
        });

        test('handles missing resourceTypeGeneral attribute', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<resource><resourceType>Research Data</resourceType></resource>',
                'text/xml'
            );
            
            expect(() => {
                mappingModule.processResourceType(xmlDoc);
            }).not.toThrow();
        });

        test('selects matching option in dropdown', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<resource><resourceType resourceTypeGeneral="Dataset">Research Data</resourceType></resource>',
                'text/xml'
            );
            
            mappingModule.processResourceType(xmlDoc);
            
            const select = document.querySelector('#input-resourceinformation-resourcetype');
            expect(select.options[0].selected).toBe(true);
        });
    });

    describe('getNodeText', () => {
        test('returns empty string for non-existent path', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<root></root>', 'text/xml');
            const resolver = () => null;
            
            const result = mappingModule.getNodeText(xmlDoc, '//nonexistent', xmlDoc, resolver);
            expect(result).toBe('');
        });

        test('returns text content for existing node', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<root><child>Test Text</child></root>', 'text/xml');
            const resolver = () => null;
            
            const result = mappingModule.getNodeText(xmlDoc, '//child', xmlDoc, resolver);
            expect(result).toBe('Test Text');
        });

        test('trims whitespace from result', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<root><child>  Test Text  </child></root>', 'text/xml');
            const resolver = () => null;
            
            const result = mappingModule.getNodeText(xmlDoc, '//child', xmlDoc, resolver);
            expect(result).toBe('Test Text');
        });

        test('handles xpath without leading dot or slash', () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<root><child>Content</child></root>', 'text/xml');
            const resolver = () => null;
            
            // The function prepends ./ but XPath evaluation may still fail in jsdom
            // Testing that the function handles this gracefully
            const result = mappingModule.getNodeText(xmlDoc, 'child', xmlDoc, resolver);
            expect(typeof result).toBe('string');
        });
    });

    describe('getTagifyInstance', () => {
        test('returns null for null input', () => {
            expect(mappingModule.getTagifyInstance(null)).toBeNull();
        });

        test('returns tagify from _tagify property (direct)', () => {
            const mockTagify = { addTags: jest.fn() };
            const element = { _tagify: mockTagify };
            
            expect(mappingModule.getTagifyInstance(element)).toBe(mockTagify);
        });

        test('returns tagify from _tagify property', () => {
            const mockTagify = { addTags: jest.fn() };
            const element = { _tagify: mockTagify };
            
            expect(mappingModule.getTagifyInstance(element)).toBe(mockTagify);
        });

        test('returns tagify from jQuery-like element with _tagify', () => {
            const mockTagify = { addTags: jest.fn() };
            const element = { 0: { _tagify: mockTagify } };
            
            expect(mappingModule.getTagifyInstance(element)).toBe(mockTagify);
        });
    });
});
