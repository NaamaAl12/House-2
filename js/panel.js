// panel.js — loads all data, wires up year slider and threshold toggle

let currentYear = 2022;
let currentThreshold = 50;

// Load all three datasets in parallel, then initialize charts
Promise.all([
  fetch('assets/Rent_Burden_Greater_than_50.geojson').then(r => r.json()),
  fetch('assets/Rent_Burden_Greater_than_30.geojson').then(r => r.json()),
  fetch('assets/Renter_HH_by_Income_Category.geojson').then(r => r.json())
])
.then(function ([burden50, burden30, income]) {

  // Store properties arrays in shared window object (used by charts.js)
  window.dashData.burden50 = burden50.features.map(f => f.properties);
  window.dashData.burden30 = burden30.features.map(f => f.properties);
  window.dashData.income   = income.features.map(f => f.properties);

  // Init charts now that data is loaded
  initCharts();

  // Render initial state
  updateTrendChart(currentThreshold);
  updateYearCharts(currentYear, currentThreshold);

})
.catch(err => console.error('Data load error:', err));

// -------------------------------------------------------
// Year slider
// -------------------------------------------------------
const slider = document.getElementById('year-slider');
const yearDisplay = document.getElementById('year-display');

slider.addEventListener('input', function () {
  currentYear = parseInt(this.value);
  yearDisplay.textContent = currentYear;
  updateYearCharts(currentYear, currentThreshold);
});

// -------------------------------------------------------
// Threshold toggle buttons
// -------------------------------------------------------
document.querySelectorAll('.toggle-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentThreshold = parseInt(this.dataset.threshold);
    updateTrendChart(currentThreshold);
    updateYearCharts(currentYear, currentThreshold);
  });
});
