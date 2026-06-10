const fs = require('fs');
const path = require('path');

function createJQuery() {
  const $ = (selector) => {
    if (selector === document) {
      return { ready: (fn) => fn() };
    }
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    return {
      length: element ? 1 : 0,
      0: element,
      val: function(v) { if (v === undefined) return element ? element.value : ''; element.value = v; },
      find: (sel) => $(element ? element.querySelector(sel) : null),
      index: () => element ? Array.from(element.parentNode.children).indexOf(element) : -1,
      closest: (sel) => $(element ? element.closest(sel) : null),
      attr: (name) => element ? element.getAttribute(name) : null,
      on: jest.fn(),
      one: jest.fn((ev, fn) => fn()),
      click: jest.fn(),
      css: jest.fn(),
      data: function(key, value){
        if(!element) return undefined;
        element._data = element._data || {};
        if(value === undefined) return element._data[key];
        element._data[key] = value;
        return this;
      },
      modal: jest.fn()
    };
  };
  return $;
}

function createGoogleMapsStub() {
  global.createdMarkers = [];
  global.createdRectangles = [];
  let mapInstance;

  class LatLng {
    constructor(lat, lng){ this._lat = parseFloat(lat); this._lng = parseFloat(lng); }
    lat(){ return this._lat; }
    lng(){ return this._lng; }
  }

  class LatLngBounds {
    constructor(sw, ne){ this.sw = sw || null; this.ne = ne || null; }
    extend(ll){
      if(!this.sw || !this.ne){ this.sw = new LatLng(ll.lat(), ll.lng()); this.ne = new LatLng(ll.lat(), ll.lng()); return; }
      this.sw = new LatLng(Math.min(this.sw.lat(), ll.lat()), Math.min(this.sw.lng(), ll.lng()));
      this.ne = new LatLng(Math.max(this.ne.lat(), ll.lat()), Math.max(this.ne.lng(), ll.lng()));
    }
    union(other){
      if(!other) return; this.extend(other.getSouthWest()); this.extend(other.getNorthEast());
    }
    getNorthEast(){ return this.ne; }
    getSouthWest(){ return this.sw; }
    isEmpty(){ return !this.sw || !this.ne; }
    getCenter(){ return new LatLng((this.ne.lat()+this.sw.lat())/2,(this.ne.lng()+this.sw.lng())/2); }
  }

  class AdvancedMarkerElement {
    constructor(opts = {}){
      // Real AdvancedMarkerElement normalises LatLng → LatLngLiteral
      var p = opts.position || null;
      if (p && typeof p.lat === 'function') {
        this.position = { lat: p.lat(), lng: p.lng() };
      } else {
        this.position = p;
      }
      this.map = opts.map || null;
      this.content = opts.content || null;
      createdMarkers.push(this);
    }
  }

  class PinElement {
    constructor(opts = {}){
      this.glyphText = opts.glyphText || '';
      this.glyphColor = opts.glyphColor || '';
      this.background = opts.background || '';
      this.borderColor = opts.borderColor || '';
    }
  }

  class Rectangle {
    constructor(opts){
      this.bounds = opts.bounds;
      this.map = opts.map;
      this.setMap = jest.fn((m)=>{ this.map = m; });
      this.setBounds = jest.fn((b) => { this.bounds = b; });
      createdRectangles.push(this);
    }
    getBounds(){ return this.bounds; }
  }

  class Map {
    constructor(element, opts){
      this.element = element;
      this.opts = opts;
      this.controls = {};
      this.controls[maps.ControlPosition.TOP_CENTER] = [];
      this.controls[maps.ControlPosition.TOP_RIGHT] = [];
      this.fitBounds = jest.fn();
      this.panTo = jest.fn();
      this.setZoom = jest.fn();
      this.setOptions = jest.fn();
      this.listeners = {};
      mapInstance = this;
    }
    getBounds(){ return new LatLngBounds(new LatLng(-1,-1), new LatLng(1,1)); }
    addListener(event, cb){
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(cb);
    }
  }

  const maps = {
    Map,
    LatLng,
    LatLngBounds,
    Rectangle,
    MapTypeId: { SATELLITE: 'satellite' },
    ControlPosition: { TOP_CENTER: 'TOP_CENTER', TOP_RIGHT: 'TOP_RIGHT' },
    event: { addListener: jest.fn(), trigger: jest.fn() },
    marker: { AdvancedMarkerElement, PinElement },
    importLibrary: jest.fn((name) => {
      if (name === 'maps') return Promise.resolve({ Map });
      if (name === 'marker') return Promise.resolve({ AdvancedMarkerElement, PinElement });
      if (name === 'places') return Promise.resolve({});
      return Promise.resolve({});
    })
  };

  return { maps, LatLng, LatLngBounds, AdvancedMarkerElement, PinElement, Rectangle, get mapInstance(){ return mapInstance; } };
}

