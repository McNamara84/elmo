const fs = require('fs');
const path = require('path');

describe('ggms-definition.js', () => {
    let $;

    beforeEach(() => {
        // Mock the DOM structure
        document.body.innerHTML = `
        <!-- Model Type (Dropdown) -->
        <div class="row">
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


    describe('setupICGEMFileFormats', () => {
        test('should populate select on successful ajax call', () => {
            const mockFormats = [{
                name: 'icgem1',
                description: 'ICGEM format 1'
            }, {
                name: 'icgem2',
                description: 'ICGEM format 2'
            }, ];

            // This mock simulates the full AJAX lifecycle
            jest.spyOn($, 'ajax').mockImplementation(options => {
                // 1. Simulate the 'beforeSend' callback
                if (options.beforeSend) {
                    options.beforeSend();
                }

                // 2. Simulate a successful response by calling 'success'
                if (options.success) {
                    options.success(mockFormats);
                }

                // 3. Simulate the 'complete' callback
                if (options.complete) {
                    options.complete();
                }
            });

            const selectElement = $('select[name="file_format"]');

            // Call the function AFTER the mock is in place
            window.setupICGEMFileFormats();

            // Assertions
            expect(selectElement.children().length).toBe(3); // "Choose..." + 2 formats
            expect(selectElement.find('option').eq(0).text()).toBe('Choose...');
            expect(selectElement.find('option').eq(1).val()).toBe('icgem1');
            expect(selectElement.find('option').eq(1).text()).toBe('icgem1');
            expect(selectElement.find('option').eq(1).attr('title')).toBe('ICGEM format 1');
            expect(selectElement.find('option').eq(2).val()).toBe('icgem2');
            expect(selectElement.prop('disabled')).toBe(false); // Verified by 'complete'
        });

        test('should show message when no formats are available', () => {
            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.beforeSend) options.beforeSend();
                if (options.success) options.success([]); // Simulate empty array response
                if (options.complete) options.complete();
            });

            setupICGEMFileFormats();

            const selectElement = $('select[name="file_format"]');
            expect(selectElement.children().length).toBe(2); // "Choose..." + "No formats" message
            expect(selectElement.find('option').eq(1).text()).toBe('No ICGEM file formats available');
            expect(selectElement.prop('disabled')).toBe(false);
        });

        test('should handle ajax errors gracefully', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.beforeSend) options.beforeSend();
                if (options.error) options.error({}, 'error', 'Internal Server Error');
                if (options.complete) options.complete();
            });

            setupICGEMFileFormats();

            const selectElement = $('select[name="file_format"]');
            expect(selectElement.children().length).toBe(1);
            expect(selectElement.find('option').text()).toBe('Error loading ICGEM file formats');
            expect(selectElement.prop('disabled')).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error loading file formats:", "error", "Internal Server Error");

            consoleErrorSpy.mockRestore();
        });
    });
    describe('setupModelTypes', () => {
        test('should populate select on successful ajax call', () => {
            const mockTypes = [{
                name: 'type1',
                description: 'Model type 1'
            }, {
                name: 'type2',
                description: 'Model type 2'
            }, ];

            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.url.includes('/vocabs/modeltypes')) {
                    if (options.beforeSend) options.beforeSend();
                    if (options.success) options.success(mockTypes);
                    if (options.complete) options.complete();
                }
            });

            const selectElement = $('select[name="model_type"]');
            window.setupModelTypes();

            expect(selectElement.children().length).toBe(3); // "Choose..." + 2 types
            expect(selectElement.find('option').eq(0).text()).toBe('Choose...');
            expect(selectElement.find('option').eq(1).val()).toBe('type1');
            expect(selectElement.find('option').eq(1).text()).toBe('type1');
            expect(selectElement.find('option').eq(1).attr('title')).toBe('Model type 1');
            expect(selectElement.find('option').eq(2).val()).toBe('type2');
            expect(selectElement.prop('disabled')).toBe(false);
        });

        test('should show message when no model types are available', () => {
            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.url.includes('/vocabs/modeltypes')) {
                    if (options.beforeSend) options.beforeSend();
                    if (options.success) options.success([]);
                    if (options.complete) options.complete();
                }
            });

            setupModelTypes();

            const selectElement = $('select[name="model_type"]');
            expect(selectElement.children().length).toBe(2);
            expect(selectElement.find('option').eq(1).text()).toBe('No ICGEM model types available');
            expect(selectElement.prop('disabled')).toBe(false);
        });

        test('should handle ajax errors gracefully', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.url.includes('/vocabs/modeltypes')) {
                    if (options.beforeSend) options.beforeSend();
                    if (options.error) options.error({}, 'error', 'Internal Server Error');
                    if (options.complete) options.complete();
                }
            });

            setupModelTypes();

            const selectElement = $('select[name="model_type"]');
            expect(selectElement.children().length).toBe(1);
            expect(selectElement.find('option').text()).toBe('Error loading ICGEM model types');
            expect(selectElement.prop('disabled')).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error loading file formats:", "error", "Internal Server Error");

            consoleErrorSpy.mockRestore();
        });
    });

    describe('setupMathReps', () => {
        test('should populate select on successful ajax call', () => {
            const mockReps = [{
                name: 'rep1',
                description: 'Math rep 1'
            }, {
                name: 'rep2',
                description: 'Math rep 2'
            }, ];

            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.url.includes('/vocabs/mathreps')) {
                    if (options.beforeSend) options.beforeSend();
                    if (options.success) options.success(mockReps);
                    if (options.complete) options.complete();
                }
            });

            const selectElement = $('select[name="mathematical_representation"]');
            window.setupMathReps();

            expect(selectElement.children().length).toBe(3); // "Choose..." + 2 reps
            expect(selectElement.find('option').eq(0).text()).toBe('Choose...');
            expect(selectElement.find('option').eq(1).val()).toBe('rep1');
            expect(selectElement.find('option').eq(1).text()).toBe('rep1');
            expect(selectElement.find('option').eq(1).attr('title')).toBe('Math rep 1');
            expect(selectElement.find('option').eq(2).val()).toBe('rep2');
            expect(selectElement.prop('disabled')).toBe(false);
        });

        test('should show message when no math reps are available', () => {
            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.url.includes('/vocabs/mathreps')) {
                    if (options.beforeSend) options.beforeSend();
                    if (options.success) options.success([]);
                    if (options.complete) options.complete();
                }
            });

            setupMathReps();

            const selectElement = $('select[name="mathematical_representation"]');
            expect(selectElement.children().length).toBe(2);
            expect(selectElement.find('option').eq(1).text()).toBe('No ICGEM mathematical representations available');
            expect(selectElement.prop('disabled')).toBe(false);
        });

        test('should handle ajax errors gracefully', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            jest.spyOn($, 'ajax').mockImplementation(options => {
                if (options.url.includes('/vocabs/mathreps')) {
                    if (options.beforeSend) options.beforeSend();
                    if (options.error) options.error({}, 'error', 'Internal Server Error');
                    if (options.complete) options.complete();
                }
            });

            setupMathReps();

            const selectElement = $('select[name="mathematical_representation"]');
            expect(selectElement.children().length).toBe(1);
            expect(selectElement.find('option').text()).toBe('Error loading ICGEM mathematical representations');
            expect(selectElement.prop('disabled')).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error loading file formats:", "error", "Internal Server Error");

            consoleErrorSpy.mockRestore();
        });
    });
});