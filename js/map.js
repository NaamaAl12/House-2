/* ============================================================
   map.js
   Core Mapbox GL JS logic:
     - Map initialization (centered on Seattle)
     - Loads seattle_housing.geojson + MHA.geojson
     - Choropleth layers: rent, burden
     - MHA zone overlay
     - Hover tooltips
     - Click → update line + donut charts
     - Map idle → update stat counter + bar chart
     - switchMapLayer() — called by panel.js layer toggles
     - resetMap()       — called by panel.js reset button
   ============================================================ */

'use strict';

/* ----------------------------------------------------------
   MAPBOX ACCESS TOKEN
   Replace with your own token from mapbox.com
   ---------------------------------------------------------- */
mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN_HERE';

/* ----------------------------------------------------------
   MAP INIT
   ---------------------------------------------------------- */
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-122.335, 47.608],   // Seattle
  zoom: 11,
  minZoom: 10,
  maxZoom: 15
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

/* ----------------------------------------------------------
   CONSTANTS — color scales matching panel.js legend config
   ---------------------------------------------------------- */

// Rent choropleth stops (MEDIAN_RENT field)
const RENT_COLOR_EXPR = [
  'interpolate', ['linear'], ['get', 'MEDIAN_RENT'],
  900,  '#1a3a5c',
  1000, '#1a3a5c',
  1500, '#1f6b8a',
  2000, '#2a9d8f',
  2500, '#e9c46a',
  3000, '#e76f51',
  3636, '#e76f51'
];

// Rent burden choropleth stops (RENT_BURDEN_PCT field)
const BURDEN_COLOR_EXPR = [
  'interpolate', ['linear'],
  ['case', ['==', ['get', 'RENT_BURDEN_PCT'], null], 0, ['get', 'RENT_BURDEN_PCT']],
  0,  '#2d6a4f',
  20, '#74c69d',
  35, '#ffd166',
  50, '#ef6351',
  65, '#9b2226',
  93, '#9b2226'
];

// MHA zone fill colors by MHA_VALUE property
const MHA_COLOR_EXPR = [
  'match', ['get', 'MHA_VALUE'],
  'M',  '#4361ee',
  'M1', '#7209b7',
  'M2', '#f72585',
  '#444444'   // default — no MHA
];

/* ----------------------------------------------------------
   DATA PATHS
   ---------------------------------------------------------- */
const HOUSING_DATA = 'assets/seattle_housing.geojson';
const MHA_DATA     = 'assets/MHA.geojson';

/* ----------------------------------------------------------
   MAP LOAD
   ---------------------------------------------------------- */
map.on('load', function () {

  // ---- Load MHA zones first (below housing layer) ----
  fetch(MHA_DATA)
    .then(r => r.json())
    .then(function (mhaGeoJSON) {

      map.addSource('mha', {
        type: 'geojson',
        data: mhaGeoJSON
      });

      // MHA fill layer — hidden by default
      map.addLayer({
        id: 'mha-fill',
        type: 'fill',
        source: 'mha',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': MHA_COLOR_EXPR,
          'fill-opacity': 0.75
        }
      });

      // MHA outline
      map.addLayer({
        id: 'mha-line',
        type: 'line',
        source: 'mha',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.4,
          'line-opacity': 0.3
        }
      });
    })
    .catch(err => console.error('MHA load error:', err));

  // ---- Load housing data ----
  fetch(HOUSING_DATA)
    .then(r => r.json())
    .then(function (housingGeoJSON) {

      map.addSource('housing', {
        type: 'geojson',
        data: housingGeoJSON
      });

      // ---- Rent choropleth (default visible) ----
      map.addLayer({
        id: 'rent-fill',
        type: 'fill',
        source: 'housing',
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': RENT_COLOR_EXPR,
          'fill-opacity': 0.82
        }
      });

      // ---- Burden choropleth (hidden by default) ----
      map.addLayer({
        id: 'burden-fill',
        type: 'fill',
        source: 'housing',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': BURDEN_COLOR_EXPR,
          'fill-opacity': 0.82
        }
      });

      // ---- Tract outlines (always visible) ----
      map.addLayer({
        id: 'housing-line',
        type: 'line',
        source: 'housing',
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.5,
          'line-opacity': 0.25
        }
      });

      // ---- Hover highlight outline ----
      map.addLayer({
        id: 'housing-hover',
        type: 'line',
        source: 'housing',
        paint: {
          'line-color': '#f0a500',
          'line-width': 2,
          'line-opacity': 0
        }
      });

      // ---- Set up events ----
      setupHoverEvents();
      setupClickEvents();
      setupIdleEvent();

      // ---- Init panel + charts now that map is ready ----
      initCharts();
      initPanel();

      // Initial stat + bar chart update
      setTimeout(updateFromMap, 800);
    })
    .catch(err => console.error('Housing data load error:', err));
});

/* ----------------------------------------------------------
   HOVER EVENTS
   ---------------------------------------------------------- */
let hoveredTractId = null;

