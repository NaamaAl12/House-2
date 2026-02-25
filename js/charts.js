/* ============================================================
   charts.js
   Initializes and updates all C3.js charts:
     - barChart:   Top neighborhoods by median rent (updates on map move)
     - lineChart:  Rent over time for a clicked tract (2001–2025)
     - donutChart: Rent burden breakdown (GRAPI) for a clicked tract
   ============================================================ */

'use strict';

// Chart references — set during init, updated later
let barChart   = null;
let lineChart  = null;
let donutChart = null;

/* ----------------------------------------------------------
   COLOR HELPERS
   ---------------------------------------------------------- */
const RENT_COLOR   = '#f0a500';  // amber accent
const LINE_COLOR   = '#2a9d8f';  // teal
const DONUT_COLORS = [
  '#2d6a4f',  // < 15%  (affordable)
  '#74c69d',  // 15–20%
  '#ffd166',  // 20–25%
  '#ef6351',  // 25–30%
  '#e63946',  // 30–35%
  '#9b2226'   // 35%+   (severely burdened)
];

/* ----------------------------------------------------------
   INIT — called once on page load
   ---------------------------------------------------------- */
function initCharts() {

  // ---- Bar Chart: Top neighborhoods by rent ----
  barChart = c3.generate({
    bindto: '#bar-chart',
    data: {
      x: 'x',
      columns: [
        ['x'],
        ['Median Rent']
      ],
      type: 'bar',
      colors: { 'Median Rent': RENT_COLOR }
    },
    bar: { width: { ratio: 0.65 } },
    axis: {
      rotated: false,
      x: {
        type: 'category',
        tick: {
          rotate: -35,
          multiline: false,
          format: function(d) {
            // Truncate long neighborhood names
            const labels = barChart && barChart.internal.config.axis_x_categories;
            if (!labels) return d;
            const name = labels[d] || '';
            return name.length > 12 ? name.slice(0, 11) + '…' : name;
          }
        },
        height: 52
      },
      y: {
        min: 800,
        padding: { bottom: 0 },
        tick: {
          format: d => '$' + (d / 1000).toFixed(1) + 'k'
        }
      }
    },
    grid: {
      y: { show: true }
    },
    legend: { show: false },
    padding: { right: 16, left: 4 },
    tooltip: {
      format: {
        value: d => '$' + d.toLocaleString()
      }
    }
  });

  // ---- Line Chart: Rent over time for selected tract ----
  lineChart = c3.generate({
    bindto: '#line-chart',
    data: {
      x: 'x',
      columns: [
        ['x'],
        ['Rent per Unit']
      ],
      type: 'line',
      colors: { 'Rent per Unit': LINE_COLOR }
    },
    point: { r: 2, focus: { expand: { r: 4 } } },
    axis: {
      x: {
        type: 'category',
        tick: {
          culling: { max: 6 },
          multiline: false
        },
        height: 28
      },
      y: {
        min: 0,
        padding: { bottom: 0 },
        tick: {
          format: d => '$' + (d / 1000).toFixed(1) + 'k'
        }
      }
    },
    grid: {
      y: { show: true }
    },
    legend: { show: false },
    padding: { right: 16, left: 4 },
    tooltip: {
      format: {
        value: d => '$' + d.toLocaleString()
      }
    }
  });

  // ---- Donut Chart: GRAPI rent burden breakdown ----
  donutChart = c3.generate({
    bindto: '#donut-chart',
    data: {
      columns: [
        ['< 15%',  0],
        ['15–20%', 0],
        ['20–25%', 0],
        ['25–30%', 0],
        ['30–35%', 0],
        ['35%+',   0]
      ],
      type: 'donut',
      colors: {
        '< 15%':  DONUT_COLORS[0],
        '15–20%': DONUT_COLORS[1],
        '20–25%': DONUT_COLORS[2],
        '25–30%': DONUT_COLORS[3],
        '30–35%': DONUT_COLORS[4],
        '35%+':   DONUT_COLORS[5]
      }
    },
    donut: {
      title: '',
      width: 28,
      label: { show: false }
    },
    legend: {
      show: true,
      position: 'right',
      item: {
        tile: { width: 8, height: 8 }
      }
    },
    padding: { right: 0, left: 0 },
    tooltip: {
      format: {
        value: (value, ratio) =>
          value.toLocaleString() + ' (' + (ratio * 100).toFixed(1) + '%)'
      }
    }
  });
}

