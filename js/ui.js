// ui.js: everything that touches the DOM (including 3D multi-charts & theme sync).

// Escape text from outside before putting it in innerHTML (prevents XSS)
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const clean = (sym) => sym.replace(/\.(NS|BO)$/, "").replace("^", "");
const inr = (n) =>
  n == null
    ? "—"
    : "₹" +
      n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const signed = (n) => (n >= 0 ? "+" : "") + n.toFixed(2);
const trend = (n) => (n >= 0 ? "gain" : "loss");
const pct = (v) => (v == null ? "—" : signed(v) + "%");
const volume = (n) =>
  n == null
    ? "—"
    : n >= 1e7
      ? (n / 1e7).toFixed(2) + " Cr"
      : n >= 1e5
        ? (n / 1e5).toFixed(2) + " L"
        : n.toLocaleString("en-IN");

// Internal state shared between DOM renders and 3D chart views
const chartState = {
  mode: "line", // "line" | "area3d" | "bar3d" | "pie3d" | "donut3d"
  hcInstance: null,
  hc3dReady: false,
  currentStock: null,
  watchlistStocks: [],
  initialized: false,
  tiltX: 18,
  tiltY: 22,
};

let hcLoadPromise = null;

/* ==========================================================================
   3D MULTI-CHART ENGINE (Highcharts 3D + Built-In 3D Canvas Fallback)
   ========================================================================== */

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    const timer = setTimeout(() => {
      reject(new Error(`Timeout loading ${src}`));
    }, 8000);

    script.onload = () => {
      clearTimeout(timer);
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Network blocked ${src}`));
    };
    document.head.appendChild(script);
  });
}

function ensureHighcharts3D() {
  if (chartState.hc3dReady && window.Highcharts) {
    return Promise.resolve(true);
  }
  if (hcLoadPromise) return hcLoadPromise;

  const cdns = [
    {
      core: "https://cdn.jsdelivr.net/npm/highcharts@11.4.8/highcharts.js",
      mod3d: "https://cdn.jsdelivr.net/npm/highcharts@11.4.8/highcharts-3d.js",
    },
    {
      core: "https://code.highcharts.com/11.4.8/highcharts.js",
      mod3d: "https://code.highcharts.com/11.4.8/highcharts-3d.js",
    },
  ];

  hcLoadPromise = (async () => {
    for (const cdn of cdns) {
      try {
        if (!window.Highcharts) {
          await injectScript(cdn.core);
        }
        await injectScript(cdn.mod3d);
        if (window.Highcharts) {
          chartState.hc3dReady = true;
          return true;
        }
      } catch (_) {
        // Try next CDN mirror
      }
    }
    return false;
  })().finally(() => {
    if (!chartState.hc3dReady) hcLoadPromise = null;
  });

  return hcLoadPromise;
}

function ensureChartDom() {
  const chartSection = document.querySelector(".card.chart");
  const timeframesEl = document.getElementById("timeframes");
  const chartBoxEl = document.querySelector(".chart-box");
  if (!chartSection || !chartBoxEl) return;

  if (!document.getElementById("chart-types") && timeframesEl) {
    const toolbar = document.createElement("div");
    toolbar.className = "chart-toolbar";
    timeframesEl.parentNode.insertBefore(toolbar, timeframesEl);
    toolbar.appendChild(timeframesEl);

    const typeBar = document.createElement("div");
    typeBar.className = "chart-types";
    typeBar.id = "chart-types";
    typeBar.setAttribute("role", "group");
    typeBar.setAttribute("aria-label", "Chart visualization style");
    typeBar.innerHTML = `
      <button type="button" class="active" data-chart-type="line">Line</button>
      <button type="button" class="is-3d" data-chart-type="area3d">Area</button>
      <button type="button" class="is-3d" data-chart-type="bar3d">Bar</button>
      <button type="button" class="is-3d" data-chart-type="pie3d">Pie</button>
      <button type="button" class="is-3d" data-chart-type="donut3d">Donut</button>
    `;
    toolbar.appendChild(typeBar);
  }

  if (!document.getElementById("chart-hint")) {
    const hint = document.createElement("div");
    hint.className = "chart-hint";
    hint.id = "chart-hint";
    hint.hidden = true;
    hint.innerHTML = `
      <span id="chart-mode-label">3D Interactive View</span>
      <span>Click &amp; drag chart to rotate 3D angle</span>
    `;
    chartBoxEl.parentNode.insertBefore(hint, chartBoxEl);
  }

  let chart3dEl = document.getElementById("chart-3d");
  if (!chart3dEl) {
    chart3dEl = document.createElement("div");
    chart3dEl.id = "chart-3d";
    chart3dEl.className = "chart-3d";
    chart3dEl.setAttribute("role", "img");
    chart3dEl.setAttribute("aria-label", "3D interactive stock chart");
    chart3dEl.hidden = true;
    chartBoxEl.appendChild(chart3dEl);
  }
  chart3dEl.style.width = "100%";
  chart3dEl.style.height = "100%";
  chart3dEl.style.minHeight = "340px";
}

function getChartPalette() {
  const isDark = document.documentElement.dataset.theme === "dark";
  return {
    isDark,
    text: isDark ? "#f1f5f9" : "#0f172a",
    muted: isDark ? "#8b9bb4" : "#64748b",
    grid: isDark ? "rgba(148, 163, 184, 0.14)" : "rgba(15, 23, 42, 0.08)",
    accent: isDark ? "#3b82f6" : "#2563eb",
    gain: isDark ? "#10b981" : "#059669",
    loss: isDark ? "#f43f5e" : "#dc2626",
    series: isDark
      ? ["#3b82f6", "#10b981", "#818cf8", "#f59e0b", "#f43f5e", "#06b6d4"]
      : ["#2563eb", "#059669", "#4f46e5", "#d97706", "#dc2626", "#0891b2"],
  };
}

function readChartJsSeries() {
  const cjs = window.Chart && Chart.getChart("price-chart");
  if (cjs && cjs.data && Array.isArray(cjs.data.datasets)) {
    const labels = (cjs.data.labels || []).map(String);
    const parsePoint = (v) =>
      typeof v === "object" && v !== null
        ? Number(v.y ?? v.c ?? 0)
        : Number(v || 0);

    const close = (cjs.data.datasets[0]?.data || []).map(parsePoint);
    const sma = (cjs.data.datasets[1]?.data || []).map(parsePoint);
    if (close.length > 0 && close.some((n) => n > 0)) {
      return { labels, close, sma };
    }
  }

  // Fallback to active stock metrics if historical series isn't populated yet
  const s = chartState.currentStock;
  if (s) {
    const points = [
      { label: "Prev Close", val: s.prevClose },
      { label: "Open", val: s.open },
      { label: "Day Low", val: s.low },
      { label: "Day High", val: s.high },
      { label: "Current", val: s.price },
    ].filter((p) => typeof p.val === "number" && p.val > 0);

    return {
      labels: points.map((p) => p.label),
      close: points.map((p) => Number(p.val.toFixed(2))),
      sma: [],
    };
  }

  return { labels: [], close: [], sma: [] };
}

function getPieSliceData(stock) {
  const validWatchlist = chartState.watchlistStocks.filter(
    (item) => item && typeof item.price === "number" && item.price > 0,
  );

  if (validWatchlist.length >= 2) {
    return validWatchlist.map((item, idx) => ({
      name: clean(item.symbol),
      y: Number(item.price.toFixed(2)),
      sliced: stock ? item.symbol === stock.symbol : idx === 0,
      selected: stock ? item.symbol === stock.symbol : idx === 0,
    }));
  }

  if (stock) {
    return [
      {
        name: "Open",
        y: Number((stock.open || 0).toFixed(2)),
        sliced: true,
        selected: true,
      },
      { name: "High", y: Number((stock.high || 0).toFixed(2)) },
      { name: "Low", y: Number((stock.low || 0).toFixed(2)) },
      { name: "Close", y: Number((stock.price || 0).toFixed(2)) },
    ].filter((d) => d.y > 0);
  }

  return [];
}

function attach3DRotation(chart) {
  const container = chart?.container;
  if (!container) return;

  const onStart = (eStart) => {
    const startX = eStart.clientX ?? eStart.touches?.[0]?.clientX ?? 0;
    const startY = eStart.clientY ?? eStart.touches?.[0]?.clientY ?? 0;
    const startAlpha = chart.options.chart.options3d.alpha;
    const startBeta = chart.options.chart.options3d.beta;

    const onMove = (eMove) => {
      const curX = eMove.clientX ?? eMove.touches?.[0]?.clientX ?? 0;
      const curY = eMove.clientY ?? eMove.touches?.[0]?.clientY ?? 0;

      chart.update(
        {
          chart: {
            options3d: {
              alpha: Math.min(
                65,
                Math.max(5, startAlpha + (curY - startY) / 4),
              ),
              beta: Math.min(
                45,
                Math.max(-45, startBeta + (startX - curX) / 4),
              ),
            },
          },
        },
        true,
        false,
        false,
      );
    };

    const onEnd = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
  };

  container.onmousedown = onStart;
  container.ontouchstart = onStart;
}

/* Built-in 3D Isometric Canvas Fallback (works offline / if CDNs are blocked) */
function renderFallback3DCanvas(
  container,
  mode,
  stockName,
  labels,
  close,
  pieData,
) {
  const c = getChartPalette();
  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  const w = container.clientWidth || 640;
  const h = container.clientHeight || 350;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // Title
  ctx.fillStyle = c.text;
  ctx.font = "700 14px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `${stockName} — ${mode.replace("3d", " 3D").toUpperCase()}`,
    w / 2,
    26,
  );

  if (mode === "pie3d" || mode === "donut3d") {
    const total = pieData.reduce((acc, d) => acc + d.y, 0);
    if (!total) return;

    const cx = w * 0.42;
    const cy = h * 0.52;
    const rx = Math.min(w * 0.26, 145);
    const ry = rx * 0.56;
    const depth = 24;
    const innerRatio = mode === "donut3d" ? 0.52 : 0;

    // Extruded 3D side wall
    for (let z = depth; z >= 0; z--) {
      let startAngle = -Math.PI / 2;
      pieData.forEach((slice, idx) => {
        const sweep = (slice.y / total) * Math.PI * 2;
        const endAngle = startAngle + sweep;
        const baseColor = c.series[idx % c.series.length];

        ctx.beginPath();
        ctx.ellipse(cx, cy + z, rx, ry, 0, startAngle, endAngle);
        if (innerRatio > 0) {
          ctx.ellipse(
            cx,
            cy + z,
            rx * innerRatio,
            ry * innerRatio,
            0,
            endAngle,
            startAngle,
            true,
          );
        } else {
          ctx.lineTo(cx, cy + z);
        }
        ctx.closePath();

        ctx.fillStyle = baseColor;
        ctx.globalAlpha = z === 0 ? 1 : 0.22;
        ctx.fill();
        if (z === 0) {
          ctx.strokeStyle = c.isDark ? "#0f172a" : "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        startAngle = endAngle;
      });
    }
    ctx.globalAlpha = 1;

    // Legend
    ctx.textAlign = "left";
    ctx.font = "600 12px 'Plus Jakarta Sans', system-ui, sans-serif";
    pieData.forEach((slice, idx) => {
      const ly = 64 + idx * 24;
      if (ly > h - 20) return;
      ctx.fillStyle = c.series[idx % c.series.length];
      ctx.fillRect(w * 0.72, ly - 9, 11, 11);
      ctx.fillStyle = c.text;
      const pctShare = ((slice.y / total) * 100).toFixed(1);
      ctx.fillText(`${slice.name} (${pctShare}%)`, w * 0.72 + 18, ly);
    });
    return;
  }

  // 3D Bar / Area Isometric Plot
  if (!close.length) return;
  const pad = { top: 48, right: 44, bottom: 44, left: 64 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const minVal = Math.min(...close) * 0.995;
  const maxVal = Math.max(...close) * 1.005;
  const span = maxVal - minVal || 1;
  const dx = 14 + (chartState.tiltY - 22) * 0.3;
  const dy = -10 - (chartState.tiltX - 18) * 0.25;

  // Grid lines
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  ctx.font = "500 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = c.muted;
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH * i) / 4;
    const val = maxVal - (span * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillText(`₹${val.toFixed(0)}`, pad.left - 8, y + 4);
  }

  const step = plotW / close.length;

  if (mode === "area3d") {
    const pts = close.map((v, i) => ({
      x: pad.left + i * step + step * 0.4,
      y: pad.top + plotH - ((v - minVal) / span) * plotH,
    }));
    const baseY = pad.top + plotH;

    // 3D top ribbon
    ctx.beginPath();
    pts.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    for (let i = pts.length - 1; i >= 0; i--) {
      ctx.lineTo(pts[i].x + dx, pts[i].y + dy);
    }
    ctx.closePath();
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.55;
    ctx.fill();

    // Front face
    ctx.beginPath();
    ctx.moveTo(pts[0].x, baseY);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, baseY);
    ctx.closePath();
    ctx.globalAlpha = 0.28;
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // 3D Extruded Columns
  const barW = Math.max(10, step * 0.56);
  close.forEach((v, i) => {
    const barH = Math.max(6, ((v - minVal) / span) * plotH);
    const x = pad.left + i * step + (step - barW) / 2;
    const y = pad.top + plotH - barH;
    const color = c.series[i % c.series.length];

    // Front face
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, barH);

    // Top 3D face
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.lineTo(x + barW + dx, y + dy);
    ctx.lineTo(x + barW, y);
    ctx.closePath();
    ctx.globalAlpha = 0.72;
    ctx.fill();

    // Right 3D face
    ctx.beginPath();
    ctx.moveTo(x + barW, y);
    ctx.lineTo(x + barW + dx, y + dy);
    ctx.lineTo(x + barW + dx, y + barH + dy);
    ctx.lineTo(x + barW, y + barH);
    ctx.closePath();
    ctx.globalAlpha = 0.52;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (i % Math.ceil(close.length / 6) === 0 && labels[i]) {
      ctx.fillStyle = c.muted;
      ctx.textAlign = "center";
      ctx.fillText(labels[i], x + barW / 2, pad.top + plotH + 18);
    }
  });
}

export async function render3DChart(mode = chartState.mode) {
  ensureChartDom();
  const chart3dEl = document.getElementById("chart-3d");
  const modeLabelEl = document.getElementById("chart-mode-label");
  if (!chart3dEl || mode === "line") return;

  if (!chartState.hc3dReady) {
    chart3dEl.innerHTML = `<div class="chart-msg">Loading 3D visualization…</div>`;
    await ensureHighcharts3D();
  }

  if (chartState.hcInstance) {
    chartState.hcInstance.destroy();
    chartState.hcInstance = null;
  }
  chart3dEl.innerHTML = "";

  const c = getChartPalette();
  const stock = chartState.currentStock;
  const stockName = stock
    ? `${stock.name} (${clean(stock.symbol)})`
    : document.querySelector("#summary h2")?.textContent?.trim() ||
      "Selected Stock";

  const { labels, close, sma } = readChartJsSeries();
  const sliceCount = Math.min(14, close.length);
  const shortLabels = labels.slice(-sliceCount);
  const shortClose = close.slice(-sliceCount);
  const shortSma = sma.slice(-sliceCount);
  const pieData = getPieSliceData(stock);

  // If external Highcharts CDN is blocked/offline, render built-in 3D Canvas fallback
  if (!window.Highcharts) {
    if (modeLabelEl)
      modeLabelEl.textContent = `${stockName} — 3D Interactive View`;
    renderFallback3DCanvas(
      chart3dEl,
      mode,
      stockName,
      shortLabels,
      shortClose,
      pieData,
    );
    return;
  }

  // 1. 3D Area Chart
  if (mode === "area3d") {
    if (shortClose.length === 0) {
      chart3dEl.innerHTML = `<div class="chart-msg">Select a stock to render the 3D Area chart.</div>`;
      return;
    }
    if (modeLabelEl) modeLabelEl.textContent = `${stockName} — 3D Area`;

    const series = [{ name: "Close Price", data: shortClose, color: c.accent }];
    if (shortSma.length === shortClose.length && shortSma.some(Boolean)) {
      series.push({ name: "Moving Avg", data: shortSma, color: c.gain });
    }

    chartState.hcInstance = Highcharts.chart("chart-3d", {
      chart: {
        type: "area",
        backgroundColor: "transparent",
        options3d: {
          enabled: true,
          alpha: 14,
          beta: 16,
          depth: 55,
          viewDistance: 25,
        },
      },
      credits: { enabled: false },
      title: {
        text: `${stockName} — 3D Area`,
        style: { color: c.text, fontSize: "14px" },
      },
      xAxis: {
        categories: shortLabels,
        gridLineColor: c.grid,
        labels: { style: { color: c.muted } },
      },
      yAxis: {
        title: { text: "Price (₹)", style: { color: c.muted } },
        gridLineColor: c.grid,
        labels: { style: { color: c.muted } },
      },
      legend: { itemStyle: { color: c.text } },
      tooltip: { valuePrefix: "₹", valueDecimals: 2 },
      plotOptions: {
        area: {
          depth: 34,
          fillOpacity: 0.48,
          marker: { enabled: true, radius: 3 },
        },
      },
      series,
    });
    attach3DRotation(chartState.hcInstance);
    return;
  }

  // 2. 3D Bar / Column Chart
  if (mode === "bar3d" || mode === "column3d") {
    if (shortClose.length === 0) {
      chart3dEl.innerHTML = `<div class="chart-msg">Select a stock to render 3D bars.</div>`;
      return;
    }
    if (modeLabelEl) modeLabelEl.textContent = `${stockName} — 3D Bar`;

    chartState.hcInstance = Highcharts.chart("chart-3d", {
      chart: {
        type: "column",
        backgroundColor: "transparent",
        options3d: {
          enabled: true,
          alpha: 15,
          beta: 18,
          depth: 55,
          viewDistance: 25,
        },
      },
      credits: { enabled: false },
      title: {
        text: `${stockName} (3D Bars)`,
        style: { color: c.text, fontSize: "14px" },
      },
      xAxis: {
        categories: shortLabels,
        gridLineColor: c.grid,
        labels: { style: { color: c.muted } },
      },
      yAxis: {
        title: { text: "Price (₹)", style: { color: c.muted } },
        gridLineColor: c.grid,
        labels: { style: { color: c.muted } },
      },
      legend: { enabled: false },
      tooltip: { valuePrefix: "₹", valueDecimals: 2 },
      plotOptions: {
        column: {
          depth: 34,
          colorByPoint: true,
          colors: c.series,
        },
      },
      series: [{ name: "Price", data: shortClose }],
    });
    attach3DRotation(chartState.hcInstance);
    return;
  }

  // 3. 3D Pie & 3D Donut Charts
  if (mode === "pie3d" || mode === "donut3d") {
    const isDonut = mode === "donut3d";
    if (modeLabelEl) {
      modeLabelEl.textContent = isDonut
        ? "Watchlist Share — 3D Donut"
        : "Watchlist Share — 3D Pie";
    }

    if (pieData.length === 0) {
      chart3dEl.innerHTML = `<div class="chart-msg">Add stocks to your watchlist to view 3D allocation.</div>`;
      return;
    }

    chartState.hcInstance = Highcharts.chart("chart-3d", {
      chart: {
        type: "pie",
        backgroundColor: "transparent",
        options3d: { enabled: true, alpha: 45, beta: 0 },
      },
      credits: { enabled: false },
      title: {
        text: isDonut
          ? "Watchlist Price Share (3D Donut)"
          : "Watchlist Price Share (3D Pie)",
        style: { color: c.text, fontSize: "14px" },
      },
      colors: c.series,
      tooltip: {
        pointFormat: "Price: <b>₹{point.y:,.2f}</b> ({point.percentage:.1f}%)",
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: "pointer",
          depth: 38,
          innerSize: isDonut ? "54%" : "0%",
          dataLabels: {
            enabled: true,
            format: "{point.name}: {point.percentage:.1f}%",
            style: { color: c.text, textOutline: "none", fontWeight: "600" },
          },
        },
      },
      series: [{ name: "Share", data: pieData }],
    });
    attach3DRotation(chartState.hcInstance);
  }
}

export function setChartMode(mode) {
  ensureChartDom();
  const canvasEl = document.getElementById("price-chart");
  const chart3dEl = document.getElementById("chart-3d");
  const chartHintEl = document.getElementById("chart-hint");
  const chartMsgEl = document.getElementById("chart-msg");
  const typeBar = document.getElementById("chart-types");

  chartState.mode = mode;

  if (typeBar) {
    typeBar.querySelectorAll("[data-chart-type]").forEach((btn) => {
      const active = btn.dataset.chartType === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  if (!canvasEl || !chart3dEl) return;

  if (mode === "line") {
    chart3dEl.hidden = true;
    if (chartHintEl) chartHintEl.hidden = true;
    canvasEl.hidden = false;
    const cjs = window.Chart && Chart.getChart("price-chart");
    if (cjs) cjs.resize();
  } else {
    canvasEl.hidden = true;
    if (chartMsgEl) chartMsgEl.textContent = "";
    chart3dEl.hidden = false;
    if (chartHintEl) chartHintEl.hidden = false;
    render3DChart(mode);
  }
}

function initDashboardEnhancements() {
  if (chartState.initialized) return;
  chartState.initialized = true;

  ensureChartDom();

  const root = document.documentElement;
  const toggleBtn = document.getElementById("theme-toggle");
  const toggleLabel = document.getElementById("theme-toggle-label");

  if (toggleBtn && toggleLabel) {
    Object.defineProperty(toggleBtn, "textContent", {
      get() {
        return toggleLabel.textContent;
      },
      set(val) {
        toggleLabel.textContent = val;
      },
    });
  }

  const observer = new MutationObserver(() => {
    const isDark = root.dataset.theme === "dark";
    root.dataset.darkMode = String(isDark);
    if (toggleBtn) toggleBtn.setAttribute("aria-pressed", String(isDark));
    if (chartState.mode !== "line") {
      render3DChart(chartState.mode);
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#chart-types [data-chart-type]");
    if (!btn) return;
    setChartMode(btn.dataset.chartType);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboardEnhancements);
} else {
  initDashboardEnhancements();
}

/* ==========================================================================
   EXISTING UI RENDER EXPORTS (Used by js/app.js)
   ========================================================================== */

export function renderSummary(el, s) {
  chartState.currentStock = s || null;

  if (!s) {
    el.innerHTML = `<h2>No stock selected</h2><p>Pick one from the list.</p>`;
    return;
  }
  el.innerHTML = `
    <h2>${esc(s.name)} <span class="ticker">${esc(clean(s.symbol))}</span></h2>
    <p class="price">${inr(s.price)}</p>
    <p class="change ${trend(s.change)}">${signed(s.change)} (${signed(s.changePct)}%)</p>
    <dl class="stats">
      <div><dt>Open</dt><dd>${inr(s.open)}</dd></div>
      <div><dt>Prev close</dt><dd>${inr(s.prevClose)}</dd></div>
      <div><dt>High</dt><dd>${inr(s.high)}</dd></div>
      <div><dt>Low</dt><dd>${inr(s.low)}</dd></div>
      <div><dt>Volume</dt><dd>${volume(s.volume)}</dd></div>
    </dl>`;

  if (chartState.mode !== "line") {
    requestAnimationFrame(() => render3DChart(chartState.mode));
  }
}

export function renderList(
  el,
  stocks,
  selected,
  { loading, hasData, emptyWatchlist },
) {
  chartState.watchlistStocks = Array.isArray(stocks) ? stocks : [];

  if (emptyWatchlist) {
    el.innerHTML = `<li class="empty">Your watchlist is empty. Search above to add a stock.</li>`;
    return;
  }
  if (loading && !hasData) {
    el.innerHTML = `<li class="empty">Loading live prices…</li>`;
    return;
  }
  if (stocks.length === 0) {
    el.innerHTML = `<li class="empty">No match in your list. Press Search to look it up on NSE.</li>`;
    return;
  }
  el.innerHTML = stocks
    .map((s) => {
      const isSel = s.symbol === selected;
      return `
    <li class="stock-item">
      <button type="button" class="stock-row ${isSel ? "selected" : ""}" data-symbol="${esc(s.symbol)}" ${isSel ? 'aria-current="true"' : ""}>
        <span>${esc(clean(s.symbol))}</span>
        <span>${inr(s.price)}</span>
        <span class="${trend(s.changePct)}">${signed(s.changePct)}%</span>
      </button>
      <button type="button" class="remove-btn" data-remove="${esc(s.symbol)}"
              aria-label="Remove ${esc(clean(s.symbol))} from watchlist" title="Remove">✕</button>
    </li>`;
    })
    .join("");

  if (chartState.mode === "pie3d" || chartState.mode === "donut3d") {
    requestAnimationFrame(() => render3DChart(chartState.mode));
  }
}

export function renderIndices(el, indices, labels) {
  el.innerHTML = indices
    .map(
      (i) => `
    <div class="index-card">
      <span class="index-name">${esc(labels[i.symbol] || clean(i.symbol))}</span>
      <strong>${i.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
      <span class="${trend(i.change)}">${signed(i.changePct)}%</span>
    </div>`,
    )
    .join("");
}

export function renderStatus(el, { open, updatedAt, error, loading }) {
  const time = updatedAt
    ? updatedAt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
  el.innerHTML = `
    <span class="badge ${open ? "open" : "closed"}">${open ? "Market open" : "Market closed"}</span>
    <span>${loading ? "Updating…" : "Updated " + time + " IST"}</span>
    ${error ? `<span class="error">${esc(error)}</span>` : ""}`;
}

export function renderSuggestions(el, items) {
  if (items.length === 0) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = items
    .map(
      (x) => `
    <li><button type="button" class="suggestion" data-symbol="${esc(x.symbol)}">
      <span>${esc(x.name)}</span><small>${esc(clean(x.symbol))} · ${esc(x.exchange)}</small>
    </button></li>`,
    )
    .join("");
}

export function markActiveSort(bar, key) {
  bar.querySelectorAll(".sort-btn").forEach((b) => {
    const on = b.dataset.sort === key;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

export function markActiveRange(bar, range) {
  bar.querySelectorAll("button").forEach((b) => {
    const on = b.dataset.range === range;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });

  if (chartState.mode !== "line") {
    setTimeout(() => render3DChart(chartState.mode), 250);
  }
}

export function renderAnalysis(el, a) {
  const rsiText =
    a.rsi == null
      ? "—"
      : `${a.rsi.toFixed(1)} (${a.rsi > 70 ? "overbought zone" : a.rsi < 30 ? "oversold zone" : "neutral zone"})`;
  el.innerHTML = `
    <dl class="stats analysis-grid">
      <div><dt>Period change</dt><dd class="${a.stats.changePct == null ? "" : trend(a.stats.changePct)}">${pct(a.stats.changePct)}</dd></div>
      <div><dt>Period high</dt><dd>${inr(a.stats.high)}</dd></div>
      <div><dt>Period low</dt><dd>${inr(a.stats.low)}</dd></div>
      <div><dt>Avg volume</dt><dd>${volume(a.stats.avgVolume)}</dd></div>
      <div><dt>Best day</dt><dd class="gain">${pct(a.bestDay)}</dd></div>
      <div><dt>Worst day</dt><dd class="loss">${pct(a.worstDay)}</dd></div>
      <div><dt>RSI (14)</dt><dd>${rsiText}</dd></div>
      <div><dt>Trend vs SMA 50</dt><dd>${esc(a.signal)}</dd></div>
    </dl>
    <p class="note">${a.hasSma ? "" : "Pick 6M or 1Y to see moving averages. "}Informational only, not financial advice.</p>`;

  if (chartState.mode !== "line") {
    requestAnimationFrame(() => render3DChart(chartState.mode));
  }
}
