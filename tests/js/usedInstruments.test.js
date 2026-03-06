/**
 * @jest-environment jsdom
 */
const { requireFresh } = require('./utils');

class MockTagify {
    constructor(el, settings) {
        this.el = el;
        this.settings = settings || {};
        this.value = [];
        this._callbacks = {};
        this.whitelist = settings?.whitelist || [];
        this.dropdown = { visible: false, refilter: jest.fn() };
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
});
