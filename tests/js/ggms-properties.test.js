const fs = require('fs');
const path = require('path');
describe('ggms-properties.js', () => {
  let $;
  
  beforeEach(() => {
    // Create a mock DOM based on the GGMsProperties.html structure
    document.body.innerHTML = `
      <form class="needs-validation">        
        <!-- Mathematical Representation (not in form group but needed for tests) -->
        <select id="input-mathematical-representation">
          <option value="">Choose...</option>
          <option value="spherical harmonics">spherical harmonics</option>
          <option value="ellipsoidal harmonics">ellipsoidal harmonics</option>
        </select>
        
        <div id="group-ggmstechnical">
          <!-- Tide System, Degree, Errors (not being tested but needed for structure) -->
          <div class="row">
            <div class="col-12 col-md-4 col-lg-6 p-1">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <select class="form-select" id="input-errors" name="errors">
                    <option value="">Choose...</option>
                    <option value="calibrated">calibrated</option>
                    <option value="formal">formal</option>
                    <option value="no">no</option>
                  </select>
                  <label for="input-errors"><span>Errors</span></label>
                </div>
              </div>
            </div>
            <div class="col-12 col-md-8 col-lg-4 p-1">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <textarea id="input-error-handling-approach" name="error_handling_approach"></textarea>
                  <label for="input-error-handling-approach">Error handling approach</label>
                </div>
              </div>
            </div>
          </div>

          <div class="row">
            <!-- Spherical fields -->
            <div class="col-12 col-md-6 col-lg-6 p-1 visibility-spherical">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" id="input-radius" name="radius">
                  <label for="input-radius">
                    <span>Radius (in km)</span>
                  </label>
                </div>
              </div>
            </div>
            
            <!-- Ellipsoidal fields -->
            <div class="col-12 col-md-12 col-lg-4 p-1 visibility-ellipsoidal">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" id="input-semimajor-axis" name="semimajor_axis_a">
                  <label for="input-semimajor-axis">
                    <span>Semimajor axis a</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4 p-1 visibility-ellipsoidal">
              <div class="input-group">
                <div class="form-floating">
                  <select id="input-second-variable" name="second_variable">
                    <option value="">Choose...</option>
                    <option value="axis_b">axis b</option>
                    <option value="flattening">flattening</option>
                    <option value="reciprocal_flattening">reciprocal flattening</option>
                  </select>
                  <label for="input-second-variable">
                    <span>Second variable</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4 p-1 visibility-ellipsoidal">
              <div class="input-group has-validation">
                <div class="form-floating">
                  <input type="text" id="input-second-variable-value" name="second_variable_value">
                  <label for="input-second-variable-value">
                    <span>Value</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `;

    // Set up jQuery
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    
    // Load the script (usually this would be done by converting the import in the test environment)
    let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/formgroups/ggms-properties.js'), 'utf8');    
    script = script.replace('$(document).ready(function() {', '(function() {');
    script = script.replace(/\n\}\);$/, '\n})();');
    window.eval(script);
    
    // Spy on functions to track their calls
    jest.spyOn(window, 'updateSecondVariableLabel');
    jest.spyOn(window, 'updateErrorHandlingVisibility');
    jest.spyOn(window, 'updateReferenceSystemVisibility');
    jest.spyOn(window, 'updateReferenceSystemVisibility');
    jest.spyOn(window, 'initializeTechnicalFields');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  // Test updateSecondVariableLabel function
  describe('updateSecondVariableLabel', () => {
    test('should set label text to "Axis b value" when "axis_b" is selected', () => {
      $('#input-second-variable').val('axis_b');
      // Call the function directly instead of relying on event trigger
      window.updateSecondVariableLabel();
      expect($('label[for="input-second-variable-value"] span:first-child').text()).toBe('Axis b value');
    });

    test('should set label text to "Flattening value" when "flattening" is selected', () => {
      $('#input-second-variable').val('flattening');
      window.updateSecondVariableLabel();
      expect($('label[for="input-second-variable-value"] span:first-child').text()).toBe('Flattening value');
    });

    test('should set label text to "Reciprocal flattening value" when "reciprocal_flattening" is selected', () => {
      $('#input-second-variable').val('reciprocal_flattening');
      window.updateSecondVariableLabel();
      expect($('label[for="input-second-variable-value"] span:first-child').text()).toBe('Reciprocal flattening value');
    });

    test('should leave label as "Value" when no option is selected', () => {
      $('#input-second-variable').val('');
      window.updateSecondVariableLabel();
      expect($('label[for="input-second-variable-value"] span:first-child').text()).toBe('Value');
    });
  });

  // Test updateErrorHandlingVisibility function
  describe('updateErrorHandlingVisibility', () => {
    test('should show error handling approach field when "calibrated" is selected', () => {
        $('#input-errors').val('calibrated');
        // Call function directly instead of relying on event trigger
        window.updateErrorHandlingVisibility();
        
        expect($('#input-error-handling-approach').closest('.col-12').css('display')).not.toBe('none');
        expect($('#input-error-handling-approach').attr('required')).toBe('required');
        expect($('#input-errors').closest('.col-12').hasClass('col-lg-2')).toBeTruthy();
        expect($('#input-errors').closest('.col-12').hasClass('col-lg-6')).toBeFalsy();
    });

    test('should hide error handling approach field when "formal" is selected', () => {
        $('#input-errors').val('formal');
        // Call function directly
        window.updateErrorHandlingVisibility();
        
        expect($('#input-error-handling-approach').closest('.col-12').css('display')).toBe('none');
        expect($('#input-error-handling-approach').attr('required')).toBeUndefined();
        expect($('#input-errors').closest('.col-12').hasClass('col-lg-6')).toBeTruthy();
        expect($('#input-errors').closest('.col-12').hasClass('col-lg-2')).toBeFalsy();
    });

    test('should hide error handling approach field when "no" is selected', () => {
        $('#input-errors').val('no');
        // Call function directly
        window.updateErrorHandlingVisibility();
        
        expect($('#input-error-handling-approach').closest('.col-12').css('display')).toBe('none');
        expect($('#input-error-handling-approach').attr('required')).toBeUndefined();
    });

    test('should clear error handling approach field value when hiding', () => {
        // First make it required
        $('#input-errors').val('calibrated');
        window.updateErrorHandlingVisibility();
        
        // Then add some value and validation
        $('#input-error-handling-approach').val('Some approach').addClass('is-valid');
        
        // Now change to a value that hides it
        $('#input-errors').val('no');
        window.updateErrorHandlingVisibility();
        
        expect($('#input-error-handling-approach').val()).toBe('');
        expect($('#input-error-handling-approach').hasClass('is-valid')).toBeFalsy();
    });
  });

  // Test initializeTechnicalFields function
  describe('initializeTechnicalFields', () => {
    test('should call all initialization functions', () => {
      window.updateReferenceSystemVisibility.mockClear();
      window.updateSecondVariableLabel.mockClear();
      window.updateErrorHandlingVisibility.mockClear();
      
      window.initializeTechnicalFields();
      
      expect(window.updateReferenceSystemVisibility).toHaveBeenCalled();
      expect(window.updateSecondVariableLabel).toHaveBeenCalled();
      expect(window.updateErrorHandlingVisibility).toHaveBeenCalled();
    });
  });
  describe('Mathematical Representation Change', () => {
    test('should show ellipsoidal fields and set required attributes when "ellipsoidal harmonics" is selected', () => {
      // Simulate selecting "ellipsoidal harmonics"
      $('#input-mathematical-representation').val('ellipsoidal harmonics').trigger('change');

      // Explicitly call the function to ensure it runs
      window.updateReferenceSystemVisibility();

      // Verify that ellipsoidal fields are visible
      expect($('.visibility-ellipsoidal').css('display')).not.toBe('none');

      // Verify that spherical fields are hidden
      expect($('.visibility-spherical').css('display')).toBe('none');

      // Check required attributes for ellipsoidal fields
      expect($('#input-semimajor-axis').attr('required')).toBe('required');
      expect($('#input-second-variable').attr('required')).toBe('required');
      expect($('#input-second-variable-value').attr('required')).toBe('required');

      // Check that spherical fields are not required
      expect($('#input-radius').attr('required')).toBeUndefined();
    });

    test('should show spherical fields and set required attributes when "spherical harmonics" is selected', () => {
      // Simulate selecting "spherical harmonics"
      $('#input-mathematical-representation').val('spherical harmonics').trigger('change');

      // Explicitly call the function to ensure it runs
      window.updateReferenceSystemVisibility();

      // Verify that spherical fields are visible
      expect($('.visibility-spherical').css('display')).not.toBe('none');

      // Verify that ellipsoidal fields are hidden
      expect($('.visibility-ellipsoidal').css('display')).toBe('none');

      // Check required attributes for spherical fields
      expect($('#input-radius').attr('required')).toBe('required');

      // Check that ellipsoidal fields are not required
      expect($('#input-semimajor-axis').attr('required')).toBeUndefined();
      expect($('#input-second-variable').attr('required')).toBeUndefined();
      expect($('#input-second-variable-value').attr('required')).toBeUndefined();
    });
  });
});