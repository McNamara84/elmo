/**
 * Validates the Contact Person section of the form.
 * Ensures the "Last Name", "First Name", and "Email" fields are required if any field in the row is filled.
 */
function checkContactPerson() {
    $('#group-contactperson').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Contact Person section
        var fields = {
            lastname: row.find('[id^="input-contactperson-lastname"]'),
            firstname: row.find('[id^="input-contactperson-firstname"]'),
            position: row.find('[id^="input-contactperson-position"]'),
            email: row.find('[id^="input-contactperson-email"]'),
            website: row.find('[id^="input-contactperson-website"]'),
            affiliation: row.find('[id^="input-contactperson-affiliation"]')
        };

        // Checks if any field in the row is filled
        var isAnyFieldFilled = Object.values(fields).some(field => field.val() && field.val().trim() !== '');

        // Sets or removes the 'required' attribute based on the fill status
        if (isAnyFieldFilled) {
            fields.lastname.attr('required', 'required');
            fields.firstname.attr('required', 'required');
            fields.email.attr('required', 'required');
        }
    });
}

/**
 * Validates the Contributor Person section of the form.
 * Ensures the "Last Name", "First Name", and "Role" fields are required if any field in the row is filled.
 */
function checkContributorPerson() {
    $('#group-contributorperson').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Contributor Person section
        var fields = {
            orcid: row.find('[id^="input-contributor-orcid"]'),
            lastname: row.find('[id^="input-contributor-lastname"]'),
            firstname: row.find('[id^="input-contributor-firstname"]'),
            role: row.find('[id^="input-contributor-personrole"]'),
            affiliation: row.find('[id^="input-contributor-personaffiliation"]')
        };

        // Checks if any field in the row is filled
        var isAnyFieldFilled = Object.values(fields).some(field => field.val() && field.val().trim() !== '');

        // Sets or removes the 'required' attribute based on the fill status
        if (isAnyFieldFilled) {
            fields.lastname.attr('required', 'required');
            fields.firstname.attr('required', 'required');
            fields.role.attr('required', 'required');
        } else {
            fields.lastname.removeAttr('required');
            fields.firstname.removeAttr('required');
            fields.role.removeAttr('required');
        };
    });
}

/**
 * Validates the Contributor Organisation section of the form.
 * Ensures the "Name" and "Role" fields are required if any field in the row is filled.
 */
function checkContributorOrganisation() {
    $('#group-contributororganisation').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Contributor Organization section
        var fields = {
            name: row.find('[id^="input-contributor-name"]'),
            role: row.find('[id^="input-contributor-organisationrole"]'),
            affiliation: row.find('[id^="input-contributor-organisationaffiliation"]')
        };

        // Checks if any field in the row is filled
        var isAnyFieldFilled = Object.values(fields).some(field => field.val() && field.val().trim() !== '');

        // Sets or removes the 'required' attribute based on the fill status
        if (isAnyFieldFilled) {
            fields.name.attr('required', 'required');
            fields.role.attr('required', 'required');
        } else {
            fields.name.removeAttr('required');
            fields.role.removeAttr('required');
        }

    });
}


/**
 * Dynamically applies or removes the 'required' attribute to input fields in each row within #group-stc.
 *
 * The function ensures:
 * - If all fields are empty, none will be required.
 * - If latMax or longMax is filled, latMin, longMin, latMax, longMax, description, dateStart, and dateEnd become required.
 * - If latMin, longMin, or description is filled, those fields along with dateStart, dateEnd, and timezone become required.
 * - If dateStart or dateEnd is filled, they, along with latMin, longMin, description, and timezone, become required.
 * - If timeStart or timeEnd is filled, they, along with dateStart, dateEnd, latMin, longMin, description, and timezone, become required.
 * - If a time is given in any row, all rows require timeStart and timeEnd
 */

function checkCoverage() {
    var group = $('#group-stc');
    var fields = ['latmin', 'latmax', 'longmin', 'longmax', 'description', 'datestart', 'timestart', 'dateend', 'timeend', 'timezone'];
    var allRows = group.find('[tsc-row]');
    var anyTimeFilled = false;

    // First pass: check if any row has timeStart or timeEnd filled
    allRows.each(function () {
        var row = $(this);
        var timeStart = row.find(`[id^="input-stc-timestart"]`).val();
        var timeEnd = row.find(`[id^="input-stc-timeend"]`).val();
        if ((timeStart && timeStart.trim() !== '') || (timeEnd && timeEnd.trim() !== '')) {
            anyTimeFilled = true;
            return false; // Exit loop early if a time field is found
        }
    });

    // Second pass: process each row
    allRows.each(function () {
        var row = $(this);
        var inputs = {};
        var filled = {};

        // Store jQuery elements and their filled status
        fields.forEach(field => {
            inputs[field] = row.find(`[id^="input-stc-${field}"]`);
            filled[field] = inputs[field].val() && inputs[field].val().trim() !== '';
            inputs[field].removeAttr('required'); // Ensure required is removed first
        });

        // If all fields are empty, stop processing for this row
        if (!Object.values(filled).includes(true)) {
            return;
        }

        // Apply 'required' based on dependencies
        if (filled.latmax || filled.longmax) {
            ['latmin', 'longmin', 'latmax', 'longmax', 'description', 'datestart', 'dateend'].forEach(field => inputs[field].attr('required', 'required'));
        }
        if (filled.latmin || filled.longmin || filled.description) {
            ['latmin', 'longmin', 'description', 'datestart', 'dateend', 'timezone'].forEach(field => inputs[field].attr('required', 'required'));
        }
        if (filled.datestart || filled.dateend) {
            ['datestart', 'dateend', 'latmin', 'longmin', 'description', 'timezone'].forEach(field => inputs[field].attr('required', 'required'));
        }
        if (filled.timestart || filled.timeend) {
            ['timestart', 'timeend', 'datestart', 'dateend', 'latmin', 'longmin', 'description', 'timezone'].forEach(field => inputs[field].attr('required', 'required'));
        }

        // Enforce time requirement across all rows if any row has time
        if (anyTimeFilled) {
            ['timestart', 'timeend'].forEach(field => inputs[field].attr('required', 'required'));
        }
    });
}




