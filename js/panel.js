/* ============================================================
   panel.js
   Handles all left panel interactions:
     - Layer toggle buttons (rent / burden / mha)
     - Dynamic stat counter (avg rent or avg burden)
     - Legend rendering (updates per active layer)
     - Reset button
     - Tooltip show/hide/position
   ============================================================ */

'use strict';

/* ----------------------------------------------------------
   STATE
   ---------------------------------------------------------- */
// Tracks which layer is currently active: 'rent' | 'burden' | 'mha'
let activeLayer = 'rent';

/* ----------------------------------------------------------
   LEGEND CONFIG
   Each layer has its own color stops and labels.
   ---------------------------------------------------------- */
const LEGEND_CONFIG = {
  rent: {
    title: 'Median Rent / Unit',
    items: [
      { color: '#1a3a5c', label: '< $1,000' },
      { color: '#1f6b8a', label: '$1,000 – $1,500' },
      { color: '#2a9d8f', label: '$1,500 – $2,000' },
      { color: '#e9c46a', label: '$2,000 – $2,500' },
      { color: '#e76f51', label: '> $2,500' }
    ]
  },
  burden: {
    title: 'Renters Paying 35%+ of Income',
    items: [
      { color: '#2d6a4f', label: '< 20%' },
      { color: '#74c69d', label: '20 – 35%' },
      { color: '#ffd166', label: '35 – 50%' },
      { color: '#ef6351', label: '50 – 65%' },
      { color: '#9b2226', label: '> 65%' }
    ]
  },
  mha: {
    title: 'MHA Zone Type',
    items: [
      { color: '#4361ee', label: 'M  — Base Requirement' },
      { color: '#7209b7', label: 'M1 — Increased Requirement' },
      { color: '#f72585', label: 'M2 — Highest Requirement' },
      { color: '#555555', label: 'No MHA Requirement' }
    ]
  }
};

/* ----------------------------------------------------------
   RENDER LEGEND
   Populates #legend-items and updates #legend-title
   ---------------------------------------------------------- */
function renderLegend(layer) {
  const config = LEGEND_CONFIG[layer];
  if (!config) return;

  document.getElementById('legend-title').textContent = config.title;

  const container = document.getElementById('legend-items');
  container.innerHTML = '';

  config.items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'legend-row';
    row.innerHTML = `
      <div class="legend-swatch" style="background:${item.color};"></div>
      <span>${item.label}</span>
    `;
    container.appendChild(row);
  });
}

/* ----------------------------------------------------------
   UPDATE STAT COUNTER
   Called by map.js whenever the map goes idle.
   data = array of visible tract property objects
   ---------------------------------------------------------- */
function updateStat(data) {
  const statValue = document.getElementById('stat-value');
  const statLabel = document.getElementById('stat-label');
  const statSub   = document.getElementById('stat-sub');

  if (!data || data.length === 0) {
    statValue.textContent = '—';
    return;
  }

  if (activeLayer === 'rent') {
    const rents = data
      .map(d => d.MEDIAN_RENT)
      .filter(v => v && v > 0);

    if (rents.length === 0) { statValue.textContent = '—'; return; }

    const avg = Math.round(rents.reduce((a, b) => a + b, 0) / rents.length);
    statLabel.textContent  = 'Avg. Median Rent · Visible Tracts';
    statValue.textContent  = '$' + avg.toLocaleString();
    statSub.textContent    = rents.length + ' tracts in view';

  } else if (activeLayer === 'burden') {
    const burdens = data
      .map(d => d.RENT_BURDEN_PCT)
      .filter(v => v !== null && v !== undefined);

    if (burdens.length === 0) { statValue.textContent = '—'; return; }

    const avg = (burdens.reduce((a, b) => a + b, 0) / burdens.length).toFixed(1);
    statLabel.textContent  = 'Avg. Rent Burden · Visible Tracts';
    statValue.textContent  = avg + '%';
    statSub.textContent    = 'Renters paying 35%+ of income';

  } else if (activeLayer === 'mha') {
    // Count MHA vs non-MHA tracts visible
    statLabel.textContent = 'MHA Zones · Visible Area';
    statValue.textContent = 'Policy';
    statSub.textContent   = 'Mandatory Housing Affordability overlay';
  }
}

