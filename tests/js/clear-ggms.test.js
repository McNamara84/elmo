/**
 * @jest-environment jsdom
 *
 * Tests for the GGMs/ICGEM-specific behaviour of clearInputFields().
 * Covers three bugs that were present before the fix:
 *
 *  1. ICGEM description textareas were NOT cleared because the old selector
 *     `[id^="input-description-"]` did not match the GGMs field IDs.
 *
 *  2. Setting #input-model-type to '' without .trigger('change') left the
 *     model-specific-card visible (the ggms-modeltypes.js handler was never fired).
 *
 *  3. Setting datasource_type[] to 'S' without .trigger('change') left the
 *     identifier columns visible when the row had been set to type M
 *     (the ggms-datasources.js delegated handler was never fired).
 *
 * Best-practices note
 * -------------------
 * jQuery's .trigger('change') is the correct idiom for programmatic select changes
 * because both ggms-modeltypes.js and ggms-datasources.js listen via delegated
 * $(document).on('change', ...) / parent.on('change', ...) handlers.
 * Calling .trigger('change') propagates through both delegation chains.
 */

describe('clear.js – GGMs / ICGEM specific behaviour', () => {
    let $;
    let clearModule;

    const GGMS_DOM = `
        <!-- ── GGMs Descriptions (GGMsDescriptions.html) ── -->
        <div id="accordion-description">
            <textarea class="textarea-description" id="input-abstract"
                name="descriptionAbstract">Abstract text</textarea>
            <textarea class="textarea-description" id="input-general-model-description"
                name="descriptionGeneralModelDescription">General text</textarea>
            <textarea class="textarea-description" id="input-input-data"
                name="descriptionInputData">Input data text</textarea>
            <textarea class="textarea-description" id="input-processing-procedures"
                name="descriptionProcessingProcedures">Processing text</textarea>
            <textarea class="textarea-description" id="input-specific-features"
                name="descriptionSpecificFeaturesOfResultingGravityField">Features text</textarea>
            <textarea class="textarea-description" id="input-other"
                name="descriptionOther">Other text</textarea>
        </div>

        <!-- ── GGMs Definition (GGMsDefinition.html) ── -->
        <div id="group-ggmspropertiesessential">
            <div class="row">
                <select id="input-model-type" name="model_type">
                    <option value="">Choose...</option>
                    <option value="Static">Static</option>
                    <option value="Temporal">Temporal</option>
                    <option value="Topographic">Topographic</option>
                </select>
                <select id="input-mathematical-representation" name="mathematical_representation">
                    <option value="">Choose...</option>
                    <option value="spherical_harmonics">Spherical harmonics</option>
                </select>
                <select id="input-celestial-body" name="celestial_body">
                    <option value="Earth" selected>Earth</option>
                    <option value="Moon of the Earth">Moon of the Earth</option>
                </select>
                <select id="input-file-format" name="file_format">
                    <option value="">Choose...</option>
                    <option value="icgem2.0">icgem2.0</option>
                </select>
                <input id="input-model-name" name="model_name" type="text" value="">
            </div>
        </div>

        <!-- ── Model-specific card (GGMsModelTypes.html) ── -->
        <!-- Starts visible (as if user picked a model type before) -->
        <div id="model-specific-card">
            <i class="bi bi-question-circle-fill" data-help-section-id="help-static"></i>
            <div class="visibility-modeltype-static"></div>
            <div class="visibility-modeltype-temporal d-none"></div>
            <div class="visibility-modeltype-topographic d-none"></div>

            <!-- Static inputs -->
            <input type="checkbox" id="checkbox-time-variable">
            <div id="time-variable-description-container" class="d-none">
                <textarea id="input-static-description" name="staticDescription[]">Static desc</textarea>
            </div>
            <!-- Temporal inputs -->
            <input id="input-temporal-start" name="temporalStart" type="date" value="2002-04-01">
            <input id="input-temporal-end" name="temporalEnd" type="date" value="2023-06-30">
            <select id="select-temporal-frequency-predef" name="temporalFrequencyPredef">
                <option value=""></option>
                <option value="monthly" selected>Monthly</option>
            </select>
            <input type="checkbox" id="checkbox-custom-frequency">
            <div id="custom-frequency-container" class="d-none">
                <input id="input-temporal-frequency" name="temporalFrequency" type="text" value="">
            </div>
            <input id="input-temporal-institution" name="temporalInstitution" type="text" value="GFZ">
            <input id="input-release-number" name="releaseNumber" type="text" value="RL07">
            <!-- Topographic inputs -->
            <select id="select-topo-layerapproach" name="topoLayerApproach[]">
                <option value="" selected></option>
                <option value="single-layer">Single-layer</option>
            </select>
            <select id="select-topo-domain" name="topoDomain[]">
                <option value="" selected></option>
                <option value="spatial">Spatial</option>
            </select>
            <select id="select-topo-approximation" name="topoApproximation[]">
                <option value="" selected></option>
                <option value="spherical">Spherical</option>
            </select>
            <div id="single-density-container">
                <select id="select-topo-density" name="topoDensity[]">
                    <option value="" selected></option>
                    <option value="constant">Constant</option>
                </select>
                <input id="input-topo-density-details" name="topoDensityDetails[]" type="text" value="">
            </div>
            <input type="checkbox" id="checkbox-separate-density">
            <div id="separate-density-container" class="d-none">
                <select id="select-topo-density-crust" name="topoDensityCrust">
                    <option value="" selected></option>
                    <option value="constant">Constant</option>
                </select>
                <input id="input-topo-density-details-crust" name="topoDensityDetailsCrust" type="text" value="">
                <select id="select-topo-density-mantle" name="topoDensityMantle">
                    <option value="" selected></option>
                    <option value="constant">Constant</option>
                </select>
                <input id="input-topo-density-details-mantle" name="topoDensityDetailsMantle" type="text" value="">
            </div>
        </div>

        <!-- ── GGMs Properties / Characteristics (GGMsProperties.html) ── -->
        <select id="input-tide-system" name="tide_system">
            <option value="">Choose...</option>
            <option value="zero tide" selected>zero tide</option>
        </select>
        <input id="input-degree" name="degree" type="number" value="300">
        <select id="input-errors" name="errors">
            <option value="">Choose...</option>
            <option value="calibrated" selected>calibrated</option>
        </select>
        <!-- error-handling-col visibility toggled by updateErrorHandlingVisibility() -->
        <div id="error-handling-col" style="display: block;">
            <textarea id="input-error-handling-approach" name="error_handling_approach">Approach text</textarea>
        </div>
        <!-- visibility-spherical / visibility-ellipsoidal toggled by updateReferenceSystemVisibility() -->
        <div class="visibility-spherical" style="display: none;">
            <input id="input-radius" name="radius" type="text" value="">
        </div>
        <div class="visibility-ellipsoidal" style="display: block;">
            <input id="input-semimajor-axis" name="semimajor_axis_a" type="text" value="">
        </div>
        <div class="visibility-ellipsoidal" style="display: block;">
            <select id="input-second-variable" name="second_variable">
                <option value="">Choose...</option>
            </select>
        </div>
        <div class="visibility-ellipsoidal" style="display: block;">
            <input id="input-second-variable-value" name="second_variable_value" type="text" value="">
        </div>
        <input id="input-earth-gravity-constant" name="earth_gravity_constant" type="decimal" value="3.986e14">

        <!-- ── GGMs Data Sources (GGMsDataSources.html) ── -->
        <div id="group-datasources">
            <div class="row" data-source-row>
                <div class="col visibility-datasources-basic">
                    <select name="datasource_type[]">
                        <option value="S" selected>Satellite</option>
                        <option value="G">Ground</option>
                        <option value="M">Model</option>
                    </select>
                </div>
                <div class="col visibility-datasources-satellite" style="display: block;">sat-field</div>
                <div class="col visibility-datasources-identifier" style="display: none;">
                    <input name="dIdentifier[]" type="text" value="">
                    <input name="dName[]" type="text" value="">
                    <select name="dIdentifierType[]"></select>
                </div>
                <div class="col visibility-datasources-basic">
                    <textarea name="datasource_description[]"></textarea>
                </div>
                <div class="col visibility-datasources-compensation" style="display: none;">
                    <input name="compensation_depth[]" type="number" value="">
                </div>
            </div>
        </div>
    `;

    beforeEach(() => {
        $ = require('jquery');
        global.$ = global.jQuery = window.$ = window.jQuery = $;
        window.mainTitleTypeId = '';

        document.body.innerHTML = GGMS_DOM;

        // ── Minimal model-type change handler ──────────────────────────────
        // Mirrors ggms-modeltypes.js updateGroupHeader(): hide the card when
        // type is empty. This is the handler that clearInputFields must fire.
        $(document).on('change.clearGgmsTest', '#input-model-type', function () {
            const val = $(this).val();
            const card = $('#model-specific-card');
            if (!val || val.trim() === '') {
                card.addClass('d-none');
            } else {
                card.removeClass('d-none');
            }
        });

        // ── Minimal datasource type change handler ─────────────────────────
        // Mirrors ggms-datasources.js updateRowState() for types S vs M.
        // clearInputFields must fire this so identifier cols hide after reset.
        $('#group-datasources').on('change.clearGgmsTest', 'select[name="datasource_type[]"]', function () {
            const val = $(this).val();
            const row = $(this).closest('.row');
            const isModel = val === 'M';
            row.find('.visibility-datasources-identifier').css('display', isModel ? '' : 'none');
            row.find('.visibility-datasources-satellite').css('display', isModel ? 'none' : '');
        });

        // ── Minimal errors change handler (Bug 4) ──────────────────────────
        // Mirrors ggms-properties.js updateErrorHandlingVisibility():
        // hide the error-handling column unless errors === 'calibrated'.
        $(document).on('change.clearGgmsTest', '#input-errors', function () {
            const val = $(this).val();
            const col = $('#error-handling-col');
            if (val === 'calibrated') {
                col.show();
            } else {
                col.hide();
            }
        });

        // ── Minimal math-representation change handler (Bug 5) ────────────
        // Mirrors ggms-properties.js updateReferenceSystemVisibility():
        // show spherical and hide ellipsoidal when value is empty.
        $(document).on('change.clearGgmsTest', '#input-mathematical-representation', function () {
            const val = $(this).val();
            const spherical = $('.visibility-spherical');
            const ellipsoidal = $('.visibility-ellipsoidal');
            spherical.hide();
            ellipsoidal.hide();
            if (!val || val.toLowerCase() === 'spherical harmonics') {
                spherical.show();
            } else if (val.toLowerCase() === 'ellipsoidal harmonics') {
                ellipsoidal.show();
            } else {
                spherical.show();
            }
        });

        jest.resetModules();
        clearModule = require('../../js/clear.js');
    });

    afterEach(() => {
        $(document).off('change.clearGgmsTest');
        $('#group-datasources').off('change.clearGgmsTest');
        document.body.innerHTML = '';
        jest.resetModules();
        delete global.$; delete global.jQuery;
        delete window.$; delete window.jQuery;
        delete window.mainTitleTypeId;
    });

    // ── Bug 1: Descriptions ─────────────────────────────────────────────────

    describe('Bug 1 – all ICGEM description textareas are cleared', () => {
        test.each([
            ['#input-abstract',                     'Abstract text'],
            ['#input-general-model-description',    'General text'],
            ['#input-input-data',                   'Input data text'],
            ['#input-processing-procedures',        'Processing text'],
            ['#input-specific-features',            'Features text'],
            ['#input-other',                        'Other text'],
        ])('%s is emptied', (selector, initialValue) => {
            expect($(selector).val()).toBe(initialValue);
            clearModule.clearInputFields();
            expect($(selector).val()).toBe('');
        });
    });

    // ── Bug 2: model-type trigger ───────────────────────────────────────────

    describe('Bug 2 – trigger(change) fires on #input-model-type', () => {
        test('model-specific-card gets d-none when model type was Static', () => {
            // Pre-condition: type is Static, card is visible
            $('#input-model-type').val('Static');
            $('#model-specific-card').removeClass('d-none');

            clearModule.clearInputFields();

            // trigger('change') must have fired our handler → d-none added
            expect($('#model-specific-card').hasClass('d-none')).toBe(true);
        });

        test('model-specific-card gets d-none when model type was Temporal', () => {
            $('#input-model-type').val('Temporal');
            $('#model-specific-card').removeClass('d-none');

            clearModule.clearInputFields();

            expect($('#model-specific-card').hasClass('d-none')).toBe(true);
        });

        test('#input-model-type value is empty string after clear', () => {
            $('#input-model-type').val('Topographic');
            clearModule.clearInputFields();
            expect($('#input-model-type').val()).toBe('');
        });

        test('handler is NOT called if no trigger – guard test to confirm the stub works', () => {
            // Direct val() without trigger must NOT add d-none (verify the stub isn't magic)
            $('#input-model-type').val('Static');
            $('#model-specific-card').removeClass('d-none');
            // Set without trigger
            $('#input-model-type').val('');
            expect($('#model-specific-card').hasClass('d-none')).toBe(false);
            // Now fire trigger to confirm the stub does work
            $('#input-model-type').trigger('change');
            expect($('#model-specific-card').hasClass('d-none')).toBe(true);
        });
    });

    // ── Bug 3: datasource type trigger ─────────────────────────────────────

    describe('Bug 3 – trigger(change) fires on datasource_type[] after clear', () => {
        test('identifier columns are hidden when row was in type M before clear', () => {
            const row = $('#group-datasources .row[data-source-row]').first();
            // Pre-condition: simulate type M (identifier visible, satellite hidden)
            row.find('select[name="datasource_type[]"]').val('M');
            row.find('.visibility-datasources-identifier').css('display', '');
            row.find('.visibility-datasources-satellite').css('display', 'none');

            clearModule.clearInputFields();

            // trigger('change') must have fired our handler → identifier hidden, satellite shown
            expect(row.find('.visibility-datasources-identifier').css('display')).toBe('none');
            expect(row.find('.visibility-datasources-satellite').css('display')).not.toBe('none');
        });

        test('datasource_type[] value is S after clear', () => {
            const row = $('#group-datasources .row[data-source-row]').first();
            row.find('select[name="datasource_type[]"]').val('M');

            clearModule.clearInputFields();

            expect(row.find('select[name="datasource_type[]"]').val()).toBe('S');
        });

        test('handler is NOT called if no trigger – guard test', () => {
            const row = $('#group-datasources .row[data-source-row]').first();
            row.find('select[name="datasource_type[]"]').val('M');
            row.find('.visibility-datasources-identifier').css('display', '');
            // Direct val() without trigger
            row.find('select[name="datasource_type[]"]').val('S');
            // jsdom normalises .css('display','') to 'block'; just ensure still visible (not 'none')
            expect(row.find('.visibility-datasources-identifier').css('display')).not.toBe('none');
            // Trigger now to confirm the stub works
            row.find('select[name="datasource_type[]"]').trigger('change');
            expect(row.find('.visibility-datasources-identifier').css('display')).toBe('none');
        });
    });

    // ── GGMs Characteristics fields ─────────────────────────────────────────

    describe('GGMs Characteristics fields are cleared', () => {
        test('tide system, degree, errors, error handling are empty', () => {
            clearModule.clearInputFields();
            expect($('#input-tide-system').val()).toBe('');
            expect($('#input-degree').val()).toBe('');
            expect($('#input-errors').val()).toBe('');
            expect($('#input-error-handling-approach').val()).toBe('');
        });

        test('earth gravity constant is empty', () => {
            clearModule.clearInputFields();
            expect($('#input-earth-gravity-constant').val()).toBe('');
        });
    });

    // ── Bug 4: errors → error handling visibility ─────────────────────────

    describe('Bug 4 – trigger(change) fires on #input-errors', () => {
        test('error-handling column is hidden when errors was calibrated before clear', () => {
            // Pre-condition: calibrated selected, error handling col visible
            $('#input-errors').val('calibrated');
            $('#error-handling-col').show();

            clearModule.clearInputFields();

            // trigger('change') must have fired our stub → col hidden
            expect($('#error-handling-col').css('display')).toBe('none');
        });

        test('#input-errors value is empty after clear', () => {
            $('#input-errors').val('calibrated');
            clearModule.clearInputFields();
            expect($('#input-errors').val()).toBe('');
        });

        test('handler is NOT called without trigger – guard test', () => {
            $('#input-errors').val('calibrated');
            $('#error-handling-col').show();
            // Direct val() without trigger must NOT hide the column
            $('#input-errors').val('');
            expect($('#error-handling-col').css('display')).not.toBe('none');
            // Now trigger to confirm the stub works
            $('#input-errors').trigger('change');
            expect($('#error-handling-col').css('display')).toBe('none');
        });
    });

    // ── Bug 5: mathematical-representation → spherical / ellipsoidal layout ─

    describe('Bug 5 – trigger(change) fires on #input-mathematical-representation', () => {
        test('ellipsoidal fields are hidden after clear (was ellipsoidal harmonics)', () => {
            // Pre-condition: ellipsoidal harmonics selected, ellipsoidal fields visible
            $('#input-mathematical-representation').val('ellipsoidal harmonics');
            $('.visibility-ellipsoidal').show();
            $('.visibility-spherical').hide();

            clearModule.clearInputFields();

            // trigger('change') fires stub → ellipsoidal hidden, spherical shown
            expect($('.visibility-ellipsoidal').first().css('display')).toBe('none');
            expect($('.visibility-spherical').first().css('display')).not.toBe('none');
        });

        test('#input-mathematical-representation value is empty after clear', () => {
            $('#input-mathematical-representation').val('ellipsoidal harmonics');
            clearModule.clearInputFields();
            expect($('#input-mathematical-representation').val()).toBe('');
        });

        test('handler is NOT called without trigger – guard test', () => {
            $('#input-mathematical-representation').val('ellipsoidal harmonics');
            $('.visibility-ellipsoidal').show();
            // Direct val() without trigger must NOT hide ellipsoidal fields
            $('#input-mathematical-representation').val('');
            expect($('.visibility-ellipsoidal').first().css('display')).not.toBe('none');
            // Trigger now to confirm stub works
            $('#input-mathematical-representation').trigger('change');
            expect($('.visibility-ellipsoidal').first().css('display')).toBe('none');
        });
    });

    // ── Bug 6: contact-person-error removed on clear ──────────────────────

    describe('Bug 6 – contact-person-error div is removed after clear', () => {
        test('#contact-person-error is removed when present before clear', () => {
            // Simulate what submitHandler.js appends on failed validation
            $('body').append('<div id="contact-person-error" class="text-danger mt-2">Please choose at least one contact person.</div>');
            expect($('#contact-person-error').length).toBe(1);

            clearModule.clearInputFields();

            expect($('#contact-person-error').length).toBe(0);
        });

        test('does nothing (no error) when #contact-person-error is absent', () => {
            expect($('#contact-person-error').length).toBe(0);
            // Must not throw
            expect(() => clearModule.clearInputFields()).not.toThrow();
        });
    });
});
