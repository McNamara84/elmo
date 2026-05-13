/**
 * Sets up an event listener for the checkbox to dynamically validate the Contact Person section.
 */
function setupContactPersonListener() {
    // When the checkbox for "Contact Person" is toggled (checked/unchecked), call validateContactPersonRequirements
    $('#group-author').on('change', '[id^="checkbox-author-contactperson"]', function () {
        validateContactPersonRequirements();  // Re-run the validateContactPersonRequirements function whenever the checkbox state changes
    });
}

/**
 * Validates the Contact Person section of the form.
 * Ensures that the "Email" field is required only if the checkbox for "Contact Person" is checked, 
 * and not required if the checkbox is unchecked.
 *
 * @function validateContactPersonRequirements
 * @returns {void}
 */
function validateContactPersonRequirements() {
    // Loops through each row in the "group-author" container
    $('#group-author').children('.row').each(function () {
        var row = $(this);

        // Defines the relevant fields for the Contact Person section
        var fields = {
            firstname: row.find('[id^="input-author-firstname"]'),
            lastname: row.find('[id^="input-author-lastname"]'),
            email: row.find('[id^="input-contactperson-email"]'),
            checkbox: row.find('[id^="checkbox-author-contactperson"]') // Checkbox for Contact Person
        };

        // Checks if the checkbox for Contact Person is checked
        var isCheckboxChecked = fields.checkbox.prop('checked');

        // Sets or removes the 'required' attribute for the email field based solely on the checkbox state
        if (isCheckboxChecked) {
            fields.email.attr('required', 'required');  // Make email required if checkbox is checked
            fields.firstname.attr('required', 'required');
            fields.lastname.attr('required', 'required');
        } else {
            fields.email.removeAttr('required');  // Remove email requirement if checkbox is unchecked
        }
    });
}

// Initialize the listener on page load
$(document).ready(function () {
    setupContactPersonListener();
});

/**
 * Validates the Contributor Person section of the form.
 * Ensures the "Last Name", "First Name", and "Role" fields are required if any field in the row is filled.
 */
function validateContributorPersonRequirements() {
    $('#group-contributorperson').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Contributor Person section
        var fields = {
            orcid: row.find('[id^="input-contributor-orcid"]'),
            lastname: row.find('[id^="input-contributor-lastname"]'),
            firstname: row.find('[id^="input-contributor-firstname"]'),
            role: row.find('[id^="input-contributor-personrole"]'),
            affiliation: row.find('[id^="input-contributorpersons-affiliation"]')
        };

        fields.lastname.removeAttr('required').removeClass('js-required-on-submit');
        fields.firstname.removeAttr('required').removeClass('js-required-on-submit');
        fields.role.removeAttr('required').removeClass('js-required-on-submit');

        // Checks if any field in the row is filled
        var isAnyFieldFilled = Object.values(fields).some(function (field) { return field.val() && field.val().trim() !== ''; });

        // Sets or removes the 'required' attribute based on the fill status
        if (isAnyFieldFilled) {
            fields.lastname.addClass('js-required-on-submit');
            fields.firstname.addClass('js-required-on-submit');
            fields.role.addClass('js-required-on-submit');
        };
    });
}

/**
 * Validates the Contributor Organisation section of the form.
 * Ensures the "Name" and "Role" fields are required if any field in the row is filled.
 */
function validateContributorOrganisationRequirements() {
    $('#group-contributororganisation').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Contributor Organization section
        var fields = {
            name: row.find('[id^="input-contributor-name"]'),
            role: row.find('[id^="input-contributor-organisationrole"]'),
            affiliation: row.find('[id^="input-contributor-organisationaffiliation"]')
        };

        // Checks if any field in the row is filled
        fields.name.removeAttr('required').removeClass('js-required-on-submit');
        fields.role.removeAttr('required').removeClass('js-required-on-submit');

        // Ist irgendetwas in der Zeile befüllt?
        var isAnyFieldFilled = Object.values(fields).some(field => field.val() && field.val().trim() !== '');

        // Sets or removes the 'required' attribute based on the fill status
        if (isAnyFieldFilled) {
            fields.name.addClass('js-required-on-submit');
            fields.role.addClass('js-required-on-submit');
        }

    });
}


