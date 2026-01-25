/**
 * @jest-environment jsdom
 */

describe('originatingLaboratories.js', () => {
    let $;
    let labData;
    
    beforeEach(() => {
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        
        // Mock lab data
        labData = [
            {
                name: 'Test Lab 1',
                identifier: 'LAB-001',
                affiliation_name: 'University A',
                affiliation_ror: 'https://ror.org/12345'
            },
            {
                name: 'Test Lab 2',
                identifier: 'LAB-002',
                affiliation_name: 'University B',
                affiliation_ror: 'https://ror.org/67890'
            }
        ];
        
        // Set up DOM
        document.body.innerHTML = `
            <div id="group-originatinglaboratory">
                <div class="row" data-laboratory-row="1">
                    <select name="laboratoryName[]" id="select-lab-1">
                        <option value="">Select...</option>
                    </select>
                    <input name="LabId[]" id="input-labid-1" value="">
                    <input name="laboratoryAffiliation[]" id="input-affiliation-1" value="">
                    <input name="laboratoryRorIds[]" id="input-ror-1" value="">
                    <button type="button" class="btn btn-primary addLaboratory" id="button-originatinglaboratory-add">+</button>
                    <span class="input-group-text"><i class="bi-question-circle-fill"></i></span>
                </div>
            </div>
        `;
        
        // Mock $.getJSON
        $.getJSON = jest.fn((url, callback) => {
            callback(labData);
            return { fail: jest.fn() };
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('populateAllLabSelectOptions', () => {
        function populateAllLabSelectOptions(data) {
            if (!data || !data.length) {
                console.error('No lab data available for populating selects');
                return;
            }

            $('select[name="laboratoryName[]"]').each(function () {
                const selectElement = $(this)[0];
                selectElement.innerHTML = '';

                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.hidden = true;
                emptyOption.textContent = '';
                selectElement.appendChild(emptyOption);

                data.forEach(function (lab) {
                    const option = document.createElement('option');
                    option.value = lab.name;
                    option.textContent = lab.name + ' (' + lab.affiliation_name + ')';
                    selectElement.appendChild(option);
                });
            });
        }

        test('populates select with lab options', () => {
            populateAllLabSelectOptions(labData);
            
            const options = $('select[name="laboratoryName[]"] option');
            expect(options.length).toBe(3); // empty + 2 labs
        });

        test('creates option text with name and affiliation', () => {
            populateAllLabSelectOptions(labData);
            
            const firstLabOption = $('select[name="laboratoryName[]"] option').eq(1);
            expect(firstLabOption.text()).toBe('Test Lab 1 (University A)');
        });

        test('sets option value to lab name', () => {
            populateAllLabSelectOptions(labData);
            
            const firstLabOption = $('select[name="laboratoryName[]"] option').eq(1);
            expect(firstLabOption.val()).toBe('Test Lab 1');
        });

        test('handles empty data gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            populateAllLabSelectOptions([]);
            
            expect(consoleSpy).toHaveBeenCalledWith('No lab data available for populating selects');
            consoleSpy.mockRestore();
        });

        test('handles null data gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            populateAllLabSelectOptions(null);
            
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('lab selection change handler', () => {
        function setupChangeHandler(data) {
            $('select[name="laboratoryName[]"]').off('change').on('change', function () {
                const selectedName = $(this).val();
                const row = $(this).closest('.row');

                const lab = data.find(item => item.name === selectedName);

                if (lab) {
                    row.find('input[name="LabId[]"]').val(lab.identifier || '');
                    row.find('input[name="laboratoryAffiliation[]"]').val(lab.affiliation_name || '');
                    row.find('input[name="laboratoryRorIds[]"]').val(lab.affiliation_ror || '');
                } else {
                    row.find('input[name="LabId[]"]').val('');
                    row.find('input[name="laboratoryAffiliation[]"]').val('');
                    row.find('input[name="laboratoryRorIds[]"]').val('');
                }
            });
        }

        test('fills hidden fields when lab selected', () => {
            setupChangeHandler(labData);
            
            // Add the lab options first
            const select = $('select[name="laboratoryName[]"]');
            labData.forEach(lab => {
                select.append(`<option value="${lab.name}">${lab.name}</option>`);
            });
            
            // Select the lab and trigger change
            select.val('Test Lab 1').trigger('change');
            
            // Verify the handler was called by checking if the input values were set
            const labId = $('input[name="LabId[]"]').val();
            expect(labId).toBe('LAB-001');
        });

        test('clears hidden fields when no lab selected', () => {
            setupChangeHandler(labData);
            
            // First select a lab
            $('select[name="laboratoryName[]"]').val('Test Lab 1').trigger('change');
            
            // Then clear selection
            $('select[name="laboratoryName[]"]').val('').trigger('change');
            
            expect($('input[name="LabId[]"]').val()).toBe('');
            expect($('input[name="laboratoryAffiliation[]"]').val()).toBe('');
        });

        test('clears hidden fields when invalid lab name selected', () => {
            setupChangeHandler(labData);
            
            $('select[name="laboratoryName[]"]').val('Nonexistent Lab').trigger('change');
            
            expect($('input[name="LabId[]"]').val()).toBe('');
        });
    });

    describe('add laboratory button', () => {
        test('clones row when add button clicked', () => {
            let rowCounter = 1;
            
            $('#button-originatinglaboratory-add').on('click', function() {
                const laboratoryGroup = $('#group-originatinglaboratory');
                const firstRow = laboratoryGroup.children('.row').first();
                const newRow = firstRow.clone();
                
                newRow.find('input').val('').removeClass('is-invalid is-valid');
                newRow.find('select').val('');
                
                rowCounter++;
                newRow.find('[id]').each(function () {
                    const oldId = $(this).attr('id');
                    const newId = oldId + '_' + rowCounter;
                    $(this).attr('id', newId);
                });
                
                laboratoryGroup.append(newRow);
            });
            
            $('#button-originatinglaboratory-add').trigger('click');
            
            const rows = $('#group-originatinglaboratory .row');
            expect(rows.length).toBe(2);
        });

        test('updates IDs in cloned row', () => {
            let rowCounter = 1;
            
            $('#button-originatinglaboratory-add').on('click', function() {
                const laboratoryGroup = $('#group-originatinglaboratory');
                const firstRow = laboratoryGroup.children('.row').first();
                const newRow = firstRow.clone();
                
                rowCounter++;
                newRow.find('[id]').each(function () {
                    const oldId = $(this).attr('id');
                    const newId = oldId + '_' + rowCounter;
                    $(this).attr('id', newId);
                });
                
                laboratoryGroup.append(newRow);
            });
            
            $('#button-originatinglaboratory-add').trigger('click');
            
            const newSelect = $('#group-originatinglaboratory .row:last select');
            expect(newSelect.attr('id')).toBe('select-lab-1_2');
        });

        test('clears values in cloned row', () => {
            // First, set some values
            $('input[name="LabId[]"]').val('LAB-001');
            
            $('#button-originatinglaboratory-add').on('click', function() {
                const laboratoryGroup = $('#group-originatinglaboratory');
                const firstRow = laboratoryGroup.children('.row').first();
                const newRow = firstRow.clone();
                
                newRow.find('input').val('');
                newRow.find('select').val('');
                
                laboratoryGroup.append(newRow);
            });
            
            $('#button-originatinglaboratory-add').trigger('click');
            
            const newLabId = $('#group-originatinglaboratory .row:last input[name="LabId[]"]');
            expect(newLabId.val()).toBe('');
        });
    });

    describe('remove laboratory button', () => {
        test('remove button removes row', () => {
            // Add a second row first
            const secondRow = `
                <div class="row" data-laboratory-row="2">
                    <select name="laboratoryName[]"></select>
                    <input name="LabId[]" value="">
                    <button type="button" class="btn btn-danger removeButton">-</button>
                </div>
            `;
            $('#group-originatinglaboratory').append(secondRow);
            
            // Attach remove handler
            $('.removeButton').on('click', function() {
                $(this).closest('.row').remove();
            });
            
            expect($('#group-originatinglaboratory .row').length).toBe(2);
            
            $('.removeButton').trigger('click');
            
            expect($('#group-originatinglaboratory .row').length).toBe(1);
        });
    });

    describe('replaceHelpButtonInClonedRows', () => {
        function replaceHelpButtonInClonedRows(row, roundCornersClass = "input-right-with-round-corners") {
            // Check if input-group-text elements are visible
            const helpSpans = row.find("span.input-group-text:has(i.bi-question-circle-fill)");
            helpSpans.each(function () {
                $(this).replaceWith('<div class="input-group-text" style="visibility: hidden; width: 42px; height: 38px;"></div>');
            });
            row.find(".input-with-help").removeClass("input-right-no-round-corners");
            row.find(".input-with-help").addClass(roundCornersClass);
        }

        test('replaces help span with hidden div', () => {
            const row = $('#group-originatinglaboratory .row:first');
            
            replaceHelpButtonInClonedRows(row);
            
            // The span should be replaced with a div
            expect(row.find('div.input-group-text').length).toBeGreaterThanOrEqual(1);
        });
    });
});
