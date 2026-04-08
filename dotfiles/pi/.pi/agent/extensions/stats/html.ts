import type {
  DailyStat, ModelStat, OverallStats, ProjectStat, RecentSession, ToolStat, WeeklyStat,
} from "./db.js";

/* ─── formatters (no ANSI) ────────────────────────────────────────────────── */

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function fmtCost(usd: number): string {
  if (usd <= 0)    return "$0.00";
  if (usd < 0.005) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function fmtMs(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function fmtDateShort(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
}

/* ─── SVG chart builders ──────────────────────────────────────────────────── */

/** Numbered leaderboard as HTML string (no SVG needed). */
function htmlLeaderboard(items: Array<{ label: string; value: number; unit?: string }>): string {
  if (items.length === 0) return "<p style='color:var(--muted)'>No data yet</p>";
  const medals = ["🥇", "🥈", "🥉"];
  const rows = items.map((item, i) => {
    const rank  = medals[i] ?? `<span style='color:#8b949e;font-size:12px'>#${i + 1}</span>`;
    const pct   = Math.round((item.value / (items[0]!.value || 1)) * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;
                  border-bottom:1px solid #21262d">
        <span style="width:28px;text-align:center;font-size:15px;flex-shrink:0">${rank}</span>
        <span style="flex:1;font-family:monospace;font-size:12px;color:#c9d1d9;overflow:hidden;
                     text-overflow:ellipsis;white-space:nowrap" title="${escHtml(item.label)}">
          ${escHtml(item.label)}
        </span>
        <span style="font-weight:700;font-variant-numeric:tabular-nums;color:#58a6ff;flex-shrink:0">
          ${item.value}
        </span>
        <span style="color:#8b949e;font-size:11px;flex-shrink:0">${item.unit ?? "inputs"}</span>
        <div style="width:60px;height:6px;background:#21262d;border-radius:3px;flex-shrink:0">
          <div style="width:${pct}%;height:6px;background:#58a6ff;border-radius:3px"></div>
        </div>
      </div>`;
  }).join("");
  return `<div>${rows}</div>`;
}

/** Horizontal bar chart as SVG. */
function svgBarChart(
  items: Array<{ label: string; value: number }>,
  opts: { width?: number; rowH?: number; barColor?: string; labelColor?: string },
): string {
  const w       = opts.width     ?? 600;
  const rowH    = opts.rowH      ?? 28;
  const bColor  = opts.barColor  ?? "#58a6ff";
  const lColor  = opts.labelColor ?? "#c9d1d9";
  const max     = Math.max(...items.map(i => i.value), 1);
  const labelW  = 160;
  const numW    = 48;
  const barArea = w - labelW - numW - 16;
  const h       = items.length * rowH + 8;

  let rects = "";
  items.forEach((item, i) => {
    const y     = i * rowH + 4;
    const bw    = Math.round((item.value / max) * barArea);
    const bwBg  = barArea;
    rects += `
      <text x="${labelW - 8}" y="${y + rowH * 0.65}" fill="${lColor}" font-size="12" text-anchor="end"
            font-family="monospace" class="label">${escHtml(item.label)}</text>
      <rect x="${labelW}" y="${y + 4}" width="${bwBg}" height="${rowH - 12}"
            fill="#21262d" rx="2"/>
      <rect x="${labelW}" y="${y + 4}" width="${bw}" height="${rowH - 12}"
            fill="${bColor}" rx="2"/>
      <text x="${labelW + bwBg + 6}" y="${y + rowH * 0.65}" fill="#8b949e" font-size="11"
            font-family="monospace">${item.value}</text>`;
  });

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

/** Token timeline sparkline as SVG. */
function svgSparkline(
  items: DailyStat[],
  opts: { width?: number; height?: number; color?: string },
): string {
  if (items.length < 2) return "";
  const w     = opts.width  ?? 700;
  const h     = opts.height ?? 80;
  const color = opts.color  ?? "#58a6ff";
  const max   = Math.max(...items.map(d => d.tokens), 1);
  const n     = items.length;
  const pad   = 4;
  const aw    = w - pad * 2;
  const ah    = h - pad * 2 - 16; // leave room for x-axis labels

  const pts = items.map((d, i) => {
    const x = pad + (i / (n - 1)) * aw;
    const y = pad + ah - (d.tokens / max) * ah;
    return `${x},${y}`;
  });

  // Area fill
  const first = pts[0]!;
  const last  = pts[n - 1]!;
  const [lx]  = last.split(",");
  const [fx]  = first.split(",");
  const area  = `M${fx},${pad + ah} L${pts.join(" L")} L${lx},${pad + ah} Z`;

  // X-axis: show first and last date
  const xLabels = `
    <text x="${pad}" y="${h}" fill="#8b949e" font-size="10" font-family="monospace"
          text-anchor="start">${items[0]!.day}</text>
    <text x="${w - pad}" y="${h}" fill="#8b949e" font-size="10" font-family="monospace"
          text-anchor="end">${items[n - 1]!.day}</text>`;

  return `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#grad)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2"
                stroke-linejoin="round" stroke-linecap="round"/>
      ${xLabels}
    </svg>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ─── main builder ────────────────────────────────────────────────────────── */

export function buildHtmlDashboard(
  overall:  OverallStats,
  weekly:   WeeklyStat,
  tools:    ToolStat[],
  models:   ModelStat[],
  projects: ProjectStat[],
  daily:    DailyStat[],
  recent:   RecentSession[],
  weekStart: number,
  weekEnd:   number,
): string {
  const generatedAt = new Date().toLocaleString();
  const weekLabel   = `${fmtDateShort(weekStart)} – ${fmtDateShort(weekEnd)}`;

  const toolItems    = tools.map(t => ({ label: t.tool, value: t.total }));
  const modelItems   = models.map(m => ({ label: `${m.provider}/${m.model_id}`, value: m.uses }));
  const projectItems = projects.map(p => ({ label: p.project, value: p.inputs }));

  const toolsChart       = svgBarChart(toolItems,    { width: 480, barColor: "#58a6ff" });
  const modelsLeaderboard = htmlLeaderboard(modelItems);
  const projectsChart    = svgBarChart(projectItems, { width: 980, barColor: "#3fb950", rowH: 32 });
  const tokenGraph    = svgSparkline(daily, { width: 980 });

  /* recent sessions table rows */
  const recentRows = recent.map(s => `
    <tr>
      <td>${fmtDate(s.started_at)}</td>
      <td>${escHtml(s.cwd?.split("/").pop() ?? "—")}</td>
      <td class="num">${s.inputs ?? 0}</td>
      <td class="num">${s.turns}</td>
      <td class="num">${fmtTokens(s.tokens)}</td>
      <td class="num cost">${fmtCost(s.cost)}</td>
      <td class="num">${fmtMs(s.duration ?? 0)}</td>
    </tr>`).join("\n");

  /* ── HTML ── */
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pi stats</title>
  <style>
    :root {
      --bg:       #0d1117;
      --card:     #161b22;
      --border:   #30363d;
      --accent:   #58a6ff;
      --text:     #c9d1d9;
      --muted:    #8b949e;
      --success:  #3fb950;
      --purple:   #a371f7;
      --warning:  #d29922;
      font-size: 14px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 24px;
      max-width: 1080px;
      margin: 0 auto;
    }
    header {
      display: flex;
      align-items: baseline;
      gap: 16px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    header h1 { color: var(--accent); font-size: 22px; }
    header .meta { color: var(--muted); font-size: 12px; }

    .week-label {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 12px;
      color: var(--muted);
    }

    /* summary cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    @media (max-width: 720px) { .cards { grid-template-columns: repeat(2, 1fr); } }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card .label { font-size: 11px; color: var(--muted); text-transform: uppercase;
                   letter-spacing: .06em; margin-bottom: 6px; }
    .card .value { font-size: 22px; font-weight: 700; color: var(--text); }
    .card .value.cost  { color: var(--success); }
    .card .value.time  { color: var(--warning); }

    /* section headings */
    h2 { font-size: 13px; color: var(--muted); text-transform: uppercase;
         letter-spacing: .07em; margin-bottom: 12px; }

    /* two-col charts */
    .charts-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    @media (max-width: 640px) { .charts-2col { grid-template-columns: 1fr; } }

    .chart-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
    }
    .chart-box svg { display: block; max-width: 100%; }

    /* full-width boxes */
    .chart-full {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      overflow-x: auto;
    }
    .chart-full svg { display: block; max-width: 100%; }

    /* table */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left;
      padding: 6px 10px;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      font-weight: 500;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    td { padding: 7px 10px; border-bottom: 1px solid #21262d; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #1c2128; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
    td.cost { color: var(--success) !important; }

    footer { text-align: center; color: var(--muted); font-size: 11px; margin-top: 32px;
             padding-top: 16px; border-top: 1px solid var(--border); }
    .svg-label { font-family: monospace !important; }
  </style>
</head>
<body>
  <header>
    <h1>pi stats</h1>
    <span class="week-label">this week: ${escHtml(weekLabel)}</span>
    <span class="meta">generated ${escHtml(generatedAt)}</span>
  </header>

  <!-- week summary cards -->
  <div class="cards">
    <div class="card">
      <div class="label">inputs</div>
      <div class="value">${weekly.inputs}</div>
    </div>
    <div class="card">
      <div class="label">sessions</div>
      <div class="value">${weekly.sessions}</div>
    </div>
    <div class="card">
      <div class="label">tokens</div>
      <div class="value">${fmtTokens(weekly.tokens)}</div>
    </div>
    <div class="card">
      <div class="label">active time</div>
      <div class="value time">${fmtMs(weekly.timeMs)}</div>
    </div>
    <div class="card">
      <div class="label">est. cost</div>
      <div class="value cost">${fmtCost(weekly.cost)}</div>
    </div>
  </div>

  <!-- tools + models side by side -->
  <div class="charts-2col">
    <div class="chart-box">
      <h2>tools — last 7 days</h2>
      ${toolsChart || "<p style='color:var(--muted)'>No data yet</p>"}
    </div>
    <div class="chart-box">
      <h2>models — leaderboard</h2>
      ${modelsLeaderboard}
    </div>
  </div>

  <!-- top projects -->
  <div class="chart-full">
    <h2>top projects</h2>
    ${projectsChart || "<p style='color:var(--muted)'>No data yet</p>"}
  </div>

  <!-- token timeline -->
  <div class="chart-full">
    <h2>token usage — last ${daily.length} days</h2>
    ${tokenGraph || "<p style='color:var(--muted)'>No data yet</p>"}
  </div>

  <!-- recent sessions -->
  <div class="chart-full">
    <h2>recent sessions</h2>
    <table>
      <thead>
        <tr>
          <th>date</th>
          <th>project</th>
          <th style="text-align:right">inputs</th>
          <th style="text-align:right">turns</th>
          <th style="text-align:right">tokens</th>
          <th style="text-align:right">cost</th>
          <th style="text-align:right">duration</th>
        </tr>
      </thead>
      <tbody>
        ${recentRows || `<tr><td colspan="7" style="color:var(--muted);text-align:center">No sessions yet</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- all-time summary (small) -->
  <div class="chart-full" style="display:flex;gap:32px;align-items:center">
    <div>
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
                  letter-spacing:.06em;margin-bottom:4px">all-time sessions</div>
      <div style="font-size:20px;font-weight:700">${overall.totalSessions}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
                  letter-spacing:.06em;margin-bottom:4px">all-time tokens</div>
      <div style="font-size:20px;font-weight:700">${fmtTokens(overall.totalTokens)}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
                  letter-spacing:.06em;margin-bottom:4px">all-time turns</div>
      <div style="font-size:20px;font-weight:700">${overall.totalTurns}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
                  letter-spacing:.06em;margin-bottom:4px">all-time est. cost</div>
      <div style="font-size:20px;font-weight:700;color:var(--success)">${fmtCost(overall.totalCost)}</div>
    </div>
  </div>

  <footer>pi stats &bull; generated by the stats extension</footer>
</body>
</html>`;
}