/**
 * Dynamically applies or removes the 'required' attribute to input fields in each row within #group-stc.
 *
 * The function ensures:
 * - If all fields are empty, none will be required.
 * - If latMax or longMax is filled, latMin, longMin, latMax, longMax, description, dateStart, and dateEnd become required.
 * - If latMin, longMin, or description is filled, those fields along with dateStart and dateEnd become required.
 * - If dateStart or dateEnd is filled, they along with latMin, longMin, and description become required.
 * - Time fields (timeStart, timeEnd) are always optional unless one of them is filled.
 * - If timeStart or timeEnd is filled, both time fields, dates, and timezone become required.
 * - Timezone is only required when time values are provided.
 *
 * @function validateSpatialTemporalCoverageRequirements
 * @returns {void}
 */
function validateSpatialTemporalCoverageRequirements() {
    var group = $('#group-stc');
    var fields = ['latmin', 'latmax', 'longmin', 'longmax', 'description', 'datestart', 'timestart', 'dateend', 'timeend', 'timezone'];
    var allRows = group.find('[tsc-row]');

    // Process each row independently
    allRows.each(function () {
        var row = $(this);
        var inputs = {};
        var filled = {};

        // Store jQuery elements and their filled status
        fields.forEach(function (field) {
            inputs[field] = row.find('[id^="input-stc-' + field + '"]');
            filled[field] = inputs[field].val() && inputs[field].val().trim() !== '';
            inputs[field].removeAttr('required').removeClass('js-required-on-submit');
        });

        // If all fields are empty, skip this row
        if (!Object.values(filled).includes(true)) {
            return;
        }

        // _______________________________________________________________________

        // Bounding box dependencies -> dates required but time optional
        if (filled.latmax || filled.longmax) {
            ['latmin', 'longmin', 'latmax', 'longmax', 'description', 'datestart', 'dateend']
                .forEach(function (field) {
                    inputs[field].addClass('js-required-on-submit');
                });
        }

        // If any of latmin/longmin/description is filled -> dates required, time optional
        if (filled.latmin || filled.longmin || filled.description) {
            ['latmin', 'longmin', 'description', 'datestart', 'dateend']
                .forEach(function (field) {
                    inputs[field].addClass('js-required-on-submit');
                });
        }

        // If dates are provided -> ensure basic required fields, time optional
        if (filled.datestart || filled.dateend) {
            ['datestart', 'dateend', 'latmin', 'longmin', 'description']
                .forEach(function (field) {
                    inputs[field].addClass('js-required-on-submit');
                });
        }

        // If any time value is provided in this row -> require both times, dates and timezone
        if (filled.timestart || filled.timeend) {
            ['timestart', 'timeend', 'datestart', 'dateend', 'latmin', 'longmin', 'description', 'timezone']
                .forEach(function (field) {
                    inputs[field].addClass('js-required-on-submit');
                });
        }
    });
}




/**
 * Validates the Related Work section of the form(only when clicking submit).
 * Ensures all fields ("Relation", "Identifier", and "Identifier Type") are required if any of them are filled.
 */
function validateRelatedWorkRequirements() {
    $('#group-relatedwork').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the related work section
        var fields = {
            relation: row.find('[id^="input-relatedwork-relation"]'),
            identifier: row.find('[id^="input-relatedwork-identifier"]'),
            type: row.find('[id^="input-relatedwork-identifiertype"]'),
        };

        // Checks if any field in the row is filled
        var isAnyFieldFilled = Object.values(fields).some(function (field) {
            return field.val() && field.val().trim() !== '';
        });

        // Sets or removes the 'required' attribute based on the fill status
        if (isAnyFieldFilled) {
            // Diese drei Felder sollen beim Submit required sein
            fields.relation.addClass('js-required-on-submit');
            fields.identifier.addClass('js-required-on-submit');
            fields.type.addClass('js-required-on-submit');
        } else {
            // Zeile leer: nicht submit-pflichtig, altes required aufräumen
            fields.relation.removeClass('js-required-on-submit').removeAttr('required');
            fields.identifier.removeClass('js-required-on-submit').removeAttr('required');
            fields.type.removeClass('js-required-on-submit').removeAttr('required');
        }
    });

};


/**
 * Validates the Funding Reference section of the form(only when clicking submit).
 * Ensures the "Funder" field is required if either "Grant Number" or "Grant Name" fields are filled.
 */
