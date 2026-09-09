(() => {
  "use strict";

  const data = window.MONTHLY_PERFORMANCE;
  if (!data || !Array.isArray(data.months) || !data.months.length) return;

  const years = [...data.years].sort((a, b) => a - b);
  const currentYear = Math.max(...years);
  const colors = { 2024: "#2563eb", 2025: "#f97316", 2026: "#059669" };
  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

  function money(value) {
    return value == null || !Number.isFinite(Number(value)) ? "—" : "$" + Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function integer(value) {
    return value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function percent(value) {
    return value == null || !Number.isFinite(Number(value)) ? "—" : (Number(value) * 100).toFixed(2) + "%";
  }

  function signedPercent(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  }

  function compact(value) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "m";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(Math.abs(n) >= 1e5 ? 0 : 1) + "k";
    return Math.round(n).toString();
  }

  function compactMoney(value) { return value == null ? "—" : "$" + compact(value); }
  function axisPercent(value) { return value == null ? "—" : (Number(value) * 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "%"; }

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

  const metrics = {
    net_sales: { label: "净销售额", value: row => row?.net_sales, format: money, axis: compactMoney },
    orders: { label: "订单量", value: row => row?.orders, format: integer, axis: compact },
    average_order_value: { label: "AOV", value: row => row?.average_order_value, format: money, axis: compactMoney },
    conversion_rate: { label: "网站 CVR", value: effectiveCvr, format: percent, axis: axisPercent },
    sessions: { label: "Sessions", value: row => row?.sessions, format: integer, axis: compact }
  };

  const byMonth = new Map(data.months.map(row => [row.month, row]));

  function rowFor(year, month) {
    return byMonth.get(`${year}-${String(month).padStart(2, "0")}`);
  }

  function rowsFor(year, startMonth = 1, endMonth = 12, completeOnly = false) {
    const rows = [];
    for (let month = startMonth; month <= endMonth; month += 1) {
      const row = rowFor(year, month);
      if (!row) continue;
      if (completeOnly && row.period_status !== "complete") continue;
      rows.push(row);
    }
    return rows;
  }

  function aggregate(rows) {
    const sales = rows.reduce((sum, row) => sum + (Number(row.net_sales) || 0), 0);
    const orders = rows.reduce((sum, row) => sum + (Number(row.orders) || 0), 0);

    const aovRows = rows.filter(row => row.average_order_value != null && Number.isFinite(Number(row.average_order_value)) && Number(row.orders) > 0);
    const aovOrders = aovRows.reduce((sum, row) => sum + Number(row.orders), 0);
    const weightedAov = aovRows.reduce((sum, row) => sum + Number(row.average_order_value) * Number(row.orders), 0);

    const trafficRows = rows.filter(row => row.sessions != null && Number.isFinite(Number(row.sessions)));
    const sessions = trafficRows.reduce((sum, row) => sum + Number(row.sessions), 0);
    const cvrRows = trafficRows.filter(row => row.conversion_sessions != null && Number.isFinite(Number(row.conversion_sessions)));
    const cvrSessions = cvrRows.reduce((sum, row) => sum + Number(row.sessions), 0);
    const conversions = cvrRows.reduce((sum, row) => sum + Number(row.conversion_sessions), 0);

    return {
      net_sales: sales,
      orders,
      average_order_value: aovOrders ? weightedAov / aovOrders : null,
      sessions: trafficRows.length ? sessions : null,
      conversion_rate: cvrRows.length && cvrSessions ? conversions / cvrSessions : null,
      traffic_months: trafficRows.length,
      cvr_months: cvrRows.length,
      months: rows.length
    };
  }

  function delta(current, previous) {
    if (current == null || previous == null || Number(previous) === 0) return null;
    return (Number(current) - Number(previous)) / Number(previous);
  }

  function sourceName(source) {
    if (source === "shopifyql_human_sessions") return "Shopify";
    if (source === "ga4_purchase_sessions") return "GA4 补充";
    return "缺失";
  }

  function brandName() {
    if (data.brand) return data.brand;
    const title = String(data.title || "");
    const match = title.match(/^(.+?)\s+monthly performance/i);
    return match ? match[1] : "Store";
  }

  function renderHeader() {
    const brand = brandName();
    const brandLink = document.querySelector(".eyebrow a");
    if (brandLink) {
      brandLink.textContent = brand;
      if (data.homepage) brandLink.href = data.homepage;
    }
    document.title = `${brand} 全站经营数据`;
    document.getElementById("dataThrough").textContent = data.data_through || "—";
    const stamp = new Date(data.synced_at);
    document.getElementById("syncTime").textContent = Number.isNaN(stamp.getTime())
      ? (data.synced_at || "—")
      : stamp.toLocaleString("zh-CN", { hour12: false });
  }

  function comparableTrafficMonths(previousYear, year, endMonth) {
    const months = [];
    for (let month = 1; month <= endMonth; month += 1) {
      const current = rowFor(year, month);
      const previous = rowFor(previousYear, month);
      if (!current || !previous) continue;
      const comparable = current.period_status === "complete" && previous.period_status === "complete"
        && current.sessions != null && previous.sessions != null
        && current.traffic_source === previous.traffic_source
        && current.traffic_source !== "unavailable";
      if (comparable) months.push(month);
    }
    return months;
  }

  function formatMonthRange(months) {
    if (!months.length) return "无同口径月份";
    if (months.length === 1) return `${months[0]}月`;
    const contiguous = months.every((month, index) => index === 0 || month === months[index - 1] + 1);
    return contiguous ? `${months[0]}–${months[months.length - 1]}月` : months.map(month => `${month}月`).join("、");
  }

  function performanceInsight(salesDelta, ordersDelta, aovDelta, completeThrough, previousYear) {
    let title;
    if (salesDelta == null) title = "销售同比暂无完整口径。";
    else if (salesDelta >= 0) {
      if ((ordersDelta ?? 0) >= 0 && (aovDelta ?? 0) >= 0) title = "订单与 AOV 共同推动增长。";
      else if ((ordersDelta ?? 0) >= 0 && (aovDelta ?? 0) < 0) title = "增长主要来自订单规模。";
      else if ((ordersDelta ?? 0) < 0 && (aovDelta ?? 0) >= 0) title = "增长主要由 AOV 提升支撑。";
      else title = "销售额保持增长。";
    } else {
      if ((ordersDelta ?? 0) < 0 && (aovDelta ?? 0) >= 0) title = "AOV 提升未完全抵消订单下降。";
      else if ((ordersDelta ?? 0) >= 0 && (aovDelta ?? 0) < 0) title = "订单增长未完全抵消 AOV 下滑。";
      else title = "销售额同比承压。";
    }
    return `<strong>${title}</strong><span>${currentYear} 1–${completeThrough}月 vs ${previousYear}：净销售额 ${signedPercent(salesDelta)}，订单量 ${signedPercent(ordersDelta)}，AOV ${signedPercent(aovDelta)}。</span>`;
  }

  function trafficInsight(sessionsDelta, cvrDelta, trafficMonths, previousTraffic, currentTraffic) {
    let title;
    if (sessionsDelta == null || cvrDelta == null) title = "流量或 CVR 暂无完整可比口径。";
    else if (sessionsDelta >= 0 && cvrDelta >= 0) title = "流量与转化同步改善。";
    else if (sessionsDelta < 0 && cvrDelta < 0) title = "流量与转化均承压。";
    else if (sessionsDelta < 0 && cvrDelta >= 0) title = "转化改善，但流量下降。";
    else title = "流量增长，但转化效率下降。";
    return `<strong>${title}</strong><span>同口径 ${formatMonthRange(trafficMonths)} Sessions ${signedPercent(sessionsDelta)}；CVR 从 ${percent(previousTraffic.conversion_rate)} 到 ${percent(currentTraffic.conversion_rate)}（${signedPercent(cvrDelta)}）。</span>`;
  }

  function renderExecutive() {
    const previousYear = currentYear - 1;
    const currentRows = rowsFor(currentYear);
    const currentYtd = aggregate(currentRows);
    const completeMonths = currentRows.filter(row => row.period_status === "complete").map(row => Number(row.month.slice(5, 7)));
    const completeThrough = completeMonths.length ? Math.max(...completeMonths) : 0;
    const currentComparable = aggregate(rowsFor(currentYear, 1, completeThrough, true));
    const previousComparable = aggregate(rowsFor(previousYear, 1, completeThrough, true));
    const trafficMonths = comparableTrafficMonths(previousYear, currentYear, completeThrough);
    const currentTraffic = aggregate(trafficMonths.map(month => rowFor(currentYear, month)));
    const previousTraffic = aggregate(trafficMonths.map(month => rowFor(previousYear, month)));
    const currentPartial = currentRows.find(row => row.period_status === "partial");

    document.getElementById("executiveRange").textContent = currentPartial
      ? `${currentYear} YTD · 截至 ${data.data_through}，含 ${Number(currentPartial.month.slice(5, 7))} 月部分数据`
      : `${currentYear} YTD · 截至 ${data.data_through}`;

    const salesDelta = delta(currentComparable.net_sales, previousComparable.net_sales);
    const ordersDelta = delta(currentComparable.orders, previousComparable.orders);
    const aovDelta = delta(currentComparable.average_order_value, previousComparable.average_order_value);
    const sessionsDelta = delta(currentTraffic.sessions, previousTraffic.sessions);
    const cvrDelta = delta(currentTraffic.conversion_rate, previousTraffic.conversion_rate);

    const kpis = [
      { label: `${currentYear} YTD 净销售额`, value: money(currentYtd.net_sales), delta: signedPercent(salesDelta), note: `同比：${currentYear} 1–${completeThrough}月 vs ${previousYear} 1–${completeThrough}月`, tone: salesDelta },
      { label: `${currentYear} YTD 订单量`, value: integer(currentYtd.orders), delta: signedPercent(ordersDelta), note: `同比：${currentYear} 1–${completeThrough}月 vs ${previousYear} 1–${completeThrough}月`, tone: ordersDelta },
      { label: `${currentYear} YTD AOV`, value: money(currentYtd.average_order_value), delta: signedPercent(aovDelta), note: `AOV 按月度 Shopify AOV × 订单量加权`, tone: aovDelta },
      { label: `${currentYear} YTD Sessions`, value: integer(currentYtd.sessions), delta: signedPercent(sessionsDelta), note: `流量同比仅用同口径 ${formatMonthRange(trafficMonths)}`, tone: sessionsDelta },
      { label: `${currentYear} YTD 网站 CVR`, value: percent(currentYtd.conversion_rate), delta: signedPercent(cvrDelta), note: `CVR = conversion sessions ÷ Sessions`, tone: cvrDelta }
    ];

    document.getElementById("executiveKpis").innerHTML = kpis.map(item => {
      const cls = item.tone == null ? "neutral" : item.tone >= 0 ? "up" : "down";
      return `<article class="kpi-card">
        <span class="kpi-label">${item.label}</span>
        <strong class="kpi-value">${item.value}</strong>
        <div class="kpi-foot"><span class="kpi-delta ${cls}">${item.delta}</span><small>${item.note}</small></div>
      </article>`;
    }).join("");

    const full2024 = aggregate(rowsFor(2024));
    const share2024 = full2024.net_sales ? currentYtd.net_sales / full2024.net_sales : null;
    const insights = [
      performanceInsight(salesDelta, ordersDelta, aovDelta, completeThrough, previousYear),
      trafficInsight(sessionsDelta, cvrDelta, trafficMonths, previousTraffic, currentTraffic),
      currentPartial
        ? `<strong>${Number(currentPartial.month.slice(5, 7))}月仍是部分月。</strong><span>截至 ${data.data_through}：净销售额 ${money(currentPartial.net_sales)}，${integer(currentPartial.orders)} 单，AOV ${money(currentPartial.average_order_value)}；不纳入完整月同比。</span>`
        : `<strong>当前月份已完整。</strong><span>所有已展示月份均可进入完整月同比。</span>`,
      share2024 != null
        ? `<strong>${currentYear} YTD 已达到 2024 全年销售额的 ${(share2024 * 100).toFixed(1)}%。</strong><span>用于快速判断当前规模，但 YTD 与全年不是同比口径。</span>`
        : ""
    ].filter(Boolean);
    document.getElementById("insightGrid").innerHTML = insights.map((text, index) => `<article class="insight-card"><span class="insight-number">0${index + 1}</span><div>${text}</div></article>`).join("");
  }

  function trafficCoverage(summary) {
    const rows = rowsFor(summary.year);
    const trafficRows = rows.filter(row => row.sessions != null);
    const sources = [...new Set(trafficRows.map(row => row.traffic_source))];
    if (!trafficRows.length) return "无可用流量数据";
    if (sources.length > 1) return `流量覆盖 ${trafficRows.length}/${rows.length} 月 · 混合口径`;
    return `流量覆盖 ${trafficRows.length}/${rows.length} 月 · ${sourceName(sources[0])}`;
  }

  function renderYearCards() {
    document.getElementById("yearCards").innerHTML = data.summaries.map(summary => {
      const status = summary.partial ? `YTD · 截至 ${data.data_through}` : "完整年度";
      const computed = aggregate(rowsFor(summary.year));
      const mixedSources = new Set(rowsFor(summary.year).filter(row => row.sessions != null).map(row => row.traffic_source)).size > 1;
      return `<article class="year-card ${summary.partial ? "partial" : ""}">
        <div class="year-head"><h3>${summary.year}</h3><span>${status}</span></div>
        <div class="year-sales"><span>净销售额</span><strong>${money(summary.net_sales ?? computed.net_sales)}</strong></div>
        <div class="year-metrics">
          <div><span>订单量</span><strong>${integer(summary.orders ?? computed.orders)}</strong></div>
          <div><span>AOV</span><strong>${money(computed.average_order_value)}</strong></div>
          <div><span>Sessions*</span><strong>${integer(computed.sessions)}</strong></div>
          <div><span>网站 CVR*</span><strong>${percent(computed.conversion_rate)}</strong></div>
        </div>
        <p class="coverage">${trafficCoverage(summary)}${mixedSources ? "；跨来源年度流量不用于管理层同比" : ""}</p>
      </article>`;
    }).join("");
  }

  function svgEl(name, attrs = {}, text = "") {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text) element.textContent = text;
    return element;
  }

  function ensureTooltip() {
    let tooltip = document.getElementById("trendTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "trendTooltip";
      tooltip.className = "chart-tooltip";
      tooltip.hidden = true;
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function positionTooltip(tooltip, clientX, clientY) {
    const gap = 14;
    const pad = 10;
    tooltip.style.left = `${clientX + gap}px`;
    tooltip.style.top = `${clientY + gap}px`;
    const rect = tooltip.getBoundingClientRect();
    let left = clientX + gap;
    let top = clientY + gap;
    if (rect.right > window.innerWidth - pad) left = clientX - rect.width - gap;
    if (rect.bottom > window.innerHeight - pad) top = clientY - rect.height - gap;
    tooltip.style.left = `${Math.max(pad, left)}px`;
    tooltip.style.top = `${Math.max(pad, top)}px`;
  }

  function chartTrafficNote() {
    const trafficRows = data.months.filter(row => row.sessions != null);
    const sources = [...new Set(trafficRows.map(row => row.traffic_source))];
    const missing = data.months.filter(row => row.sessions == null).map(row => row.month);
    if (sources.length === 1 && sources[0] === "shopifyql_human_sessions") {
      return `Sessions 与 CVR 均为 Shopify human sessions 口径；CVR = conversion sessions ÷ Sessions。${missing.length ? `缺失 ${missing.length} 个月流量数据。` : ""}`;
    }
    const sourceText = sources.map(sourceName).join(" + ");
    return `Sessions / CVR 使用 ${sourceText || "可用来源"}；CVR = conversion sessions ÷ Sessions。${missing.length ? `另有 ${missing.length} 个月流量缺失。` : ""}跨来源折线可看趋势，不做严格同比。`;
  }

  function renderChart(metricKey) {
    const metric = metrics[metricKey];
    const svg = document.getElementById("trendChart");
    const title = svg.querySelector("title");
    const desc = svg.querySelector("desc");
    svg.replaceChildren(title, desc);
    title.textContent = `${metric.label}月度趋势`;
    desc.textContent = `${years.join("、")} 年 ${metric.label}逐月对比。`;

    const width = 1120, height = 390;
    const pad = { left: 78, right: 30, top: 34, bottom: 48 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const values = data.months.map(metric.value).filter(value => value != null && Number.isFinite(Number(value))).map(Number);
    const maxValue = values.length ? Math.max(...values) : 0;
    const max = maxValue > 0 ? maxValue * 1.12 : 1;
    const x = month => pad.left + (month - 1) * innerWidth / 11;
    const y = value => pad.top + innerHeight - Number(value) / max * innerHeight;

    for (let tick = 0; tick <= 4; tick += 1) {
      const value = max * tick / 4;
      const py = pad.top + innerHeight - innerHeight * tick / 4;
      svg.appendChild(svgEl("line", { x1: pad.left, x2: width - pad.right, y1: py, y2: py, class: "grid-line" }));
      svg.appendChild(svgEl("text", { x: pad.left - 12, y: py + 4, "text-anchor": "end", class: "axis-text" }, metric.axis(value)));
    }
    monthNames.forEach((name, index) => {
      svg.appendChild(svgEl("text", { x: x(index + 1), y: height - 16, "text-anchor": "middle", class: "axis-text" }, name));
    });

    const tooltip = ensureTooltip();
    tooltip.hidden = true;

    years.forEach(year => {
      let segment = [];
      let previousMonth = null;
      const drawSegment = () => {
        if (segment.length > 1) {
          svg.appendChild(svgEl("polyline", {
            points: segment.map(point => `${x(point.month)},${y(point.value)}`).join(" "),
            class: "trend-line", stroke: colors[year] || "#555"
          }));
        }
        segment = [];
      };

      for (let month = 1; month <= 12; month += 1) {
        const row = rowFor(year, month);
        const value = metric.value(row);
        if (value == null || !Number.isFinite(Number(value))) {
          if (segment.length) drawSegment();
          previousMonth = null;
          continue;
        }
        if (previousMonth != null && month !== previousMonth + 1) drawSegment();
        segment.push({ month, value: Number(value), row });
        previousMonth = month;
      }
      drawSegment();

      for (let month = 1; month <= 12; month += 1) {
        const row = rowFor(year, month);
        const value = metric.value(row);
        if (value == null || !Number.isFinite(Number(value))) continue;
        const pointX = x(month);
        const pointY = y(Number(value));
        const baseRadius = row.period_status === "partial" ? 5.5 : 4.5;
        const circle = svgEl("circle", {
          cx: pointX, cy: pointY, r: baseRadius,
          class: "trend-point", stroke: colors[year] || "#555",
          fill: row.period_status === "partial" ? "#ffffff" : (colors[year] || "#555")
        });
        svg.appendChild(circle);

        const hit = svgEl("circle", {
          cx: pointX, cy: pointY, r: 13,
          class: "trend-hit", fill: "transparent", tabindex: "0",
          role: "button",
          "aria-label": `${year} ${monthNames[month - 1]} ${metric.label} ${metric.format(value)}`
        });

        const show = (clientX, clientY) => {
          circle.setAttribute("r", String(baseRadius + 2.5));
          tooltip.innerHTML = `<div class="tooltip-head"><i style="background:${colors[year] || "#555"}"></i><strong>${year} · ${monthNames[month - 1]}</strong></div><span>${metric.label}</span><b>${metric.format(value)}</b><small>${sourceName(row.traffic_source)}${row.period_status === "partial" ? " · 部分月" : ""}</small>`;
          tooltip.hidden = false;
          positionTooltip(tooltip, clientX, clientY);
        };
        const hide = () => {
          circle.setAttribute("r", String(baseRadius));
          tooltip.hidden = true;
        };

        hit.addEventListener("mouseenter", event => show(event.clientX, event.clientY));
        hit.addEventListener("mousemove", event => positionTooltip(tooltip, event.clientX, event.clientY));
        hit.addEventListener("mouseleave", hide);
        hit.addEventListener("focus", () => {
          const rect = hit.getBoundingClientRect();
          show(rect.left + rect.width / 2, rect.top + rect.height / 2);
        });
        hit.addEventListener("blur", hide);
        svg.appendChild(hit);
      }
    });

    const note = metricKey === "sessions" || metricKey === "conversion_rate"
      ? chartTrafficNote()
      : `销售、订单与 AOV 均为 ShopifyQL 销售口径；${currentYear} 年当前未结束月份以空心点标记。`;
    document.getElementById("chartNote").textContent = note;
  }

  function renderMetricSwitch() {
    const switcher = document.getElementById("metricSwitch");
    switcher.innerHTML = "";
    Object.entries(metrics).forEach(([key, metric], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = metric.label;
      button.dataset.metric = key;
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.addEventListener("click", () => {
        switcher.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        renderChart(key);
      });
      switcher.appendChild(button);
    });
    document.getElementById("legend").innerHTML = years.map(year => `<span><i style="background:${colors[year] || "#555"}"></i>${year}</span>`).join("");
    renderChart("net_sales");
  }

  function renderMonthlyTable(year) {
    const rows = [];
    for (let month = 1; month <= 12; month += 1) {
      const row = rowFor(year, month);
      if (!row) {
        rows.push(`<tr class="empty-row"><th scope="row">${monthNames[month - 1]}</th><td colspan="6">无数据</td></tr>`);
        continue;
      }
      const partial = row.period_status === "partial";
      rows.push(`<tr class="${partial ? "partial-row" : ""}">
        <th scope="row"><strong>${monthNames[month - 1]}</strong>${partial ? "<span class=\"partial-badge\">部分月</span>" : ""}</th>
        <td class="primary-cell">${money(row.net_sales)}</td>
        <td>${integer(row.orders)}</td>
        <td>${money(row.average_order_value)}</td>
        <td>${integer(row.sessions)}</td>
        <td>${percent(effectiveCvr(row))}</td>
        <td><span class="source-badge ${row.traffic_source === "shopifyql_human_sessions" ? "shopify" : row.traffic_source === "ga4_purchase_sessions" ? "ga4" : "missing"}">${sourceName(row.traffic_source)}</span></td>
      </tr>`);
    }
    document.getElementById("monthlyRows").innerHTML = rows.join("");
  }

  function renderYearSwitch() {
    const switcher = document.getElementById("yearSwitch");
    switcher.innerHTML = "";
    years.forEach(year => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = year === currentYear ? `${year} YTD` : String(year);
      button.setAttribute("aria-pressed", String(year === currentYear));
      button.addEventListener("click", () => {
        switcher.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        renderMonthlyTable(year);
      });
      switcher.appendChild(button);
    });
    renderMonthlyTable(currentYear);
  }

  function renderSources() {
    document.getElementById("sourceLine").textContent = `Shopify 报表时区：${data.shopify_timezone || "未记录"}；GA4 时区：${data.ga4_timezone || "未记录"}。数据文件更新时间：${data.synced_at || "未记录"}。CVR 优先由 conversion sessions ÷ Sessions 实时计算；只需更新 data.js 与 monthly_metrics.csv 即可刷新看板。`;
  }

  renderHeader();
  renderExecutive();
  renderYearCards();
  renderMetricSwitch();
  renderYearSwitch();
  renderSources();
})();
