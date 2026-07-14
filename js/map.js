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

  function debugLog(message, data) {
    console.log("[ELMO Map]", message, data || {});
  }

  function debugError(message, error, data) {
    console.error("[ELMO Map ERROR]", message, {
      message: error && error.message ? error.message : null,
      name: error && error.name ? error.name : null,
      stack: error && error.stack ? error.stack : null,
      context: data || {}
    });
  }


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

    debugLog("map modal open clicked", {
      rowId: rowId
    });

    // Store current row reference and ID in the modal
    $("#modal-stc-map")
      .data("current-row", $currentRow)
      .data("tsc-row-id", rowId);

    // Adjust the map when the modal is shown
    $("#modal-stc-map").one("shown.bs.modal", function () {
      debugLog("modal shown", {
        rowId: rowId,
        hasMap: !!map
      });

      google.maps.event.trigger(map, "resize");

      var latMin = $currentRow.find("[id^=input-stc-latmin]").val();
      var lngMin = $currentRow.find("[id^=input-stc-longmin]").val();
      var latMax = $currentRow.find("[id^=input-stc-latmax]").val();
      var lngMax = $currentRow.find("[id^=input-stc-longmax]").val();

      debugLog("modal row coordinates", {
        rowId: rowId,
        latMin: latMin,
        lngMin: lngMin,
        latMax: latMax,
        lngMax: lngMax
      });

      if (latMin && lngMin) {
        // Ensure overlay exists for this row (may not if coords were set programmatically)
        var hasOverlay = drawnOverlays.some(function (item) { return item.rowId === rowId; });

        debugLog("existing overlay check", {
          rowId: rowId,
          hasOverlay: hasOverlay
        });

        if (!hasOverlay) {
          updateMapOverlay(rowId, latMax, lngMax, latMin, lngMin);
        } else {
          fitMapBoundsForRow(rowId);
        }
      } else {
        // No coordinates yet – reset to whole-planet view
        debugLog("resetting map to default world view", {
          rowId: rowId
        });

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
      var rowId = $currentRow.attr("tsc-row-id");

      debugLog("cancel coordinates clicked", {
        rowId: rowId
      });

      $currentRow.find("[id^=input-stc-latmax]").val("");
      $currentRow.find("[id^=input-stc-longmax]").val("");
      $currentRow.find("[id^=input-stc-latmin]").val("");
      $currentRow.find("[id^=input-stc-longmin]").val("");


      deleteDrawnOverlaysForRow(rowId);
    }
  });

  /**
   * Event listener for the "Send Coordinates" button.
   * Hides the map modal.
   */
  $("#button-stc-sendcoords").click(function () {
    debugLog("send coordinates clicked; closing modal");
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
    /** @type {?number} Pending single-click debounce timer (on instance so setMode can cancel it) */
    this._clickTimer = null;
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
      btnMarker.addEventListener("click", function () {
        debugLog("drawing mode button clicked", { mode: "marker" });
        self.setMode("marker");
      });
    }
    if (btnRect) {
      btnRect.addEventListener("click", function () {
        debugLog("drawing mode button clicked", { mode: "rectangle" });
        self.setMode("rectangle");
      });
    }

    this._updateToolbarUI();
  };

  /**
   * Changes the active drawing mode and updates toolbar button states.
   *
   * @param {string} mode - The drawing mode to activate ('marker' or 'rectangle').
   */
  DrawingController.prototype.setMode = function (mode) {
    // Cancel any click that hasn't fired yet so it can't bleed into the new mode
    if (this._clickTimer !== null) {
      clearTimeout(this._clickTimer);
      this._clickTimer = null;
    }
    // Discard any in-progress rectangle so the new mode always starts clean
    if (this.previewRect) {
      this.previewRect.setMap(null);
      this.previewRect = null;
    }
    this.rectState = null;
    this.startLatLng = null;

    this.mode = mode;
    debugLog("drawing mode changed", { mode: mode });
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
    /** @type {number} Two clicks within this window (ms) are treated as a double-click */
    var DBLCLICK_THRESHOLD = 150;

    this._map.addListener("click", function (e) {
      if (self._clickTimer !== null) {
        // Second click arrived within the threshold – treat as double-click.
        // Cancel the pending drawing action; Google Maps handles the zoom via dblclick.
        clearTimeout(self._clickTimer);
        self._clickTimer = null;
        debugLog("map double click detected; pending drawing action cancelled");
        return;
      }

      var latLng = e.latLng;
      self._clickTimer = setTimeout(function () {
        self._clickTimer = null;
        if (self.mode === "marker") {
          debugLog("marker drawing click resolved", {
            lat: latLng.lat(),
            lng: latLng.lng(),
            hasAdvancedMarkerElement: !!AdvancedMarkerElement
          });

          try {
            var marker = new AdvancedMarkerElement({
              position: latLng,
              map: self._map
            });
            debugLog("advanced marker created from click", {
              lat: latLng.lat(),
              lng: latLng.lng()
            });
            self._emit("markercomplete", marker);
          } catch (error) {
            debugError("failed to create advanced marker from click", error, {
              lat: latLng.lat(),
              lng: latLng.lng()
            });
          }
        } else if (self.mode === "rectangle") {
          if (self.rectState === null) {
            // First click: anchor the first corner and show a preview rectangle
            self.rectState = "started";
            self.startLatLng = latLng;

            debugLog("rectangle drawing started", {
              lat: latLng.lat(),
              lng: latLng.lng()
            });

            self.previewRect = new google.maps.Rectangle({
              bounds: new google.maps.LatLngBounds(latLng, latLng),
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
              Math.min(self.startLatLng.lat(), latLng.lat()),
              Math.min(self.startLatLng.lng(), latLng.lng())
            );
            var ne = new google.maps.LatLng(
              Math.max(self.startLatLng.lat(), latLng.lat()),
              Math.max(self.startLatLng.lng(), latLng.lng())
            );
            var rect = self.previewRect;
            rect.setBounds(new google.maps.LatLngBounds(sw, ne));
            self.previewRect = null;
            self.startLatLng = null;

            debugLog("rectangle drawing completed", {
              sw: { lat: sw.lat(), lng: sw.lng() },
              ne: { lat: ne.lat(), lng: ne.lng() }
            });

            self._emit("rectanglecomplete", rect);
          }
        }
      }, DBLCLICK_THRESHOLD);
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

    // Right-click cancels an in-progress rectangle and resets to initial drawing state.
    this._map.addListener("rightclick", function () {
      if (self._clickTimer !== null) {
        clearTimeout(self._clickTimer);
        self._clickTimer = null;
      }
      if (self.previewRect) {
        self.previewRect.setMap(null);
        self.previewRect = null;
      }
      self.rectState = null;
      self.startLatLng = null;

      debugLog("rectangle drawing cancelled via right click");
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
    debugLog("drawing event emitted", {
      event: event
    });
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
    debugLog("createLabeledMarker called", {
      label: label,
      hasMap: !!map,
      hasPinElement: !!PinElement,
      hasAdvancedMarkerElement: !!AdvancedMarkerElement,
      position: typeof position.lat === "function"
        ? { lat: position.lat(), lng: position.lng() }
        : position
    });

    try {
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
    } catch (error) {
      debugError("createLabeledMarker failed", error, {
        label: label
      });
      throw error;
    }
  }

  /**
   * Updates the label of an AdvancedMarkerElement by recreating its PinElement content.
   *
   * @param {google.maps.marker.AdvancedMarkerElement} marker - The marker to update.
   * @param {string} newLabel - The new label text.
   */
  function updateMarkerLabel(marker, newLabel) {
    debugLog("updateMarkerLabel called", {
      newLabel: newLabel,
      hasMarker: !!marker,
      hasPinElement: !!PinElement
    });

    try {
      var pin = new PinElement({
        glyphText: newLabel,
        glyphColor: "white",
        background: "#FF0000",
        borderColor: "#CC0000"
      });
      marker.content = pin;
    } catch (error) {
      debugError("updateMarkerLabel failed", error, {
        newLabel: newLabel
      });
      throw error;
    }
  }

  /**
   * Removes an AdvancedMarkerElement from the map.
   * Handles both AdvancedMarkerElement (property assignment) and
   * legacy Marker/Rectangle (setMap method).
   *
   * @param {Object} overlay - The overlay to remove from the map.
   */
  function removeOverlayFromMap(overlay) {
    debugLog("removeOverlayFromMap called", {
      hasSetMap: !!(overlay && typeof overlay.setMap === "function"),
      hasMapProperty: !!(overlay && "map" in overlay)
    });

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
      debugLog("initMap aborted: panel-stc-map not found");
      return;
    }

    debugLog("initMap start", {
      mapId: mapId
    });

    // Import required libraries (no 'drawing' library needed)
    const mapsLib = await google.maps.importLibrary("maps");
    const markerLib = await google.maps.importLibrary("marker");
    const Map = mapsLib.Map;
    AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
    PinElement = markerLib.PinElement;

    debugLog("libraries loaded", {
      hasMapClass: !!Map,
      hasAdvancedMarkerElement: !!AdvancedMarkerElement,
      hasPinElement: !!PinElement
    });

    // Initialize map with mapId for AdvancedMarkerElement support
    var mapOptions = {
      center: { lat: 52.37929540757325, lng: 13.065966655404743 },
      zoom: 2,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    };
    if (mapId) {
      mapOptions.mapId = mapId;
    }

    debugLog("mapOptions before map creation", mapOptions);

    map = new Map(mapElement, mapOptions);

    debugLog("map created", {
      mapIdPassed: mapOptions.mapId || "",
      renderingType: typeof map.getRenderingType === "function" ? map.getRenderingType() : "n/a"
    });

    if (typeof map.getMapCapabilities === "function") {
      try {
        var caps = map.getMapCapabilities();
        debugLog("initial map capabilities", {
          isAdvancedMarkersAvailable: caps ? caps.isAdvancedMarkersAvailable : null,
          isDataDrivenStylingAvailable: caps ? caps.isDataDrivenStylingAvailable : null,
          isWebGLOverlayViewAvailable: caps ? caps.isWebGLOverlayViewAvailable : null
        });
      } catch (error) {
        debugError("reading initial map capabilities failed", error);
      }
    }

    if (typeof map.addListener === "function") {
      map.addListener("mapcapabilities_changed", function () {
        try {
          var caps = typeof map.getMapCapabilities === "function" ? map.getMapCapabilities() : null;
          debugLog("mapcapabilities_changed", {
            isAdvancedMarkersAvailable: caps ? caps.isAdvancedMarkersAvailable : null,
            isDataDrivenStylingAvailable: caps ? caps.isDataDrivenStylingAvailable : null,
            isWebGLOverlayViewAvailable: caps ? caps.isWebGLOverlayViewAvailable : null
          });
        } catch (error) {
          debugError("mapcapabilities_changed handler failed", error);
        }
      });
    }

    // Keyboard zoom: + / = zooms in, - zooms out, active whenever the map modal is visible.
    document.addEventListener("keydown", function (e) {
      var modal = document.getElementById("modal-stc-map");
      if (!modal || !modal.classList.contains("show")) return;
      // Don't steal keystrokes from text inputs (e.g. the place-search field)
      var tag = e.target ? e.target.tagName.toUpperCase() : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        debugLog("keyboard zoom in");
        map.setZoom(map.getZoom() + 1);
      } else if (e.key === "-") {
        e.preventDefault();
        debugLog("keyboard zoom out");
        map.setZoom(map.getZoom() - 1);
      }
    });

    // Setup custom drawing controller (replaces deprecated DrawingManager)
    var drawingController = new DrawingController(map);
    debugLog("drawing controller initialized");

    // Setup PlaceAutocompleteElement (replaces deprecated SearchBox)
    await setupPlaceAutocomplete();

    debugLog("place autocomplete initialized");

    // Handle rectangle drawing completion
    drawingController.on("rectanglecomplete", function (rectangle) {
      var $currentRow = $("#modal-stc-map").data("current-row");
      if (!$currentRow || !$currentRow.length) return;

      var rowId = $currentRow.attr("tsc-row-id");
      deleteDrawnOverlaysForRow(rowId);

      var bounds = rectangle.getBounds();
      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();

      debugLog("rectanglecomplete handler", {
        rowId: rowId,
        ne: { lat: ne.lat(), lng: ne.lng() },
        sw: { lat: sw.lat(), lng: sw.lng() }
      });

      $currentRow.find("[id^=input-stc-latmax]").val(ne.lat());
      $currentRow.find("[id^=input-stc-longmax]").val(ne.lng());
      $currentRow.find("[id^=input-stc-latmin]").val(sw.lat());
      $currentRow.find("[id^=input-stc-longmin]").val(sw.lng());

      var displayNumber = $currentRow.index() + 1;
      var label = createLabeledMarker(bounds.getCenter(), displayNumber.toString());

      drawnOverlays.push({ rowId: rowId, overlay: rectangle, labelOverlay: label });

      debugLog("rectangle overlay stored", {
        rowId: rowId,
        drawnOverlayCount: drawnOverlays.length
      });
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
      debugLog("markercomplete handler", {
        rowId: rowId,
        lat: lat,
        lng: lng
      });

      $currentRow.find("[id^=input-stc-latmin]").val(lat);
      $currentRow.find("[id^=input-stc-longmin]").val(lng);
      $currentRow.find("[id^=input-stc-latmax]").val("");
      $currentRow.find("[id^=input-stc-longmax]").val("");

      var displayNumber = $currentRow.index() + 1;
      updateMarkerLabel(marker, displayNumber.toString());
      drawnOverlays.push({ rowId: rowId, overlay: marker });

      debugLog("marker overlay stored", {
        rowId: rowId,
        drawnOverlayCount: drawnOverlays.length
      });
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
    debugLog("setupPlaceAutocomplete start");

    await google.maps.importLibrary("places");

    var card = document.getElementById("place-autocomplete-card");
    var placeAutocomplete = document.querySelector("gmp-place-autocomplete");

    debugLog("place autocomplete elements", {
      hasCard: !!card,
      hasPlaceAutocomplete: !!placeAutocomplete
    });

    if (!card || !placeAutocomplete) return;

    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);

    // Bias search results to current map viewport
    map.addListener("bounds_changed", function () {
      placeAutocomplete.locationBias = map.getBounds();
    });

    // Handle place selection from autocomplete
    placeAutocomplete.addEventListener("gmp-select", async function (event) {
      debugLog("place autocomplete selection event fired");

      var placePrediction = event.placePrediction;
      var place = placePrediction.toPlace();
      await place.fetchFields({ fields: ["location", "viewport"] });

      debugLog("place fetched", {
        hasLocation: !!place.location,
        hasViewport: !!place.viewport
      });

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
        try {
          searchMarker = new AdvancedMarkerElement({
            map: map,
            position: place.location
          });

          debugLog("search marker created", {
            hasLocation: !!place.location
          });
        } catch (error) {
          debugError("search marker creation failed", error);
        }
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

      debugLog("coordinate input changed", {
        rowId: currentRowId,
        latMax: latMax,
        lngMax: lngMax,
        latMin: latMin,
        lngMin: lngMin
      });

      updateMapOverlay(currentRowId, latMax, lngMax, latMin, lngMin);
    }
  );

  /**
   * Updates the labels on the overlays to match the current row numbering.
   */
  function updateOverlayLabels() {
    debugLog("updateOverlayLabels called", {
      drawnOverlayCount: drawnOverlays.length
    });

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

    debugLog("updateOverlayLabels finished", {
      remainingOverlayCount: drawnOverlays.length
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
    debugLog("updateMapOverlay called", {
      rowId: currentRowId,
      latMax: latMax,
      lngMax: lngMax,
      latMin: latMin,
      lngMin: lngMin
    });

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

      debugLog("rectangle overlay created from inputs", {
        rowId: currentRowId,
        displayNumber: displayNumber
      });

      var label = createLabeledMarker(bounds.getCenter(), displayNumber.toString());
      drawnOverlays.push({ rowId: currentRowId, overlay: rectangle, labelOverlay: label });
    } else if (latMin && lngMin) {
      var position = new google.maps.LatLng(
        parseFloat(latMin),
        parseFloat(lngMin)
      );

      debugLog("point overlay created from inputs", {
        rowId: currentRowId,
        displayNumber: displayNumber,
        lat: position.lat(),
        lng: position.lng()
      });

      var marker = new AdvancedMarkerElement({
        position: position,
        map: map
      });
      updateMarkerLabel(marker, displayNumber.toString());
      drawnOverlays.push({ rowId: currentRowId, overlay: marker });
    }

    debugLog("updateMapOverlay finished", {
      rowId: currentRowId,
      drawnOverlayCount: drawnOverlays.length
    });

    fitMapBoundsForRow(currentRowId);
  }

  /**
   * Deletes all drawn overlays (markers and rectangles) for a specific row ID.
   *
   * @param {string} rowId - The ID of the row whose overlays should be deleted.
   */
  function deleteDrawnOverlaysForRow(rowId) {
    debugLog("deleteDrawnOverlaysForRow called", {
      rowId: rowId,
      drawnOverlayCountBefore: drawnOverlays.length
    });

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

    debugLog("deleteDrawnOverlaysForRow finished", {
      rowId: rowId,
      drawnOverlayCountAfter: drawnOverlays.length
    });
  }

  /**
   * Adjusts the map's viewport to fit the drawn overlays for a single row.
   *
   * @param {string} rowId - The row whose overlays define the viewport.
   */
  function fitMapBoundsForRow(rowId) {
    debugLog("fitMapBoundsForRow called", {
      rowId: rowId
    });

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

      debugLog("fitMapBoundsForRow applying bounds", {
        rowId: rowId,
        ne: { lat: ne.lat(), lng: ne.lng() },
        sw: { lat: sw.lat(), lng: sw.lng() }
      });

      map.fitBounds(bounds);
    } else {
      debugLog("fitMapBoundsForRow skipped: bounds empty", {
        rowId: rowId
      });
    }
  }

  /**
   * Adjusts the map's viewport to fit all drawn overlays with a 50% buffer.
   */
  function fitMapBounds() {
    debugLog("fitMapBounds called", {
      drawnOverlayCount: drawnOverlays.length
    });

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

      debugLog("fitMapBounds applying bounds", {
        ne: { lat: ne.lat(), lng: ne.lng() },
        sw: { lat: sw.lat(), lng: sw.lng() }
      });

      map.fitBounds(bounds);
    } else {
      debugLog("fitMapBounds skipped: bounds empty");
    }
  }


  /**
   * Loads the Google Maps API dynamically using the provided API key.
   * This function is adapted from the Google Maps JavaScript API documentation.
   *
   * @param {string} apiKey - The API key for Google Maps.
   */
  function loadGoogleMapsApi(apiKey) {
    debugLog("loadGoogleMapsApi called", {
      hasApiKey: !!apiKey
    });

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
            debugLog("appending Google Maps script", {
              src: a.src
            });
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
      debugLog("settings.php response received", {
        ok: response.ok,
        status: response.status
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then(function (data) {
      debugLog("maps config from settings.php", {
        hasApiKey: !!data.apiKey,
        mapId: data.mapId || "",
        host: window.location.host
      });

      if (data.apiKey) {
        if (!window.google || !window.google.maps || !window.google.maps.importLibrary) {
          loadGoogleMapsApi(data.apiKey);
        }
        window.google.maps.importLibrary("maps").then(function () {
          debugLog("google.maps.importLibrary('maps') resolved; calling initMap", {
            mapId: data.mapId || ""
          });
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