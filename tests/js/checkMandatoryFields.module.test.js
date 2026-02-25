const { simulateSubmitValidation } = require('./utils');



/**
 * @jest-environment jsdom
 * 
 * Tests for checkMandatoryFields.js using require() for proper coverage tracking
 */

describe('checkMandatoryFields module coverage', () => {
    let checkMandatoryFields;
    let $;

    beforeEach(() => {
        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Set up DOM for all validation functions
        document.body.innerHTML = `
            <div id="group-author">
                <div class="row">
                    <input type="text" id="input-author-firstname" name="authorGivenname[]">
                    <input type="text" id="input-author-lastname" name="authorFamilyname[]">
                    <input type="email" id="input-contactperson-email" name="contactEmail[]">
                    <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]">
                </div>
            </div>
            <div id="group-contributorperson">
                <div class="row" contributor-person-row>
                    <input type="text" id="input-contributor-orcid" name="cbPersonOrcid[]">
                    <input type="text" id="input-contributor-lastname" name="cbPersonLastname[]">
                    <input type="text" id="input-contributor-firstname" name="cbPersonFirstname[]">
                    <input type="text" id="input-contributor-role" name="cbPersonRoles[]">
                    <input type="text" id="input-contributor-affiliation" name="cbPersonAffiliation[]">
                </div>
            </div>
            <div id="group-contributororganisation">
                <div class="row" contributors-row>
                    <input type="text" id="input-contributororganisation-name" name="OrganisationName[]">
                    <input type="text" id="input-contributororganisation-role" name="cbOrganisationRoles[]">
                    <input type="text" id="input-contributororganisation-affiliation" name="OrganisationAffiliation[]">
                </div>
            </div>
            <div id="group-authorinstitution">
                <div class="row" data-authorinstitution-row>
                    <input type="text" id="input-authorinstitution-name" name="authorinstitutionName[]">
                    <input type="text" id="input-authorinstitution-affiliation" name="institutionAffiliation[]">
                </div>
            </div>
            <div id="group-stc">
                <div class="row" tsc-row tsc-row-id="1">
                    <input type="text" id="input-stc-latmin_1" name="tscLatitudeMin[]">
                    <input type="text" id="input-stc-latmax_1" name="tscLatitudeMax[]">
                    <input type="text" id="input-stc-longmin_1" name="tscLongitudeMin[]">
                    <input type="text" id="input-stc-longmax_1" name="tscLongitudeMax[]">
                    <textarea id="input-stc-description" name="tscDescription[]"></textarea>
                    <input type="date" id="input-stc-datestart" name="tscDateStart[]">
                    <input type="date" id="input-stc-dateend" name="tscDateEnd[]">
                    <input type="time" id="input-stc-timestart" name="tscTimeStart[]">
                    <input type="time" id="input-stc-timeend" name="tscTimeEnd[]">
                    <select id="input-stc-timezone" name="tscTimezone[]"></select>
                </div>
            </div>
            <div id="group-relatedwork">
                <div class="row" related-work-row>
                    <input type="text" id="input-relatedwork-identifier" name="RelatedWorkIdentifier[]">
                    <select id="input-relatedwork-relation" name="RelatedWorkRelation[]">
                        <option value="">Select</option>
                        <option value="IsPartOf">Is Part Of</option>
                    </select>
                    <select id="input-relatedwork-type" name="RelatedWorkIdentifierType[]">
                        <option value="">Select</option>
                        <option value="DOI">DOI</option>
                    </select>
                </div>
            </div>
            <div id="group-fundingreference">
                <div class="row" funding-reference-row>
                    <input type="text" id="input-fundingreference-funder" name="funder[]">
                    <input type="text" id="input-fundingreference-funderId" name="funderIdentifier[]">
                    <select id="input-fundingreference-funderIdType" name="funderIdentifierType[]">
                        <option value="">Select</option>
                        <option value="Crossref">Crossref</option>
                    </select>
                    <input type="text" id="input-fundingreference-awardnumber" name="grantNr[]">
                    <input type="text" id="input-fundingreference-awardtitle" name="grantName[]">
                    <input type="text" id="input-fundingreference-awarduri" name="grantURI[]">
                </div>
            </div>
        `;

        // Mock requestAnimationFrame
        global.requestAnimationFrame = jest.fn(cb => {
            cb();
            return 1;
        });

        // Mock applyTagifyAccessibilityAttributes
        window.applyTagifyAccessibilityAttributes = jest.fn();

        // Clear module cache
        jest.resetModules();

        // Require the module - this is key for coverage tracking
        checkMandatoryFields = require('../../js/checkMandatoryFields.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        delete global.requestAnimationFrame;
        delete window.applyTagifyAccessibilityAttributes;
    });

    describe('validateSpatialTemporalCoverageRequirements', () => {
        test('is exported as a function', () => {
            expect(typeof checkMandatoryFields.validateSpatialTemporalCoverageRequirements).toBe('function');
        });

        test('can be called without errors', () => {
            expect(() => {
                checkMandatoryFields.validateSpatialTemporalCoverageRequirements();
                simulateSubmitValidation();
            }).not.toThrow();
        });

        test('marks date fields as required when coordinates filled', () => {
            $('#input-stc-latmin_1').val('52.0');
            $('#input-stc-latmax_1').val('53.0');
            $('#input-stc-longmin_1').val('13.0');
            $('#input-stc-longmax_1').val('14.0');
            
            checkMandatoryFields.validateSpatialTemporalCoverageRequirements();
            simulateSubmitValidation();
            
            expect($('#input-stc-datestart').attr('required')).toBe('required');
            expect($('#input-stc-dateend').attr('required')).toBe('required');
        });

        test('does not require time fields by default', () => {
            $('#input-stc-latmin_1').val('52.0');
            $('#input-stc-datestart').val('2025-01-01');
            
            checkMandatoryFields.validateSpatialTemporalCoverageRequirements();
            simulateSubmitValidation();
            
            // Time is optional
            expect($('#input-stc-timestart').attr('required')).toBeUndefined();
            expect($('#input-stc-timeend').attr('required')).toBeUndefined();
        });

        test('requires timezone when time is provided', () => {
            $('#input-stc-latmin_1').val('52.0');
            $('#input-stc-datestart').val('2025-01-01');
            $('#input-stc-timestart').val('08:00');
            
            checkMandatoryFields.validateSpatialTemporalCoverageRequirements();
            simulateSubmitValidation();
            
            expect($('#input-stc-timezone').attr('required')).toBe('required');
        });

        test('clears requirements when all fields empty', () => {
            // First set requirements
            $('#input-stc-latmin_1').val('52.0');
            checkMandatoryFields.validateSpatialTemporalCoverageRequirements();
            simulateSubmitValidation();
            
            // Then clear all values
            $('#input-stc-latmin_1').val('');
            $('#input-stc-latmax_1').val('');
            $('#input-stc-longmin_1').val('');
            $('#input-stc-longmax_1').val('');
            $('#input-stc-description').val('');
            $('#input-stc-datestart').val('');
            $('#input-stc-dateend').val('');
            
            checkMandatoryFields.validateSpatialTemporalCoverageRequirements();
            simulateSubmitValidation();
            
            expect($('#input-stc-latmin_1').attr('required')).toBeUndefined();
        });
    });

    describe('validateAllMandatoryFields', () => {
        test('is exported as a function', () => {
            expect(typeof checkMandatoryFields.validateAllMandatoryFields).toBe('function');
        });

        test('calls all validation functions', () => {
            // Just verify it runs without error
            expect(() => {
                checkMandatoryFields.validateAllMandatoryFields();
            }).not.toThrow();
        });
    });

    describe('exported functions', () => {
        test('validateSpatialTemporalCoverageRequirements is exported', () => {
            expect(typeof checkMandatoryFields.validateSpatialTemporalCoverageRequirements).toBe('function');
        });

        test('validateAllMandatoryFields is exported', () => {
            expect(typeof checkMandatoryFields.validateAllMandatoryFields).toBe('function');
        });
    });

    describe('validateAllMandatoryFields comprehensive', () => {
        test('validates contact person - requires email when checkbox checked', () => {
            $('#checkbox-author-contactperson').prop('checked', true);

            checkMandatoryFields.validateAllMandatoryFields();

            expect($('#input-contactperson-email').attr('required')).toBe('required');
        });

        test('validates contact person - removes required when checkbox unchecked', () => {
            $('#checkbox-author-contactperson').prop('checked', false);

            checkMandatoryFields.validateAllMandatoryFields();

            expect($('#input-contactperson-email').attr('required')).toBeUndefined();
        });

        test('validates contributor person - requires lastname when orcid filled', () => {
            $('#input-contributor-orcid').val('0000-0001-2345-6789');

            checkMandatoryFields.validateAllMandatoryFields();
            simulateSubmitValidation();

            expect($('#input-contributor-lastname').attr('required')).toBe('required');
        });

        test('validates related work - requires relation when identifier filled', () => {
            $('#input-relatedwork-identifier').val('10.1234/test');

            checkMandatoryFields.validateAllMandatoryFields();
            simulateSubmitValidation();

            expect($('#input-relatedwork-relation').attr('required')).toBe('required');
        });

        test('validates funding reference - can be called without errors', () => {
            $('#input-fundingreference-awardnumber').val('GRANT-001');

            expect(() => {
                checkMandatoryFields.validateAllMandatoryFields();
            }).not.toThrow();
        });

        test('validates author institution - requires name when any field filled', () => {
            $('#input-authorinstitution-affiliation').val('https://ror.org/12345');

            checkMandatoryFields.validateAllMandatoryFields();

            expect($('#input-authorinstitution-name').attr('required')).toBe('required');
        });

        test('validates all on call', () => {
            // Setup multiple validators
            $('#checkbox-author-contactperson').prop('checked', true);
            $('#input-contributor-orcid').val('0000-0001-2345-6789');

            checkMandatoryFields.validateAllMandatoryFields();
            simulateSubmitValidation();

            // Both should be validated
            expect($('#input-contactperson-email').attr('required')).toBe('required');
            expect($('#input-contributor-lastname').attr('required')).toBe('required');
        });
    });
});