function validateFundingReferenceRequirements() {
    $('#group-fundingreference').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Funding Reference section
        var fields = {
            funder: row.find('[id^="input-funder"]'),
            grantNumber: row.find('[id^="input-grantnumber"]'),
            grantName: row.find('[id^="input-grantname"]'),
            awardUri: row.find('[id^="input-awarduri"]')
        };

        // Checks if either the Grant Number, Grant Name or Award URI field is filled
        var isAnyGrantFieldFilled = (fields.grantNumber.val() && fields.grantNumber.val().trim() !== '') ||
            (fields.grantName.val() && fields.grantName.val().trim() !== '') ||
            (fields.awardUri.val() && fields.awardUri.val().trim() !== '');

        // Mark Funder as a required field only if Submit has been clicked.
        if (isAnyGrantFieldFilled) {
            fields.funder.addClass('js-required-on-submit');
        } else {
            fields.funder.removeClass('js-required-on-submit')
                .removeAttr('required');
        }
    });
};

/**
 * Validates the Author-Institution section of the form.
 * Ensures that the “Author Institution Name” field must be filled in if the “Author Institution Affiliation” field is filled in.
 */
const scheduleAuthorInstitutionMicrotask = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (callback) => Promise.resolve().then(callback);

const scheduleAuthorInstitutionAnimationFrame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (callback) => setTimeout(callback, 16);

const authorInstitutionAttributeObservers = new WeakMap();

function registerAuthorInstitutionObserver(element, attributeName, desiredValue) {
    let observers = authorInstitutionAttributeObservers.get(element);
    if (!observers) {
        observers = new Map();
        authorInstitutionAttributeObservers.set(element, observers);
    }

    let observerState = observers.get(attributeName);
    if (!observerState) {
        observerState = { desiredValue, active: false };
        const observer = new MutationObserver(() => {
            if (!observerState.active) {
                return;
            }

            if (element.getAttribute(attributeName) !== observerState.desiredValue) {
                element.setAttribute(attributeName, observerState.desiredValue);
            }
        });

        observer.observe(element, { attributes: true, attributeFilter: [attributeName] });
        observerState.observer = observer;
        observers.set(attributeName, observerState);
    }

    observerState.desiredValue = desiredValue;
    return observerState;
}

function setAuthorInstitutionObserverActive(element, attributeName, isActive) {
    const observers = authorInstitutionAttributeObservers.get(element);
    if (!observers) {
        return;
    }

    const observerState = observers.get(attributeName);
    if (!observerState) {
        return;
    }

    observerState.active = isActive;
}

function enforceAuthorInstitutionAttribute(element, attributeName, desiredValue) {
    const ensureValue = () => {
        if (element.getAttribute(attributeName) !== desiredValue) {
            element.setAttribute(attributeName, desiredValue);
        }
    };

    element.setAttribute(attributeName, desiredValue);
    scheduleAuthorInstitutionMicrotask(ensureValue);
    scheduleAuthorInstitutionAnimationFrame(() => {
        ensureValue();
        scheduleAuthorInstitutionMicrotask(ensureValue);
    });

    const observerState = registerAuthorInstitutionObserver(element, attributeName, desiredValue);
    observerState.active = true;
}

function applyAuthorInstitutionNameRequirement(inputElement, shouldRequire) {
    if (shouldRequire) {
        enforceAuthorInstitutionAttribute(inputElement, 'required', 'required');
        enforceAuthorInstitutionAttribute(inputElement, 'aria-required', 'true');
    } else {
        inputElement.removeAttribute('required');
        inputElement.removeAttribute('aria-required');
        setAuthorInstitutionObserverActive(inputElement, 'required', false);
        setAuthorInstitutionObserverActive(inputElement, 'aria-required', false);
    }
}

