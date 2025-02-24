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
    $('#input-resourceinformation-titletype').val('1');
  
    // Reset Rights License select field
    $('#input-rights-license').val('');
  
    // Reset existing authors
    $('#group-author .row[data-creator-row]').not(':first').remove();
    $('#group-author .row[data-creator-row]:first input').val('');
  
    // Reset existing contact persons
    $('#group-contactperson .row[contact-person-row]').not(':first').remove();
    $('#group-contactperson .row[contact-person-row]:first input').val('');
  
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
        '#input-author-affiliation',
        '#input-contactperson-affiliation',
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
  }