describe('map.js', () => {
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <div id="group-stc">
        <div tsc-row tsc-row-id="row1">
          <input id="input-stc-latmax-row1" />
          <input id="input-stc-longmax-row1" />
          <input id="input-stc-latmin-row1" />
          <input id="input-stc-longmin-row1" />
        </div>
        <div tsc-row tsc-row-id="row2">
          <input id="input-stc-latmax-row2" />
          <input id="input-stc-longmax-row2" />
          <input id="input-stc-latmin-row2" />
          <input id="input-stc-longmin-row2" />
        </div>
      </div>
      <div id="modal-stc-map"></div>
      <div id="panel-stc-map"></div>
      <div id="map-drawing-toolbar" style="display:none;">
        <button id="btn-draw-marker" type="button"></button>
        <button id="btn-draw-rectangle" type="button"></button>
      </div>
      <div id="place-autocomplete-card"></div>
    `;

    global.$ = createJQuery();
    const gm = createGoogleMapsStub();
    global.google = gm;

    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ apiKey: 'dummy', mapId: 'test-map-id' })
    }));

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/map.js'), 'utf8');
    eval(script);
    // Wait for async initialization (fetch + importLibrary)
    await new Promise(r => setTimeout(r, 50));
    global.mapInstance = gm.mapInstance;
  });

  test('updateMapOverlay draws rectangle and fits bounds with buffer', () => {
    window.updateMapOverlay('row1', '52.55', '13.45', '52.45', '13.35');
    const fitArgs = mapInstance.fitBounds.mock.calls[0][0];
    const ne = fitArgs.getNorthEast();
    const sw = fitArgs.getSouthWest();
    expect(ne.lat()).toBeCloseTo(52.55 + (52.55 - 52.45) * 0.5);
    expect(ne.lng()).toBeCloseTo(13.45 + (13.45 - 13.35) * 0.5);
    expect(sw.lat()).toBeCloseTo(52.45 - (52.55 - 52.45) * 0.5);
    expect(sw.lng()).toBeCloseTo(13.35 - (13.45 - 13.35) * 0.5);
  });

  test('updateMapOverlay draws marker for point coordinates', () => {
    window.updateMapOverlay('row1', '', '', '52.5', '13.4');
    // Should have created an AdvancedMarkerElement
    expect(createdMarkers.length).toBeGreaterThan(0);
    const marker = createdMarkers[createdMarkers.length - 1];
    expect(marker.position).toBeDefined();
  });

  test('deleteDrawnOverlaysForRow removes overlays and prevents fitBounds', () => {
    window.updateMapOverlay('row1', '', '', '52.5', '13.4');
    mapInstance.fitBounds.mockClear();
    window.deleteDrawnOverlaysForRow('row1');
    window.fitMapBounds();
    expect(mapInstance.fitBounds).not.toHaveBeenCalled();
  });

  test('updateOverlayLabels relabels overlays after row removal', () => {
    window.updateMapOverlay('row1', '', '', '52.5', '13.4');
    window.updateMapOverlay('row2', '48.90', '2.40', '48.85', '2.35');

    // Remove row1 from DOM
    document.querySelector('[tsc-row-id="row1"]').remove();
    window.updateOverlayLabels();

    // The row2 rectangle's label marker should have updated content
    // Verify that the overlay for row1 was cleaned up
    // (fitMapBounds should still work with remaining overlays)
    mapInstance.fitBounds.mockClear();
    window.fitMapBounds();
    expect(mapInstance.fitBounds).toHaveBeenCalled();
  });

  test('deleteDrawnOverlaysForRow handles Rectangle setMap correctly', () => {
    window.updateMapOverlay('row1', '52.55', '13.45', '52.45', '13.35');
    const rectangle = createdRectangles[0];
    window.deleteDrawnOverlaysForRow('row1');
    expect(rectangle.setMap).toHaveBeenCalledWith(null);
  });

  test('fitMapBounds does nothing when no overlays exist', () => {
    mapInstance.fitBounds.mockClear();
    window.fitMapBounds();
    expect(mapInstance.fitBounds).not.toHaveBeenCalled();
  });

  test('drawing toolbar becomes visible after initialization', () => {
    const toolbar = document.getElementById('map-drawing-toolbar');
    expect(toolbar.style.display).toBe('flex');
  });

  test('marker button has active state by default', () => {
    const btnMarker = document.getElementById('btn-draw-marker');
    expect(btnMarker.classList.contains('active')).toBe(true);
    expect(btnMarker.getAttribute('aria-pressed')).toBe('true');
  });

  test('rectangle button is not active by default', () => {
    const btnRect = document.getElementById('btn-draw-rectangle');
    expect(btnRect.classList.contains('active')).toBe(false);
    expect(btnRect.getAttribute('aria-pressed')).toBe('false');
  });

  test('fetch is called with correct settings URL', () => {
    expect(global.fetch).toHaveBeenCalledWith('settings.php?setting=apiKey');
  });

  test('importLibrary is called for maps, marker, and places', () => {
    const calls = google.maps.importLibrary.mock.calls.map(c => c[0]);
    expect(calls).toContain('maps');
    expect(calls).toContain('marker');
    expect(calls).toContain('places');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DrawingController: mode switching and preview rectangle
  // ─────────────────────────────────────────────────────────────────────────
  describe('DrawingController: mode switching and preview rectangle', () => {
    // Safely above the 150 ms DBLCLICK_THRESHOLD in map.js
    const OVER_THRESHOLD = 250;

    function fireMapEvent(eventName, lat, lng) {
      (mapInstance.listeners[eventName] || []).forEach(cb =>
        cb({ latLng: new google.maps.LatLng(lat, lng) })
      );
    }

    function waitMs(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    beforeEach(() => {
      // Wire up #modal-stc-map so the rectanglecomplete / markercomplete handlers
      // can find the current row and write coordinate values into its inputs.
      const row1El = document.querySelector('[tsc-row-id="row1"]');
      document.getElementById('modal-stc-map')._data = {
        'current-row': global.$(row1El),
        'tsc-row-id': 'row1'
      };
    });

    test('preview rect appears and follows mouse: place marker → switch to rect → click first corner', async () => {
      // 1. Place a marker in the default marker mode
      fireMapEvent('click', 52.5, 13.4);
      await waitMs(OVER_THRESHOLD);
      expect(createdMarkers.length).toBeGreaterThan(0);

      // 2. Switch to rectangle mode
      document.getElementById('btn-draw-rectangle').click();

      // 3. Click the first corner of the rectangle
      fireMapEvent('click', 52.6, 13.5);
      await waitMs(OVER_THRESHOLD);

      // A preview rectangle must have been created and remain on the map
      expect(createdRectangles.length).toBe(1);
      expect(createdRectangles[0].map).not.toBeNull();

      // Coordinate inputs must still be empty — rectangle is not yet completed
      expect(document.querySelector('[id^=input-stc-latmax]').value).toBe('');

      // Moving the mouse must update the preview bounds
      fireMapEvent('mousemove', 52.7, 13.6);
      expect(createdRectangles[0].setBounds).toHaveBeenCalled();
    });

    test('switching modes mid-rectangle resets state so the next first click starts a fresh preview', async () => {
      // Start a rectangle — click first corner and wait for debounce
      document.getElementById('btn-draw-rectangle').click();
      fireMapEvent('click', 52.6, 13.5);
      await waitMs(OVER_THRESHOLD); // rectState = 'started', previewRect on map

      expect(createdRectangles.length).toBe(1);

      // Switch away and back (user hesitation / back-and-forth)
      document.getElementById('btn-draw-marker').click();
      document.getElementById('btn-draw-rectangle').click();

      // User now clicks what they intend as the FIRST corner of a new rectangle
      fireMapEvent('click', 52.8, 13.6);
      await waitMs(OVER_THRESHOLD);

      // BUG (unfixed): stale rectState='started' causes this click to be treated as
      // the second click → rectanglecomplete fires immediately → inputs get filled.
      // FIXED: setMode resets state, so this click only starts the preview.
      expect(document.querySelector('[id^=input-stc-latmax]').value).toBe('');
    });

    test('clicking in rect mode then quickly switching to marker cancels the pending rectangle click', async () => {
      document.getElementById('btn-draw-rectangle').click();

      // Click in rectangle mode, then switch modes BEFORE the debounce fires
      fireMapEvent('click', 52.6, 13.5);
      document.getElementById('btn-draw-marker').click(); // switch within 150 ms

      await waitMs(OVER_THRESHOLD);

      // BUG (unfixed): the debounce timer fires in marker mode and creates an
      // unintended marker at the rectangle click coordinates.
      // FIXED: setMode cancels the pending timer, so no marker appears.
      expect(createdMarkers.length).toBe(0);
    });

    test('right-click after first rectangle corner removes the preview and resets to initial state', async () => {
      document.getElementById('btn-draw-rectangle').click();

      // Place the first corner
      fireMapEvent('click', 52.6, 13.5);
      await waitMs(OVER_THRESHOLD); // previewRect created, rectState = 'started'

      expect(createdRectangles.length).toBe(1);
      expect(createdRectangles[0].map).not.toBeNull();

      // Right-click: cancel the in-progress rectangle
      fireMapEvent('rightclick', 0, 0);

      // Preview rect must have been removed from the map
      expect(createdRectangles[0].setMap).toHaveBeenCalledWith(null);

      // A subsequent left-click must start a NEW first corner, not complete a rectangle
      fireMapEvent('click', 52.9, 14.0);
      await waitMs(OVER_THRESHOLD);

      // Inputs still empty – the click started a fresh preview, not a completion
      expect(document.querySelector('[id^=input-stc-latmax]').value).toBe('');
      // A new preview rectangle must have been created
      expect(createdRectangles.length).toBe(2);
      expect(createdRectangles[1].map).not.toBeNull();
    });

    test('right-click while debounce is still pending (before first corner is anchored) is also a no-op', async () => {
      document.getElementById('btn-draw-rectangle').click();

      // Click, but right-click BEFORE the 150 ms debounce fires
      fireMapEvent('click', 52.6, 13.5);
      fireMapEvent('rightclick', 0, 0); // cancel during the pending timer

      await waitMs(OVER_THRESHOLD);

      // The pending click must have been swallowed — no preview rect, no coords
      expect(createdRectangles.length).toBe(0);
      expect(document.querySelector('[id^=input-stc-latmax]').value).toBe('');
    });
  });
});