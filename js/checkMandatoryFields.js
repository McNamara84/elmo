/**
 * Checks and sets mandatory fields for various form sections.
 * This function is called to dynamically adjust input field validation.
 */
function checkMandatoryFields() {
    // Formgroup Contact person(s)
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

    // Formgroup Contributor Person
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

    // Formgroup Contributor Organization
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

    //Formgroup Related Work
    checkRelatedWork();

    // Formgroup Funding Reference
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
        }
    });

};
//////////////////////////////// Event handlers  ///////////////////////////////////////////////////////////


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
    'input[name="rIdentifier"]',            // Related Work Identifier

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
    'input[name="funder[]"],' +                     // Funder field
    'input[name="relation[]"],' +             // Related Work Relation
    'input[name="rIdentifierType[]"]',      // Related Work Identifier Type
    function () {
        // Check mandatory fields when any of these fields' values change
        checkMandatoryFields();
    }
);