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
 * Dynamically applies or removes the 'required' attribute to the latitude and longitude fields 
 * based on the following conditions:
 * - When latMin is filled, longMin becomes required and vice versa.
 * - When latMax is filled, longMax becomes required and vice versa.
 * - When either latMax or longMax is filled, latMin and longMin become required.
 * - If all fields are empty, none of the fields will be required.
 * 
 * This function operates on each row within the #group-stc container that has the attribute 'tsc-row'.
 */
function checkSpatialCoverage() {
    $('#group-stc').find('[tsc-row]').each(function () {
        var row = $(this);

        // Locate the input fields for latitude and longitude
        var latMin = row.find('[id^="input-stc-latmin"]');
        var latMax = row.find('[id^="input-stc-latmax"]');
        var longMin = row.find('[id^="input-stc-longmin"]');
        var longMax = row.find('[id^="input-stc-longmax"]');

        // Check if the fields are filled (not empty or whitespace only)
        var isLatMinFilled = latMin.val() && latMin.val().trim() !== '';
        var isLatMaxFilled = latMax.val() && latMax.val().trim() !== '';
        var isLongMinFilled = longMin.val() && longMin.val().trim() !== '';
        var isLongMaxFilled = longMax.val() && longMax.val().trim() !== '';

        // If all fields are empty, none of them should be required
        if (!isLatMinFilled && !isLatMaxFilled && !isLongMinFilled && !isLongMaxFilled) {
            latMin.removeAttr('required');
            latMax.removeAttr('required');
            longMin.removeAttr('required');
            longMax.removeAttr('required');
        } else {
            // When either latMax or longMax is filled, latMin and longMin and the other max become required
            if (isLatMaxFilled || isLongMaxFilled) {
                latMin.attr('required', 'required');
                longMin.attr('required', 'required');
                latMax.attr('required', 'required');
                longMax.attr('required', 'required');
            } else {
                latMax.removeAttr('required');
                longMax.removeAttr('required');
            }

            // When latMin is filled, longMin becomes required and vice versa
            if (isLatMinFilled) {
                longMin.attr('required', 'required');
            }


            if (isLongMinFilled) {
                latMin.attr('required', 'required');
            }

        }
    });
}

/**
 * Dynamically applies or removes the 'required' attribute to the date, time, and timezone fields 
 * based on the following conditions:
 * - When dateStart is filled, dateEnd becomes required and vice versa.
 * - When timeStart is filled, timeEnd becomes required, as well as both date fields and vice versa.
 * - When any date or time field is filled, the timezone field becomes required.
 * - If all fields are empty, none of the fields will be required.
 * 
 * This function operates on each row within the #group-stc container that has the attribute 'tsc-row'.
 */
function checkTemporalCoverage() {
    $('#group-stc').find('[tsc-row]').each(function () {
        var row = $(this);

        // Locate the input fields for start and end dates/times and timezone
        var dateStart = row.find('[id^="input-stc-datestart"]');
        var timeStart = row.find('[id^="input-stc-timestart"]');
        var dateEnd = row.find('[id^="input-stc-dateend"]');
        var timeEnd = row.find('[id^="input-stc-timeend"]');
        var timezone = row.find('[id^="input-stc-timezone"]');

        // Check if the fields are filled (not empty or whitespace only)
        var isDateStartFilled = dateStart.val() && dateStart.val().trim() !== '';
        var isTimeStartFilled = timeStart.val() && timeStart.val().trim() !== '';
        var isDateEndFilled = dateEnd.val() && dateEnd.val().trim() !== '';
        var isTimeEndFilled = timeEnd.val() && timeEnd.val().trim() !== '';

        // If all temporal fields are empty, none of them should be required
        if (!isDateStartFilled && !isTimeStartFilled && !isDateEndFilled && !isTimeEndFilled) {
            dateStart.removeAttr('required');
            timeStart.removeAttr('required');
            dateEnd.removeAttr('required');
            timeEnd.removeAttr('required');
            timezone.removeAttr('required');
        } else {
            // Make end date required if start date is filled and vice versa
            if (isDateStartFilled || isDateEndFilled) {
                dateStart.attr('required', 'required');
                dateEnd.attr('required', 'required');
            } else {
                dateStart.removeAttr('required');
                dateEnd.removeAttr('required');
            }

            // Make timeEnd, dates, and timezone required if timeStart is filled and vice versa
            if (isTimeStartFilled || isTimeEndFilled) {
                timeStart.attr('required', 'required');
                timeEnd.attr('required', 'required');
                dateStart.attr('required', 'required');
                dateEnd.attr('required', 'required');
                timezone.attr('required', 'required');
            } else {
                timeStart.removeAttr('required');
                timeEnd.removeAttr('required');
            }

            // Make timezone required if any date or time field is filled
            if (isDateStartFilled || isDateEndFilled || isTimeStartFilled || isTimeEndFilled) {
                timezone.attr('required', 'required');
            } else {
                timezone.removeAttr('required');
            }
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
    checkSpatialCoverage();
    checkTemporalCoverage();

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
    'input[name^="cpLastname"], ' +         // Contact Person last name
    'input[name^="cpFirstname"], ' +        // Contact Person first name
    'input[name^="cpPosition"], ' +         // Contact Person position
    'input[name^="cpEmail"], ' +            // Contact Person email address
    'input[name^="cpOnlineResource"], ' +   // Contact Person website
    'input[name="grantNummer[]"], ' +       // Grant Number field
    'input[name="grantName[]"], ' +         // Grant Name field
    'input[name="cbORCID[]"], ' +           // Contributor Person ORCID
    'input[name="cbPersonLastname[]"], ' +  // Contributor Person Lastname
    'input[name="cbPersonFirstname[]"], ' + // Contributor Person Firstname
    'input[name="cbOrganisationName[]"],' +   // Contributor Organisation Name
    'input[name="tscLongitudeMax[]"],' +
    'input[name="tscLongitudeMin[]"],' +
    'input[name="tscLatitudeMin[]"],' +
    'input[name="tscLatitudeMax[]"],' +
    'input[name="tscDateStart[]"],' +
    'input[name="tscDateEnd[]"],' +
    'input[name="tscTimeStart[]"],' +
    'input[name="tscTimeEnd[]"],' +
    'input[name="rIdentifier[]"]',            // Related Work Identifier
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
    'input[name^="cpAffiliation"], ' +            // Contact Person Affiliation
    'input[name="cbPersonRoles[]"], ' +           // Contributor Person Roles
    'input[name="cbAffiliation[]"], ' +           // Contributor Person Affiliation
    'input[name="cbOrganisationRoles[]"], ' +     // Contributor Organisation Roles
    'input[name="OrganisationAffiliation[]"], ' + // Contributor Organisation Affiliation
    'select[name="relation[]"], ' +            // Related Work Relation (dropdown)
    'select[name="rIdentifierType[]"], ' +
    'input[name="funder[]"]',                     // Funder field

    function () {
        // Check mandatory fields when any of these fields' values change
        checkMandatoryFields();
    }
);