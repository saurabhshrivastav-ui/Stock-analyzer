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

// overlays: [{ label, data: [numbers or null], color }], drawn as dashed lines
export function drawChart(canvas, points, label, overlays = []) {
  clearChart();
  const up = points[points.length - 1].close >= points[0].close;
  const color = up ? "#0f9d58" : "#d93025";
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
        legend: { display: hasOverlay },
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
        x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { callback: (v) => "₹" + v.toLocaleString("en-IN") } },
      },
    },
  });
}
