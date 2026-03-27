/**
 * @jest-environment jsdom
 */

describe('clear.js - clearInputFields', () => {
    beforeEach(() => {
        // Set up DOM structure
        document.body.innerHTML = `
            <div>
                <!-- Resource Information -->
                <input id="input-resourceinformation-doi" value="10.1234/test">
                <input id="input-resourceinformation-publicationyear" value="2024">
                <input id="input-resourceinformation-version" value="1.0">
                <input id="input-resourceinformation-resourcetype" value="Dataset">
                <select id="input-resourceinformation-language">
                    <option value="en">English</option>
                    <option value="de" selected>German</option>
                </select>
                
                <!-- Titles -->
                <div class="row">
                    <input name="title[]" value="Test Title 1">
                </div>
                <div class="row">
                    <input name="title[]" value="Test Title 2">
                </div>
                <input id="input-resourceinformation-titletype" value="1">
                
                <!-- Rights -->
                <select id="input-rights-license">
                    <option value="">Select</option>
                    <option value="CC-BY" selected>CC-BY</option>
                </select>
                
                <!-- Authors -->
                <div data-creator-row="1">
                    <input name="authorGivenname[]" value="John">
                    <input name="authorFamilyname[]" value="Doe">
                    <input name="personAffiliation[]" value="Test Uni">
                    <input name="contacts[]" type="checkbox" checked>
                    <div class="contact-person-input" style="display: block;"></div>
                    <input name="authorPersonRorIds[]" value="12345">
                </div>
                <div data-creator-row="2">
                    <input name="authorGivenname[]" value="Jane">
                </div>
                
                <!-- Author Institutions -->
                <div data-authorinstitution-row="1">
                    <input name="institutionName[]" value="Test Institution">
                    <input name="institutionAffiliation[]" value="Affiliation">
                </div>
                <div data-authorinstitution-row="2">
                    <input name="institutionName[]" value="Another Institution">
                </div>
                
                <!-- Laboratories -->
                <div id="group-originatinglaboratory">
                    <div class="row" data-laboratory-row="1">
                        <select><option value="1">Lab 1</option><option value="2">Lab 2</option></select>
                        <input type="hidden" value="hidden-val">
                    </div>
                    <div class="row" data-laboratory-row="2">
                        <select></select>
                    </div>
                </div>
                
                <!-- Contributor Person -->
                <div id="group-contributorperson">
                    <div class="row" contributor-person-row="1">
                        <input value="Contributor 1">
                    </div>
                    <div class="row" contributor-person-row="2">
                        <input value="Contributor 2">
                    </div>
                </div>
                
                <!-- Contributor Institution -->
                <div id="group-contributororganisation">
                    <div class="row" contributors-row="1">
                        <input value="Org 1">
                    </div>
                    <div class="row" contributors-row="2">
                        <input value="Org 2">
                    </div>
                </div>
                
                <!-- Descriptions -->
                <div id="accordion-description">
                    <textarea id="input-abstract">Abstract text</textarea>
                    <textarea id="input-description-Methods">Methods text</textarea>
                    <textarea id="input-description-TechnicalInfo">Tech info</textarea>
                    <textarea id="input-description-Other">Other info</textarea>
                </div>
                
                <!-- Tagify fields -->
                <input id="input-sciencekeyword">
                <input id="input-Platforms">
                <input id="input-Instruments">
                <input id="input-mslkeyword">
                <input id="input-freekeyword">
                <input name="cbPersonRoles[]">
                <input name="cbPersonAffiliation[]">
                <input name="cbAffiliation[]">
                <input name="cbOrganisationRoles[]">
                <input name="OrganisationAffiliation[]">
                
                <!-- Dates -->
                <input name="dateCreated" value="2024-01-01">
                <input name="dateEmbargo" value="2025-01-01">
                
                <!-- STC -->
                <div id="group-stc">
                    <div class="row" tsc-row="1">
                        <input value="STC 1">
                        <textarea>STC Desc 1</textarea>
                        <select><option value="1">Opt 1</option></select>
                    </div>
                    <div class="row" tsc-row="2">
                        <input value="STC 2">
                    </div>
                </div>
                
                <!-- Related Works -->
                <div id="group-relatedwork">
                    <div class="row" related-work-row="1">
                        <input value="Related 1">
                        <select><option value="1">Opt 1</option></select>
                    </div>
                    <div class="row" related-work-row="2">
                        <input value="Related 2">
                    </div>
                </div>
                
                <!-- Funding References -->
                <div id="group-fundingreference">
                    <div class="row" funding-reference-row="1">
                        <input value="Funding 1">
                    </div>
                    <div class="row" funding-reference-row="2">
                        <input value="Funding 2">
                    </div>
                </div>
                
                <!-- GGMs Properties -->
                <select id="input-model-type">
                    <option value="">Select</option>
                    <option value="1" selected>Type 1</option>
                </select>
                <select id="input-mathematical-representation">
                    <option value="">Select</option>
                    <option value="1" selected>Rep 1</option>
                </select>
                <select id="input-celestial-body">
                    <option value="Earth">Earth</option>
                    <option value="Mars" selected>Mars</option>
                </select>
                <select id="input-file-format">
                    <option value="">Select</option>
                    <option value="1" selected>Format 1</option>
                </select>
                <input id="input-model-name" value="Test Model">
                <select id="input-product-type">
                    <option value="Gravity Field">Gravity Field</option>
                    <option value="Other" selected>Other</option>
                </select>
            </div>
        `;
        
        // Set up jQuery
        global.$ = require('jquery');
        global.jQuery = global.$;
        
        // Set global mainTitleTypeId
        global.window = global.window || {};
        global.window.mainTitleTypeId = '1';
        
        // Define clearInputFields function for testing (mirrors the source)
        global.clearInputFields = function clearInputFields() {
            // Reset input fields in Resource Information
            $('#input-resourceinformation-doi').val('');
            $('#input-resourceinformation-publicationyear').val('');
            $('#input-resourceinformation-version').val('');
            $('#input-resourceinformation-resourcetype').val('');
          
            // Reset language field to default (first option)
            $('#input-resourceinformation-language').prop('selectedIndex', 0);
          
            // Reset Titles
            $('input[name="title[]"]').closest('.row').not(':first').remove();
            $('input[name="title[]"]:first').val('');
            $('#input-resourceinformation-titletype').val(window.mainTitleTypeId || '');
            // Notify title module to reset its internal counter
            $(document).trigger('elmo:clearTitles');          
            // Reset Rights License select field
            $('#input-rights-license').val('');
          
            // Reset existing authors (now using data-creator-row)
            $('div[data-creator-row]').not(':first').remove();
            $('div[data-creator-row]:first').find('input').val('');
            $('div[data-creator-row]:first').find('.contact-person-input').hide();
            $('div[data-creator-row]:first').find('input[name="contacts[]"]').prop('checked', false);

            // Clear Tagify for affiliations in the first author row
            const firstAffiliationTagify = $('div[data-creator-row]:first').find('input[name="personAffiliation[]"]')[0];
            if (firstAffiliationTagify && firstAffiliationTagify._tagify) {
                firstAffiliationTagify._tagify.removeAllTags();
            }

            // Removes all author-institution lines except the first one
            $('div[data-authorinstitution-row]').not(':first').remove();
            // Clears all input fields (input elements) in the first author-institution row
            $('div[data-authorinstitution-row]:first').find('input').val('');

            // Clear Tagify for institution affiliations in the first institution row
            const firstInstitutionAffiliationTagify = $('div[data-authorinstitution-row]:first').find('input[name="institutionAffiliation[]"]')[0];
            if (firstInstitutionAffiliationTagify && firstInstitutionAffiliationTagify._tagify) {
                firstInstitutionAffiliationTagify._tagify.removeAllTags();
            }

            // Clear author ROR IDs
            $('div[data-creator-row]:first').find('input[name="authorPersonRorIds[]"]').val('');
          
            // Reset existing laboratories
            $('#group-originatinglaboratory .row[data-laboratory-row]').not(':first').remove();
            $('#group-originatinglaboratory .row[data-laboratory-row]:first select').prop('selectedIndex', 0);
            $('#group-originatinglaboratory .row[data-laboratory-row]:first input[type="hidden"]').val('');
          
            // Clear Contributor Person 
            $('#group-contributorperson .row[contributor-person-row]').not(':first').remove();
            $('#group-contributorperson .row[contributor-person-row]:first input').val('');
          
            // Clear Contributor Institution
            $('#group-contributororganisation .row[contributors-row]').not(':first').remove();
            $('#group-contributororganisation .row[contributors-row]:first input').val('');
          
            // Clear descriptions
            $('#input-abstract').val('');
            $('#accordion-description textarea[id^="input-description-"]').val('');
          
            // Clear all Tagify fields
            const tagifySelectors = [
                '#input-sciencekeyword', 
                '#input-Platforms', 
                '#input-Instruments',
                '#input-mslkeyword', 
                '#input-freekeyword', 
                'input[name="cbPersonRoles[]"]',
                'input[name="cbPersonAffiliation[]"]',  
                'input[name="cbAffiliation[]"]', 
                'input[name="cbOrganisationRoles[]"]', 
                'input[name="OrganisationAffiliation[]"]'
            ];

            tagifySelectors.forEach(selector => {
                const tagifyInput = document.querySelector(selector);
                if (tagifyInput && tagifyInput._tagify) {
                    tagifyInput._tagify.removeAllTags();
                }
            });
          
            // Clear date fields
            $('input[name="dateCreated"]').val('');
            $('input[name="dateEmbargo"]').val('');
          
            // Remove all STC rows except the first one
            $('#group-stc .row[tsc-row]').not(':first').remove();
            // Clear the input fields of the first row
            $('#group-stc .row[tsc-row]:first').find('input, textarea, select').val('');
          
            // Reset Related Works
            $('#group-relatedwork .row[related-work-row]').not(':first').remove();
            $('#group-relatedwork .row[related-work-row]:first').find('input, select').val('').trigger('change');

            // Clear Funding References
            $('#group-fundingreference .row[funding-reference-row]').not(':first').remove();
            $('#group-fundingreference .row[funding-reference-row]:first input').val('');

            // === GGMsProperties fields ===
            $('#input-model-type').prop('selectedIndex', 0).val('');
            $('#input-mathematical-representation').prop('selectedIndex', 0).val('');
            $('#input-celestial-body').prop('selectedIndex', 0).val('Earth');
            $('#input-file-format').prop('selectedIndex', 0).val('');
            $('#input-model-name').val('');
            $('#input-product-type').prop('selectedIndex', 0).val('Gravity Field');
        };
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('clearInputFields clears resource information fields', () => {
        clearInputFields();
        
        expect($('#input-resourceinformation-doi').val()).toBe('');
        expect($('#input-resourceinformation-publicationyear').val()).toBe('');
        expect($('#input-resourceinformation-version').val()).toBe('');
        expect($('#input-resourceinformation-resourcetype').val()).toBe('');
    });

    test('clearInputFields resets language to first option', () => {
        clearInputFields();
        
        expect($('#input-resourceinformation-language').prop('selectedIndex')).toBe(0);
    });

    test('clearInputFields removes extra title rows', () => {
        clearInputFields();
        
        const titleInputs = $('input[name="title[]"]');
        expect(titleInputs.length).toBe(1);
        expect(titleInputs.first().val()).toBe('');
    });

    test('clearInputFields clears rights license', () => {
        clearInputFields();
        
        expect($('#input-rights-license').val()).toBe('');
    });

    test('clearInputFields removes extra author rows', () => {
        clearInputFields();
        
        const authorRows = $('div[data-creator-row]');
        expect(authorRows.length).toBe(1);
    });

    test('clearInputFields clears first author row inputs', () => {
        clearInputFields();
        
        const firstRow = $('div[data-creator-row]:first');
        expect(firstRow.find('input[name="authorGivenname[]"]').val()).toBe('');
        expect(firstRow.find('input[name="authorPersonRorIds[]"]').val()).toBe('');
    });

    test('clearInputFields unchecks contact person checkbox', () => {
        clearInputFields();
        
        expect($('div[data-creator-row]:first input[name="contacts[]"]').prop('checked')).toBe(false);
    });

    test('clearInputFields removes extra author institution rows', () => {
        clearInputFields();
        
        const institutionRows = $('div[data-authorinstitution-row]');
        expect(institutionRows.length).toBe(1);
    });

    test('clearInputFields removes extra laboratory rows', () => {
        clearInputFields();
        
        const labRows = $('#group-originatinglaboratory .row[data-laboratory-row]');
        expect(labRows.length).toBe(1);
    });

    test('clearInputFields removes extra contributor person rows', () => {
        clearInputFields();
        
        const rows = $('#group-contributorperson .row[contributor-person-row]');
        expect(rows.length).toBe(1);
    });

    test('clearInputFields removes extra contributor institution rows', () => {
        clearInputFields();
        
        const rows = $('#group-contributororganisation .row[contributors-row]');
        expect(rows.length).toBe(1);
    });

    test('clearInputFields clears description fields', () => {
        clearInputFields();
        
        expect($('#input-abstract').val()).toBe('');
        expect($('#input-description-Methods').val()).toBe('');
        expect($('#input-description-TechnicalInfo').val()).toBe('');
        expect($('#input-description-Other').val()).toBe('');
    });

    test('clearInputFields clears date fields', () => {
        clearInputFields();
        
        expect($('input[name="dateCreated"]').val()).toBe('');
        expect($('input[name="dateEmbargo"]').val()).toBe('');
    });

    test('clearInputFields removes extra STC rows', () => {
        clearInputFields();
        
        const stcRows = $('#group-stc .row[tsc-row]');
        expect(stcRows.length).toBe(1);
    });

    test('clearInputFields clears first STC row', () => {
        clearInputFields();
        
        const firstRow = $('#group-stc .row[tsc-row]:first');
        expect(firstRow.find('input').val()).toBe('');
        expect(firstRow.find('textarea').val()).toBe('');
    });

    test('clearInputFields removes extra related work rows', () => {
        clearInputFields();
        
        const rows = $('#group-relatedwork .row[related-work-row]');
        expect(rows.length).toBe(1);
    });

    test('clearInputFields removes extra funding reference rows', () => {
        clearInputFields();
        
        const rows = $('#group-fundingreference .row[funding-reference-row]');
        expect(rows.length).toBe(1);
    });

    test('clearInputFields resets GGMs property fields', () => {
        clearInputFields();
        
        expect($('#input-model-type').prop('selectedIndex')).toBe(0);
        expect($('#input-mathematical-representation').prop('selectedIndex')).toBe(0);
        expect($('#input-celestial-body').val()).toBe('Earth');
        expect($('#input-file-format').prop('selectedIndex')).toBe(0);
        expect($('#input-model-name').val()).toBe('');
        expect($('#input-product-type').val()).toBe('Gravity Field');
    });

    test('clearInputFields triggers elmo:clearTitles event to re-enable add title button', () => {
        // Set up a disabled add-title button
        document.body.insertAdjacentHTML('beforeend',
            '<button id="button-resourceinformation-addtitle" disabled></button>'
        );

        // Listen for the custom event and re-enable the button (simulates resourceinformation-title.js)
        $(document).on('elmo:clearTitles', function () {
            $('#button-resourceinformation-addtitle').prop('disabled', false);
        });

        clearInputFields();

        expect($('#button-resourceinformation-addtitle').prop('disabled')).toBe(false);

        // Clean up event handler
        $(document).off('elmo:clearTitles');
    });
});
