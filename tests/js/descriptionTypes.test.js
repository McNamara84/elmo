/**
 * @jest-environment jsdom
 */

const { requireFresh } = require('./utils');

describe('descriptionTypes.js', () => {
    let module;

    beforeEach(() => {
        // Set up jQuery
        const $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        global.window = window;
        window.$ = $;
        window.jQuery = $;
        window.applyTranslations = jest.fn();
        window.updateHelpStatus = jest.fn();
        global.updateHelpStatus = jest.fn();

        // Set up DOM with accordion container
        document.body.innerHTML = `
            <div class="accordion" id="accordion-description">
                <div class="accordion-item">
                    <textarea id="input-abstract" name="descriptionAbstract"></textarea>
                </div>
            </div>
        `;

        // Mock $.ajax
        $.ajax = jest.fn();

        module = requireFresh('../../js/descriptionTypes.js');
    });

    afterEach(() => {
        delete global.$;
        delete global.jQuery;
        delete window.applyTranslations;
        delete window.updateHelpStatus;
        delete global.updateHelpStatus;
        delete window.ELMO_ACTIVE_DESCRIPTION_TYPES;
        delete window.descriptionTypesReady;
        jest.restoreAllMocks();
    });

    describe('SLUG_TO_TRANSLATION_KEY', () => {
        test('contains mappings for all dynamic description types', () => {
            expect(module.SLUG_TO_TRANSLATION_KEY).toHaveProperty('Methods');
            expect(module.SLUG_TO_TRANSLATION_KEY).toHaveProperty('TechnicalInfo');
            expect(module.SLUG_TO_TRANSLATION_KEY).toHaveProperty('Other');
            expect(module.SLUG_TO_TRANSLATION_KEY).toHaveProperty('SeriesInformation');
            expect(module.SLUG_TO_TRANSLATION_KEY).toHaveProperty('TableOfContents');
        });

        test('does not contain Abstract mapping', () => {
            expect(module.SLUG_TO_TRANSLATION_KEY).not.toHaveProperty('Abstract');
        });
    });

    describe('SLUG_TO_HELP_ID', () => {
        test('maps slugs to correct help section IDs', () => {
            expect(module.SLUG_TO_HELP_ID.Methods).toBe('help-description-methods');
            expect(module.SLUG_TO_HELP_ID.TechnicalInfo).toBe('help-description-technicalinfo');
            expect(module.SLUG_TO_HELP_ID.Other).toBe('help-description-other');
            expect(module.SLUG_TO_HELP_ID.SeriesInformation).toBe('help-description-seriesinformation');
            expect(module.SLUG_TO_HELP_ID.TableOfContents).toBe('help-description-tableofcontents');
        });
    });

    describe('buildAccordionItem', () => {
        test('creates accordion item with correct structure', () => {
            const type = { id: 2, name: 'Methods', slug: 'Methods' };
            const item = module.buildAccordionItem(type);

            expect(item.hasClass('accordion-item')).toBe(true);
            expect(item.attr('data-description-slug')).toBe('Methods');
        });

        test('creates textarea with correct name attribute', () => {
            const type = { id: 2, name: 'Methods', slug: 'Methods' };
            const item = module.buildAccordionItem(type);
            const textarea = item.find('textarea');

            expect(textarea.attr('name')).toBe('description[Methods]');
            expect(textarea.attr('id')).toBe('input-description-Methods');
        });

        test('sets data-translate attribute on button', () => {
            const type = { id: 2, name: 'Methods', slug: 'Methods' };
            const item = module.buildAccordionItem(type);
            const button = item.find('button');

            expect(button.attr('data-translate')).toBe('descriptions.methods');
        });

        test('sets data-translate-placeholder on textarea', () => {
            const type = { id: 2, name: 'Methods', slug: 'Methods' };
            const item = module.buildAccordionItem(type);
            const textarea = item.find('textarea');

            expect(textarea.attr('data-translate-placeholder')).toBe('descriptions.methodsPlaceholder');
        });

        test('sets help section ID on icon', () => {
            const type = { id: 2, name: 'Methods', slug: 'Methods' };
            const item = module.buildAccordionItem(type);
            const helpIcon = item.find('i.bi-question-circle-fill');

            expect(helpIcon.attr('data-help-section-id')).toBe('help-description-methods');
            expect(helpIcon.attr('id')).toBe('methods-help');
        });

        test('sets aria-describedby on textarea', () => {
            const type = { id: 2, name: 'Methods', slug: 'Methods' };
            const item = module.buildAccordionItem(type);
            const textarea = item.find('textarea');

            expect(textarea.attr('aria-describedby')).toBe('methods-help');
        });

        test('creates visually-hidden label', () => {
            const type = { id: 5, name: 'Technical Info', slug: 'TechnicalInfo' };
            const item = module.buildAccordionItem(type);
            const label = item.find('label.visually-hidden');

            expect(label.length).toBe(1);
            expect(label.attr('for')).toBe('input-description-TechnicalInfo');
        });

        test('handles unknown slugs gracefully', () => {
            const type = { id: 99, name: 'Unknown Type', slug: 'UnknownType' };
            const item = module.buildAccordionItem(type);

            expect(item.hasClass('accordion-item')).toBe(true);
            const textarea = item.find('textarea');
            expect(textarea.attr('name')).toBe('description[UnknownType]');
        });
    });

    describe('initDescriptionTypes', () => {
        test('skips Abstract type and only renders dynamic types', async () => {
            $.ajax.mockImplementation(function (options) {
                options.success([
                    { id: 1, name: 'Abstract', slug: 'Abstract' },
                    { id: 2, name: 'Methods', slug: 'Methods' },
                    { id: 6, name: 'Other', slug: 'Other' }
                ]);
            });

            const slugs = await module.initDescriptionTypes();

            expect(slugs).toEqual(['Methods', 'Other']);
            expect(slugs).not.toContain('Abstract');
        });

        test('stores active slugs in window.ELMO_ACTIVE_DESCRIPTION_TYPES', async () => {
            $.ajax.mockImplementation(function (options) {
                options.success([
                    { id: 1, name: 'Abstract', slug: 'Abstract' },
                    { id: 2, name: 'Methods', slug: 'Methods' }
                ]);
            });

            await module.initDescriptionTypes();

            expect(window.ELMO_ACTIVE_DESCRIPTION_TYPES).toEqual(['Methods']);
        });

        test('calls applyTranslations after rendering', async () => {
            $.ajax.mockImplementation(function (options) {
                options.success([{ id: 2, name: 'Methods', slug: 'Methods' }]);
            });

            await module.initDescriptionTypes();

            expect(window.applyTranslations).toHaveBeenCalled();
        });

        test('appends accordion items to the accordion container', async () => {
            $.ajax.mockImplementation(function (options) {
                options.success([
                    { id: 1, name: 'Abstract', slug: 'Abstract' },
                    { id: 2, name: 'Methods', slug: 'Methods' },
                    { id: 5, name: 'Technical Info', slug: 'TechnicalInfo' }
                ]);
            });

            await module.initDescriptionTypes();

            const items = $('#accordion-description .accordion-item[data-description-slug]');
            expect(items.length).toBe(2);
        });

        test('resolves with empty array on API error', async () => {
            $.ajax.mockImplementation(function (options) {
                options.error({ status: 500 });
            });

            const slugs = await module.initDescriptionTypes();

            expect(slugs).toEqual([]);
            expect(window.ELMO_ACTIVE_DESCRIPTION_TYPES).toEqual([]);
        });

        test('handles non-array response gracefully', async () => {
            $.ajax.mockImplementation(function (options) {
                options.success('invalid');
            });

            const slugs = await module.initDescriptionTypes();

            expect(slugs).toEqual([]);
        });

        test('renders all 5 dynamic types correctly', async () => {
            $.ajax.mockImplementation(function (options) {
                options.success([
                    { id: 1, name: 'Abstract', slug: 'Abstract' },
                    { id: 2, name: 'Methods', slug: 'Methods' },
                    { id: 3, name: 'Series Information', slug: 'SeriesInformation' },
                    { id: 4, name: 'Table of Contents', slug: 'TableOfContents' },
                    { id: 5, name: 'Technical Info', slug: 'TechnicalInfo' },
                    { id: 6, name: 'Other', slug: 'Other' }
                ]);
            });

            const slugs = await module.initDescriptionTypes();

            expect(slugs).toEqual(['Methods', 'SeriesInformation', 'TableOfContents', 'TechnicalInfo', 'Other']);
            expect($('#input-description-Methods').length).toBe(1);
            expect($('#input-description-SeriesInformation').length).toBe(1);
            expect($('#input-description-TableOfContents').length).toBe(1);
            expect($('#input-description-TechnicalInfo').length).toBe(1);
            expect($('#input-description-Other').length).toBe(1);
        });
    });
});
