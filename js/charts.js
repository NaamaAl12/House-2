// charts.js — C3.js chart initialization and update logic
// All charts are driven by the rent burden and renter income GeoJSON data

// Shared state — populated by panel.js after data loads
window.dashData = {
  burden50: [],   // Rent_Burden_Greater_than_50 features
  burden30: [],   // Rent_Burden_Greater_than_30 features
  income:   []    // Renter_HH_by_Income_Category features
};

// Chart instances
let trendChart, raceChart, incomeChart;

// Color palette for race chart bars
const RACE_COLORS = {
  'White':            '#38bdf8',
  'Black':            '#f97316',
  'Asian':            '#a78bfa',
  'Hispanic':         '#34d399',
  'Native':           '#fbbf24',
  'Pacific Islander': '#f472b6',
  'Multi':            '#94a3b8',
  'Other':            '#64748b'
};

const INCOME_COLOR = '#f97316';

// -------------------------------------------------------
// Init all three charts with empty/placeholder data
// -------------------------------------------------------
function initCharts() {

  // TREND CHART — line chart showing burden rate 2006–2022
  trendChart = c3.generate({
    bindto: '#chart-trend',
    data: {
      x: 'x',
      columns: [
        ['x'],
        ['Renters']
      ],
      type: 'line',
      colors: { 'Renters': '#f97316' }
    },
    point: { show: false },
    axis: {
      x: {
        type: 'category',
        tick: { rotate: -35, multiline: false, culling: { max: 6 } }
      },
      y: {
        tick: { format: d => (d * 100).toFixed(0) + '%' },
        min: 0,
        padding: { bottom: 0 }
      }
    },
    legend: { show: false },
    padding: { right: 16 },
    tooltip: {
      format: {
        value: v => (v * 100).toFixed(1) + '%'
      }
    }
  });

  // RACE CHART — bar chart for selected year, renters, all ages
  raceChart = c3.generate({
    bindto: '#chart-race',
    data: {
      x: 'x',
      columns: [
        ['x', 'White', 'Black', 'Asian', 'Hispanic', 'Native'],
        ['Burden', 0, 0, 0, 0, 0]
      ],
      type: 'bar',
      colors: {
        Burden: function(d) {
          const colors = ['#38bdf8','#f97316','#a78bfa','#34d399','#fbbf24'];
          return colors[d.index % colors.length];
        }
      },
      color: function(color, d) {
        const colors = ['#38bdf8','#f97316','#a78bfa','#34d399','#fbbf24'];
        return d && d.index !== undefined ? colors[d.index % colors.length] : color;
      }
    },
    bar: { width: { ratio: 0.65 } },
    axis: {
      x: { type: 'category', tick: { rotate: -25, multiline: false } },
      y: {
        tick: { format: d => (d * 100).toFixed(0) + '%' },
        min: 0,
        padding: { bottom: 0 }
      }
    },
    legend: { show: false },
    padding: { right: 16 },
    tooltip: {
      format: { value: v => (v * 100).toFixed(1) + '%' }
    }
  });

  // INCOME CHART — bar chart of renter households by income bracket for selected year
  incomeChart = c3.generate({
    bindto: '#chart-income',
    data: {
      x: 'x',
      columns: [
        ['x', '<30% AMI', '30–50%', '50–80%', '80–120%', '>120%'],
        ['Households', 0, 0, 0, 0, 0]
      ],
      type: 'bar',
      colors: { Households: INCOME_COLOR }
    },
    bar: { width: { ratio: 0.65 } },
    axis: {
      x: { type: 'category', tick: { rotate: -25, multiline: false } },
      y: {
        tick: { format: d => d >= 1000 ? (d/1000).toFixed(0) + 'k' : d },
        min: 0,
        padding: { bottom: 0 }
      }
    },
    legend: { show: false },
    padding: { right: 16 },
    tooltip: {
      format: { value: v => v.toLocaleString() + ' households' }
    }
  });
}

// -------------------------------------------------------
// Update trend chart when threshold toggle changes
// -------------------------------------------------------
function updateTrendChart(threshold) {
  const dataset = threshold === 50 ? window.dashData.burden50 : window.dashData.burden30;

  // Filter: Renters, All race, All age — sorted by year
  const rows = dataset
    .filter(f => f.TENURE === 'Renters' && f.RACE === 'All' && f.AGE === 'All')
    .sort((a, b) => a.YEAR - b.YEAR);

  if (!rows.length) return;

  const years   = rows.map(r => String(r.YEAR));
  const burdens = rows.map(r => r.All_);

  trendChart.load({
    columns: [
      ['x', ...years],
      ['Renters', ...burdens]
    ]
  });
}

// -------------------------------------------------------
// Update race and income charts for a given year + threshold
// -------------------------------------------------------
function updateYearCharts(year, threshold) {
  const dataset = threshold === 50 ? window.dashData.burden50 : window.dashData.burden30;

  // Race breakdown — Renters, All age, selected year
  const races = ['White', 'Black', 'Asian', 'Hispanic', 'Native'];
  const raceValues = races.map(race => {
    const row = dataset.find(f =>
      f.YEAR === year && f.TENURE === 'Renters' && f.RACE === race && f.AGE === 'All'
    );
    return row ? row.All_ : 0;
  });

  raceChart.load({
    columns: [
      ['x', ...races],
      ['Burden', ...raceValues]
    ]
  });

  document.getElementById('race-year').textContent = '(' + year + ')';

  // Income category — selected year
  const incRow = window.dashData.income.find(f => f.YEAR === year);
  if (incRow) {
    incomeChart.load({
      columns: [
        ['x', '<30% AMI', '30–50%', '50–80%', '80–120%', '>120%'],
        ['Households', incRow.F0___30_, incRow.F30___50_, incRow.F50___80_, incRow.F80___120_, incRow.Above_120_]
      ]
    });
    document.getElementById('income-year').textContent = '(' + year + ')';
  }

  // Update the big stat number — Renters, All race, All age
  const statRow = dataset.find(f =>
    f.YEAR === year && f.TENURE === 'Renters' && f.RACE === 'All' && f.AGE === 'All'
  );
  if (statRow) {
    const pct = (statRow.All_ * 100).toFixed(1) + '%';
    document.getElementById('burden-stat').textContent = pct;
  }
}
