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
  
    // Reset Rights License select field
    $('#input-rights-license').val('');
  
    // Reset existing authors (now using data-creator-row)
    $('div[data-creator-row]').not(':first').remove();
    $('div[data-creator-row]:first').find('input').val('');
    $('div[data-creator-row]:first').find('.contact-person-input').hide();
    $('div[data-creator-row]:first').find('input[name="contacts[]"]').prop('checked', false);

    // Clear Tagify for affiliations in the first author row
    const firstAffiliationTagify = $('div[data-creator-row]:first').find('input[name="personAffiliation[]"]')[0];
    if (firstAffiliationTagify && firstAffiliationTagify.tagify) {
        firstAffiliationTagify.tagify.removeAllTags();
    }

    // Removes all author-institution lines except the first one
    $('div[data-authorinstitution-row]').not(':first').remove();
    // Clears all input fields (input elements) in the first author-institution row
    $('div[data-authorinstitution-row]:first').find('input').val('');

    // Clear Tagify for institution affiliations in the first institution row
    const firstInstitutionAffiliationTagify = $('div[data-authorinstitution-row]:first').find('input[name="institutionAffiliation[]"]')[0];
    if (firstInstitutionAffiliationTagify && firstInstitutionAffiliationTagify.tagify) {
        firstInstitutionAffiliationTagify.tagify.removeAllTags();
    }


    // Clear author ROR IDs
    $('div[data-creator-row]:first').find('input[name="authorPersonRorIds[]"]').val('');
  
    // Reset existing laboratories
    $('#group-originatinglaboratory .row[data-laboratory-row]').not(':first').remove();
    $('#group-originatinglaboratory .row[data-laboratory-row]:first input').val('');
  
    // Clear Contributor Person 
    $('#group-contributorperson .row[contributor-person-row]').not(':first').remove();
    $('#group-contributorperson .row[contributor-person-row]:first input').val('');
  
    // Clear Contributor Institution
    $('#group-contributororganisation .row[contributors-row]').not(':first').remove();
    $('#group-contributororganisation .row[contributors-row]:first input').val('');
  
    // Clear descriptions
    $('#input-abstract').val('');
    $('#input-methods').val('');
    $('#input-technicalinfo').val('');
    $('#input-other').val('');
  
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
    $('#group-relatedwork .row[related-work-row]').not(':first').remove();  // Remove all rows except the first one
    $('#group-relatedwork .row[related-work-row]:first').find('input, select').val('').trigger('change');  // Clear the first row

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

}
