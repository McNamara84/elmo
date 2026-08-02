const fs = require('fs');
const path = require('path');

describe('ggmsModelTypes.js', () => {
    let $;

    beforeEach(() => {
        // Load jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;
                // Define helper functions that are used in ggmsModelTypes.js
        window.visibilityON = function(element) {
            element.removeClass('d-none');
            element.attr('aria-hidden', 'false');
        };
        
        window.visibilityOFF = function(element) {
            element.addClass('d-none');
            element.attr('aria-hidden', 'true');
        };
        // Set up the document body with the necessary HTML structure
        document.body.innerHTML = `
            <select id="input-model-type">
                <option value="Choose...">Choose...</option>
                <option value="Static">Static</option>
                <option value="Temporal">Temporal</option>
                <option value="Topographic">Topographic</option>
                <option value="Simulated">Simulated</option>
            </select>

            <div class="card mb-2" id="model-specific-card">
                <div class="card-header">
                    <b>Model Types</b>
                    <i class="bi bi-question-circle-fill" data-help-section-id="help-no-model-type" aria-hidden="true"></i>
                </div>
                <div class="card-body" id="group-modelvars">
                    <!-- Static models special variables -->
                    <div class="visibility-modeltype-static d-none">
                        <h5 class="mb-3">Static models special variables</h5>
                        <hr>
                        <div class="row mb-3">
                            <div class="col-12 p-1">
                                <div class="form-check">
                                    <input class="form-check-input no-validation-style" type="checkbox" id="checkbox-time-variable">
                                    <label class="form-check-label" for="checkbox-time-variable">Time-variable coefficients provided</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Temporal models special variables -->
                    <div class="visibility-modeltype-temporal d-none">
                        <h5 class="mb-3">Temporal models special variables</h5>
                        <hr>
                        <div class="row mb-3">
                            <div class="col-sm-2 col-lg-2 p-1">
                                <div class="form-floating mb-1">
                                    <select class="form-select" id="select-release-frequency" name="releaseFrequency">
                                        <option selected value=""></option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                    <label for="select-release-frequency">Release frequency</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input no-validation-style" type="checkbox" id="checkbox-custom-frequency">
                                    <label class="form-check-label" for="checkbox-custom-frequency">Use custom release frequency</label>
                                </div>
                                <div class="form-floating mt-1 d-none" id="custom-frequency-container">
                                    <input type="text" class="form-control" id="input-temporal-frequency" name="temporalFrequency">
                                    <label for="input-temporal-frequency">Custom release frequency (days)</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Topographic variables special variables -->
                    <div class="visibility-modeltype-topographic d-none">
                        <h5 class="mb-3">Topographic variables special variables</h5>
                        <hr>
                        <div class="row">
                            <div id="single-density-container" class="col-12">
                                <div class="row" id="single-density-row"></div>
                            </div>
                            <div class="form-check mt-2">
                                <input class="form-check-input no-validation-style" type="checkbox" id="checkbox-separate-density">
                                <label class="form-check-label" for="checkbox-separate-density">Provide separate density for crust and mantle</label>
                            </div>
                            <div id="separate-density-container" class="d-none mt-2">
                                <div class="row"><h6>Crust</h6></div>
                                <div class="row mt-2"><h6>Mantle</h6></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const scriptPath = path.resolve(__dirname, '../../js/eventhandlers/formgroups/ggmsModelTypes.js');
        let scriptContent = fs.readFileSync(scriptPath, 'utf8');

        scriptContent = scriptContent
            .replace(
                "import { visibilityOFF, visibilityON } from '../functions.js';",
                "const { visibilityOFF, visibilityON } = require('../../js/eventhandlers/functions.js');"
            )
            .replace('$(document).ready(function() {', '')
            .replace(/}\);?\s*$/, '');

        new Function('$', 'require', scriptContent)($, require);
    });

    afterEach(() => {
        // Clean up the DOM
        document.body.innerHTML = '';
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        // Reset modules to ensure clean state for each test
        jest.resetModules();
    });

    describe('Model Type Visibility', () => {
        test('should hide the model-specific card initially', () => {
            $('#input-model-type').val('Choose...').trigger('change');
            expect($('#model-specific-card').hasClass('d-none')).toBe(true);
        });

        test('should show the card and static section for "Static" model type', () => {
            $('#input-model-type').val('Static').trigger('change');
            expect($('#model-specific-card').hasClass('d-none')).toBe(false);
            expect($('.visibility-modeltype-static').hasClass('d-none')).toBe(false);
            expect($('.visibility-modeltype-temporal').hasClass('d-none')).toBe(true);
            expect($('.visibility-modeltype-topographic').hasClass('d-none')).toBe(true);
            expect($('#model-specific-card .bi-question-circle-fill').attr('data-help-section-id')).toBe('help-static');
        });

        test('should show the card and temporal section for "Temporal" model type', () => {
            $('#input-model-type').val('Temporal').trigger('change');
            expect($('#model-specific-card').hasClass('d-none')).toBe(false);
            expect($('.visibility-modeltype-static').hasClass('d-none')).toBe(true);
            expect($('.visibility-modeltype-temporal').hasClass('d-none')).toBe(false);
            expect($('.visibility-modeltype-topographic').hasClass('d-none')).toBe(true);
            expect($('#model-specific-card .bi-question-circle-fill').attr('data-help-section-id')).toBe('help-temporal');
        });

        test('should show the card and topographic section for "Topographic" model type', () => {
            $('#input-model-type').val('Topographic').trigger('change');
            expect($('#model-specific-card').hasClass('d-none')).toBe(false);
            expect($('.visibility-modeltype-static').hasClass('d-none')).toBe(true);
            expect($('.visibility-modeltype-temporal').hasClass('d-none')).toBe(true);
            expect($('.visibility-modeltype-topographic').hasClass('d-none')).toBe(false);
            expect($('#model-specific-card .bi-question-circle-fill').attr('data-help-section-id')).toBe('help-topographic');
        });
    });

    describe('Separate Density Checkbox', () => {
        test('should show single density input by default', () => {
            expect($('#single-density-container').hasClass('d-none')).toBe(false);
            expect($('#separate-density-container').hasClass('d-none')).toBe(true);
        });

        test('should toggle to separate density inputs when checkbox is checked', () => {
            $('#checkbox-separate-density').prop('checked', true).trigger('change');
            expect($('#single-density-container').hasClass('d-none')).toBe(true);
            expect($('#separate-density-container').hasClass('d-none')).toBe(false);
        });
    });

    describe('Custom Release Frequency', () => {
        test('should show custom input and disable dropdown when checkbox is checked', () => {
            const customCheckbox = $('#checkbox-custom-frequency');
            const customContainer = $('#custom-frequency-container');
            const releaseFrequencySelect = $('#select-release-frequency');

            // Initial state: checkbox is unchecked
            expect(customContainer.hasClass('d-none')).toBe(true);
            expect(releaseFrequencySelect.prop('disabled')).toBe(false);

            // Action: check the box
            customCheckbox.prop('checked', true).trigger('change');

            // Assert: custom input is visible, dropdown is disabled
            expect(customContainer.hasClass('d-none')).toBe(false);
            expect(releaseFrequencySelect.prop('disabled')).toBe(true);
        });

        test('should hide custom input and enable dropdown when checkbox is unchecked', () => {
            const customCheckbox = $('#checkbox-custom-frequency');
            const customContainer = $('#custom-frequency-container');
            const releaseFrequencySelect = $('#select-release-frequency');

            // Setup: start with the checkbox checked
            customCheckbox.prop('checked', true).trigger('change');
            expect(customContainer.hasClass('d-none')).toBe(false);
            expect(releaseFrequencySelect.prop('disabled')).toBe(true);

            // Action: uncheck the box
            customCheckbox.prop('checked', false).trigger('change');

            // Assert: custom input is hidden, dropdown is enabled
            expect(customContainer.hasClass('d-none')).toBe(true);
            expect(releaseFrequencySelect.prop('disabled')).toBe(false);
        });
    });
});