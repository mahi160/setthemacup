import type {
  DailyStat,
  ModelStat,
  OverallStats,
  ProjectStat,
  RecentSession,
  ToolStat,
  WeeklyStat,
} from "./db.js";
import {
  fmtTokens,
  fmtCost,
  fmtMs,
  fmtDate,
  fmtDateShort,
  escHtml,
} from "./format.js";

/* ─── chart builders ──────────────────────────────────────────────────────── */

function htmlLeaderboard(
  items: Array<{ label: string; value: number; unit?: string }>,
): string {
  if (!items.length) return `<p class="empty">No data yet</p>`;
  const medals = ["🥇", "🥈", "🥉"];
  return `<div class="leaderboard">${items
    .map((item, i) => {
      const rank = medals[i] ?? `<span class="rank-num">#${i + 1}</span>`;
      const pct = Math.round((item.value / (items[0]!.value || 1)) * 100);
      return `
      <div class="lb-row">
        <span class="lb-rank">${rank}</span>
        <span class="lb-label" title="${escHtml(item.label)}">${escHtml(item.label)}</span>
        <span class="lb-value">${item.value}</span>
        <span class="lb-unit">${item.unit ?? "inputs"}</span>
        <div class="lb-bar"><div class="lb-fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("")}</div>`;
}

