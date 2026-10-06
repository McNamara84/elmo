const fs = require('fs');
const path = require('path');

describe('ggmsMascons.js', () => {
    let $;

    const MASCON_DOM = `
        <select id="input-model-type" name="model_type">
            <option value="">Choose...</option>
            <option value="Static">Static</option>
            <option value="Temporal">Temporal</option>
            <option value="Altimetry-derived">Altimetry-derived</option>
        </select>
        <select id="input-mathematical-representation" name="mathematical_representation">
            <option value="">Choose...</option>
            <option value="Spherical harmonics">Spherical harmonics</option>
            <option value="Gridded dataset">Gridded dataset</option>
            <option value="MASCON">MASCON</option>
        </select>
        <div class="card mb-2 d-none" aria-hidden="true">
            <div class="card-body">
                <div id="group-ggmsmascons">
                    <input type="text" id="input-land-mascon" required>
                    <div class="row" id="mascon-background-model-list">
                        <div class="col-12 col-md-6 p-1" data-mascon-background-model>
                            <select id="input-mascon-background-model-type" name="mascon_background_model_type[]">
                                <option value="">Choose...</option>
                                <option value="static_gravity_field">Static Gravity Field</option>
                                <option value="solid_earth_tides">Solid Earth Tides</option>
                                <option value="ocean_tides">Ocean Tides</option>
                                <option value="solid_pole_tide">Solid Pole Tide</option>
                                <option value="ocean_pole_tide">Ocean Pole Tide</option>
                                <option value="aod">AOD</option>
                                <option value="atmospheric_tides">Atmospheric Tides</option>
                                <option value="third_body_attractions">Third-Body attractions</option>
                                <option value="general_relativity">General relativity</option>
                                <option value="other">Other</option>
                            </select>
                            <input type="text" id="input-mascon-background-model-name" name="mascon_background_model_name[]">
                            <button type="button" class="btn btn-primary addMasconBackgroundModel" id="button-mascon-background-model-add">+</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="card mb-2" id="characteristics-card">
            <input type="number" id="input-degree">
        </div>
    `;

    function loadMasconsScript() {
        const scriptPath = path.resolve(__dirname, '../../js/eventhandlers/formgroups/ggmsMascons.js');
        let scriptContent = fs.readFileSync(scriptPath, 'utf8');
        scriptContent = scriptContent
            .replace(
                "import { visibilityOFF, visibilityON, createRemoveButton } from '../functions.js';",
                "const { visibilityOFF, visibilityON, createRemoveButton } = require('../../js/eventhandlers/functions.js');"
            )
            .replace('$(document).ready(function () {', '')
            .replace(/}\);?\s*$/, '');
        new Function('$', 'require', scriptContent)($, require);
    }

    beforeEach(() => {
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        document.body.innerHTML = MASCON_DOM;
        loadMasconsScript();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        jest.resetModules();
    });

    function masconCard() {
        return $('#group-ggmsmascons').closest('.card');
    }

    describe('visibility', () => {
        test('hides the MASCON form group when mathematical representation is empty', () => {
            expect(masconCard().hasClass('d-none')).toBe(true);
            expect($('#input-land-mascon').prop('disabled')).toBe(true);
        });

        test('shows the MASCON form group only when mathematical representation is MASCON', () => {
            $('#input-mathematical-representation').val('MASCON').trigger('change');

            expect(masconCard().hasClass('d-none')).toBe(false);
            expect(masconCard().attr('aria-hidden')).toBe('false');
            expect($('#input-land-mascon').prop('disabled')).toBe(false);
            expect($('#characteristics-card').hasClass('d-none')).toBe(true);
        });

        test('hides the MASCON form group for spherical harmonics', () => {
            $('#input-mathematical-representation').val('MASCON').trigger('change');
            $('#input-mathematical-representation').val('Spherical harmonics').trigger('change');

            expect(masconCard().hasClass('d-none')).toBe(true);
            expect($('#input-land-mascon').prop('disabled')).toBe(true);
            expect($('#characteristics-card').hasClass('d-none')).toBe(false);
        });

        test('keeps characteristics hidden when leaving MASCON for altimetry-derived', () => {
            $('#input-mathematical-representation').val('MASCON').trigger('change');
            $('#input-model-type').val('Altimetry-derived');
            $('#input-mathematical-representation').val('Gridded dataset').trigger('change');

            expect(masconCard().hasClass('d-none')).toBe(true);
            expect($('#characteristics-card').hasClass('d-none')).toBe(true);
        });

        test('re-syncs visibility after ICGEM upload populate', () => {
            expect(masconCard().hasClass('d-none')).toBe(true);

            $('#input-mathematical-representation').val('MASCON');
            $(document).trigger('icgem:form-populated');

            expect(masconCard().hasClass('d-none')).toBe(false);
        });
    });

    describe('background force models', () => {
        function modelSlots() {
            return $('#mascon-background-model-list').children('[data-mascon-background-model]');
        }

        test('starts with one half-width slot that contains type, name, and add', () => {
            const first = modelSlots().first();
            expect(modelSlots().length).toBe(1);
            expect(first.hasClass('col-md-6')).toBe(true);
            expect(first.find('#input-mascon-background-model-type option').length).toBe(11);
            expect(first.find('#input-mascon-background-model-name').length).toBe(1);
            expect(first.find('.addMasconBackgroundModel').length).toBe(1);
            expect(first.find('.removeButton').length).toBe(0);
        });

        test('add places a second half-width slot with a remove button on the same row', () => {
            $('#input-mathematical-representation').val('MASCON').trigger('change');
            $('.addMasconBackgroundModel').trigger('click');

            expect(modelSlots().length).toBe(2);
            expect(modelSlots().eq(1).hasClass('col-md-6')).toBe(true);
            expect(modelSlots().eq(1).find('.removeButton').length).toBe(1);
            expect(modelSlots().eq(1).find('#input-mascon-background-model-type-1').length).toBe(1);
            expect(modelSlots().eq(1).find('#input-mascon-background-model-name-1').length).toBe(1);
            expect(modelSlots().first().find('.addMasconBackgroundModel').length).toBe(1);
        });

        test('remove deletes only that slot and leaves the first addable slot', () => {
            $('#input-mathematical-representation').val('MASCON').trigger('change');
            $('.addMasconBackgroundModel').trigger('click');
            $('.addMasconBackgroundModel').trigger('click');
            expect(modelSlots().length).toBe(3);

            modelSlots().eq(1).find('.removeButton').trigger('click');

            expect(modelSlots().length).toBe(2);
            expect(modelSlots().first().find('.addMasconBackgroundModel').length).toBe(1);
        });
    });
});