/**
 * Validates the Related Work section of the form.
 * Ensures all fields ("Relation", "Identifier", and "Identifier Type") are required if any of them are filled.
 */
function checkRelatedWork() {
    $('#group-relatedwork').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the related work section
        var fields = {
            relation: row.find('[id^="input-relatedwork-relation"]'),
            identifier: row.find('[id^="input-relatedwork-identifier"]'),
            type: row.find('[id^="input-relatedwork-identifiertype"]'),
        };

        // Checks if any field in the row is filled
        var isAnyFieldFilled = Object.values(fields).some(field => field.val() && field.val().trim() !== '');

        // Sets or removes the 'required' attribute based on the fill status
        if (isAnyFieldFilled) {
            fields.relation.attr('required', 'required');
            fields.identifier.attr('required', 'required');
            fields.type.attr('required', 'required');
        } else {
            fields.relation.removeAttr('required');
            fields.identifier.removeAttr('required');
            fields.type.removeAttr('required');
        }
    });

};

/**
 * Validates the Funding Reference section of the form.
 * Ensures the "Funder" field is required if either "Grant Number" or "Grant Name" fields are filled.
 */
function checkFunder() {
    $('#group-fundingreference').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Funding Reference section
        var fields = {
            funder: row.find('[id^="input-funder"]'),
            grantNumber: row.find('[id^="input-grantnumber"]'),
            grantName: row.find('[id^="input-grantname"]')
        };

        // Checks if either the Grant Number or Grant Name field is filled
        var isAnyGrantFieldFilled = (fields.grantNumber.val() && fields.grantNumber.val().trim() !== '') ||
            (fields.grantName.val() && fields.grantName.val().trim() !== '');

        // Sets or removes the 'required' attribute for the Funder field based on the Grant fields' fill status
        if (isAnyGrantFieldFilled) {
            fields.funder.attr('required', 'required');
        } else {
            fields.funder.removeAttr('required');
        }
    });
};


/**
 * Checks and dynamically sets the 'required' attribute for input fields across various formgroups.
 * This function ensures that mandatory fields are validated only when relevant data is provided in related fields.
 * It consolidates validation logic for multiple form groups, adjusting requirements as needed.
 */
function checkMandatoryFields() {
    // Formgroup Contact person(s)
    checkContactPerson();

    // Formgroup Contributor Person
    checkContributorPerson();

    // Formgroup Contributor Organization
    checkContributorOrganisation();

    // Formgroup Spacial and Temporal Coverage
    checkCoverage();

    //Formgroup Related Work
    checkRelatedWork();

    // Formgroup Funding Reference
    checkFunder();

};


/**
* Event handler for blur events on normal input fields.
* Triggers checkMandatoryFields() when the user leaves these fields.
*/
$(document).on('blur',
    'input[name^="cpLastname"], ' +         
    'input[name^="cpFirstname"], ' +        
    'input[name^="cpPosition"], ' +         
    'input[name^="cpEmail"], ' +            
    'input[name^="cpOnlineResource"], ' +   
    'input[name="grantNummer[]"], ' +       
    'input[name="grantName[]"], ' +         
    'input[name="cbORCID[]"], ' +           
    'input[name="cbPersonLastname[]"], ' +  
    'input[name="cbPersonFirstname[]"], ' + 
    'input[name="cbOrganisationName[]"],' +  
    'input[name="tscLongitudeMax[]"],' +
    'input[name="tscLongitudeMin[]"],' +
    'input[name="tscLatitudeMin[]"],' +
    'input[name="tscLatitudeMax[]"],' +
    'input[name="tscDescription[]"],' +
    'input[name="tscDateStart[]"],' +
    'input[name="tscDateEnd[]"],' +
    'input[name="tscTimeStart[]"],' +
    'input[name="tscTimeEnd[]"],' +
    'input[name="rIdentifier[]"]',           
    function () {
        // Check mandatory fields when user leaves any of these input fields
        checkMandatoryFields();
    }
);

/**
 * Event handler for change events on dropdown and special input fields.
 * Triggers checkMandatoryFields() when the value of these fields changes.
 */
$(document).on('change',
    'input[name^="cpAffiliation"], ' +            
    'input[name="cbPersonRoles[]"], ' +           
    'input[name="cbAffiliation[]"], ' +           
    'input[name="cbOrganisationRoles[]"], ' +     
    'input[name="OrganisationAffiliation[]"], ' + 
    'select[name="relation[]"], ' +           
    'select[name="rIdentifierType[]"], ' +      
    'select[name="timezone[]"], ' +             
    'input[name="funder[]"]',                     
    function () {
        // Check mandatory fields when any of these fields' values change
        checkMandatoryFields();
    }
);