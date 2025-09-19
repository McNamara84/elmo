import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? 'playwright-test-google-maps-key';

const googleMapsStub = String.raw`(() => {
  const listeners = new WeakMap();

  function getEventStore(target) {
    let store = listeners.get(target);
    if (!store) {
      store = {};
      listeners.set(target, store);
    }
    return store;
  }

  const event = {
    addListener(target, eventName, callback) {
      const store = getEventStore(target);
      store[eventName] = store[eventName] || [];
      store[eventName].push(callback);
      return {
        remove() {
          store[eventName] = store[eventName].filter((cb) => cb !== callback);
        }
      };
    },
    trigger(target, eventName, payload) {
      const store = listeners.get(target);
      if (!store || !store[eventName]) {
        return;
      }
      for (const cb of [...store[eventName]]) {
        cb(payload);
      }
    }
  };

  class LatLng {
    constructor(lat, lng) {
      this._lat = lat;
      this._lng = lng;
    }
    lat() {
      return this._lat;
    }
    lng() {
      return this._lng;
    }
  }

  class LatLngBounds {
    constructor(sw = new LatLng(-1, -1), ne = new LatLng(1, 1)) {
      this._sw = sw;
      this._ne = ne;
    }
    getNorthEast() {
      return this._ne;
    }
    getSouthWest() {
      return this._sw;
    }
    getCenter() {
      const lat = (this._ne.lat() + this._sw.lat()) / 2;
      const lng = (this._ne.lng() + this._sw.lng()) / 2;
      return new LatLng(lat, lng);
    }
    extend(latLng) {
      this._ne = new LatLng(Math.max(this._ne.lat(), latLng.lat()), Math.max(this._ne.lng(), latLng.lng()));
      this._sw = new LatLng(Math.min(this._sw.lat(), latLng.lat()), Math.min(this._sw.lng(), latLng.lng()));
    }
    union(bounds) {
      this.extend(bounds.getNorthEast());
      this.extend(bounds.getSouthWest());
    }
    isEmpty() {
      return false;
    }
  }

  class Map {
    constructor(element, options) {
      this.element = element;
      this.options = options;
      const topCenterKey = 'TOP_CENTER';
      const topRightKey = 'TOP_RIGHT';
      this.controls = {
        [topCenterKey]: { push() {} },
        [topRightKey]: { push() {} }
      };
      element.setAttribute('data-map-ready', 'true');
    }
    addListener(eventName, callback) {
      return event.addListener(this, eventName, callback);
    }
    getBounds() {
      return new LatLngBounds(new LatLng(-10, -10), new LatLng(10, 10));
    }
    panTo() {}
    setZoom() {}
    fitBounds(bounds) {
      this._lastBounds = bounds;
    }
  }

  class Marker {
    constructor({ position, map = null, label = '' }) {
      this._position = position;
      this._map = map;
      this._label = label;
    }
    setMap(map) {
      this._map = map;
    }
    setLabel(label) {
      this._label = label;
    }
    getPosition() {
      return this._position;
    }
  }

  class Rectangle {
    constructor({ bounds, map = null }) {
      this._bounds = bounds;
      this._map = map;
    }
    setMap(map) {
      this._map = map;
    }
    getBounds() {
      return this._bounds;
    }
  }

  class DrawingManager {
    constructor(options) {
      this.options = options;
      this.map = null;
      window.__elmoDrawingManagerInstances = window.__elmoDrawingManagerInstances || [];
      window.__elmoDrawingManagerInstances.push(this);
    }
    setMap(map) {
      this.map = map;
    }
  }

  class SearchBox {
    constructor(input) {
      this.input = input;
      window.__elmoSearchBoxes = window.__elmoSearchBoxes || [];
      window.__elmoSearchBoxes.push(this);
    }
    setBounds(bounds) {
      this._bounds = bounds;
    }
    addListener(eventName, callback) {
      return event.addListener(this, eventName, callback);
    }
    setTestPlaces(places) {
      this._places = places;
      event.trigger(this, 'places_changed');
    }
    getPlaces() {
      return this._places || [];
    }
  }

  const mapTypeId = { SATELLITE: 'satellite' };
  const controlPosition = { TOP_CENTER: 'TOP_CENTER', TOP_RIGHT: 'TOP_RIGHT' };
  const overlayType = { RECTANGLE: 'rectangle', MARKER: 'marker' };

  const callback = window.google?.maps?.__ib__;
  window.google = window.google || {};
  window.google.maps = window.google.maps || {};
  const maps = window.google.maps;

  maps.event = event;
  maps.Map = Map;
  maps.Marker = Marker;
  maps.Rectangle = Rectangle;
  maps.LatLng = LatLng;
  maps.LatLngBounds = LatLngBounds;
  maps.MapTypeId = mapTypeId;
  maps.ControlPosition = controlPosition;
  maps.drawing = { OverlayType: overlayType, DrawingManager };
  maps.places = { SearchBox };
  maps.importLibrary = async (name) => {
    if (name === 'maps') {
      return { Map, LatLng, LatLngBounds, Marker, Rectangle, MapTypeId: mapTypeId, ControlPosition: controlPosition };
    }
    if (name === 'drawing') {
      return { DrawingManager, OverlayType: overlayType };
    }
    if (name === 'places') {
      return { SearchBox };
    }
    return {};
  };

  if (typeof callback === 'function') {
    callback();
  }
})();`;

