/**
 * @jest-environment jsdom
 */
class MockTagify {
    constructor(el, settings) {
        this.el = el;
        this.settings = settings || {};
        this.value = [];
        this._callbacks = {};
        this.whitelist = settings?.whitelist || [];
        this.state = { inputText: '', hasFocus: false, dropdown: { visible: false } };
        this.dropdown = { show: jest.fn(), refilter: jest.fn() };
        // Attach to element like real Tagify does
        el._tagify = this;
    }
    on(event, cb) {
        if (!this._callbacks[event]) {
            this._callbacks[event] = [];
        }
        this._callbacks[event].push(cb);
        return this;
    }
    addTags(items) {
        const arr = Array.isArray(items) ? items : [items];
        arr.forEach(item => {
            if (typeof item === 'string') {
                this.value.push({ value: item });
            } else {
                this.value.push(item);
            }
        });
        // Trigger add callbacks
        arr.forEach(item => {
            if (this._callbacks['add']) {
                this._callbacks['add'].forEach(cb => cb({ detail: { data: item } }));
            }
        });
    }
    removeAllTags() {
        this.value = [];
    }
    loading(state) {
        this._loading = state;
        this.state.isLoading = state;
    }
    getAttributes() {
        return '';
    }
}

describe('usedInstruments.js', () => {
    let $;
    let originalFetch;

    beforeEach(() => {
        // Set up DOM
        document.body.innerHTML = `
            <div id="group-usedinstruments">
                <input type="text" id="input-usedinstruments" name="usedInstruments"
                    data-translate-placeholder="usedInstruments.placeholder" />
                <div id="usedinstruments-hidden-inputs"></div>
            </div>
        `;

        // Set up jQuery
        $ = require('jquery');
        global.$ = $;
        global.jQuery = $;
        window.$ = $;
        window.jQuery = $;

        // Set up Tagify mock
        global.Tagify = MockTagify;

        // Set up ELMO_FEATURES
        window.ELMO_FEATURES = {
            showUsedInstruments: true
        };

        // Set up translations
        window.translations = {
            usedInstruments: {
                placeholder: 'Search and select instruments...',
                required: 'Please select at least one instrument.'
            }
        };

        // Mock applyTagifyAccessibilityAttributes
        window.applyTagifyAccessibilityAttributes = jest.fn();

        // Save and mock fetch via jQuery
        originalFetch = $.ajax;
    });

    afterEach(() => {
        delete global.Tagify;
        delete window.ELMO_FEATURES;
        delete window.translations;
        delete window.applyTagifyAccessibilityAttributes;
        delete window.usedInstrumentsModule;
        $.ajax = originalFetch;
        jest.restoreAllMocks();
    });

    function loadScript() {
        jest.isolateModules(() => {
            require('../../js/usedInstruments.js');
        });
        // Trigger DOMContentLoaded
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
    }

    test('does not initialize when feature is disabled', () => {
        window.ELMO_FEATURES.showUsedInstruments = false;

        loadScript();

        const input = document.getElementById('input-usedinstruments');
        expect(input._tagify).toBeUndefined();
    });

    test('initializes Tagify when feature is enabled', () => {
        loadScript();

        const input = document.getElementById('input-usedinstruments');
        expect(input._tagify).toBeInstanceOf(MockTagify);
        expect(input._tagify.settings.enforceWhitelist).toBe(true);
    });

    test('exposes usedInstrumentsModule on window', () => {
        loadScript();

        expect(window.usedInstrumentsModule).toBeDefined();
        expect(typeof window.usedInstrumentsModule.addInstrumentsByData).toBe('function');
        expect(typeof window.usedInstrumentsModule.getSelectedInstruments).toBe('function');
        expect(typeof window.usedInstrumentsModule.loadInstrumentsFromAPI).toBe('function');
    });

    test('creates hidden inputs when instruments are added', () => {
        loadScript();

        const input = document.getElementById('input-usedinstruments');
        const tagify = input._tagify;

        // Simulate adding an instrument
        tagify.addTags([{
            value: 'Test Instrument (Seismometer)',
            pid: '21.11157/1234',
            pidType: 'Handle',
            name: 'Test Instrument',
            instrumentTypes: ['Seismometer']
        }]);

        // Check hidden inputs
        const container = document.getElementById('usedinstruments-hidden-inputs');
        const pidInputs = container.querySelectorAll('input[name="instrumentPid[]"]');
        const pidTypeInputs = container.querySelectorAll('input[name="instrumentPidType[]"]');

        expect(pidInputs.length).toBe(1);
        expect(pidInputs[0].value).toBe('21.11157/1234');
        expect(pidTypeInputs.length).toBe(1);
        expect(pidTypeInputs[0].value).toBe('Handle');
    });

    test('addInstrumentsByData adds instruments programmatically', () => {
        loadScript();

        window.usedInstrumentsModule.addInstrumentsByData([
            {
                pid: '21.11157/1001',
                pidType: 'Handle',
                name: 'Gravimeter A',
                instrumentTypes: ['Gravimeter']
            },
            {
                pid: '21.11157/1002',
                pidType: 'Handle',
                name: 'Seismometer B',
                instrumentTypes: ['Seismometer', 'Broadband']
            }
        ]);

        const input = document.getElementById('input-usedinstruments');
        expect(input._tagify.value.length).toBe(2);
        expect(input._tagify.value[0].pid).toBe('21.11157/1001');
        expect(input._tagify.value[1].pid).toBe('21.11157/1002');
    });

    test('getSelectedInstruments returns correct PID data', () => {
        loadScript();

        const input = document.getElementById('input-usedinstruments');
        input._tagify.addTags([{
            value: 'Instrument X (Type)',
            pid: '21.11157/9999',
            pidType: 'Handle',
            name: 'Instrument X',
            instrumentTypes: ['Type']
        }]);

        const selected = window.usedInstrumentsModule.getSelectedInstruments();
        expect(selected.length).toBe(1);
        expect(selected[0].pid).toBe('21.11157/9999');
        expect(selected[0].pidType).toBe('Handle');
    });

    test('formats instrument display correctly with types', () => {
        loadScript();

        window.usedInstrumentsModule.addInstrumentsByData([{
            pid: '21.11157/1234',
            pidType: 'Handle',
            name: 'MyInstrument',
            instrumentTypes: ['TypeA', 'TypeB']
        }]);

        const input = document.getElementById('input-usedinstruments');
        expect(input._tagify.value[0].value).toBe('MyInstrument (TypeA, TypeB)');
    });

    test('formats instrument display correctly without types', () => {
        loadScript();

        window.usedInstrumentsModule.addInstrumentsByData([{
            pid: '21.11157/5678',
            pidType: 'Handle',
            name: 'SimpleInstrument',
            instrumentTypes: []
        }]);

        const input = document.getElementById('input-usedinstruments');
        expect(input._tagify.value[0].value).toBe('SimpleInstrument');
    });

    describe('instrument search relevance', () => {
        let dropdown;

        beforeEach(() => {
            loadScript();
            dropdown = document.getElementById('input-usedinstruments')._tagify.settings.dropdown;
        });

        function suggestion(name, instrumentTypes = []) {
            return { name, instrumentTypes, value: `${name} (${instrumentTypes.join(', ')})` };
        }

        function rankedNames(items, query) {
            return dropdown.sortby(items, query).map(item => item.name);
        }

        test('ranks exact names and stable name prefixes ahead of other name matches', () => {
            const items = [
                suggestion('GASMET'),
                suggestion('AGRA-Bewässerungsmenge'),
                suggestion('SM-02'),
                suggestion('SM-01'),
                suggestion('SM')
            ];

            expect(rankedNames(items, 'SM')).toEqual([
                'SM', 'SM-02', 'SM-01', 'GASMET', 'AGRA-Bewässerungsmenge'
            ]);
        });

        test('ranks every name match ahead of type-only matches', () => {
            const items = [
                suggestion('MOSES', ['FTIR gas analyzer']),
                suggestion('Station GA-03'),
                suggestion('GASMET', ['FTIR gas analyzer'])
            ];

            expect(rankedNames(items, 'GA')).toEqual(['GASMET', 'Station GA-03', 'MOSES']);
        });

        test('ranks all-word name matches ahead of matches requiring a name and a type', () => {
            const items = [
                suggestion('GASMET', ['Flowmeter']),
                suggestion('Flow station GASMET')
            ];

            expect(rankedNames(items, 'gas flow')).toEqual(['Flow station GASMET', 'GASMET']);
        });

        test('normalizes case, surrounding spaces and combining accents', () => {
            const items = [suggestion('xSM'), suggestion('ŚM-02'), suggestion('S\u0301M')];

            expect(rankedNames(items, ' sM ')).toEqual(['S\u0301M', 'ŚM-02', 'xSM']);
        });

        test('limits only after ranking all candidates', () => {
            const items = Array.from({ length: 50 }, (_, index) => suggestion(`GASMET-${index}`));
            items.push(suggestion('SM-01'));

            const results = dropdown.sortby(items, 'SM');

            expect(results).toHaveLength(50);
            expect(results[0].name).toBe('SM-01');
            expect(results[1].name).toBe('GASMET-0');
        });

        test.each([undefined, '', '   '])('preserves order and limit for empty query %p', query => {
            const items = [suggestion('Third'), suggestion('First'), suggestion('Second')];
            dropdown.maxItems = 2;

            expect(dropdown.sortby(items, query)).toEqual(items.slice(0, 2));
        });

        test.each([[0, 0], [1, 1], [-1, 3]])('respects maxItems %i', (limit, count) => {
            dropdown.maxItems = limit;

            expect(dropdown.sortby([
                suggestion('GASMET'), suggestion('SM-01'), suggestion('SM')
            ], 'SM')).toHaveLength(count);
        });

        test('preserves candidate objects and leaves the whitelist order untouched', () => {
            const partial = Object.freeze({ ...suggestion('GASMET'), pid: '21/partial', pidType: 'Handle' });
            const prefix = Object.freeze({ ...suggestion('SM-01'), pid: '10.1234/sm', pidType: 'DOI' });
            const items = Object.freeze([partial, prefix]);

            const results = dropdown.sortby(items, 'SM');

            expect(results[0]).toBe(prefix);
            expect(results[1]).toBe(partial);
            expect(items).toEqual([partial, prefix]);
        });

        test('handles PID fallback entries without a name and empty candidate lists', () => {
            const fallback = { value: '21.11157/unknown', pid: '21.11157/unknown', pidType: 'Handle' };
            const partial = suggestion('Station 21.11157');

            expect(dropdown.sortby([partial, fallback], '21.11157')).toEqual([fallback, partial]);
            expect(dropdown.sortby([], 'SM')).toEqual([]);
        });
    });

    describe('suggestions after lazy loading', () => {
        const apiData = [
            { pid: '21/ga', pidType: 'Handle', name: 'GASMET', instrumentTypes: ['FTIR gas analyzer'] }
        ];

        function pendingLoad() {
            loadScript();
            const deferred = $.Deferred();
            $.ajax = jest.fn(() => deferred.promise());
            const tagify = document.getElementById('input-usedinstruments')._tagify;
            const promise = window.usedInstrumentsModule.loadInstrumentsFromAPI();
            return { deferred, tagify, promise };
        }

        test('uses the latest input and clears loading before showing suggestions', async () => {
            const { deferred, tagify, promise } = pendingLoad();
            expect(tagify.state.isLoading).toBe(true);
            tagify.state.hasFocus = true;
            tagify.state.inputText = 'SM';
            tagify.dropdown.show.mockImplementation(() => {
                expect(tagify.state.isLoading).toBe(false);
            });

            tagify.state.inputText = 'GA';
            deferred.resolve(apiData);

            await expect(promise).resolves.toEqual({ success: true, dataLoaded: true });
            expect(tagify.dropdown.show).toHaveBeenCalledWith('GA');
        });

        test.each([
            ['blurred', false, 'GA', 1],
            ['cleared', true, '', 1],
            ['whitespace only', true, '   ', 1],
            ['below threshold', true, 'G', 2],
            ['disabled', true, 'GA', false]
        ])('does not open suggestions when %s', async (_, focused, query, enabled) => {
            const { deferred, tagify, promise } = pendingLoad();
            tagify.state.hasFocus = focused;
            tagify.state.inputText = query;
            tagify.settings.dropdown.enabled = enabled;

            deferred.resolve(apiData);
            await promise;

            expect(tagify.state.isLoading).toBe(false);
            expect(tagify.dropdown.show).not.toHaveBeenCalled();
        });

        test('refreshes an already visible dropdown with the current input', async () => {
            const { deferred, tagify, promise } = pendingLoad();
            tagify.state.hasFocus = true;
            tagify.state.dropdown.visible = 'SM';
            tagify.state.inputText = 'GA';

            deferred.resolve(apiData);
            await promise;

            expect(tagify.dropdown.show).toHaveBeenCalledWith('GA');
        });

        test('allows refocusing to retry a failed request', async () => {
            const { deferred, tagify, promise } = pendingLoad();
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            tagify.state.hasFocus = true;
            tagify.state.inputText = 'GA';
            deferred.reject({ status: 503, statusText: 'Unavailable' }, 'error', 'Unavailable');

            await expect(promise).resolves.toEqual({ success: false, dataLoaded: false });
            expect(tagify.state.isLoading).toBe(false);
            expect(tagify.dropdown.show).not.toHaveBeenCalled();

            const retry = $.Deferred();
            $.ajax.mockImplementation(() => retry.promise());
            tagify._callbacks.focus[0]();
            const retryPromise = window.usedInstrumentsModule.loadInstrumentsFromAPI();
            expect($.ajax).toHaveBeenCalledTimes(2);
            retry.resolve(apiData);

            await expect(retryPromise).resolves.toEqual({ success: true, dataLoaded: true });
            expect(tagify.dropdown.show).toHaveBeenCalledWith('GA');
        });

        test('preserves imported PID fallback tags when the catalogue arrives', async () => {
            const { deferred, tagify, promise } = pendingLoad();
            window.usedInstrumentsModule.addInstrumentsByPid([{ pid: '21/unknown', pidType: 'Handle' }]);
            const imported = tagify.value[0];

            deferred.resolve(apiData);
            await promise;

            expect(tagify.value[0]).toBe(imported);
            expect(tagify.whitelist).toContain(imported);
            expect(document.querySelector('input[name="instrumentPid[]"]').value).toBe('21/unknown');
        });
    });

    describe('loadInstrumentsFromAPI', () => {
        function mockAjaxSuccess(data) {
            $.ajax = jest.fn(() => {
                const deferred = $.Deferred();
                setTimeout(() => deferred.resolve(data), 0);
                const promise = deferred.promise();
                promise.done = function (cb) { deferred.done(cb); return this; };
                promise.fail = function (cb) { deferred.fail(cb); return this; };
                promise.always = function (cb) { deferred.always(cb); return this; };
                return promise;
            });
        }

        function mockAjaxFailure() {
            $.ajax = jest.fn(() => {
                const deferred = $.Deferred();
                setTimeout(() => deferred.reject({ status: 0, statusText: 'error' }, 'error', 'Network error'), 0);
                const promise = deferred.promise();
                promise.done = function (cb) { deferred.done(cb); return this; };
                promise.fail = function (cb) { deferred.fail(cb); return this; };
                promise.always = function (cb) { deferred.always(cb); return this; };
                return promise;
            });
        }

        test('resolves with success and dataLoaded when API returns instruments', async () => {
            loadScript();

            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Seismometer', instrumentTypes: ['Seismometer'] }
            ];
            mockAjaxSuccess(apiData);

            const result = await window.usedInstrumentsModule.loadInstrumentsFromAPI();
            expect(result).toEqual({ success: true, dataLoaded: true });
        });

        test('resolves with dataLoaded false when API returns empty array', async () => {
            loadScript();
            mockAjaxSuccess([]);

            const result = await window.usedInstrumentsModule.loadInstrumentsFromAPI();
            expect(result).toEqual({ success: true, dataLoaded: false });
        });

        test('resolves (never rejects) on AJAX failure', async () => {
            loadScript();
            mockAjaxFailure();

            const result = await window.usedInstrumentsModule.loadInstrumentsFromAPI();
            expect(result).toEqual({ success: false, dataLoaded: false });
        });

        test('returns cached result on second call', async () => {
            loadScript();

            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Seismometer', instrumentTypes: ['Seismometer'] }
            ];
            mockAjaxSuccess(apiData);

            await window.usedInstrumentsModule.loadInstrumentsFromAPI();
            // Second call should not hit AJAX again
            $.ajax.mockClear();
            const result = await window.usedInstrumentsModule.loadInstrumentsFromAPI();
            expect(result).toEqual({ success: true, dataLoaded: true });
            expect($.ajax).not.toHaveBeenCalled();
        });
    });

    describe('addInstrumentsByPid', () => {
        function loadWithApiData(apiData) {
            loadScript();

            // Mock $.ajax to return the given data, then call loadInstrumentsFromAPI()
            // so the module's internal instrumentData array is populated.
            const mockDeferred = $.Deferred();
            $.ajax = jest.fn(() => {
                setTimeout(() => mockDeferred.resolve(apiData), 0);
                const promise = mockDeferred.promise();
                promise.done = function (cb) { mockDeferred.done(cb); return this; };
                promise.fail = function (cb) { mockDeferred.fail(cb); return this; };
                promise.always = function (cb) { mockDeferred.always(cb); return this; };
                return promise;
            });

            return window.usedInstrumentsModule.loadInstrumentsFromAPI();
        }

        test('adds matched instruments with full API metadata', async () => {
            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Broadband Seismometer STS-2', instrumentTypes: ['Seismometer', 'Broadband'] },
                { pid: '21.11157/0002', pidType: 'Handle', name: 'Gravimeter', instrumentTypes: ['Gravimeter'] }
            ];
            await loadWithApiData(apiData);

            window.usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21.11157/0001', pidType: 'Handle' }
            ]);

            const input = document.getElementById('input-usedinstruments');
            expect(input._tagify.value).toHaveLength(1);
            expect(input._tagify.value[0].pid).toBe('21.11157/0001');
            expect(input._tagify.value[0].name).toBe('Broadband Seismometer STS-2');
            expect(input._tagify.value[0].value).toBe('Broadband Seismometer STS-2 (Seismometer, Broadband)');
        });

        test('adds PID-only fallback tags for unmatched PIDs', async () => {
            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Known Instrument', instrumentTypes: ['Type'] }
            ];
            await loadWithApiData(apiData);

            window.usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21.11157/UNKNOWN', pidType: 'Handle' }
            ]);

            const input = document.getElementById('input-usedinstruments');
            expect(input._tagify.value).toHaveLength(1);
            // Fallback: name equals the PID itself
            expect(input._tagify.value[0].pid).toBe('21.11157/UNKNOWN');
            expect(input._tagify.value[0].name).toBe('21.11157/UNKNOWN');
            expect(input._tagify.value[0].instrumentTypes).toEqual([]);
        });

        test('handles mix of matched and unmatched PIDs', async () => {
            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Seismometer', instrumentTypes: ['Seismometer'] }
            ];
            await loadWithApiData(apiData);

            window.usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21.11157/0001', pidType: 'Handle' },
                { pid: '10.12345/unknown', pidType: 'DOI' }
            ]);

            const input = document.getElementById('input-usedinstruments');
            expect(input._tagify.value).toHaveLength(2);
            expect(input._tagify.value[0].name).toBe('Seismometer');
            expect(input._tagify.value[1].pid).toBe('10.12345/unknown');
            expect(input._tagify.value[1].pidType).toBe('DOI');
            expect(input._tagify.value[1].name).toBe('10.12345/unknown');
        });

        test('does nothing when called with empty array', async () => {
            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Seismometer', instrumentTypes: [] }
            ];
            await loadWithApiData(apiData);

            window.usedInstrumentsModule.addInstrumentsByPid([]);

            const input = document.getElementById('input-usedinstruments');
            expect(input._tagify.value).toHaveLength(0);
        });

        test('creates correct hidden inputs for matched instruments', async () => {
            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Seismometer', instrumentTypes: [] }
            ];
            await loadWithApiData(apiData);

            window.usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21.11157/0001', pidType: 'Handle' }
            ]);

            const container = document.getElementById('usedinstruments-hidden-inputs');
            const pidInputs = container.querySelectorAll('input[name="instrumentPid[]"]');
            const pidTypeInputs = container.querySelectorAll('input[name="instrumentPidType[]"]');
            expect(pidInputs).toHaveLength(1);
            expect(pidInputs[0].value).toBe('21.11157/0001');
            expect(pidTypeInputs).toHaveLength(1);
            expect(pidTypeInputs[0].value).toBe('Handle');
        });
    });

    describe('upgradeInstrumentTags', () => {
        function loadWithApiData(apiData) {
            loadScript();

            const mockDeferred = $.Deferred();
            $.ajax = jest.fn(() => {
                setTimeout(() => mockDeferred.resolve(apiData), 0);
                const promise = mockDeferred.promise();
                promise.done = function (cb) { mockDeferred.done(cb); return this; };
                promise.fail = function (cb) { mockDeferred.fail(cb); return this; };
                promise.always = function (cb) { mockDeferred.always(cb); return this; };
                return promise;
            });

            return window.usedInstrumentsModule.loadInstrumentsFromAPI();
        }

        test('upgrades PID-only tags with full API metadata', async () => {
            loadScript();

            // Step 1: Add PID-only tags (no API data loaded yet)
            window.usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21.11157/0001', pidType: 'Handle' }
            ]);

            const input = document.getElementById('input-usedinstruments');
            // Should be PID-only
            expect(input._tagify.value[0].name).toBe('21.11157/0001');

            // Step 2: Load API data into the same module instance
            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Broadband Seismometer STS-2', instrumentTypes: ['Seismometer'] }
            ];
            const mockDeferred = $.Deferred();
            $.ajax = jest.fn(() => {
                setTimeout(() => mockDeferred.resolve(apiData), 0);
                const promise = mockDeferred.promise();
                promise.done = function (cb) { mockDeferred.done(cb); return this; };
                promise.fail = function (cb) { mockDeferred.fail(cb); return this; };
                promise.always = function (cb) { mockDeferred.always(cb); return this; };
                return promise;
            });
            await window.usedInstrumentsModule.loadInstrumentsFromAPI();

            // Step 3: Upgrade
            window.usedInstrumentsModule.upgradeInstrumentTags();

            expect(input._tagify.value).toHaveLength(1);
            expect(input._tagify.value[0].name).toBe('Broadband Seismometer STS-2');
            expect(input._tagify.value[0].value).toBe('Broadband Seismometer STS-2 (Seismometer)');
            expect(input._tagify.value[0].pid).toBe('21.11157/0001');
        });

        test('leaves already-enriched tags untouched', async () => {
            const apiData = [
                { pid: '21.11157/0001', pidType: 'Handle', name: 'Seismometer', instrumentTypes: ['Seismometer'] }
            ];
            await loadWithApiData(apiData);

            // Add via addInstrumentsByPid which already matched against API
            window.usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21.11157/0001', pidType: 'Handle' }
            ]);

            const input = document.getElementById('input-usedinstruments');
            expect(input._tagify.value[0].name).toBe('Seismometer');

            // Upgrade should be a no-op
            window.usedInstrumentsModule.upgradeInstrumentTags();
            expect(input._tagify.value).toHaveLength(1);
            expect(input._tagify.value[0].name).toBe('Seismometer');
        });

        test('does nothing when no API data is loaded', () => {
            loadScript();

            window.usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21.11157/0001', pidType: 'Handle' }
            ]);

            const input = document.getElementById('input-usedinstruments');
            // No API data → upgradeInstrumentTags should not change anything
            window.usedInstrumentsModule.upgradeInstrumentTags();
            expect(input._tagify.value).toHaveLength(1);
            expect(input._tagify.value[0].name).toBe('21.11157/0001');
        });
    });
});