/* ----------------------------------------------------------
   LAYER TOGGLE BUTTONS
   ---------------------------------------------------------- */
function initLayerToggle() {
  const buttons = document.querySelectorAll('.toggle-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      const layer = this.dataset.layer;
      if (layer === activeLayer) return;

      // Update active state on buttons
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Update global state
      activeLayer = layer;

      // Update legend
      renderLegend(layer);

      // Tell map.js to switch layers
      if (typeof switchMapLayer === 'function') {
        switchMapLayer(layer);
      }
    });
  });
}

/* ----------------------------------------------------------
   RESET BUTTON
   ---------------------------------------------------------- */
function initResetButton() {
  document.getElementById('reset-btn').addEventListener('click', function() {
    // Reset layer to rent
    activeLayer = 'rent';
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-layer="rent"]').classList.add('active');
    renderLegend('rent');

    // Reset stat
    document.getElementById('stat-label').textContent = 'Avg. Median Rent · Visible Tracts';
    document.getElementById('stat-value').textContent = '—';
    document.getElementById('stat-sub').textContent   = 'Hover a tract for details';

    // Reset charts
    if (typeof resetCharts === 'function') {
      resetCharts();
    }

    // Reset map
    if (typeof resetMap === 'function') {
      resetMap();
    }

    // Hide tooltip
    hideTooltip();
  });
}

/* ----------------------------------------------------------
   TOOLTIP
   ---------------------------------------------------------- */
function showTooltip(e, props) {
  const tooltip = document.getElementById('tooltip');
  const ttName  = document.getElementById('tt-name');
  const ttBody  = document.getElementById('tt-body');

  // Title: tract name + neighborhood
  ttName.textContent = props.NAME + ' · ' + (props.NEIGHBORHOOD || '');

  // Build rows based on active layer
  let rows = '';

  if (activeLayer === 'rent') {
    rows += tooltipRow('Median Rent', '$' + (props.MEDIAN_RENT || 0).toLocaleString(), true);
    rows += tooltipRow('Rent Category', props.RENT_COST_CATEGORY || '—');
    rows += tooltipRow('YoY Change', props.RENT_CHANGE_CATEGORY || '—');
    if (props.LEVEL_OF_CONCERN) {
      rows += tooltipRow('Concern Level', props.LEVEL_OF_CONCERN);
    }

  } else if (activeLayer === 'burden') {
    const burden = props.RENT_BURDEN_PCT !== null
      ? props.RENT_BURDEN_PCT + '%'
      : '—';
    rows += tooltipRow('Rent Burden', burden, true);
    rows += tooltipRow('Renter Units', (props.RENTER_UNITS || 0).toLocaleString());
    rows += tooltipRow('Median Gross Rent', '$' + (props.MEDIAN_GROSS_RENT || 0).toLocaleString());

  } else if (activeLayer === 'mha') {
    rows += tooltipRow('MHA Value', props.MHA_VALUE || '—', true);
    rows += tooltipRow('Zone', props.ZONING || '—');
    rows += tooltipRow('Category', props.CATEGORY_DESC || '—');
  }

  ttBody.innerHTML = rows;
  tooltip.style.display = 'block';
  positionTooltip(e);
}

function positionTooltip(e) {
  const tooltip = document.getElementById('tooltip');
  const offset  = 16;
  const w = tooltip.offsetWidth;
  const h = tooltip.offsetHeight;

  // Keep tooltip within the viewport
  let x = e.originalEvent ? e.originalEvent.clientX : e.clientX;
  let y = e.originalEvent ? e.originalEvent.clientY : e.clientY;

  // Flip left if near right edge
  if (x + w + offset > window.innerWidth) {
    x = x - w - offset;
  } else {
    x = x + offset;
  }

  // Flip up if near bottom edge
  if (y + h + offset > window.innerHeight) {
    y = y - h - offset;
  } else {
    y = y + offset;
  }

  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

function tooltipRow(key, val, accent) {
  return `
    <div class="tt-row">
      <span class="tt-key">${key}</span>
      <span class="tt-val${accent ? ' accent' : ''}">${val}</span>
    </div>
  `;
}

/* ----------------------------------------------------------
   INIT — called by map.js after map loads
   ---------------------------------------------------------- */
function initPanel() {
  renderLegend('rent');
  initLayerToggle();
  initResetButton();
}
