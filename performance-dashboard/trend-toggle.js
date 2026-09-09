(() => {
  "use strict";

  const legend = document.getElementById("legend");
  const chart = document.getElementById("trendChart");
  const data = window.MONTHLY_PERFORMANCE;
  if (!legend || !chart || !data || !Array.isArray(data.months)) return;

  const yearColors = {
    "2024": "#2563eb",
    "2025": "#f97316",
    "2026": "#059669"
  };
  const hiddenYears = new Set();
  const rowsByMonth = new Map(data.months.map(row => [row.month, row]));
  let applyFrame = null;

  function normalizeWording(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      let text = node.nodeValue;
      text = text.replaceAll("管理层同比", "严格同比").replaceAll("管理层", "");
      if (text !== node.nodeValue) node.nodeValue = text;
    }
  }

  function injectStyles() {
    if (document.getElementById("yearToggleStyles")) return;
    const style = document.createElement("style");
    style.id = "yearToggleStyles";
    style.textContent = `
      .legend .year-toggle {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 6px 8px;
        margin: -6px -8px;
        border-radius: 999px;
        cursor: pointer;
        user-select: none;
        transition: opacity .15s ease, background-color .15s ease, color .15s ease;
      }
      .legend .year-toggle:hover { background: rgba(24, 32, 29, .055); color: var(--ink, #18201d); }
      .legend .year-toggle:focus-visible { outline: 2px solid rgba(30, 91, 79, .32); outline-offset: 2px; }
      .legend .year-toggle.is-off { opacity: .32; }
      .legend .year-toggle.is-off i { filter: grayscale(1); }

      .chart-tooltip.is-grouped {
        min-width: 225px;
        max-width: 280px;
        padding: 12px 13px;
      }
      .chart-tooltip.is-grouped .tooltip-group-title {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 14px;
        padding-bottom: 9px;
        margin-bottom: 5px;
        border-bottom: 1px solid rgba(255,255,255,.14);
      }
      .chart-tooltip.is-grouped .tooltip-group-title strong {
        font-size: 12px;
      }
      .chart-tooltip.is-grouped .tooltip-group-title span {
        color: rgba(255,255,255,.58);
        font-size: 9px;
        white-space: nowrap;
      }
      .tooltip-compare-list {
        display: grid;
        gap: 2px;
      }
      .tooltip-compare-row {
        display: grid;
        grid-template-columns: 76px 1fr auto;
        align-items: center;
        gap: 7px;
        min-height: 31px;
      }
      .tooltip-compare-year {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: rgba(255,255,255,.78);
        font-size: 10px;
        font-weight: 650;
      }
      .tooltip-compare-year i {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: 0 0 auto;
      }
      .tooltip-compare-value {
        justify-self: end;
        font-size: 16px;
        line-height: 1;
        letter-spacing: -.02em;
      }
      .tooltip-compare-status {
        min-width: 27px;
        color: rgba(255,255,255,.42);
        font-size: 8px;
        text-align: right;
      }
      .chart-tooltip.is-grouped .tooltip-group-foot {
        display: block;
        margin-top: 7px;
        padding-top: 7px;
        border-top: 1px solid rgba(255,255,255,.10);
        color: rgba(255,255,255,.44);
        font-size: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function updateLegendState() {
    legend.querySelectorAll(".year-toggle").forEach(item => {
      const year = item.dataset.year;
      const visible = !hiddenYears.has(year);
      item.classList.toggle("is-off", !visible);
      item.setAttribute("aria-pressed", String(visible));
      item.setAttribute("aria-label", `${visible ? "隐藏" : "显示"} ${year} 年曲线`);
      item.title = `${visible ? "隐藏" : "显示"} ${year} 年曲线`;
    });
  }

  function applyVisibility() {
    applyFrame = null;
    Object.entries(yearColors).forEach(([year, color]) => {
      const hidden = hiddenYears.has(year);
      chart.querySelectorAll(`.trend-line[stroke="${color}"], .trend-point[stroke="${color}"]`).forEach(element => {
        element.style.display = hidden ? "none" : "";
      });
      chart.querySelectorAll(".trend-hit").forEach(element => {
        const label = element.getAttribute("aria-label") || "";
        if (label.startsWith(`${year} `)) element.style.display = hidden ? "none" : "";
      });
    });

    const tooltip = document.getElementById("trendTooltip");
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.classList.remove("is-grouped");
    }
    updateLegendState();
  }

  function scheduleApply() {
    if (applyFrame != null) cancelAnimationFrame(applyFrame);
    applyFrame = requestAnimationFrame(applyVisibility);
  }

  function toggleYear(year) {
    if (hiddenYears.has(year)) hiddenYears.delete(year);
    else hiddenYears.add(year);
    applyVisibility();
  }

  function bindLegend() {
    legend.querySelectorAll("span").forEach(item => {
      const year = item.textContent.trim();
      if (!yearColors[year] || item.dataset.yearToggleBound === "true") return;
      item.dataset.yearToggleBound = "true";
      item.dataset.year = year;
      item.classList.add("year-toggle");
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-pressed", "true");

      item.addEventListener("click", () => toggleYear(year));
      item.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleYear(year);
        }
      });
    });
    updateLegendState();
  }

  function money(value) {
    return value == null || !Number.isFinite(Number(value))
      ? "—"
      : "$" + Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function integer(value) {
    return value == null || !Number.isFinite(Number(value))
      ? "—"
      : Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function percent(value) {
    return value == null || !Number.isFinite(Number(value))
      ? "—"
      : (Number(value) * 100).toFixed(2) + "%";
  }

  function effectiveCvr(row) {
    if (!row) return null;
    const sessions = Number(row.sessions);
    const conversions = Number(row.conversion_sessions);
    if (row.sessions != null && row.conversion_sessions != null && Number.isFinite(sessions) && sessions > 0 && Number.isFinite(conversions)) {
      return conversions / sessions;
    }
    const supplied = Number(row.conversion_rate);
    return row.conversion_rate != null && Number.isFinite(supplied) ? supplied : null;
  }

  function metricConfig() {
    const key = document.querySelector('#metricSwitch button[aria-pressed="true"]')?.dataset.metric || "net_sales";
    const configs = {
      net_sales: { label: "净销售额", value: row => row?.net_sales, format: money },
      orders: { label: "订单量", value: row => row?.orders, format: integer },
      average_order_value: { label: "AOV", value: row => row?.average_order_value, format: money },
      conversion_rate: { label: "网站 CVR", value: effectiveCvr, format: percent },
      sessions: { label: "Sessions", value: row => row?.sessions, format: integer }
    };
    return { key, ...(configs[key] || configs.net_sales) };
  }

  function pointMonth(hit) {
    const label = hit?.getAttribute("aria-label") || "";
    const match = label.match(/^\d{4}\s+(\d{1,2})月\b/);
    return match ? Number(match[1]) : null;
  }

  function visibleYears() {
    return Object.keys(yearColors).filter(year => !hiddenYears.has(year));
  }

  function positionTooltip(tooltip, clientX, clientY) {
    const gap = 14;
    const pad = 10;
    let left = clientX + gap;
    let top = clientY + gap;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    const rect = tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth - pad) left = clientX - rect.width - gap;
    if (rect.bottom > window.innerHeight - pad) top = clientY - rect.height - gap;
    tooltip.style.left = `${Math.max(pad, left)}px`;
    tooltip.style.top = `${Math.max(pad, top)}px`;
  }

  function showGroupedTooltip(hit, clientX, clientY) {
    const month = pointMonth(hit);
    if (!month) return;
    const tooltip = document.getElementById("trendTooltip");
    if (!tooltip) return;

    const metric = metricConfig();
    const activeYears = visibleYears();
    const rows = activeYears.map(year => {
      const row = rowsByMonth.get(`${year}-${String(month).padStart(2, "0")}`);
      const value = metric.value(row);
      const partial = row?.period_status === "partial";
      return `
        <div class="tooltip-compare-row">
          <span class="tooltip-compare-year"><i style="background:${yearColors[year]}"></i>${year}</span>
          <b class="tooltip-compare-value">${metric.format(value)}</b>
          <span class="tooltip-compare-status">${partial ? "部分月" : ""}</span>
        </div>`;
    }).join("");

    tooltip.classList.add("is-grouped");
    tooltip.innerHTML = `
      <div class="tooltip-group-title">
        <strong>${month}月 · ${metric.label}</strong>
        <span>同月对比</span>
      </div>
      <div class="tooltip-compare-list">${rows}</div>
      <small class="tooltip-group-foot">仅展示当前已开启的年份</small>`;
    tooltip.hidden = false;
    positionTooltip(tooltip, clientX, clientY);
  }

  function groupedFromPointer(event) {
    const hit = event.target.closest?.(".trend-hit");
    if (!hit || !chart.contains(hit)) return;
    showGroupedTooltip(hit, event.clientX, event.clientY);
  }

  chart.addEventListener("mousemove", groupedFromPointer);
  chart.addEventListener("mouseover", event => {
    const hit = event.target.closest?.(".trend-hit");
    if (!hit || !chart.contains(hit)) return;
    requestAnimationFrame(() => showGroupedTooltip(hit, event.clientX, event.clientY));
  });
  chart.addEventListener("focusin", event => {
    const hit = event.target.closest?.(".trend-hit");
    if (!hit || !chart.contains(hit)) return;
    requestAnimationFrame(() => {
      const rect = hit.getBoundingClientRect();
      showGroupedTooltip(hit, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
  });

  normalizeWording();
  injectStyles();
  bindLegend();
  applyVisibility();

  const observer = new MutationObserver(() => {
    bindLegend();
    scheduleApply();
  });
  observer.observe(chart, { childList: true, subtree: true });
})();