function setupHoverEvents() {
  const hoverLayers = ['rent-fill', 'burden-fill'];

  hoverLayers.forEach(layerId => {

    map.on('mousemove', layerId, function (e) {
      if (!e.features || e.features.length === 0) return;
      map.getCanvas().style.cursor = 'pointer';

      const props = e.features[0].properties;

      // Parse RENT_TIMESERIES back from string (GeoJSON stores it as string)
      // Not needed for tooltip — just for click

      // Highlight outline
      if (hoveredTractId !== null) {
        map.setPaintProperty('housing-hover', 'line-opacity', 0);
      }
      hoveredTractId = props.GEOID;

      // Use filter to highlight only this tract
      map.setFilter('housing-hover', ['==', ['get', 'GEOID'], hoveredTractId]);
      map.setPaintProperty('housing-hover', 'line-opacity', 1);

      // Show tooltip
      showTooltip(e, props);
    });

    map.on('mouseleave', layerId, function () {
      map.getCanvas().style.cursor = '';
      map.setPaintProperty('housing-hover', 'line-opacity', 0);
      hoveredTractId = null;
      hideTooltip();
    });
  });

  // MHA hover
  map.on('mousemove', 'mha-fill', function (e) {
    if (!e.features || e.features.length === 0) return;
    map.getCanvas().style.cursor = 'pointer';
    showTooltip(e, e.features[0].properties);
  });

  map.on('mouseleave', 'mha-fill', function () {
    map.getCanvas().style.cursor = '';
    hideTooltip();
  });

  // Move tooltip with mouse
  document.getElementById('map').addEventListener('mousemove', function (e) {
    const tooltip = document.getElementById('tooltip');
    if (tooltip.style.display === 'block') {
      positionTooltip(e);
    }
  });
}

/* ----------------------------------------------------------
   CLICK EVENTS — update line + donut charts
   ---------------------------------------------------------- */
function setupClickEvents() {
  const clickLayers = ['rent-fill', 'burden-fill'];

  clickLayers.forEach(layerId => {
    map.on('click', layerId, function (e) {
      if (!e.features || e.features.length === 0) return;

      const props = e.features[0].properties;
      const name  = props.NAME || 'Selected Tract';

      // RENT_TIMESERIES is stored as a JSON string in GeoJSON properties
      let timeseries = [];
      try {
        timeseries = JSON.parse(props.RENT_TIMESERIES || '[]');
      } catch (err) {
        console.warn('Could not parse RENT_TIMESERIES:', err);
      }

      // Update both click-driven charts
      updateLineChart(name, timeseries);
      updateDonutChart(name, props);
    });
  });
}

/* ----------------------------------------------------------
   IDLE EVENT — update stat counter + bar chart
   ---------------------------------------------------------- */
function setupIdleEvent() {
  map.on('idle', updateFromMap);
}

function updateFromMap() {
  // Determine which layer is currently visible
  let visibleLayer = null;
  if (isLayerVisible('rent-fill'))   visibleLayer = 'rent-fill';
  if (isLayerVisible('burden-fill')) visibleLayer = 'burden-fill';

  if (!visibleLayer) {
    updateStat([]);
    return;
  }

  // Query all rendered features in current viewport
  const features = map.queryRenderedFeatures({ layers: [visibleLayer] });

  // Deduplicate by GEOID
  const seen    = new Set();
  const visible = [];
  features.forEach(f => {
    const id = f.properties.GEOID;
    if (id && !seen.has(id)) {
      seen.add(id);
      visible.push(f.properties);
    }
  });

  // Update stat block
  updateStat(visible);

  // Update bar chart with visible tract data
  const barData = visible
    .filter(p => p.MEDIAN_RENT > 0)
    .map(p => ({
      neighborhood: p.NEIGHBORHOOD || 'Unknown',
      rent: p.MEDIAN_RENT
    }));

  updateBarChart(barData);
}

/* ----------------------------------------------------------
   SWITCH MAP LAYER — called by panel.js
   ---------------------------------------------------------- */
function switchMapLayer(layer) {
  // Hide all thematic layers first
  setLayerVisibility('rent-fill',   'none');
  setLayerVisibility('burden-fill', 'none');
  setLayerVisibility('mha-fill',    'none');
  setLayerVisibility('mha-line',    'none');

  // Show selected layer
  if (layer === 'rent') {
    setLayerVisibility('rent-fill', 'visible');
  } else if (layer === 'burden') {
    setLayerVisibility('burden-fill', 'visible');
  } else if (layer === 'mha') {
    setLayerVisibility('mha-fill', 'visible');
    setLayerVisibility('mha-line', 'visible');
  }

  // Trigger stat/bar update after layer switch
  setTimeout(updateFromMap, 300);
}

/* ----------------------------------------------------------
   RESET MAP — called by panel.js reset button
   ---------------------------------------------------------- */
function resetMap() {
  // Fly back to Seattle default view
  map.flyTo({
    center: [-122.335, 47.608],
    zoom: 11,
    duration: 1000
  });

  // Switch back to rent layer
  switchMapLayer('rent');

  // Clear hover highlight
  map.setPaintProperty('housing-hover', 'line-opacity', 0);
  hoveredTractId = null;
}

/* ----------------------------------------------------------
   HELPERS
   ---------------------------------------------------------- */
function setLayerVisibility(layerId, visibility) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visibility);
  }
}

function isLayerVisible(layerId) {
  if (!map.getLayer(layerId)) return false;
  return map.getLayoutProperty(layerId, 'visibility') === 'visible';
}
