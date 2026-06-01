$(document).ready(function () {
  /** @type {google.maps.Map} */
  var map;
  /** @type {Array<Object>} */
  var drawnOverlays = [];
  /** @type {?google.maps.marker.AdvancedMarkerElement} */
  var searchMarker = null;
  /** @type {?Function} AdvancedMarkerElement constructor, set after library load */
  var AdvancedMarkerElement = null;
  /** @type {?Function} PinElement constructor, set after library load */
  var PinElement = null;

  /**
   * Standard rectangle style options used for all drawn rectangles.
   * @type {Object}
   */
  var RECTANGLE_STYLE = {
    strokeColor: "#FF0000",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#FF0000",
    fillOpacity: 0.35
  };

  /**
   * Event listener for Map buttons within the #group-stc.
   * Stores the current row data when the map modal is opened and adjusts the map.
   */
  $("#group-stc").on("click", "[data-bs-target='#modal-stc-map']", function () {
    var $currentRow = $(this).closest("[tsc-row]");
    var rowId = $currentRow.attr("tsc-row-id");

    // Store current row reference and ID in the modal
    $("#modal-stc-map")
      .data("current-row", $currentRow)
      .data("tsc-row-id", rowId);

    // Adjust the map when the modal is shown
    $("#modal-stc-map").one("shown.bs.modal", function () {
      google.maps.event.trigger(map, "resize");

      var latMin = $currentRow.find("[id^=input-stc-latmin]").val();
      var lngMin = $currentRow.find("[id^=input-stc-longmin]").val();
      var latMax = $currentRow.find("[id^=input-stc-latmax]").val();
      var lngMax = $currentRow.find("[id^=input-stc-longmax]").val();

      if (latMin && lngMin) {
        // Ensure overlay exists for this row (may not if coords were set programmatically)
        var hasOverlay = drawnOverlays.some(function (item) { return item.rowId === rowId; });
        if (!hasOverlay) {
          updateMapOverlay(rowId, latMax, lngMax, latMin, lngMin);
        } else {
          fitMapBoundsForRow(rowId);
        }
      } else {
        // No coordinates yet – reset to whole-planet view
        map.setCenter({ lat: 20, lng: 0 });
        map.setZoom(2);
      }
    });
  });

  /**
   * Event listener for the "Cancel Coordinates" button.
   * Clears coordinate inputs and removes any drawn overlays for the current row.
   */
  $("#button-stc-cancelpanel").click(function () {
    var $currentRow = $("#modal-stc-map").data("current-row");
    if ($currentRow && $currentRow.length) {
      $currentRow.find("[id^=input-stc-latmax]").val("");
      $currentRow.find("[id^=input-stc-longmax]").val("");
      $currentRow.find("[id^=input-stc-latmin]").val("");
      $currentRow.find("[id^=input-stc-longmin]").val("");

      var rowId = $currentRow.attr("tsc-row-id");
      deleteDrawnOverlaysForRow(rowId);
    }
  });

  /**
   * Event listener for the "Send Coordinates" button.
   * Hides the map modal.
   */
  $("#button-stc-sendcoords").click(function () {
    $("#modal-stc-map").modal("hide");
  });

  // ───────────────────────────────────────────────────────────
  // Custom DrawingController – replaces the deprecated Drawing Library
  // ───────────────────────────────────────────────────────────

  /**
   * Custom drawing controller that replaces the deprecated Google Maps Drawing Library.
   * Supports placing markers (single click) and drawing rectangles (click + drag).
   *
   * @class DrawingController
   * @param {google.maps.Map} mapInstance - The Google Map instance.
   */
  function DrawingController(mapInstance) {
    /** @type {string|null} Current drawing mode: 'marker' | 'rectangle' | null */
    this.mode = "marker";
    /** @type {string|null} Rectangle drawing state: null | 'started' */
    this.rectState = null;
    /** @type {?google.maps.LatLng} Start position for rectangle drawing */
    this.startLatLng = null;
    /** @type {?google.maps.Rectangle} Temporary preview rectangle during drag */
    this.previewRect = null;
    /** @type {Object} Registered event callbacks */
    this._listeners = { rectanglecomplete: [], markercomplete: [] };
    /** @type {google.maps.Map} */
    this._map = mapInstance;

    this._setupToolbar();
    this._setupMapListeners();
  }

  /**
   * Sets up the drawing toolbar as a custom map control.
   * @private
   */
  DrawingController.prototype._setupToolbar = function () {
    var toolbar = document.getElementById("map-drawing-toolbar");
    if (!toolbar) return;

    toolbar.style.display = "flex";
    this._map.controls[google.maps.ControlPosition.TOP_CENTER].push(toolbar);

    var self = this;
    var btnMarker = document.getElementById("btn-draw-marker");
    var btnRect = document.getElementById("btn-draw-rectangle");

    if (btnMarker) {
      btnMarker.addEventListener("click", function () { self.setMode("marker"); });
    }
    if (btnRect) {
      btnRect.addEventListener("click", function () { self.setMode("rectangle"); });
    }

    this._updateToolbarUI();
  };

  /**
   * Changes the active drawing mode and updates toolbar button states.
   *
   * @param {string} mode - The drawing mode to activate ('marker' or 'rectangle').
   */
  DrawingController.prototype.setMode = function (mode) {
    this.mode = mode;
    this._updateToolbarUI();
    this._map.setOptions({
      draggableCursor: mode ? "crosshair" : null
    });
  };

  /**
   * Updates the active/inactive state of toolbar buttons.
   * @private
   */
  DrawingController.prototype._updateToolbarUI = function () {
    var btnMarker = document.getElementById("btn-draw-marker");
    var btnRect = document.getElementById("btn-draw-rectangle");
    if (btnMarker) {
      btnMarker.classList.toggle("active", this.mode === "marker");
      btnMarker.setAttribute("aria-pressed", this.mode === "marker" ? "true" : "false");
    }
    if (btnRect) {
      btnRect.classList.toggle("active", this.mode === "rectangle");
      btnRect.setAttribute("aria-pressed", this.mode === "rectangle" ? "true" : "false");
    }
  };

  /**
   * Sets up click and mousemove listeners on the map for drawing.
   * Rectangle drawing uses two clicks: first click sets the first corner,
   * second click completes the rectangle. Any corner order is supported.
   * @private
   */
  DrawingController.prototype._setupMapListeners = function () {
    var self = this;

    this._map.addListener("click", function (e) {
      if (self.mode === "marker") {
        var marker = new AdvancedMarkerElement({
          position: e.latLng,
          map: self._map
        });
        self._emit("markercomplete", marker);
      } else if (self.mode === "rectangle") {
        if (self.rectState === null) {
          // First click: anchor the first corner and show a preview rectangle
          self.rectState = "started";
          self.startLatLng = e.latLng;
          self.previewRect = new google.maps.Rectangle({
            bounds: new google.maps.LatLngBounds(e.latLng, e.latLng),
            strokeColor: RECTANGLE_STYLE.strokeColor,
            strokeOpacity: RECTANGLE_STYLE.strokeOpacity,
            strokeWeight: RECTANGLE_STYLE.strokeWeight,
            fillColor: RECTANGLE_STYLE.fillColor,
            fillOpacity: RECTANGLE_STYLE.fillOpacity,
            map: self._map,
            clickable: false
          });
        } else {
          // Second click: finalize bounds (normalise so any corner order works)
          self.rectState = null;
          var sw = new google.maps.LatLng(
            Math.min(self.startLatLng.lat(), e.latLng.lat()),
            Math.min(self.startLatLng.lng(), e.latLng.lng())
          );
          var ne = new google.maps.LatLng(
            Math.max(self.startLatLng.lat(), e.latLng.lat()),
            Math.max(self.startLatLng.lng(), e.latLng.lng())
          );
          var rect = self.previewRect;
          rect.setBounds(new google.maps.LatLngBounds(sw, ne));
          self.previewRect = null;
          self.startLatLng = null;
          self._emit("rectanglecomplete", rect);
        }
      }
    });

    this._map.addListener("mousemove", function (e) {
      if (self.rectState === "started" && self.previewRect) {
        var sw = new google.maps.LatLng(
          Math.min(self.startLatLng.lat(), e.latLng.lat()),
          Math.min(self.startLatLng.lng(), e.latLng.lng())
        );
        var ne = new google.maps.LatLng(
          Math.max(self.startLatLng.lat(), e.latLng.lat()),
          Math.max(self.startLatLng.lng(), e.latLng.lng())
        );
        self.previewRect.setBounds(new google.maps.LatLngBounds(sw, ne));
      }
    });
  };

  /**
   * Registers a callback for a drawing event.
   *
   * @param {string} event - The event name ('rectanglecomplete' or 'markercomplete').
   * @param {Function} callback - The callback function.
   */
  DrawingController.prototype.on = function (event, callback) {
    if (this._listeners[event]) {
      this._listeners[event].push(callback);
    }
  };

  /**
   * Emits a drawing event to all registered listeners.
   *
   * @param {string} event - The event name.
   * @param {*} data - The event data (marker or rectangle instance).
   * @private
   */
  DrawingController.prototype._emit = function (event, data) {
    (this._listeners[event] || []).forEach(function (cb) { cb(data); });
  };

  // ───────────────────────────────────────────────────────────
  // Helper: create a labeled AdvancedMarkerElement with PinElement
  // ───────────────────────────────────────────────────────────

  /**
   * Creates an AdvancedMarkerElement with a numbered pin label.
   *
   * @param {google.maps.LatLng|google.maps.LatLngLiteral} position - The marker position.
   * @param {string} label - The text label to display on the pin.
   * @returns {google.maps.marker.AdvancedMarkerElement} The created marker.
   */
  function createLabeledMarker(position, label) {
    var pin = new PinElement({
      glyphText: label,
      glyphColor: "white",
      background: "#FF0000",
      borderColor: "#CC0000"
    });
    return new AdvancedMarkerElement({
      position: position,
      map: map,
      content: pin
    });
  }

  /**
   * Updates the label of an AdvancedMarkerElement by recreating its PinElement content.
   *
   * @param {google.maps.marker.AdvancedMarkerElement} marker - The marker to update.
   * @param {string} newLabel - The new label text.
   */
  function updateMarkerLabel(marker, newLabel) {
    var pin = new PinElement({
      glyphText: newLabel,
      glyphColor: "white",
      background: "#FF0000",
      borderColor: "#CC0000"
    });
    marker.content = pin;
  }

  /**
   * Removes an AdvancedMarkerElement from the map.
   * Handles both AdvancedMarkerElement (property assignment) and
   * legacy Marker/Rectangle (setMap method).
   *
   * @param {Object} overlay - The overlay to remove from the map.
   */
  function removeOverlayFromMap(overlay) {
    if (typeof overlay.setMap === "function") {
      overlay.setMap(null);
    } else if ("map" in overlay) {
      overlay.map = null;
    }
  }

  // ───────────────────────────────────────────────────────────
  // Map initialization
  // ───────────────────────────────────────────────────────────

  /**
   * Initializes the Google Map, custom DrawingController, and PlaceAutocompleteElement.
   * Sets up event listeners for drawing rectangles and markers on the map.
   *
   * @param {string} mapId - The Google Maps Map ID (required for AdvancedMarkerElement).
   */
  async function initMap(mapId) {
    const mapElement = document.getElementById("panel-stc-map");
    if (!mapElement) {
      return;
    }

    // Import required libraries (no 'drawing' library needed)
    const mapsLib = await google.maps.importLibrary("maps");
    const markerLib = await google.maps.importLibrary("marker");
    const Map = mapsLib.Map;
    AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
    PinElement = markerLib.PinElement;

    // Initialize map with mapId for AdvancedMarkerElement support
    var mapOptions = {
      center: { lat: 52.37929540757325, lng: 13.065966655404743 },
      zoom: 2,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    };
    if (mapId) {
      mapOptions.mapId = mapId;
    }
    map = new Map(mapElement, mapOptions);

    // Setup custom drawing controller (replaces deprecated DrawingManager)
    var drawingController = new DrawingController(map);

    // Setup PlaceAutocompleteElement (replaces deprecated SearchBox)
    await setupPlaceAutocomplete();

    // Handle rectangle drawing completion
    drawingController.on("rectanglecomplete", function (rectangle) {
      var $currentRow = $("#modal-stc-map").data("current-row");
      if (!$currentRow || !$currentRow.length) return;

      var rowId = $currentRow.attr("tsc-row-id");
      deleteDrawnOverlaysForRow(rowId);

      var bounds = rectangle.getBounds();
      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();

      $currentRow.find("[id^=input-stc-latmax]").val(ne.lat());
      $currentRow.find("[id^=input-stc-longmax]").val(ne.lng());
      $currentRow.find("[id^=input-stc-latmin]").val(sw.lat());
      $currentRow.find("[id^=input-stc-longmin]").val(sw.lng());

      var displayNumber = $currentRow.index() + 1;
      var label = createLabeledMarker(bounds.getCenter(), displayNumber.toString());

      drawnOverlays.push({ rowId: rowId, overlay: rectangle, labelOverlay: label });
    });

    // Handle marker placement completion
    drawingController.on("markercomplete", function (marker) {
      var $currentRow = $("#modal-stc-map").data("current-row");
      if (!$currentRow || !$currentRow.length) return;

      var rowId = $currentRow.attr("tsc-row-id");
      deleteDrawnOverlaysForRow(rowId);

      var position = marker.position;
      var lat = typeof position.lat === "function" ? position.lat() : position.lat;
      var lng = typeof position.lng === "function" ? position.lng() : position.lng;
      $currentRow.find("[id^=input-stc-latmin]").val(lat);
      $currentRow.find("[id^=input-stc-longmin]").val(lng);
      $currentRow.find("[id^=input-stc-latmax]").val("");
      $currentRow.find("[id^=input-stc-longmax]").val("");

      var displayNumber = $currentRow.index() + 1;
      updateMarkerLabel(marker, displayNumber.toString());
      drawnOverlays.push({ rowId: rowId, overlay: marker });
    });
  }

  // ───────────────────────────────────────────────────────────
  // PlaceAutocompleteElement – replaces deprecated SearchBox
  // ───────────────────────────────────────────────────────────

  /**
   * Sets up the PlaceAutocompleteElement (new Places API) as a map control
   * to replace the deprecated google.maps.places.SearchBox.
   *
   * @async
   */
  async function setupPlaceAutocomplete() {
    await google.maps.importLibrary("places");

    var card = document.getElementById("place-autocomplete-card");
    var placeAutocomplete = document.querySelector("gmp-place-autocomplete");

    if (!card || !placeAutocomplete) return;

    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);

    // Bias search results to current map viewport
    map.addListener("bounds_changed", function () {
      placeAutocomplete.locationBias = map.getBounds();
    });

    // Handle place selection from autocomplete
    placeAutocomplete.addEventListener("gmp-select", async function (event) {
      var placePrediction = event.placePrediction;
      var place = placePrediction.toPlace();
      await place.fetchFields({ fields: ["location", "viewport"] });

      // Clear previous search marker
      if (searchMarker) {
        removeOverlayFromMap(searchMarker);
      }

      // Center map on selected place
      if (place.viewport) {
        map.fitBounds(place.viewport);
      } else if (place.location) {
        map.panTo(place.location);
        map.setZoom(15);
      }

      // Add marker for selected place
      if (place.location) {
        searchMarker = new AdvancedMarkerElement({
          map: map,
          position: place.location
        });
      }
    });
  }

  /**
   * Event listener for changes in the coordinate input fields.
   * Updates the map overlays based on the input values.
   */
  $("#group-stc").on(
    "input",
    "[tsc-row] input[name^='tscLatitude'], [tsc-row] input[name^='tscLongitude']",
    function () {
      var $row = $(this).closest("[tsc-row]");
      var currentRowId = $row.attr("tsc-row-id");

      var latMax = $row.find("[id^=input-stc-latmax]").val();
      var lngMax = $row.find("[id^=input-stc-longmax]").val();
      var latMin = $row.find("[id^=input-stc-latmin]").val();
      var lngMin = $row.find("[id^=input-stc-longmin]").val();

      updateMapOverlay(currentRowId, latMax, lngMax, latMin, lngMin);
    }
  );

  /**
   * Updates the labels on the overlays to match the current row numbering.
   */
  function updateOverlayLabels() {
    drawnOverlays.forEach(function (item) {
      var rowId = item.rowId;
      var $row = $("#group-stc").find("[tsc-row-id='" + rowId + "']");

      if ($row.length > 0) {
        var displayNumber = $row.index() + 1;

        if (item.overlay instanceof google.maps.Rectangle) {
          if (item.labelOverlay) {
            updateMarkerLabel(item.labelOverlay, displayNumber.toString());
          }
        } else {
          // AdvancedMarkerElement overlay (point marker)
          updateMarkerLabel(item.overlay, displayNumber.toString());
        }
      } else {
        // Row no longer exists – remove the overlay from the map
        removeOverlayFromMap(item.overlay);
        if (item.labelOverlay) {
          removeOverlayFromMap(item.labelOverlay);
        }
      }
    });

    // Remove entries for deleted rows
    drawnOverlays = drawnOverlays.filter(function (item) {
      var $row = $("#group-stc").find("[tsc-row-id='" + item.rowId + "']");
      return $row.length > 0;
    });
  }

  /**
   * Updates the map overlays based on the provided coordinates.
   * Draws rectangles or markers on the map depending on the inputs.
   *
   * @param {string} currentRowId - The ID of the current row.
   * @param {string} latMax - The maximum latitude value.
   * @param {string} lngMax - The maximum longitude value.
   * @param {string} latMin - The minimum latitude value.
   * @param {string} lngMin - The minimum longitude value.
   */
  function updateMapOverlay(currentRowId, latMax, lngMax, latMin, lngMin) {
    deleteDrawnOverlaysForRow(currentRowId);

    var $row = $("#group-stc").find("[tsc-row-id='" + currentRowId + "']");
    var displayNumber = $row.index() + 1;

    if (latMax && lngMax && latMin && lngMin) {
      var bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(parseFloat(latMin), parseFloat(lngMin)),
        new google.maps.LatLng(parseFloat(latMax), parseFloat(lngMax))
      );
      var rectangle = new google.maps.Rectangle({
        bounds: bounds,
        strokeColor: RECTANGLE_STYLE.strokeColor,
        strokeOpacity: RECTANGLE_STYLE.strokeOpacity,
        strokeWeight: RECTANGLE_STYLE.strokeWeight,
        fillColor: RECTANGLE_STYLE.fillColor,
        fillOpacity: RECTANGLE_STYLE.fillOpacity,
        map: map,
        clickable: false
      });

      var label = createLabeledMarker(bounds.getCenter(), displayNumber.toString());
      drawnOverlays.push({ rowId: currentRowId, overlay: rectangle, labelOverlay: label });
    } else if (latMin && lngMin) {
      var position = new google.maps.LatLng(
        parseFloat(latMin),
        parseFloat(lngMin)
      );
      var marker = new AdvancedMarkerElement({
        position: position,
        map: map
      });
      updateMarkerLabel(marker, displayNumber.toString());
      drawnOverlays.push({ rowId: currentRowId, overlay: marker });
    }

    fitMapBoundsForRow(currentRowId);
  }

  /**
   * Deletes all drawn overlays (markers and rectangles) for a specific row ID.
   *
   * @param {string} rowId - The ID of the row whose overlays should be deleted.
   */
  function deleteDrawnOverlaysForRow(rowId) {
    drawnOverlays = drawnOverlays.filter(function (item) {
      if (item.rowId === rowId) {
        removeOverlayFromMap(item.overlay);
        if (item.labelOverlay) {
          removeOverlayFromMap(item.labelOverlay);
        }
        return false;
      }
      return true;
    });
  }

  /**
   * Adjusts the map's viewport to fit the drawn overlays for a single row.
   *
   * @param {string} rowId - The row whose overlays define the viewport.
   */
  function fitMapBoundsForRow(rowId) {
    var bounds = new google.maps.LatLngBounds();
    drawnOverlays.forEach(function (item) {
      if (item.rowId !== rowId) return;
      if (item.overlay.getBounds) {
        bounds.union(item.overlay.getBounds());
      } else if (item.overlay.position) {
        var pos = item.overlay.position;
        if (typeof pos.lat === "function") {
          bounds.extend(pos);
        } else {
          bounds.extend(new google.maps.LatLng(pos.lat, pos.lng));
        }
      } else if (item.overlay.getPosition) {
        bounds.extend(item.overlay.getPosition());
      }
    });
    if (!bounds.isEmpty()) {
      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();
      var lat_buffer = (ne.lat() - sw.lat()) * 0.5 || 2;
      var lng_buffer = (ne.lng() - sw.lng()) * 0.5 || 2;
      bounds.extend(new google.maps.LatLng(ne.lat() + lat_buffer, ne.lng() + lng_buffer));
      bounds.extend(new google.maps.LatLng(sw.lat() - lat_buffer, sw.lng() - lng_buffer));
      map.fitBounds(bounds);
    }
  }

  /**
   * Adjusts the map's viewport to fit all drawn overlays with a 50% buffer.
   */
  function fitMapBounds() {
    var bounds = new google.maps.LatLngBounds();
    drawnOverlays.forEach(function (item) {
      if (item.overlay.getBounds) {
        bounds.union(item.overlay.getBounds());
      } else if (item.overlay.position) {
        // AdvancedMarkerElement uses .position property
        var pos = item.overlay.position;
        if (typeof pos.lat === "function") {
          bounds.extend(pos);
        } else {
          bounds.extend(new google.maps.LatLng(pos.lat, pos.lng));
        }
      } else if (item.overlay.getPosition) {
        bounds.extend(item.overlay.getPosition());
      }
    });

    if (!bounds.isEmpty()) {
      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();
      var lat_buffer = (ne.lat() - sw.lat()) * 0.5;
      var lng_buffer = (ne.lng() - sw.lng()) * 0.5;
      bounds.extend(
        new google.maps.LatLng(ne.lat() + lat_buffer, ne.lng() + lng_buffer)
      );
      bounds.extend(
        new google.maps.LatLng(sw.lat() - lat_buffer, sw.lng() - lng_buffer)
      );
      map.fitBounds(bounds);
    }
  }

  /**
   * Loads the Google Maps API dynamically using the provided API key.
   * This function is adapted from the Google Maps JavaScript API documentation.
   *
   * @param {string} apiKey - The API key for Google Maps.
   */
  function loadGoogleMapsApi(apiKey) {
    ((g) => {
      var h,
        a,
        k,
        p = "The Google Maps JavaScript API",
        c = "google",
        l = "importLibrary",
        q = "__ib__",
        m = document,
        b = window;
      b = b[c] || (b[c] = {});
      var d = b.maps || (b.maps = {}),
        r = new Set(),
        e = new URLSearchParams(),
        u = () =>
          h ||
          (h = new Promise(async (f, n) => {
            await (a = m.createElement("script"));
            e.set("libraries", [...r] + "");
            for (k in g)
              e.set(
                k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
                g[k]
              );
            e.set("callback", c + ".maps." + q);
            a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
            d[q] = f;
            a.onerror = () => (h = n(Error(p + " could not load.")));
            a.nonce = m.querySelector("script[nonce]")?.nonce || "";
            m.head.append(a);
          }));
      d[l]
        ? console.warn(p + " only loads once. Ignoring:", g)
        : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
    })({
      key: apiKey,
      v: "weekly",
    });
  }

  // Fetch the Google Maps API key and Map ID from settings.php, then initialize
  fetch("settings.php?setting=apiKey")
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then(function (data) {
      if (data.apiKey) {
        if (!window.google || !window.google.maps || !window.google.maps.importLibrary) {
          loadGoogleMapsApi(data.apiKey);
        }
        window.google.maps.importLibrary("maps").then(function () {
          initMap(data.mapId || "");
        });
      } else {
        console.error("API key not found in the response");
      }
    })
    .catch(function (error) {
      console.error("Error fetching the API key:", error);
    });


  // Make functions globally accessible
  window.deleteDrawnOverlaysForRow = deleteDrawnOverlaysForRow;
  window.fitMapBounds = fitMapBounds;
  window.fitMapBoundsForRow = fitMapBoundsForRow;
  window.updateOverlayLabels = updateOverlayLabels;
  window.updateMapOverlay = updateMapOverlay;
});
