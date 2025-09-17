$(document).ready(function () {
  /** @type {google.maps.Map} */
  var map;
  /** @type {Array<Object>} */
  var drawnOverlays = [];

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
      fitMapBounds();
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

  /**
   * Initializes the Google Map, Drawing Manager and Places SearchBox.
   * Sets up event listeners for drawing rectangles and markers on the map.
   */
  async function initMap() {
    const mapElement = document.getElementById("panel-stc-map");
    if (!mapElement) {
      return;
    }

    // Import required libraries
    const { Map } = await google.maps.importLibrary("maps");
    const { DrawingManager } = await google.maps.importLibrary("drawing");
    const { SearchBox } = await google.maps.importLibrary("places");

    // Initialize map
    map = new Map(mapElement, {
      center: { lat: 52.37929540757325, lng: 13.065966655404743 },
      zoom: 2,
      mapTypeId: google.maps.MapTypeId.SATELLITE,
    });

    // Setup Drawing Manager for rectangles and markers
    const drawingManager = new DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.MARKER,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.RECTANGLE,
          google.maps.drawing.OverlayType.MARKER
        ]
      },
      rectangleOptions: {
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#FF0000",
        fillOpacity: 0.35
      }
    });
    drawingManager.setMap(map);

    // Prepare SearchBox for place lookups
    /** @type {HTMLInputElement} */
    const searchInput = document.getElementById("input-stc-map-search");
    $(searchInput).css({ width: "40%" });
    const searchBox = new SearchBox(searchInput);
    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(searchInput);

    // Bias search results to current viewport
    map.addListener("bounds_changed", () => {
      searchBox.setBounds(map.getBounds());
    });

    // Handle user selecting a place
    let searchMarker;
    searchBox.addListener("places_changed", () => {
      const places = searchBox.getPlaces();
      if (!places || !places.length) return;

      // Clear previous search marker
      if (searchMarker) {
        searchMarker.setMap(null);
      }

      const place = places[0];
      if (!place.geometry || !place.geometry.location) {
        return;
      }

      // Center and zoom the map to the selected place
      map.panTo(place.geometry.location);
      map.setZoom(15);

      // Add marker for selected place
      searchMarker = new google.maps.Marker({
        map: map,
        position: place.geometry.location
      });
    });

    /**
     * Event listener for when a rectangle is completed.
     * Updates the coordinate inputs and draws overlays on the map.
     *
     * @param {google.maps.Rectangle} rectangle - The completed rectangle.
     */
    google.maps.event.addListener(
      drawingManager,
      "rectanglecomplete",
      function (rectangle) {
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

        // Get the display number based on the row's position
        var displayNumber = $currentRow.index() + 1;

        var label = new google.maps.Marker({
          position: bounds.getCenter(),
          label: displayNumber.toString(),
          map: map,
        });

        drawnOverlays.push({ rowId: rowId, overlay: rectangle, labelOverlay: label });
      }
    );

    /**
     * Event listener for when a marker is completed.
     * Updates the coordinate inputs and draws overlays on the map.
     *
     * @param {google.maps.Marker} marker - The completed marker.
     */
    google.maps.event.addListener(
      drawingManager,
      "markercomplete",
      function (marker) {
        var $currentRow = $("#modal-stc-map").data("current-row");
        if (!$currentRow || !$currentRow.length) return;

        var rowId = $currentRow.attr("tsc-row-id");
        deleteDrawnOverlaysForRow(rowId);

        var position = marker.getPosition();
        $currentRow.find("[id^=input-stc-latmin]").val(position.lat());
        $currentRow.find("[id^=input-stc-longmin]").val(position.lng());
        $currentRow.find("[id^=input-stc-latmax]").val("");
        $currentRow.find("[id^=input-stc-longmax]").val("");

        // Get the display number based on the row's position
        var displayNumber = $currentRow.index() + 1;

        marker.setLabel(displayNumber.toString());
        drawnOverlays.push({ rowId: rowId, overlay: marker });
      }
    );
  }

  /**
  * Handles the 'shown.bs.modal' event for the STC map modal.
  * Triggers a map resize, fits all overlays, and re-adds the search control.
  */
  function onStcMapModalShown() {
    google.maps.event.trigger(map, "resize");
    fitMapBounds();

    // Ensure search control is right-aligned and rebias
    if (typeof searchInput !== 'undefined' && typeof searchBox !== 'undefined') {
      map.controls[google.maps.ControlPosition.TOP_RIGHT].push(searchInput);
      searchBox.setBounds(map.getBounds());
    }
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

      // Find the row with this tsc-row-id
      var $row = $("#group-stc").find("[tsc-row-id='" + rowId + "']");

      if ($row.length > 0) {
        var displayNumber = $row.index() + 1; // Since index is zero-based

        // Update the label on the overlay
        if (item.overlay instanceof google.maps.Rectangle) {
          if (item.labelOverlay) {
            item.labelOverlay.setLabel(displayNumber.toString());
          }
        } else if (item.overlay instanceof google.maps.Marker) {
          item.overlay.setLabel(displayNumber.toString());
        }
      } else {
        // If the row no longer exists, remove the overlay
        item.overlay.setMap(null);
        if (item.labelOverlay) {
          item.labelOverlay.setMap(null);
        }
      }
    });

    // Remove any overlays that are no longer associated with existing rows
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
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#FF0000",
        fillOpacity: 0.35,
        map: map,
      });

      var label = new google.maps.Marker({
        position: bounds.getCenter(),
        label: displayNumber.toString(),
        map: map,
      });

      drawnOverlays.push({ rowId: currentRowId, overlay: rectangle, labelOverlay: label });
    } else if (latMin && lngMin) {
      var position = new google.maps.LatLng(
        parseFloat(latMin),
        parseFloat(lngMin)
      );
      var marker = new google.maps.Marker({
        position: position,
        label: displayNumber.toString(),
        map: map,
      });

      drawnOverlays.push({ rowId: currentRowId, overlay: marker });
    }

    fitMapBounds();
  }

  /**
   * Deletes all drawn overlays (markers and rectangles) for a specific row ID.
   *
   * @param {string} rowId - The ID of the row whose overlays should be deleted.
   */
  function deleteDrawnOverlaysForRow(rowId) {
    drawnOverlays = drawnOverlays.filter((item) => {
      if (item.rowId === rowId) {
        item.overlay.setMap(null);
        if (item.labelOverlay) {
          item.labelOverlay.setMap(null);
        }
        return false;
      }
      return true;
    });
  }

  /**
   * Adjusts the map's viewport to fit all drawn overlays with a 50% buffer.
   */
  function fitMapBounds() {
    var bounds = new google.maps.LatLngBounds();
    drawnOverlays.forEach((item) => {
      if (item.overlay.getBounds) {
        bounds.union(item.overlay.getBounds());
      } else if (item.overlay.getPosition) {
        bounds.extend(item.overlay.getPosition());
      }
    });

    if (!bounds.isEmpty()) {
      // Zoom with 50% buffer
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

  // Fetch the Google Maps API key from helper_functions.php and initialize the map
  fetch("helper_functions.php?setting=apiKey")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      if (data.apiKey) {
        if (!window.google || !window.google.maps || !window.google.maps.importLibrary) {
          loadGoogleMapsApi(data.apiKey);
        }

        window.google.maps.importLibrary("maps").then(initMap);
      } else {
        console.error("API key not found in the response");
      }
    })
    .catch((error) => {
      console.error("Error fetching the API key:", error);
    });


  // Make functions globally accessible
  window.deleteDrawnOverlaysForRow = deleteDrawnOverlaysForRow;
  window.fitMapBounds = fitMapBounds;
  window.updateOverlayLabels = updateOverlayLabels;
  window.updateMapOverlay = updateMapOverlay;
  $("#modal-stc-map").one("shown.bs.modal", onStcMapModalShown);
});