function svgBarChart(
  items: Array<{ label: string; value: number }>,
  opts: { width?: number; rowH?: number; color?: string },
): string {
  if (!items.length) return `<p class="empty">No data yet</p>`;
  const w = opts.width ?? 600;
  const rowH = opts.rowH ?? 28;
  const color = opts.color ?? "var(--accent)";
  const max = Math.max(...items.map((i) => i.value), 1);
  const labelW = 160,
    numW = 48;
  const barArea = w - labelW - numW - 16;
  const h = items.length * rowH + 8;

  const bars = items
    .map((item, i) => {
      const y = i * rowH + 4;
      const bw = Math.round((item.value / max) * barArea);
      return `
      <text x="${labelW - 8}" y="${y + rowH * 0.65}" fill="var(--text)" font-size="12"
            text-anchor="end" font-family="var(--mono)">${escHtml(item.label)}</text>
      <rect x="${labelW}" y="${y + 4}" width="${barArea}" height="${rowH - 12}"
            fill="var(--border)" rx="3"/>
      <rect x="${labelW}" y="${y + 4}" width="${bw}" height="${rowH - 12}"
            fill="${color}" rx="3"/>
      <text x="${labelW + barArea + 6}" y="${y + rowH * 0.65}" fill="var(--muted)" font-size="11"
            font-family="var(--mono)">${item.value}</text>`;
    })
    .join("");

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function svgSparkline(
  items: DailyStat[],
  opts: { width?: number; height?: number },
): string {
  if (items.length < 2) return "";
  const w = opts.width ?? 700,
    h = opts.height ?? 80;
  const max = Math.max(...items.map((d) => d.tokens), 1);
  const pad = 4,
    ah = h - pad * 2 - 16,
    aw = w - pad * 2;

  const pts = items.map((d, i) => {
    const x = pad + (i / (items.length - 1)) * aw;
    const y = pad + ah - (d.tokens / max) * ah;
    return `${x},${y}`;
  });

  const [fx] = pts[0]!.split(",");
  const [lx] = pts.at(-1)!.split(",");

  return `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="M${fx},${pad + ah} L${pts.join(" L")} L${lx},${pad + ah} Z" fill="url(#sparkGrad)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2"
                stroke-linejoin="round" stroke-linecap="round"/>
      <text x="${pad}" y="${h}" fill="var(--muted)" font-size="10"
            font-family="var(--mono)">${items[0]!.day}</text>
      <text x="${w - pad}" y="${h}" fill="var(--muted)" font-size="10"
            font-family="var(--mono)" text-anchor="end">${items.at(-1)!.day}</text>
    </svg>`;
}

/* ─── main builder ────────────────────────────────────────────────────────── */

export function buildHtmlDashboard(
  overall: OverallStats,
  weekly: WeeklyStat,
  tools: ToolStat[],
  models: ModelStat[],
  projects: ProjectStat[],
  daily: DailyStat[],
  recent: RecentSession[],
  weekStart: number,
  weekEnd: number,
): string {
  const generated = new Date().toLocaleString();
  const weekLabel = `${fmtDateShort(weekStart)} – ${fmtDateShort(weekEnd)}`;

  const toolsChart = svgBarChart(
    tools.map((t) => ({ label: t.tool, value: t.total })),
    { width: 480 },
  );
  const modelsBoard = htmlLeaderboard(
    models.map((m) => ({
      label: `${m.provider}/${m.model_id}`,
      value: m.uses,
    })),
  );
  const projectsChart = svgBarChart(
    projects.map((p) => ({ label: p.project, value: p.inputs })),
    { width: 980, color: "var(--green)", rowH: 32 },
  );
  const tokenGraph = svgSparkline(daily, { width: 980 });

  const recentRows = recent.length
    ? recent
        .map(
          (s) => `
        <tr>
          <td>${fmtDate(s.started_at)}</td>
          <td>${escHtml(s.cwd?.split("/").pop() ?? "—")}</td>
          <td class="num">${s.inputs ?? 0}</td>
          <td class="num">${s.turns}</td>
          <td class="num">${fmtTokens(s.tokens)}</td>
          <td class="num cost">${fmtCost(s.cost)}</td>
          <td class="num">${fmtMs(s.duration ?? 0)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="empty">No sessions yet</td></tr>`;

  const summaryCard = (label: string, value: string, cls = "") =>
    `<div class="card"><div class="card-label">${label}</div><div class="card-value ${cls}">${value}</div></div>`;

  const allTimeItem = (label: string, value: string, cls = "") =>
    `<div><div class="at-label">${label}</div><div class="at-value ${cls}">${value}</div></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pi stats</title>
  <style>
    :root {
      --bg: #0d1117; --surface: #161b22; --border: #30363d;
      --accent: #58a6ff; --text: #c9d1d9; --muted: #8b949e;
      --green: #3fb950; --yellow: #d29922;
      --mono: ui-monospace, "SF Mono", "Cascadia Mono", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      --radius: 10px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg); color: var(--text); font-family: var(--sans);
      padding: 32px 24px; max-width: 1080px; margin: 0 auto; line-height: 1.5;
    }

    /* header */
    header { display: flex; align-items: baseline; gap: 16px; padding-bottom: 20px;
             border-bottom: 1px solid var(--border); margin-bottom: 24px; }
    header h1 { color: var(--accent); font-size: 22px; font-weight: 700; }
    .badge { background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
             padding: 3px 14px; font-size: 12px; color: var(--muted); }
    .meta { color: var(--muted); font-size: 12px; margin-left: auto; }

    /* cards grid */
    .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
    .card { background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--radius); padding: 18px 16px; }
    .card-label { font-size: 11px; color: var(--muted); text-transform: uppercase;
                  letter-spacing: 0.06em; margin-bottom: 6px; }
    .card-value { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .card-value.cost { color: var(--green); }
    .card-value.time { color: var(--yellow); }

    /* sections */
    h2 { font-size: 12px; color: var(--muted); text-transform: uppercase;
         letter-spacing: 0.08em; margin-bottom: 14px; font-weight: 600; }
    .panel { background: var(--surface); border: 1px solid var(--border);
             border-radius: var(--radius); padding: 20px; margin-bottom: 16px; overflow-x: auto; }
    .panel svg { display: block; max-width: 100%; }

    /* 2-col layout */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    /* leaderboard */
    .leaderboard { display: flex; flex-direction: column; gap: 2px; }
    .lb-row { display: flex; align-items: center; gap: 10px; padding: 7px 0;
              border-bottom: 1px solid var(--border); }
    .lb-row:last-child { border-bottom: none; }
    .lb-rank { width: 28px; text-align: center; font-size: 15px; flex-shrink: 0; }
    .rank-num { color: var(--muted); font-size: 12px; }
    .lb-label { flex: 1; font-family: var(--mono); font-size: 12px; overflow: hidden;
                text-overflow: ellipsis; white-space: nowrap; }
    .lb-value { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent);
                flex-shrink: 0; }
    .lb-unit { color: var(--muted); font-size: 11px; flex-shrink: 0; }
    .lb-bar { width: 60px; height: 6px; background: var(--border); border-radius: 3px;
              flex-shrink: 0; }
    .lb-fill { height: 6px; background: var(--accent); border-radius: 3px; }

    /* table */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 6px 10px; color: var(--muted); font-weight: 500;
         font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
         border-bottom: 1px solid var(--border); }
    td { padding: 8px 10px; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .num { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted);
           font-family: var(--mono); }
    .cost { color: var(--green) !important; }

    /* all-time strip */
    .at-strip { display: flex; gap: 40px; align-items: center; flex-wrap: wrap; }
    .at-label { font-size: 11px; color: var(--muted); text-transform: uppercase;
                letter-spacing: 0.06em; margin-bottom: 4px; }
    .at-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }

    .empty { color: var(--muted); text-align: center; padding: 12px 0; }

    footer { text-align: center; color: var(--muted); font-size: 11px; margin-top: 32px;
             padding-top: 16px; border-top: 1px solid var(--border); }

    @media (max-width: 720px) {
      .cards { grid-template-columns: repeat(2, 1fr); }
      .grid-2 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>pi stats</h1>
    <span class="badge">${escHtml(weekLabel)}</span>
    <span class="meta">${escHtml(generated)}</span>
  </header>

  <section class="cards">
    ${summaryCard("inputs", String(weekly.inputs))}
    ${summaryCard("sessions", String(weekly.sessions))}
    ${summaryCard("tokens", fmtTokens(weekly.tokens))}
    ${summaryCard("active time", fmtMs(weekly.timeMs), "time")}
    ${summaryCard("est. cost", fmtCost(weekly.cost), "cost")}
  </section>

  <section class="grid-2">
    <div class="panel">
      <h2>tools — last 7 days</h2>
      ${toolsChart}
    </div>
    <div class="panel">
      <h2>models — leaderboard</h2>
      ${modelsBoard}
    </div>
  </section>

  <section class="panel">
    <h2>top projects</h2>
    ${projectsChart}
  </section>

  <section class="panel">
    <h2>token usage — last ${daily.length} days</h2>
    ${tokenGraph || `<p class="empty">Not enough data yet</p>`}
  </section>

  <section class="panel">
    <h2>recent sessions</h2>
    <table>
      <thead>
        <tr>
          <th>date</th><th>project</th>
          <th class="num">inputs</th><th class="num">turns</th><th class="num">tokens</th>
          <th class="num">cost</th><th class="num">duration</th>
        </tr>
      </thead>
      <tbody>${recentRows}</tbody>
    </table>
  </section>

  <section class="panel">
    <div class="at-strip">
      ${allTimeItem("all-time sessions", String(overall.totalSessions))}
      ${allTimeItem("all-time tokens", fmtTokens(overall.totalTokens))}
      ${allTimeItem("all-time turns", String(overall.totalTurns))}
      ${allTimeItem("all-time est. cost", fmtCost(overall.totalCost), "cost")}
    </div>
  </section>

  <footer>pi stats · generated by the stats extension</footer>
</body>
</html>`;
}