function validateAuthorInstitutionRequirements() {
    $('#group-authorinstitution').children('.row').each(function () {
        var row = $(this);
        // Defines the relevant fields for the Author-Institution section
        var fields = {
            authorinstitutionName: row.find('[id^="input-authorinstitution-name"]'),
            authorinstitutionAffiliation: row.find('[id^="input-authorinstitution-affiliation"]')
        };

        // Check whether the Author-Institution-Affiliation field has a visible value or Tagify tags assigned.
        var affVal = (fields.authorinstitutionAffiliation.val() || '').trim();
        var tagifyInstance = fields.authorinstitutionAffiliation.get(0)?._tagify;
        var hasTagifyAffiliations = Array.isArray(tagifyInstance?.value) && tagifyInstance.value.length > 0;
        var isauthorinstitutionAffiliationFilled = affVal !== '' || hasTagifyAffiliations;

        // Sets or removes the “required” attribute for the “Author Institution Name” field based on the fill status of “Author Institution Affiliation.”
        fields.authorinstitutionName.each(function () {
            applyAuthorInstitutionNameRequirement(this, isauthorinstitutionAffiliationFilled);
        });

        fields.authorinstitutionAffiliation.each(function () {
            if (typeof window.applyTagifyAccessibilityAttributes !== 'function') {
                return;
            }

            const tagifyInstance = this._tagify;
            if (!tagifyInstance) {
                return;
            }

            window.applyTagifyAccessibilityAttributes(tagifyInstance, this, {
                isRequired: isauthorinstitutionAffiliationFilled
            });
        });
    });
};


// Select the abstract textarea element
const abstract = document.getElementById('input-abstract');

// Add event listeners for both input (typing) and blur (leaving the field) if element exists
if (abstract) {
    ['input', 'blur'].forEach(evt =>
        abstract.addEventListener(evt, validateAbstractField)
    );
}

/**
 * Validates the abstract textarea field.
 * - Marks the field as valid if it contains text.
 * - Marks the field as invalid if it is empty or contains only whitespace.
 * - Appends or removes the corresponding feedback message dynamically.
 */
function validateAbstractField() {
    // Trim the current value to ignore leading/trailing whitespace
    const abstract = document.getElementById('input-abstract');
    const value = abstract.value.trim();
    const inputGroup = abstract.closest('.input-group');

    // Reset validation state (remove valid/invalid classes)
    abstract.classList.remove('is-valid', 'is-invalid');

    // Remove any previous feedback messages to avoid duplicates
    let oldFeedback = inputGroup.querySelector('.invalid-feedback[data-translate="descriptions.abstractInvalid"]');
    if (oldFeedback) oldFeedback.remove();

    if (value.length === 0) {
        // If empty or whitespace-only, mark field as invalid
        abstract.classList.add('is-invalid');

        // Create a new feedback element and append it after the input group
        const feedbackElem = document.createElement('div');
        feedbackElem.className = 'invalid-feedback';
        feedbackElem.setAttribute('data-translate', 'descriptions.abstractInvalid');
        feedbackElem.innerText = translations.descriptions.abstractInvalid;
        inputGroup.appendChild(feedbackElem);

        // Set HTML5 validity so that checkValidity() also works
        abstract.setCustomValidity(translations.descriptions.abstractInvalid);
        return false;
    } else {
        // Otherwise, mark field as valid
        abstract.classList.add('is-valid');
        abstract.setCustomValidity("");
        return true;
    }
}


const errorHandlingApproach = document.getElementById('input-error-handling-approach');
// Add event listeners for both input (typing) and blur (leaving the field) if element exists
if (errorHandlingApproach) {
    ['input', 'blur'].forEach(evt =>
        errorHandlingApproach.addEventListener(evt, validateErrorHandlingApproachField)
    );
}
/**
 * ICGEM special: Marks topographic-specific selects (layerApproach, forwardModellingDomain) as
 * required-on-submit only when the topographic section is currently visible.
 * Called from the Submit button handler in buttons.js.
 */
function validateTopographicModelTypeRequirements() {
    const topoSection = document.querySelector('.visibility-modeltype-topographic');
    const layerApproach = document.getElementById('select-topo-layerapproach');
    const domain = document.getElementById('select-topo-domain');

    if (!topoSection || !layerApproach || !domain) {
        return;
    }

    const isVisible = !topoSection.classList.contains('d-none');

    if (isVisible) {
        layerApproach.classList.add('js-required-on-submit');
        domain.classList.add('js-required-on-submit');
    } else {
        layerApproach.classList.remove('js-required-on-submit');
        layerApproach.removeAttribute('required');
        domain.classList.remove('js-required-on-submit');
        domain.removeAttribute('required');
    }
}
/**
 * ICGEM special: Validates the error handling approach textarea field.
 * - Returns success automatically if the field is not required or not present.
 * - Marks the field as valid if it contains text and is required.
 * - Marks the field as invalid if it is required but empty or contains only whitespace.
 */
