/**
 * @jest-environment jsdom
 * 
 * Tests for clear.js using require() for proper coverage tracking
 */

describe('clear module coverage', () => {
    let clearModule;
    let $;

    beforeEach(() => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Set up DOM with all form elements that clearInputFields resets
        document.body.innerHTML = `
            <div id="group-resourceinformation">
                <input type="text" id="input-resourceinformation-doi" value="10.5880/test">
                <input type="text" id="input-resourceinformation-publicationyear" value="2025">
                <input type="text" id="input-resourceinformation-version" value="1.0">
                <select id="input-resourceinformation-resourcetype">
                    <option value="1" selected>Dataset</option>
                </select>
                <select id="input-resourceinformation-language">
                    <option value="en">English</option>
                    <option value="de" selected>German</option>
                </select>
                <div class="row">
                    <input type="text" name="title[]" value="Test Title">
                </div>
                <select id="input-resourceinformation-titletype">
                    <option value="1">Main Title</option>
                </select>
            </div>

            <div id="group-rights">
                <select id="input-rights-license">
                    <option value="1" selected>CC-BY</option>
                </select>
            </div>

            <div id="group-author">
                <div data-creator-row>
                    <input type="text" name="familynames[]" value="Doe">
                    <input type="text" name="givennames[]" value="John">
                    <input type="checkbox" name="contacts[]" checked>
                    <div class="contact-person-input" style="display: block;">
                        <input type="email" name="contactEmail[]" value="john@test.com">
                    </div>
                    <input type="text" name="personAffiliation[]" value="Test University">
                    <input type="text" name="authorPersonRorIds[]" value="https://ror.org/12345">
                </div>
                <div data-creator-row>
                    <input type="text" name="familynames[]" value="Smith">
                </div>
            </div>

            <div id="group-authorinstitution">
                <div data-authorinstitution-row>
                    <input type="text" name="authorinstitutionName[]" value="Test Org">
                    <input type="text" name="institutionAffiliation[]" value="Parent Org">
                </div>
                <div data-authorinstitution-row>
                    <input type="text" name="authorinstitutionName[]" value="Second Org">
                </div>
            </div>

            <div id="group-originatinglaboratory">
                <div class="row" data-laboratory-row>
                    <select name="laboratoryName[]"><option value="">Lab 1</option></select>
                    <input type="hidden" value="lab-id-1">
                </div>
                <div class="row" data-laboratory-row>
                    <select name="laboratoryName[]"><option value="">Lab 2</option></select>
                </div>
            </div>

            <div id="group-contributorperson">
                <div contributor-person-row>
                    <input type="text" name="cbPersonLastname[]" value="Contributor">
                </div>
            </div>

            <div id="group-contributororganisation">
                <div contributors-row>
                    <input type="text" name="OrganisationName[]" value="Org">
                </div>
            </div>

            <div id="group-description">
                <textarea name="descriptions[]">Test description</textarea>
            </div>

            <div id="group-freekeywords">
                <input type="text" name="freeKeywords[]" value="keyword1">
            </div>

            <div id="group-dates">
                <input type="date" name="dateCreated" value="2025-01-01">
                <input type="date" name="dateEmbargo" value="2025-12-31">
            </div>

            <div id="group-stc">
                <div class="row" tsc-row>
                    <input type="text" name="tscLatitudeMin[]" value="52.0">
                    <textarea name="tscDescription[]">Location</textarea>
                    <select name="tscTimezone[]">
                        <option value="UTC" selected>UTC</option>
                    </select>
                </div>
                <div class="row" tsc-row>
                    <input type="text" name="tscLatitudeMin[]" value="53.0">
                </div>
            </div>

            <div id="group-relatedwork">
                <div class="row" related-work-row>
                    <input type="text" name="RelatedWorkIdentifier[]" value="10.1234/test">
                    <select name="relation[]">
                        <option value="IsPartOf" selected>Is Part Of</option>
                    </select>
                </div>
                <div class="row" related-work-row>
                    <input type="text" name="RelatedWorkIdentifier[]" value="10.5678/other">
                </div>
            </div>

            <div id="group-fundingreference">
                <div class="row" funding-reference-row>
                    <input type="text" name="funder[]" value="DFG">
                </div>
                <div class="row" funding-reference-row>
                    <input type="text" name="funder[]" value="BMBF">
                </div>
            </div>

            <div id="group-ggmsproperties">
                <select id="input-model-type">
                    <option value="">Select</option>
                    <option value="1" selected>Type 1</option>
                </select>
                <select id="input-mathematical-representation">
                    <option value="">Select</option>
                </select>
                <select id="input-celestial-body">
                    <option value="Earth">Earth</option>
                    <option value="Mars" selected>Mars</option>
                </select>
                <select id="input-file-format">
                    <option value="">Select</option>
                </select>
                <input type="text" id="input-model-name" value="Test Model">
                <select id="input-product-type">
                    <option value="Gravity Field">Gravity Field</option>
                </select>
            </div>
        `;

        // Mock mainTitleTypeId
        window.mainTitleTypeId = '1';

        // Clear module cache
        jest.resetModules();

        // Require the module
        clearModule = require('../../js/clear.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete window.mainTitleTypeId;
    });

    describe('module exports', () => {
        test('exports clearInputFields function', () => {
            expect(typeof clearModule.clearInputFields).toBe('function');
        });
    });

    describe('clearInputFields', () => {
        test('clears resource information fields', () => {
            clearModule.clearInputFields();

            expect($('#input-resourceinformation-doi').val()).toBe('');
            expect($('#input-resourceinformation-publicationyear').val()).toBe('');
            expect($('#input-resourceinformation-version').val()).toBe('');
        });

        test('resets language select to first option', () => {
            clearModule.clearInputFields();

            expect($('#input-resourceinformation-language').prop('selectedIndex')).toBe(0);
        });

        test('clears title fields', () => {
            clearModule.clearInputFields();

            expect($('input[name="title[]"]:first').val()).toBe('');
        });

        test('removes extra author rows', () => {
            expect($('div[data-creator-row]').length).toBe(2);

            clearModule.clearInputFields();

            expect($('div[data-creator-row]').length).toBe(1);
        });

        test('clears first author row inputs', () => {
            clearModule.clearInputFields();

            const firstRow = $('div[data-creator-row]:first');
            expect(firstRow.find('input[name="familynames[]"]').val()).toBe('');
            expect(firstRow.find('input[name="givennames[]"]').val()).toBe('');
        });

        test('unchecks contact person checkbox', () => {
            clearModule.clearInputFields();

            expect($('input[name="contacts[]"]').prop('checked')).toBe(false);
        });

        test('hides contact person input', () => {
            clearModule.clearInputFields();

            expect($('.contact-person-input').css('display')).toBe('none');
        });

        test('removes extra author institution rows', () => {
            expect($('div[data-authorinstitution-row]').length).toBe(2);

            clearModule.clearInputFields();

            expect($('div[data-authorinstitution-row]').length).toBe(1);
        });

        test('removes extra laboratory rows', () => {
            expect($('#group-originatinglaboratory .row[data-laboratory-row]').length).toBe(2);

            clearModule.clearInputFields();

            expect($('#group-originatinglaboratory .row[data-laboratory-row]').length).toBe(1);
        });

        test('removes extra STC rows', () => {
            expect($('#group-stc .row[tsc-row]').length).toBe(2);

            clearModule.clearInputFields();

            expect($('#group-stc .row[tsc-row]').length).toBe(1);
        });

        test('clears first STC row', () => {
            clearModule.clearInputFields();

            const firstRow = $('#group-stc .row[tsc-row]:first');
            expect(firstRow.find('input[name="tscLatitudeMin[]"]').val()).toBe('');
            expect(firstRow.find('textarea[name="tscDescription[]"]').val()).toBe('');
        });

        test('removes extra related work rows', () => {
            expect($('#group-relatedwork .row[related-work-row]').length).toBe(2);

            clearModule.clearInputFields();

            expect($('#group-relatedwork .row[related-work-row]').length).toBe(1);
        });

        test('removes extra funding reference rows', () => {
            expect($('#group-fundingreference .row[funding-reference-row]').length).toBe(2);

            clearModule.clearInputFields();

            expect($('#group-fundingreference .row[funding-reference-row]').length).toBe(1);
        });

        test('resets GGMs properties fields', () => {
            clearModule.clearInputFields();

            expect($('#input-model-type').prop('selectedIndex')).toBe(0);
            expect($('#input-celestial-body').val()).toBe('Earth');
            expect($('#input-model-name').val()).toBe('');
            expect($('#input-product-type').val()).toBe('Gravity Field');
        });

        test('clears date fields', () => {
            clearModule.clearInputFields();

            expect($('input[name="dateCreated"]').val()).toBe('');
            expect($('input[name="dateEmbargo"]').val()).toBe('');
        });

        test('clears rights license', () => {
            clearModule.clearInputFields();

            // val() returns null for empty select, not empty string
            expect($('#input-rights-license').val()).toBeFalsy();
        });
    });
});
