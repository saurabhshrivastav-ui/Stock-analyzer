// chart.js: all Chart.js code lives here. `Chart` is a global from the CDN script.
let chart = null;

export function clearChart() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

const fmtDate = (ms) =>
  new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtPrice = (v) =>
  "₹" +
  v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Read colors from the CSS variables so the chart follows light/dark theme
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function drawChart(canvas, points, label, overlays = []) {
  clearChart();
  const up = points[points.length - 1].close >= points[0].close;
  const color = up ? cssVar("--gain") : cssVar("--loss");
  const muted = cssVar("--muted");
  const gridColor = cssVar("--border");
  const hasOverlay = overlays.some((o) => o.data.some((v) => v != null));

  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map((p) => fmtDate(p.t)),
      datasets: [
        {
          label,
          data: points.map((p) => p.close),
          borderColor: color,
          backgroundColor: color + "22",
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
        },
        ...overlays.map((o) => ({
          label: o.label,
          data: o.data,
          borderColor: o.color,
          borderWidth: 1.5,
          borderDash: [6, 4],
          fill: false,
          pointRadius: 0,
          tension: 0.2,
        })),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: hasOverlay, labels: { color: muted } },
        tooltip: {
          callbacks: {
            label: (c) =>
              c.parsed.y == null
                ? ""
                : `${c.dataset.label}: ${fmtPrice(c.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 6, color: muted },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: muted,
            callback: (v) => "₹" + v.toLocaleString("en-IN"),
          },
          grid: { color: gridColor },
        },
      },
    },
  });
}