function validateErrorHandlingApproachField() {
    const errorHandlingApproach = document.getElementById('input-error-handling-approach');
    
    // If the field doesn't exist on this page, return success automatically
    if (!errorHandlingApproach) {

        return true;
    }
    
    const value = errorHandlingApproach.value
    const inputGroup = errorHandlingApproach.closest('.input-group');
    const errorsSelect = document.getElementById('input-errors');
    
    
    const isRequired = errorsSelect.value === 'calibrated';
    // If field is not required, return success automatically
    if (!isRequired) {
        errorHandlingApproach.setCustomValidity("");
        errorHandlingApproach.classList.remove('needs-validation');
        return true;

    }

    // Reset validation state first
    errorHandlingApproach.classList.remove('is-valid', 'is-invalid');
    // Look for our custom feedback message (without data-translate)
    let oldFeedback = inputGroup.querySelector('.invalid-feedback.custom-error-handling');
    if (oldFeedback) oldFeedback.remove();
    errorHandlingApproach.setCustomValidity("");

    // Field is required, so validate content
    if (value.trim().length === 0) {
        errorHandlingApproach.classList.add('is-invalid');

        const feedbackElem = document.createElement('div');
        feedbackElem.className = 'invalid-feedback custom-error-handling';
        feedbackElem.innerText = 'Please enter details of error handling approach as a free text';
        inputGroup.appendChild(feedbackElem);

        errorHandlingApproach.setCustomValidity('Please enter details of error handling approach as a free text');
        return false;
    } else {
        errorHandlingApproach.classList.add('is-valid');
        errorHandlingApproach.setCustomValidity("");
        console.log('value length >0');
        return true;
    }
}

/**
 * This function ensures that optional input fields in the form 
 * are only marked as valid when they actually contain a value.
 * This prevents empty optional fields from being incorrectly 
 * displayed with green checkmarks and borders.
 * 
 */
function removeGreenCheckmarks() {
  // Iterate through all fields in the optionalFieldsSelector
  document.querySelectorAll(optionalFieldsSelector).forEach(field => {
    // Check if the field is empty (trimmed string is empty)
    const isEmpty = field.value.trim() === "";

    // Set dataset attribute to indicate empty state
    field.dataset.empty = isEmpty ? "true" : "false";

    if (isEmpty) {
      // If empty, remove validity-related classes
      field.classList.remove("is-valid");
      field.classList.remove("is-invalid");

      // Reset custom validity to clear validity state
      field.setCustomValidity("");

      // Remove green shadows and background image, as Bootstrap uses these
      // to visually highlight valid fields
      field.style.setProperty('box-shadow', 'none', 'important');
      field.style.setProperty('background-image', 'none', 'important');
    } else {
      // If not empty, check validity
      if (field.checkValidity()) {
        // For valid value, add .is-valid
        field.classList.add("is-valid");

        // Explicitly set validity status to empty to reset errors
        field.setCustomValidity("");

        // Remove green checkmark background image (inline style) to suppress green tick
        field.style.setProperty('background-image', 'none', 'important');
      } else {
        // For invalid value, remove .is-valid
        field.classList.remove("is-valid");
      }

      // Remove inline green shadow styling to revert to Bootstrap default border behavior
      field.style.removeProperty('box-shadow');

      // Only remove background image if field is not empty (keeps none if empty)
      if (isEmpty) {
        field.style.setProperty('background-image', 'none', 'important');
      } else {
        field.style.removeProperty('background-image');
      }
    }
  });
}

/**
 * Checks and dynamically sets the 'required' attribute for input fields across various formgroups.
 * This function ensures that mandatory fields are validated only when relevant data is provided in related fields.
 * It consolidates validation logic for multiple form groups, adjusting requirements as needed.
 */
function validateAllMandatoryFields() {
    // Formgroup Contact person(s)
    validateContactPersonRequirements();

    // Formgroup Contributor Person
    validateContributorPersonRequirements	();

    // Formgroup Contributor Organization
    validateContributorOrganisationRequirements();

    // Formgroup Spacial and Temporal Coverage
    validateSpatialTemporalCoverageRequirements();

    //Formgroup Related Work
    validateRelatedWorkRequirements();

    // Formgroup Funding Reference
    validateFundingReferenceRequirements();

    // Formgroup Autor Institution
    validateAuthorInstitutionRequirements();

    // for the entire form
    removeGreenCheckmarks();

    // ICGEM special Validate error handling approach field
    validateErrorHandlingApproachField();
    // ICGEM special Validate topographic model type requirements
    validateTopographicModelTypeRequirements();

};

