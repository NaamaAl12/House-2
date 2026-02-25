// map.js — Mapbox GL JS map initialization and MHA zones layer

mapboxgl.accessToken = 'pk.eyJ1IjoibmFsMTIiLCJhIjoiY21reXBkYmxtMDltbDNyb2NmcjZpaDdvdiJ9.ZX7GLNtaTYyTjLOhx4ITqg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-122.3321, 47.6062],  // Seattle
  zoom: 11,
  minZoom: 10,
  maxZoom: 15
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// MHA_VALUE color mapping
function getMHAColor(val) {
  if (val === 'M')  return '#f97316';  // base performance — orange
  if (val === 'M1') return '#fb923c';  // higher — lighter orange
  if (val === 'M2') return '#fdba74';  // highest — lightest orange
  return '#334155';                     // no tier — slate gray
}

map.on('load', function () {

  fetch('assets/MHA.geojson')
    .then(r => r.json())
    .then(function (geojson) {

      map.addSource('mha', {
        type: 'geojson',
        data: geojson
      });

      // Fill layer — colored by MHA_VALUE tier
      map.addLayer({
        id: 'mha-fill',
        type: 'fill',
        source: 'mha',
        paint: {
          'fill-color': [
            'match',
            ['get', 'MHA_VALUE'],
            'M',  '#f97316',
            'M1', '#fb923c',
            'M2', '#fdba74',
            '#334155'   // default — no tier
          ],
          'fill-opacity': 0.65
        }
      });

      // Outline layer
      map.addLayer({
        id: 'mha-outline',
        type: 'line',
        source: 'mha',
        paint: {
          'line-color': '#0b0f1a',
          'line-width': 0.4,
          'line-opacity': 0.6
        }
      });

      // Highlighted outline on hover
      map.addLayer({
        id: 'mha-hover',
        type: 'line',
        source: 'mha',
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.5,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hovered'], false],
            1, 0
          ]
        }
      });

      // --- Tooltip popup ---
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10
      });

      let hoveredId = null;

      map.on('mousemove', 'mha-fill', function (e) {
        map.getCanvas().style.cursor = 'pointer';

        if (hoveredId !== null) {
          map.setFeatureState({ source: 'mha', id: hoveredId }, { hovered: false });
        }
        hoveredId = e.features[0].id;
        map.setFeatureState({ source: 'mha', id: hoveredId }, { hovered: true });

        const p = e.features[0].properties;
        const mhaVal = p.MHA_VALUE || 'No tier';
        const zoneDesc = p.ZONING_DESC || p.ZONELUT_DESC || 'Unknown';
        const classDesc = p.CLASS_DESC || '';
        const mhaLabel = {
          'M':  'M — Base Performance',
          'M1': 'M1 — Higher Performance',
          'M2': 'M2 — Highest Performance'
        }[p.MHA_VALUE] || 'No MHA Tier';

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            '<strong>' + (p.ZONING || 'Zone') + '</strong>' +
            '<div style="color:#94a3b8;font-size:0.76rem;margin-top:4px">' + zoneDesc + '</div>' +
            '<div style="margin-top:8px;font-size:0.76rem"><span style="color:#f97316">MHA: </span>' + mhaLabel + '</div>' +
            (classDesc ? '<div style="color:#64748b;font-size:0.72rem;margin-top:2px">' + classDesc + '</div>' : '')
          )
          .addTo(map);
      });

      map.on('mouseleave', 'mha-fill', function () {
        map.getCanvas().style.cursor = '';
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'mha', id: hoveredId }, { hovered: false });
        }
        hoveredId = null;
        popup.remove();
      });

    })
    .catch(err => console.error('Failed to load MHA GeoJSON:', err));
});
