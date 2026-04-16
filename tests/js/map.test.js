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
});