// used to remove the green checkmarks from optional fields
const optionalFieldsSelector = [
    // Resource Information
    'input[name="doi"]',
    'input[name="version"]',
    // Author Person
    'input[name="orcids[]"]',
    'input[name="cpOnlineResource[]"]',
    // Author Institution
    'input[name="authorinstitutionName[]"]',
    // Contributor  Person
    'input[name="cbORCID[]"]',
    'input[name="cbPersonLastname[]"]',
    'input[name="cbPersonFirstname[]"]',
    // Contributor  Institution
    'input[name="cbOrganisationName[]"]',
    // Originating Laboratory 
    'select[name="laboratoryName[]"]',
    // Related work
    'select[name="relation[]"]',
    'input[name="rIdentifier[]"]',
    'select[name="rIdentifierType[]"]',  
    // Funding Reference
    'input[name="funder[]"]',
    'input[name="grantNummer[]"]',
    'input[name="grantName[]"]',
    'input[name="awardURI[]"]',
    // Spatial and Temporal Coverage
    'input[name="tscLongitudeMax[]"]',
    'input[name="tscLongitudeMin[]"]',
    'textarea[name="tscDescription[]"]',
    'input[name="tscLatitudeMin[]"]',
    'input[name="tscLatitudeMax[]"]',
    'input[name="tscDateStart[]"]',
    'input[name="tscDateEnd[]"]',
    'input[name="tscTimeStart[]"]',
    'input[name="tscTimeEnd[]"]',
    // Dates
    'input[name="dateEmbargo"]',
    // ICGEM-related fields:
    // GGMs Model Types - Static Models
    'textarea[name="staticDescription[]"]',
    // GGMs Model Types - Temporal Models
    'input[name="temporalStart[]"]',
    'input[name="temporalEnd[]"]',
    'select[name="temporalFrequencyPredef[]"]',
    'input[name="temporalFrequency[]"]',
    'input[name="temporalInstitution"]',
    'input[name="releaseNumber"]',
    // GGMs Model Types - Topographic Models
    'select[name="topoLayerApproach[]"]',
    'select[name="topoDomain[]"]',
    'select[name="topoApproximation[]"]',
    'select[name="topoDensity[]"]',
    'input[name="topoDensityDetails[]"]',
    'select[name="topoDensityCrust"]',
    'input[name="topoDensityDetailsCrust"]',
    'select[name="topoDensityMantle"]',
    'input[name="topoDensityDetailsMantle"]',
    // GGMs Data Sources
    'select[name="datasource_details[]"]',
    'input[name="compensation_depth[]"]',
    'input[name="dIdentifier[]"]',
    'select[name="dIdentifierType[]"]',
    'input[name="dName[]"]',
    'textarea[name="datasource_description[]"]',
    'input[name="satellite_platform[]"]'
].join(', ');


/**
* Event handler for blur events on normal input fields.
* Triggers validateAllMandatoryFields() when the user leaves these fields.
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
    'input[name="rIdentifier[]"],' +
    'input[name="awardURI[]"], ' +
    'textarea#input-abstract' , +
    'textarea#input-error-handling-approach',

    function () {
        // Check mandatory fields when user leaves any of these input fields
        validateAllMandatoryFields();
    }
);

/**
 * Event handler for change events on dropdown and special input fields.
 * Triggers validateAllMandatoryFields() when the value of these fields changes.
 */
$(document).on('change',
    'input[name^="cpAffiliation"], ' +
    'input[name="cbPersonRoles[]"], ' +
    'input[name="cbAffiliation[]"], ' +
    'input[name="cbOrganisationRoles[]"], ' +
    'input[name="OrganisationAffiliation[]"], ' +
    'select[name="relation[]"], ' +
    'select[name="rIdentifierType[]"], ' +
    'select[name="tscTimezone[]"], ' +
    'input[name="funder[]"], ' +
    'input[name="institutionAffiliation[]"], ' +
    'textarea#input-error-handling-approach',
    function () {
        // Check mandatory fields when any of these fields' values change
        validateAllMandatoryFields();
    }
);

// Export selected functions for unit testing in Node/Jest
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateSpatialTemporalCoverageRequirements,
        validateAllMandatoryFields,
        validateTitleField,
        validateAuthorNameFields,
        validateTopographicModelTypeRequirements
    };
}
