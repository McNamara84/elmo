/**
 * Clears and resets input fields and Tagify instances.
 */
function clearInputFields() {

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
  
    if (window.authorStack && typeof window.authorStack.setAuthors === 'function') {
        window.authorStack.setAuthors([]);
    } else {
        // Reset existing authors (legacy fallback)
        $('div[data-creator-row]').not(':first').remove();
        $('div[data-creator-row]:first').find('input').val('');
        $('div[data-creator-row]:first').find('.contact-person-input').hide();
        $('div[data-creator-row]:first').find('input[name="contacts[]"]').prop('checked', false);
    }
    // Remove the "Please choose at least one contact person" error inserted by submitHandler.js
    $('#contact-person-error').remove();

    // Clear Tagify for affiliations in the first author row
    const firstAffiliationTagify = $('div[data-creator-row]:first').find('input[name="personAffiliation[]"]')[0];
    if (firstAffiliationTagify && firstAffiliationTagify._tagify) {
        firstAffiliationTagify._tagify.removeAllTags();
        if (typeof firstAffiliationTagify._tagify._updateHiddenField === 'function') {
            firstAffiliationTagify._tagify._updateHiddenField();
        }
    }

    if (!window.authorStack || typeof window.authorStack.setAuthors !== 'function') {
        // Removes all author-institution lines except the first one
        $('div[data-authorinstitution-row]').not(':first').remove();
        // Clears all input fields (input elements) in the first author-institution row
        $('div[data-authorinstitution-row]:first').find('input').val('');
    }

    // Clear Tagify for institution affiliations in the first institution row
    const firstInstitutionAffiliationTagify = $('div[data-authorinstitution-row]:first').find('input[name="institutionAffiliation[]"]')[0];
    if (firstInstitutionAffiliationTagify && firstInstitutionAffiliationTagify._tagify) {
        firstInstitutionAffiliationTagify._tagify.removeAllTags();
        if (typeof firstInstitutionAffiliationTagify._tagify._updateHiddenField === 'function') {
            firstInstitutionAffiliationTagify._tagify._updateHiddenField();
        }
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
  
    // Clear descriptions – covers abstract and all ICGEM description textareas
    // (textarea.textarea-description is the shared class on all GGMs description fields)
    $('#accordion-description textarea.textarea-description').val('');
  

    if (typeof window.clearAllThesaurusSelections === 'function') {
        window.clearAllThesaurusSelections();
    }
    
    // Clear all Tagify fields
    const tagifySelectors = [
        '#input-sciencekeyword',
        '#input-platforms',
        '#input-instruments',
        '#input-chronostratigraphy',
        '#input-gemet',
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
            if (typeof tagifyInput._tagify._updateHiddenField === 'function') {
                tagifyInput._tagify._updateHiddenField();
            }
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
    $('#group-relatedwork .row[related-work-row]').not(':first').remove();  // Remove all rows except the first one
    $('#group-relatedwork .row[related-work-row]:first').find('input, select').val('').trigger('change');  // Clear the first row

    // Reset Used Instruments (Tagify)
    var instrumentsInput = document.getElementById('input-usedinstruments');
    if (instrumentsInput && instrumentsInput._tagify) {
        instrumentsInput._tagify.removeAllTags();
    }
    // Also clear hidden inputs for instruments
    var hiddenContainer = document.getElementById('usedinstruments-hidden-inputs');
    if (hiddenContainer) {
        hiddenContainer.innerHTML = '';
    }

    // Clear Funding References
    $('#group-fundingreference .row[funding-reference-row]').not(':first').remove();
    $('#group-fundingreference .row[funding-reference-row]:first input').val('');

    // === GGMs Definition fields (GGMsDefinition.html) ===
    // .trigger('change') is the correct jQuery idiom after programmatic val() — it fires
    // the delegated handler in ggmsModelTypes.js, which hides the model-specific-card
    // and resets section visibility when the value is empty.
    $('#input-model-type').prop('selectedIndex', 0).val('').trigger('change');
    // .trigger('change') calls updateReferenceSystemVisibility() in ggms-properties.js,
    // which resets the model properties FG back to the default spherical layout.
    $('#input-mathematical-representation').prop('selectedIndex', 0).val('').trigger('change');
    $('#input-celestial-body').prop('selectedIndex', 0).val('Earth');
    $('#input-file-format').prop('selectedIndex', 0).val('');
    $('#input-model-name').val('');
    $('#input-product-type').prop('selectedIndex', 0).val('Gravity Field');

    // === GGMs Characteristics fields (GGMsProperties.html) ===
    $('#input-tide-system').prop('selectedIndex', 0).val('');
    $('#input-degree').val('');
    // .trigger('change') calls updateErrorHandlingVisibility() in ggms-properties.js,
    // which hides the error-handling approach field when errors is reset to empty.
    $('#input-errors').prop('selectedIndex', 0).val('').trigger('change');
    $('#input-error-handling-approach').val('');
    $('#input-radius').val('');
    $('#input-semimajor-axis').val('');
    $('#input-second-variable').prop('selectedIndex', 0).val('');
    $('#input-second-variable-value').val('');
    $('#input-earth-gravity-constant').val('');

    // === GGMs Data Sources ===
    $('#group-datasources .row[data-source-row]').not(':first').remove();
    const $firstDsRow = $('#group-datasources .row[data-source-row]:first');
    // .trigger('change') fires the delegated handler in ggmsDatasources.js (updateRowState),
    // which restores satellite-field visibility and hides identifier cols for type S.
    $firstDsRow.find('select[name="datasource_type[]"]').val('S').trigger('change');
    $firstDsRow.find('select[name="datasource_details[]"]').prop('selectedIndex', 0);
    $firstDsRow.find('textarea[name="datasource_description[]"]').val('');
    $firstDsRow.find('input[name="dIdentifier[]"]').val('');
    $firstDsRow.find('input[name="dName[]"]').val('');
    $firstDsRow.find('input[name="compensation_depth[]"]').val('');

    // === GGMs Model Types (GGMsModelTypes.html) ===
    // Static
    // ggmsModelTypes.js registers this via native addEventListener, so we must
    // use dispatchEvent (not .trigger()) to reach it. dispatchEvent also fires
    // any jQuery handlers listening on the same element.
    const cbTimeVar = document.getElementById('checkbox-time-variable');
    if (cbTimeVar) { cbTimeVar.checked = false; cbTimeVar.dispatchEvent(new Event('change', { bubbles: true })); }
    $('#input-static-description').val('');
    // Temporal
    $('#input-temporal-start').val('');
    $('#input-temporal-end').val('');
    $('#select-release-frequency').prop('selectedIndex', 0).val('');
    $('#select-temporal-frequency-predef').prop('selectedIndex', 0).val('');
    // .trigger('change') fires the jQuery handler in ggmsModelTypes.js which
    // hides #custom-frequency-container and re-enables #select-temporal-frequency-predef.
    $('#checkbox-custom-frequency').prop('checked', false).trigger('change');
    $('#input-temporal-frequency').val('');
    $('#input-temporal-institution').val('');
    $('#input-release-number').val('');
    // Topographic
    $('#select-topo-layerapproach').prop('selectedIndex', 0).val('');
    $('#select-topo-domain').prop('selectedIndex', 0).val('');
    $('#select-topo-approximation').prop('selectedIndex', 0).val('');
    $('#select-topo-density').prop('selectedIndex', 0).val('');
    $('#input-topo-density-details').val('');
    // .trigger('change') fires the jQuery handler in ggmsModelTypes.js which
    // shows #single-density-container and hides #separate-density-container.
    $('#checkbox-separate-density').prop('checked', false).trigger('change');
    $('#select-topo-density-crust').prop('selectedIndex', 0).val('');
    $('#input-topo-density-details-crust').val('');
    $('#select-topo-density-mantle').prop('selectedIndex', 0).val('');
    $('#input-topo-density-details-mantle').val('');

}

/**
 * All GGMs/ICGEM-specific field selectors used by clearInputFields().
 * Exported so Jest and Playwright tests can reference the same source of truth.
 */
const GGMS_SELECTORS = {
    definition: {
        modelType: '#input-model-type',
        mathRep: '#input-mathematical-representation',
        celestialBody: '#input-celestial-body',
        fileFormat: '#input-file-format',
        modelName: '#input-model-name',
    },
    characteristics: {
        tideSystem: '#input-tide-system',
        degree: '#input-degree',
        errors: '#input-errors',
        errorHandlingApproach: '#input-error-handling-approach',
        radius: '#input-radius',
        semimajorAxis: '#input-semimajor-axis',
        secondVariable: '#input-second-variable',
        secondVariableValue: '#input-second-variable-value',
        earthGravityConstant: '#input-earth-gravity-constant',
    },
    modelTypes: {
        timeVariableCheckbox: '#checkbox-time-variable',
        staticDescription: '#input-static-description',
        temporalStart: '#input-temporal-start',
        temporalEnd: '#input-temporal-end',
        releaseFrequency: '#select-release-frequency',
        temporalFreqPredef: '#select-temporal-frequency-predef',
        customFreqCheckbox: '#checkbox-custom-frequency',
        temporalFrequency: '#input-temporal-frequency',
        temporalInstitution: '#input-temporal-institution',
        releaseNumber: '#input-release-number',
        topoLayerApproach: '#select-topo-layerapproach',
        topoDomain: '#select-topo-domain',
        topoApproximation: '#select-topo-approximation',
        topoDensity: '#select-topo-density',
        topoDensityDetails: '#input-topo-density-details',
        separateDensityCheckbox: '#checkbox-separate-density',
        topoDensityCrust: '#select-topo-density-crust',
        topoDensityDetailsCrust: '#input-topo-density-details-crust',
        topoDensityMantle: '#select-topo-density-mantle',
        topoDensityDetailsMantle: '#input-topo-density-details-mantle',
    },
    dataSources: {
        rowSelector: '#group-datasources .row[data-source-row]',
    },
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { clearInputFields, GGMS_SELECTORS };
}