test.describe('Spatial and Temporal Coverages Form Group', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/settings.php?setting=apiKey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ apiKey }),
      });
    });

    await page.route('**/maps/api/js*', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('key')).toBe(apiKey);
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: googleMapsStub,
      });
    });

    await navigateToHome(page);
    await expect(page.locator(SELECTORS.formGroups.spatialTemporalCoverages)).toBeVisible();
    await page.waitForFunction(() => document.querySelectorAll('#input-stc-timezone option').length > 0);
  });

  test('renders spatial and temporal coverage fields with accessible helpers', async ({ page }) => {
    const groupHeader = page.locator('b[data-translate="coverage.title"]');
    await expect(groupHeader).toBeVisible();
    await expect(
      page.locator(`${SELECTORS.formGroups.spatialTemporalCoverages} [data-help-section-id="help-tsc-geographicalcoverage"]`)
    ).toHaveCount(2);
    await expect(
      page.locator(`${SELECTORS.formGroups.spatialTemporalCoverages} [data-help-section-id="help-tsc-description"]`)
    ).toBeVisible();
    await expect(
      page.locator(`${SELECTORS.formGroups.spatialTemporalCoverages} [data-help-section-id="help-tsc-temporalcoverage"]`)
    ).toHaveCount(2);
    await expect(
      page.locator(`${SELECTORS.formGroups.spatialTemporalCoverages} [data-help-section-id="help-tsc-timezone"]`)
    ).toBeVisible();

    const latMin = page.locator('#input-stc-latmin_1');
    const latMax = page.locator('#input-stc-latmax_1');
    const longMin = page.locator('#input-stc-longmin_1');
    const longMax = page.locator('#input-stc-longmax_1');

    await expect(latMin).toHaveAttribute('pattern', '^-?(90(\\.0+)?|[1-8]?\\d(\\.\\d+)?)$');
    await expect(latMax).toHaveAttribute('pattern', '^-?(90(\\.0+)?|[1-8]?\\d(\\.\\d+)?)$');
    await expect(longMin).toHaveAttribute('pattern', '^-?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$');
    await expect(longMax).toHaveAttribute('pattern', '^-?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$');

    const startDate = page.locator('#input-stc-datestart');
    const endDate = page.locator('#input-stc-dateend');
    await expect(startDate).toHaveAttribute('min', '1900-01-01');
    await expect(startDate).toHaveAttribute('max', '2100-12-31');
    await expect(endDate).toHaveAttribute('min', '1900-01-01');
    await expect(endDate).toHaveAttribute('max', '2100-12-31');

    const mapButton = page.locator('#button-stc-openmap');
    await expect(mapButton).toHaveAccessibleName(/Map/i);

    const timezoneSelect = page.locator('#input-stc-timezone');
    const timezoneOptionCount = await timezoneSelect.locator('option').count();
    expect(timezoneOptionCount).toBeGreaterThan(1);
  });

  test('allows adding and removing coverage rows while maintaining timezone selections', async ({ page }) => {
    await page.waitForFunction(() => typeof (window as any).deleteDrawnOverlaysForRow === 'function');
    await page.evaluate(() => {
      (window as any).__deletedRows = [];
      const originalDelete = (window as any).deleteDrawnOverlaysForRow;
      (window as any).deleteDrawnOverlaysForRow = function patched(rowId: string) {
        (window as any).__deletedRows.push(rowId);
        if (typeof originalDelete === 'function') {
          return originalDelete.call(this, rowId);
        }
        return undefined;
      };
    });

    const timezoneSelect = page.locator('#input-stc-timezone');
    const optionValues = await timezoneSelect
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    const targetValue = optionValues[1] || optionValues[0];
    await timezoneSelect.selectOption(targetValue);
    const chosenValue = await timezoneSelect.inputValue();

    await page.locator('#button-stc-add').click();
    const rows = page.locator(`${SELECTORS.formGroups.spatialTemporalCoverages} [tsc-row]`);
    await expect(rows).toHaveCount(2);

    const secondRowTimezone = page.locator('[tsc-row-id="2"] select[name="tscTimezone[]"]');
    await expect(secondRowTimezone).toHaveValue(chosenValue);

    const description = page.locator('[tsc-row-id="2"] textarea[name="tscDescription[]"]');
    await description.fill('Secondary region focus.');
    await expect(description).toHaveValue('Secondary region focus.');

    await page.locator('[tsc-row-id="2"] .removeButton').click();
    await expect(rows).toHaveCount(1);

    const deletedRows = await page.evaluate(() => (window as any).__deletedRows);
    expect(deletedRows).toContain('2');
  });

  test('integrates Google Maps interactions to populate coordinate fields', async ({ page }) => {
    await page.locator('#button-stc-openmap').click();
    const modal = page.locator('#modal-stc-map');
    await expect(modal).toBeVisible();
    await expect(page.locator('#panel-stc-map')).toHaveAttribute('data-map-ready', 'true');

    await page.waitForFunction(
      () => Array.isArray((window as any).__elmoDrawingManagerInstances) && (window as any).__elmoDrawingManagerInstances.length > 0
    );

    await page.evaluate(() => {
      const [manager] = (window as any).__elmoDrawingManagerInstances || [];
      const marker = new (window as any).google.maps.Marker({
        position: new (window as any).google.maps.LatLng(40.7128, -74.0060),
      });
      (window as any).google.maps.event.trigger(manager, 'markercomplete', marker);
    });

    const latMin = page.locator('#input-stc-latmin_1');
    const longMin = page.locator('#input-stc-longmin_1');
    const latMax = page.locator('#input-stc-latmax_1');
    const longMax = page.locator('#input-stc-longmax_1');

    await expect(latMin).not.toHaveValue('');
    await expect(longMin).not.toHaveValue('');
    await expect(latMax).toHaveValue('');
    await expect(longMax).toHaveValue('');

    await page.evaluate(() => {
      const [manager] = (window as any).__elmoDrawingManagerInstances || [];
      const bounds = new (window as any).google.maps.LatLngBounds(
        new (window as any).google.maps.LatLng(40.0, -74.5),
        new (window as any).google.maps.LatLng(41.0, -73.5),
      );
      const rectangle = new (window as any).google.maps.Rectangle({ bounds });
      (window as any).google.maps.event.trigger(manager, 'rectanglecomplete', rectangle);
    });

    await expect(latMax).toHaveValue(/41(?:\.0+)?/);
    await expect(longMax).toHaveValue(/-73\.5/);
    await expect(latMin).toHaveValue(/40(?:\.0+)?/);
    await expect(longMin).toHaveValue(/-74\.5/);
  });
});