describe('populateIcgemDefinition MASCON upload', () => {
    let $;
    let icgemModule;

    beforeEach(() => {
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        document.body.innerHTML = `
            <input id="input-model-name">
            <select id="input-model-type" name="model_type">
                <option value="">Choose...</option>
                <option value="Temporal">Temporal</option>
            </select>
            <select id="input-mathematical-representation" name="mathematical_representation">
                <option value="">Choose...</option>
            </select>
            <select id="input-file-format" name="file_format">
                <option value="">Choose...</option>
            </select>
            <input id="input-celestial-body">
        `;

        jest.resetModules();
        icgemModule = require('../../js/mappingXmlToInputFieldsIcgem.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete global.$;
        delete global.jQuery;
        delete window.$;
        delete window.jQuery;
        jest.resetModules();
    });

    test('creates a MASCON option when the vocab dropdown has not loaded yet', () => {
        icgemModule.populateIcgemDefinition({
            scalars: { mathematicalRepresentation: 'MASCON' }
        });

        const $select = $('#input-mathematical-representation');
        expect($select.find('option').filter(function () {
            return $(this).text() === 'MASCON';
        }).length).toBe(1);
        expect($select.val()).toBe('MASCON');
    });

    test('selectOrCreateOption is a no-op for empty selects', () => {
        expect(icgemModule.selectOrCreateOption($('#missing'), 'MASCON')).toBe(false);
        expect(icgemModule.selectOrCreateOption($('#input-mathematical-representation'), '')).toBe(false);
    });
});
