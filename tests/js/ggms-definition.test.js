const fs = require('fs');
const path = require('path');

describe('ggms-definition.js', () => {
    let $;

    beforeEach(() => {
        // Mock the DOM structure
        document.body.innerHTML = `
        <!-- Model Type (Dropdown) -->
        <div class="col-12 col-md-6 col-lg-3 p-1">
            <div class="input-group has-validation">
                <div class="form-floating">
                    <select class="form-select input-with-help input-right-no-round-corners" 
                            id="input-model-type" 
                            name="model_type" 
                            required>
                    </select>
                    <label for="input-model-type">
                        <span data-translate="model.type">Model Type</span>
                        <span class="text-danger">*</span>
                    </label>
                    <div class="invalid-feedback">Please provide model type.</div>
                </div>
                <div class="input-group-append">
                    <span class="input-group-text">
                        <i class="bi bi-question-circle-fill" data-help-section-id="help-model-type"></i>
                    </span>
                </div>
                <div class="invalid-feedback" data-translate="general.pleaseChoose"></div>
            </div>
        </div>

        <!-- Mathematical Representation (Dropdown) -->
        <div class="col-12 col-md-6 col-lg-3 p-1">
            <div class="input-group has-validation">
                <div class="form-floating">
                    <select class="form-select input-with-help input-right-no-round-corners" 
                            id="input-mathematical-representation" 
                            name="mathematical_representation" 
                            required>
                    </select>
                    <label for="input-mathematical-representation">
                        Mathematical representation
                        <span class="text-danger">*</span>
                    </label>
                    <div class="invalid-feedback">Please provide mathematical representation.</div>
                </div>
                <div class="input-group-append">
                    <span class="input-group-text">
                        <i class="bi bi-question-circle-fill" data-help-section-id="help-math-representation"></i>
                    </span>
                </div>
            </div>
        </div>

        <!-- File Format (Dropdown) -->
        <div class="col-12 col-md-6 col-lg-3 p-1">
            <div class="form-floating">
                <select class="form-select" id="input-file-format" name="file_format" required>
                </select>
                <label for="input-file-format">File format</label>
                <div class="invalid-feedback">Please provide file format</div>
            </div>
        </div>

        <!-- Celestial Body (Dropdown) -->
        <div class="col-12 col-md-6 col-lg-3 p-1">
            <div class="form-floating">
                <select class="form-select" id="input-celestial-body" name="celestial_body">
                    <option value="Earth" selected>Earth</option>
                    <option value="Moon of the Earth">Moon of the Earth</option>
                    <option value="Mars">Mars</option>
                    <option value="Ceres">Ceres</option>
                    <option value="Venus">Venus</option>
                    <option value="Other">Other</option>
                </select>
                <label for="input-celestial-body">Celestial body</label>
            </div>
        </div>

        <!-- Model Name (Text Input) -->
        <div class="col-12 col-md-12 col-lg-12 p-1">
            <div class="form-floating">
                <input type="text" class="form-control" id="input-model-name" 
                       name="model_name" 
                       pattern="^[^\\s]+$"      
                       required>
                <label for="input-model-name">Model name
                    <span class="text-danger">*</span>
                </label>
                <div class="invalid-feedback">Please provide model name. No spaces are allowed in it.</div>
            </div>
        </div>
        `;

        // Load jQuery and set up the global environment
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Load and modify the script
        let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/formgroups/ggms-definition.js'), 'utf8');
        script = script.replace(/\$\(document\)\.ready\(function\(\) \{/g, '(function() {');
        script = script.replace(/\n\}\);\s*$/g, '\n})();');
        window.eval(script);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete global.setupICGEMFileFormats;
        delete global.setupModelTypes;
        delete global.setupMathReps;
    });

    test('model types should be loaded into the document correctly', () => {
        // Mock the AJAX response
        jest.spyOn($, 'ajax').mockImplementation(({ success }) => {
            success([
                {
                    id: 1,
                    name: "Static",
                    description: "Models of gravity field potential computed from satellite-based gravity measurements."
                },
                {
                    id: 2,
                    name: "Temporal",
                    description: "Models derived from input data of dedicated time periods."
                },
                {
                    id: 3,
                    name: "Topographic",
                    description: "Models represent the gravitational potential generated by Earth's topographic masses."
                },
                {
                    id: 4,
                    name: "Simulated",
                    description: "Models based on simulated data, not based on any measurements."
                }
            ]);
        });

        // Call the function to populate the dropdown
        setupModelTypes();

        // Get the dropdown element
        const selectId = "#input-model-type" ;
        var modelTypes = $(selectId).closest(".row").find('select[name="model_type"]');
        console.log('Dropdown HTML after AJAX:', modelTypes);

        // Assertions
        expect(modelTypes.children().length).toBe(5); // Includes the placeholder option
        expect(modelTypes.find('option').eq(1).val()).toBe('Static');
        expect(modelTypes.find('option').eq(1).text()).toBe('Static');
        expect(modelTypes.find('option').eq(2).val()).toBe('Temporal');
        expect(modelTypes.find('option').eq(2).text()).toBe('Temporal');
        expect(modelTypes.find('option').eq(3).val()).toBe('Topographic');
        expect(modelTypes.find('option').eq(3).text()).toBe('Topographic');
        expect(modelTypes.find('option').eq(4).val()).toBe('Simulated');
        expect(modelTypes.find('option').eq(4).text()).toBe('Simulated');
    });
});