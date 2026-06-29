import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS, simulateSubmitValidation } from '../utils';

const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? 'playwright-test-google-maps-key';
const mapId = 'playwright-test-map-id';

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
      // Expose map instance globally for E2E test interaction
      window.__elmoMapInstance = this;
    }
    addListener(eventName, callback) {
      return event.addListener(this, eventName, callback);
    }
    getBounds() {
      return new LatLngBounds(new LatLng(-10, -10), new LatLng(10, 10));
    }
    panTo() {}
    setZoom() {}
    setOptions() {}
    fitBounds(bounds) {
      this._lastBounds = bounds;
    }
  }

  class AdvancedMarkerElement {
    constructor({ position, map = null, content = null }) {
      this.position = position;
      this.map = map;
      this.content = content;
    }
  }

  class PinElement {
    constructor({ glyphText = '', glyphColor = '', background = '', borderColor = '' } = {}) {
      this.glyphText = glyphText;
      this.glyphColor = glyphColor;
      this.background = background;
      this.borderColor = borderColor;
    }
  }

  class Rectangle {
    constructor(opts = {}) {
      this._bounds = opts.bounds || null;
      this._map = opts.map || null;
      this._listeners = {};
    }
    setMap(map) {
      this._map = map;
    }
    setBounds(bounds) {
      this._bounds = bounds;
      // Trigger bounds_changed event when bounds are set
      this._triggerEvent('bounds_changed');
    }
    getBounds() {
      return this._bounds;
    }
    addListener(eventName, callback) {
      if (!this._listeners[eventName]) {
        this._listeners[eventName] = [];
      }
      this._listeners[eventName].push(callback);
      return {
        remove: () => {
          this._listeners[eventName] = this._listeners[eventName].filter(cb => cb !== callback);
        }
      };
    }
    _triggerEvent(eventName) {
      if (this._listeners[eventName]) {
        this._listeners[eventName].forEach(cb => cb());
      }
    }
  }

  // Register gmp-place-autocomplete as a custom element stub
  if (!customElements.get('gmp-place-autocomplete')) {
    class PlaceAutocompleteStub extends HTMLElement {
      constructor() {
        super();
      }
      get locationBias() { return this._locationBias; }
      set locationBias(val) { this._locationBias = val; }
    }
    customElements.define('gmp-place-autocomplete', PlaceAutocompleteStub);
  }

  const mapTypeId = { SATELLITE: 'satellite' };
  const controlPosition = { TOP_CENTER: 'TOP_CENTER', TOP_RIGHT: 'TOP_RIGHT' };

  const callback = window.google?.maps?.__ib__;
  window.google = window.google || {};
  window.google.maps = window.google.maps || {};
  const maps = window.google.maps;

  maps.event = event;
  maps.Map = Map;
  maps.Rectangle = Rectangle;
  maps.LatLng = LatLng;
  maps.LatLngBounds = LatLngBounds;
  maps.MapTypeId = mapTypeId;
  maps.ControlPosition = controlPosition;
  maps.importLibrary = async (name) => {
    if (name === 'maps') {
      return { Map, LatLng, LatLngBounds, Rectangle, MapTypeId: mapTypeId, ControlPosition: controlPosition };
    }
    if (name === 'marker') {
      return { AdvancedMarkerElement, PinElement };
    }
    if (name === 'places') {
      return {};
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
        body: JSON.stringify({ apiKey, mapId }),
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

  test('highlights dynamically required STC fields before submit', async ({ page }) => {
    const longMax = page.locator('#input-stc-longmax_1');
    const latMin = page.locator('#input-stc-latmin_1');
    const longMin = page.locator('#input-stc-longmin_1');
    const description = page.locator('#input-stc-description');
    const startDate = page.locator('#input-stc-datestart');

    await longMax.fill('14');
    await longMax.blur();

    await expect(latMin).toHaveAttribute('aria-required', 'true');
    await expect(latMin).toHaveClass(/border-danger/);
    await expect(page.locator('label[for="input-stc-latmin_1"] .stc-required-marker')).toHaveText('*');

    await expect(longMin).toHaveAttribute('aria-required', 'true');
    await expect(longMin).toHaveClass(/border-danger/);
    await expect(page.locator('label[for="input-stc-longmin_1"] .stc-required-marker')).toHaveText('*');

    await expect(description).toHaveAttribute('aria-required', 'true');
    await expect(description).toHaveClass(/border-danger/);
    await expect(page.locator('label[for="input-stc-description"] .stc-required-marker')).toHaveText('*');

    await expect(startDate).toHaveAttribute('aria-required', 'true');
    await expect(startDate).toHaveClass(/border-danger/);
    await expect(page.locator('label[for="input-stc-datestart"] .stc-required-marker')).toHaveText('*');

    await expect(longMax).toHaveAttribute('aria-required', 'true');
    await expect(longMax).not.toHaveClass(/border-danger/);
    await expect(page.locator('label[for="input-stc-longmax_1"] .stc-required-marker')).toHaveCount(0);

    await longMax.fill('');
    await longMax.blur();

    await expect(latMin).not.toHaveAttribute('aria-required', 'true');
    await expect(latMin).not.toHaveClass(/border-danger/);
    await expect(page.locator('label[for="input-stc-latmin_1"] .stc-required-marker')).toHaveCount(0);
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

    const firstRowLongMax = page.locator('#input-stc-longmax_1');
    await firstRowLongMax.fill('14');
    await firstRowLongMax.blur();
    await expect(page.locator('#input-stc-latmin_1')).toHaveClass(/border-danger/);

    await page.locator('#button-stc-add').click();
    const rows = page.locator(`${SELECTORS.formGroups.spatialTemporalCoverages} [tsc-row]`);
    await expect(rows).toHaveCount(2);

    const secondRowTimezone = page.locator('[tsc-row-id="2"] select[name="tscTimezone[]"]');
    await expect(secondRowTimezone).toHaveValue(chosenValue);

    const secondRowLatMin = page.locator('[tsc-row-id="2"] #input-stc-latmin_2');
    await expect(page.locator('[tsc-row-id="2"] label[for="input-stc-latmin_2"]')).toBeVisible();
    await expect(secondRowLatMin).not.toHaveAttribute('aria-required', 'true');
    await expect(secondRowLatMin).not.toHaveClass(/border-danger/);
    await expect(page.locator('[tsc-row-id="2"] label[for="input-stc-latmin_2"] .stc-required-marker')).toHaveCount(0);

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

    // Wait for the drawing toolbar to become visible (indicates DrawingController is ready)
    await page.waitForFunction(
      () => {
        const toolbar = document.getElementById('map-drawing-toolbar');
        return toolbar && toolbar.style.display !== 'none';
      }
    );

    // DrawingController starts in 'marker' mode by default.
    // Simulate a click on the map to place a marker.
    await page.evaluate(() => {
      const mapInstance = (window as any).__elmoMapInstance;
      const latLng = new (window as any).google.maps.LatLng(40.7128, -74.0060);
      (window as any).google.maps.event.trigger(mapInstance, 'click', { latLng });
    });

    const latMin = page.locator('#input-stc-latmin_1');
    const longMin = page.locator('#input-stc-longmin_1');
    const latMax = page.locator('#input-stc-latmax_1');
    const longMax = page.locator('#input-stc-longmax_1');

    await expect(latMin).not.toHaveValue('');
    await expect(longMin).not.toHaveValue('');
    await expect(latMax).toHaveValue('');
    await expect(longMax).toHaveValue('');

    // Switch to rectangle mode by clicking the rectangle toolbar button
    await page.locator('#btn-draw-rectangle').click();

    // Rectangle drawing uses TWO clicks (not click+drag): first click anchors the
    // first corner, second click completes it. A 150ms double-click guard timer
    // must expire between clicks, so we wait 300ms after each.

    // First click – anchors first corner, starts the preview rectangle
    await page.evaluate(() => {
      const mapInstance = (window as any).__elmoMapInstance;
      (window as any).google.maps.event.trigger(mapInstance, 'click', {
        latLng: new (window as any).google.maps.LatLng(40.0, -74.5),
      });
    });
    await page.waitForTimeout(300); // wait for 150ms DBLCLICK_THRESHOLD timer to fire

    // Second click – completes the rectangle and emits 'rectanglecomplete'
    await page.evaluate(() => {
      const mapInstance = (window as any).__elmoMapInstance;
      (window as any).google.maps.event.trigger(mapInstance, 'click', {
        latLng: new (window as any).google.maps.LatLng(41.0, -73.5),
      });
    });
    await page.waitForTimeout(300); // wait for timer to fire and fields to update

    await expect(latMax).toHaveValue(/41(?:\.0+)?/);
    await expect(longMax).toHaveValue(/-73\.5/);
    await expect(latMin).toHaveValue(/40(?:\.0+)?/);
    await expect(longMin).toHaveValue(/-74\.5/);
  });

  test('allows date-only entries without time fields', async ({ page }) => {
    // Fill spatial coordinates (required)
    await page.locator('#input-stc-latmin_1').fill('52.0');
    await page.locator('#input-stc-latmax_1').fill('52.5');
    await page.locator('#input-stc-longmin_1').fill('13.0');
    await page.locator('#input-stc-longmax_1').fill('13.5');

    // Fill only dates, no times
    const startDate = page.locator('#input-stc-datestart');
    const endDate = page.locator('#input-stc-dateend');
    await startDate.fill('2024-01-15');
    await endDate.fill('2024-06-30');

    // Leave time fields empty
    const startTime = page.locator('#input-stc-timestart');
    const endTime = page.locator('#input-stc-timeend');
    await expect(startTime).toHaveValue('');
    await expect(endTime).toHaveValue('');

    // Timezone is pre-populated (no empty option exists), but validation should still pass
    // when no time is provided since timezone is only required with time fields
    const timezoneSelect = page.locator('#input-stc-timezone');

    // Trigger blur to run validation
    await endDate.blur();

    // Date fields should NOT have invalid class since date-only is allowed
    await expect(startDate).not.toHaveClass(/is-invalid/);
    await expect(endDate).not.toHaveClass(/is-invalid/);

    // Time fields should remain valid (not required when empty)
    await expect(startTime).not.toHaveClass(/is-invalid/);
    await expect(endTime).not.toHaveClass(/is-invalid/);

    // Timezone should not be marked invalid when no time is provided
    await expect(timezoneSelect).not.toHaveClass(/is-invalid/);
  });

  test('makes timezone required when time fields are filled', async ({ page }) => {
    // Verify timezone is NOT required initially
    const timezoneSelect = page.locator('#input-stc-timezone');
    await expect(timezoneSelect).not.toHaveAttribute('required');

    // Fill spatial coordinates (required)
    await page.locator('#input-stc-latmin_1').fill('52.0');
    await page.locator('#input-stc-latmax_1').fill('52.5');
    await page.locator('#input-stc-longmin_1').fill('13.0');
    await page.locator('#input-stc-longmax_1').fill('13.5');

    // Fill only dates first
    await page.locator('#input-stc-datestart').fill('2024-01-15');
    await page.locator('#input-stc-dateend').fill('2024-06-30');

    // Trigger blur to run validation
    await page.locator('#input-stc-dateend').blur();

    // Timezone should still NOT be required when only dates are provided
    await expect(timezoneSelect).not.toHaveAttribute('required');

    // Now fill time fields
    await page.locator('#input-stc-timestart').fill('09:00');
    await page.locator('#input-stc-timeend').fill('17:00');

    // Trigger blur to run validation
    await page.locator('#input-stc-timeend').blur();

    await simulateSubmitValidation(page);

    // Timezone should now be required when time is provided
    await expect(timezoneSelect).toHaveAttribute('required');
  });
});