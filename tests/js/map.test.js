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
      val: function(v) { if (v === undefined) return element.value; element.value = v; },
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
      }
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
  class Marker {
    constructor(opts){
      this.position = opts.position;
      this.label = opts.label;
      this.map = opts.map;
      this.setMap = jest.fn((m)=>{ this.map = m; });
      this.setLabel = jest.fn((l)=>{ this.label = l; });
      createdMarkers.push(this);
    }
    getPosition(){ return this.position; }
  }
class Rectangle {
    constructor(opts){
      this.bounds = opts.bounds;
      this.map = opts.map;
      this.setMap = jest.fn((m)=>{ this.map = m; });
      createdRectangles.push(this);
    }
    getBounds(){ return this.bounds; }
}
class DrawingManager {
    constructor(opts){ this.opts = opts; }
    setMap(m){ this.map = m; }
}
class SearchBox {
    constructor(input){ this.input = input; this.listeners = {}; }
    addListener(event, cb){ this.listeners[event] = cb; }
    setBounds(b){ this.bounds = b; }
    getPlaces(){ return this.places || []; }
}
  class Map {
    constructor(element, opts){
      this.element = element;
      this.opts = opts;
      this.controls = { 0: [], 1: [] };
      this.fitBounds = jest.fn();
      this.listeners = {};
      mapInstance = this;
    }
    getBounds(){ return new LatLngBounds(new LatLng(-1,-1), new LatLng(1,1)); }
    addListener(event, cb){ this.listeners[event] = cb; }
  }
  const maps = {
    Map,
    LatLng,
    LatLngBounds,
    Marker,
    Rectangle,
    MapTypeId: { SATELLITE: 'satellite' },
    ControlPosition: { TOP_CENTER:0, TOP_RIGHT:1 },
    drawing: { OverlayType: { RECTANGLE: 'rectangle', MARKER:'marker' } },
    event: { addListener: jest.fn(), trigger: jest.fn() },
    importLibrary: jest.fn(() => Promise.resolve({ Map, DrawingManager: DrawingManager, SearchBox }))
  };
  return { maps, get mapInstance(){ return mapInstance; } };
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
      <input id="input-stc-map-search" />
    `;

    global.$ = createJQuery();
    const gm = createGoogleMapsStub();
    global.google = gm;

    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ apiKey: 'dummy' }) }));

    const script = fs.readFileSync(path.resolve(__dirname, '../../js/map.js'), 'utf8');
    eval(script);
    // wait for async initialization
    await new Promise(r => setTimeout(r, 0));
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
    const labelMarker = createdMarkers[1];
    document.querySelector('[tsc-row-id="row1"]').remove();
    window.updateOverlayLabels();
    expect(createdMarkers[0].setMap).toHaveBeenCalledWith(null);
    expect(labelMarker.setLabel).toHaveBeenCalledWith('1');
  });
});