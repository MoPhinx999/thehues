(() => {
  "use strict";

  const legend = document.getElementById("legend");
  const chart = document.getElementById("trendChart");
  if (!legend || !chart) return;

  const yearColors = {
    "2024": "#2563eb",
    "2025": "#f97316",
    "2026": "#059669"
  };
  const hiddenYears = new Set();
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
      .legend .year-toggle.is-off::after {
        content: "";
        position: absolute;
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
    if (tooltip) tooltip.hidden = true;
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