/* ----------------------------------------------------------
   UPDATE BAR CHART
   Called by panel.js whenever the map moves.
   Receives array of { neighborhood, rent } objects.
   ---------------------------------------------------------- */
function updateBarChart(data) {
  if (!barChart || !data || data.length === 0) return;

  // Aggregate by neighborhood — take average rent per neighborhood
  const grouped = {};
  data.forEach(d => {
    const n = d.neighborhood || 'Unknown';
    if (!grouped[n]) grouped[n] = [];
    grouped[n].push(d.rent);
  });

  // Average rent per neighborhood, sort descending, take top 8
  const sorted = Object.entries(grouped)
    .map(([name, rents]) => ({
      name,
      rent: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length)
    }))
    .filter(d => d.rent > 0)
    .sort((a, b) => b.rent - a.rent)
    .slice(0, 8);

  if (sorted.length === 0) return;

  barChart.load({
    columns: [
      ['x',           ...sorted.map(d => d.name)],
      ['Median Rent', ...sorted.map(d => d.rent)]
    ]
  });
}

/* ----------------------------------------------------------
   UPDATE LINE CHART
   Called when user clicks a tract.
   Receives the RENT_TIMESERIES array from that tract's properties.
   ---------------------------------------------------------- */
function updateLineChart(tractName, timeseries) {
  if (!lineChart || !timeseries || timeseries.length === 0) return;

  // Filter to entries with valid rent, sort by year
  const valid = timeseries
    .filter(d => d.rent && d.rent > 0)
    .sort((a, b) => a.year - b.year);

  if (valid.length === 0) return;

  // Update chart title
  document.getElementById('chart2-title').textContent =
    tractName + ' · Rent Over Time';

  lineChart.load({
    columns: [
      ['x',            ...valid.map(d => String(d.year))],
      ['Rent per Unit', ...valid.map(d => d.rent)]
    ]
  });
}

/* ----------------------------------------------------------
   UPDATE DONUT CHART
   Called when user clicks a tract.
   Receives the tract properties object.
   ---------------------------------------------------------- */
function updateDonutChart(tractName, props) {
  if (!donutChart) return;

  const g1 = props.GRAPI_LESS_15  || 0;
  const g2 = props.GRAPI_15_20    || 0;
  const g3 = props.GRAPI_20_25    || 0;
  const g4 = props.GRAPI_25_30    || 0;
  const g5 = props.GRAPI_30_35    || 0;
  const g6 = props.GRAPI_35_PLUS  || 0;

  // Update chart title
  document.getElementById('chart3-title').textContent =
    tractName + ' · Rent Burden';

  donutChart.load({
    columns: [
      ['< 15%',  g1],
      ['15–20%', g2],
      ['20–25%', g3],
      ['25–30%', g4],
      ['30–35%', g5],
      ['35%+',   g6]
    ]
  });
}

/* ----------------------------------------------------------
   RESET CHARTS
   Called by the reset button — clears click-based charts
   back to their default empty/placeholder state.
   ---------------------------------------------------------- */
function resetCharts() {
  if (lineChart) {
    document.getElementById('chart2-title').textContent =
      'Click a tract · Rent Over Time';
    lineChart.load({
      columns: [
        ['x'],
        ['Rent per Unit']
      ]
    });
  }

  if (donutChart) {
    document.getElementById('chart3-title').textContent =
      'Click a tract · Rent Burden Breakdown';
    donutChart.load({
      columns: [
        ['< 15%',  0],
        ['15–20%', 0],
        ['20–25%', 0],
        ['25–30%', 0],
        ['30–35%', 0],
        ['35%+',   0]
      ]
    });
  }
}
