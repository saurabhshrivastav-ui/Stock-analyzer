// chart.js: all Chart.js code lives here. `Chart` is a global from the CDN script.
let chart = null;

export function clearChart() {
  if (chart) { chart.destroy(); chart = null; } // must destroy before reusing a canvas
}

const fmtDate = (ms) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtPrice = (v) => "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function drawChart(canvas, points, label) {
  clearChart();
  const up = points[points.length - 1].close >= points[0].close;
  const color = up ? "#0f9d58" : "#d93025";

  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map((p) => fmtDate(p.t)),
      datasets: [{
        label,
        data: points.map((p) => p.close),
        borderColor: color,
        backgroundColor: color + "22", // same color, ~13% opacity
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => fmtPrice(c.parsed.y) } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { callback: (v) => "₹" + v.toLocaleString("en-IN") } },
      },
    },
  });
}