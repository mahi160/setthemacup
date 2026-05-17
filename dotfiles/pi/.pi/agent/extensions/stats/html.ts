/**
 * html.ts — Pre-rendered static HTML dashboard.
 *
 * All data is server-side rendered. No React, no Babel.
 * Inline JS for theme toggle, period toggle, and PNG share.
 * html-to-image (tiny, ~10kb) for share card → clipboard PNG.
 */

import type {
  DailyCost,
  DailyStat,
  DurationBucket,
  ModelEfficiency,
  OverallStats,
  ProjectStat,
  RecentSession,
  TokenBreakdown,
  TokenWasteEntry,
  ToolStat,
  WeeklyStat,
  CacheRatio,
  CompactionRecord,
  ErrorRecord,
} from "./db.js";
import { fmtTokens, fmtCost, fmtMs, fmtDate, fmtPct, escHtml } from "./format.js";
import { GRUVBOX_CSS } from "./themes/gruvbox.css.js";

// ── Report data interface ─────────────────────────────────────────────────────

export interface ReportData {
  generatedAt: string;
  today: WeeklyStat;
  week: WeeklyStat;
  overall: OverallStats;
  tools: ToolStat[];
  models: ModelEfficiency[];
  projects: ProjectStat[];
  daily: DailyStat[];
  dailyCost: DailyCost[];
  recent: RecentSession[];
  histogram: DurationBucket[];
  waste: TokenWasteEntry[];
  tokenBreakdown: TokenBreakdown;
  cacheRatio: CacheRatio;
  compactions: CompactionRecord[];
  compactionSummary: { total: number; tokensSaved: number };
  errorSummary: { total: number; today: number };
  errors: ErrorRecord[];
  streak: number;
  toolless: { total: number; toolless: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
};

const fmt$ = (n: number): string => n <= 0 ? "$0" : n < 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
const fmtTime = (ms: number): string => {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${ss}s`;
  return `${ss}s`;
};

function barList(rows: { label: string; value: number }[], max: number, color: string): string {
  if (!rows.length) return `<div class="muted" style="padding:8px 0">No data</div>`;
  return `<ul class="bar-list">${rows.map(r => {
    const pct = Math.max(2, (r.value / Math.max(max, 1)) * 100);
    return `<li class="bar-row"><div class="bar-label">${escHtml(r.label)}</div><div class="bar-track"><div class="bar-fill bar-${color}" style="width:${pct.toFixed(1)}%"></div></div><div class="bar-value">${r.value}</div></li>`;
  }).join("")}</ul>`;
}

function card(title: string, hint: string, content: string, span: number, scroll = false): string {
  return `<section class="card" style="grid-column:span ${span}"><header class="card-head"><h3>${escHtml(title)}</h3>${hint ? `<span class="card-hint">${escHtml(hint)}</span>` : ""}</header><div class="card-body${scroll ? " scroll" : ""}">${content}</div></section>`;
}

// ── Hero section ──────────────────────────────────────────────────────────────

function heroSection(id: string, label: string, data: WeeklyStat, streak: number, chatPct: number, cachePct: string): string {
  const stats = [
    { label: "inputs",    value: fmtNum(data.inputs),    cls: "" },
    { label: "sessions",  value: String(data.sessions),  cls: "" },
    { label: "tokens",    value: fmtNum(data.tokens),    cls: "" },
    { label: "cost",      value: fmt$(data.cost),         cls: "stat-hi" },
    { label: "active",    value: fmtTime(data.timeMs),   cls: "" },
    { label: "streak",    value: `${streak}d`,            cls: "stat-accent" },
    { label: "cache hit", value: cachePct,                cls: "stat-good" },
  ];
  const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `<section class="hero" id="${id}"><div class="hero-head"><div class="eyebrow">${escHtml(label)}</div><div class="hero-date">${escHtml(date)}</div></div><div class="hero-grid">${stats.map(s =>
    `<div class="stat ${s.cls}"><div class="stat-val">${escHtml(s.value)}</div><div class="stat-lbl">${escHtml(s.label)}</div></div>`
  ).join("")}</div></section>`;
}

// ── Token breakdown + efficiency (combined card) ─────────────────────────────

function tokenAndEfficiencyCard(
  tb: TokenBreakdown,
  cache: CacheRatio,
  comp: { total: number; tokensSaved: number },
  errSum: { total: number; today: number },
  span: number,
): string {
  const total = tb.input + tb.output + tb.cacheRead + tb.cacheWrite;

  const segs = [
    { label: "Input",       value: tb.input,      color: "var(--yellow)" },
    { label: "Output",      value: tb.output,     color: "var(--orange)" },
    { label: "Cache Read",  value: tb.cacheRead,  color: "var(--green)" },
    { label: "Cache Write", value: tb.cacheWrite, color: "var(--blue)" },
  ];

  const bar = total > 0
    ? `<div class="tok-bar">${segs.map(s => {
        const pct = (s.value / total) * 100;
        return pct > 0 ? `<div class="tok-seg" style="width:${pct.toFixed(1)}%;background:${s.color}"></div>` : "";
      }).join("")}</div>
      <div class="tok-legend">${segs.map(s =>
        `<div class="tok-legend-item"><div class="tok-dot" style="background:${s.color}"></div>${escHtml(s.label)}: ${fmtNum(s.value)}</div>`
      ).join("")}</div>`
    : `<div class="muted" style="margin-bottom:8px">No token data yet</div>`;

  const rows = [
    { label: "Cache hit ratio", value: fmtPct(cache.ratio) },
    { label: "Cache tokens read", value: fmtNum(cache.cacheRead) },
    { label: "Compactions", value: String(comp.total) },
    { label: "Tokens saved", value: fmtNum(comp.tokensSaved) },
    { label: "Total errors", value: String(errSum.total) },
    { label: "Errors today", value: String(errSum.today) },
  ];
  const stats = `<div class="mini-stats" style="margin-top:14px">${rows.map(r =>
    `<div class="mini-row"><span class="mini-label">${escHtml(r.label)}</span><span class="mini-value">${escHtml(r.value)}</span></div>`
  ).join("")}</div>`;

  return card("tokens & efficiency", "breakdown · cache · errors", bar + stats, span);
}

// ── Combined daily chart (tokens + cost in tooltip) ───────────────────────────

function dailyChart(tokens: DailyStat[], costs: DailyCost[], span: number): string {
  if (!tokens.length) return card("daily usage", "", `<div class="muted">No data</div>`, span);

  const totalTok = tokens.reduce((s, d) => s + d.tokens, 0);
  const totalCost = costs.reduce((s, d) => s + d.cost, 0);
  const maxTok = Math.max(...tokens.map(d => d.tokens), 1);
  const costByDay = new Map(costs.map(c => [c.day, c.cost]));

  const bars = tokens.map((d, i) => {
    const h = Math.max(3, (d.tokens / maxTok) * 100);
    const cls = i === tokens.length - 1 ? " today" : "";
    const dayCost = costByDay.get(d.day) ?? 0;
    const tooltip = `${escHtml(d.day)}: ${fmtNum(d.tokens)} tok · ${fmt$(dayCost)}`;
    return `<div class="dc-col" title="${tooltip}"><div class="dc-bar${cls}" style="height:${h.toFixed(1)}%"></div></div>`;
  }).join("");

  const firstDay = tokens[0]!.day;
  const lastDay = tokens[tokens.length - 1]!.day;
  const axis = `<div class="daily-axis"><span>${escHtml(firstDay)}</span><span class="muted">peak ${fmtNum(maxTok)}</span><span>${escHtml(lastDay)}</span></div>`;
  const title = `daily usage — ${fmtNum(totalTok)} tok · ${fmt$(totalCost)}`;
  return card(title, `last ${tokens.length} days`, `<div class="daily-wrap"><div class="daily-chart">${bars}</div>${axis}</div>`, span);
}

// ── Tables ────────────────────────────────────────────────────────────────────

function modelsTable(models: ReportData["models"], span: number): string {
  if (!models.length) return "";
  const head = `<tr><th style="width:15%">provider</th><th style="width:22%">model</th><th class="r" style="width:10%">inputs</th><th class="r" style="width:13%">avg tok</th><th class="r" style="width:13%">avg time</th><th class="r" style="width:12%">$/inp</th><th class="r" style="width:15%">total</th></tr>`;
  const rows = models.map(m =>
    `<tr><td class="muted">${escHtml(m.provider)}</td><td>${escHtml(m.model_id)}</td><td class="r">${m.inputs}</td><td class="r">${fmtNum(m.avgTokens)}</td><td class="r">${m.avgTimeSec.toFixed(1)}s</td><td class="r">${m.costPerInput < 0.01 && m.costPerInput > 0 ? "&lt;$0.01" : fmt$(m.costPerInput)}</td><td class="r cost">${fmt$(m.totalCost)}</td></tr>`
  ).join("");
  return card("models", "ranked by inputs", `<div class="t-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`, span);
}

function recentTable(recent: RecentSession[], span: number): string {
  if (!recent.length) return "";
  const head = `<tr><th>date</th><th>project</th><th class="r">turns</th><th class="r">tokens</th><th class="r">cost</th><th class="r">dur</th></tr>`;
  const rows = recent.map(s =>
    `<tr><td class="muted">${fmtDate(s.started_at)}</td><td>${escHtml(s.cwd?.split("/").pop() ?? "—")}</td><td class="r">${s.turns}</td><td class="r">${fmtNum(s.tokens)}</td><td class="r cost">${fmt$(s.cost)}</td><td class="r muted">${fmtMs(s.duration ?? 0)}</td></tr>`
  ).join("");
  return card("recent sessions", "", `<div class="t-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`, span);
}

function wasteTable(waste: TokenWasteEntry[], span: number): string {
  if (!waste.length) return "";
  const head = `<tr><th>date</th><th>model</th><th class="r">tokens</th><th class="r">time</th></tr>`;
  const rows = waste.map(w =>
    `<tr><td class="muted">${fmtDate(w.started_at)}</td><td>${escHtml(w.model_id)}</td><td class="r warn">${fmtNum(w.tokens_used)}</td><td class="r muted">${fmtMs(w.time_ms)}</td></tr>`
  ).join("");
  return card("high-token no-tool inputs", "", `<div class="t-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`, span);
}

function errorsTable(errors: ErrorRecord[], span: number): string {
  if (!errors.length) return "";
  const head = `<tr><th>date</th><th>model</th><th>type</th><th>message</th></tr>`;
  const rows = errors.slice(0, 10).map(e =>
    `<tr><td class="muted">${fmtDate(e.occurredAt)}</td><td>${escHtml(e.modelId)}</td><td>${escHtml(e.errorType)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${escHtml(e.message.slice(0, 80))}</td></tr>`
  ).join("");
  return card("recent errors", "", `<div class="t-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`, span);
}

// ── Build HTML ────────────────────────────────────────────────────────────────

export function buildHtml(d: ReportData): string {
  const chatOnlyPct = d.toolless.total > 0 ? Math.round((d.toolless.toolless / d.toolless.total) * 100) : 0;
  const cachePct = fmtPct(d.cacheRatio.ratio);
  const toolMax = Math.max(...d.tools.map(t => t.total), 1);
  const projMax = Math.max(...d.projects.map(p => p.inputs), 1);
  const respMax = Math.max(...d.histogram.map(r => r.count), 1);
  const date = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>π stats</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.js"></script>
<style>${GRUVBOX_CSS}</style>
</head>
<body>
<div class="page">

<!-- TOPBAR -->
<header class="topbar">
  <div class="topbar-l">
    <div class="brand"><span class="pi">π</span><span class="brand-name">stats</span></div>
    <span class="dot">·</span>
    <span class="muted">ai usage dashboard</span>
  </div>
  <div class="topbar-r">
    <button class="toggle on" data-period="today">today</button>
    <button class="toggle" data-period="week">week</button>
    <button class="toggle" id="theme-toggle">◑ theme</button>
    <button class="toggle share-btn" id="share-btn">↥ share</button>
  </div>
</header>

<!-- HERO: today (default visible) -->
${heroSection("hero-today", "today's usage", d.today, d.streak, chatOnlyPct, cachePct)}

<!-- HERO: week (hidden by default) -->
<div id="hero-week" style="display:none">
${heroSection("hero-week-inner", "this week", d.week, d.streak, chatOnlyPct, cachePct)}
</div>

<!-- GRID -->
<main class="grid">
${card("tools", "7 days", barList(d.tools.map(t => ({ label: t.tool, value: t.total })), toolMax, "yellow"), 4)}
${card("response times", "all-time", barList(d.histogram.map(r => ({ label: r.label, value: r.count })), respMax, "aqua"), 4)}
${card("projects", "all-time", barList(d.projects.map(p => ({ label: p.project, value: p.inputs })), projMax, "orange"), 4, true)}

${dailyChart(d.daily, d.dailyCost, 6)}
${tokenAndEfficiencyCard(d.tokenBreakdown, d.cacheRatio, d.compactionSummary, d.errorSummary, 6)}

${modelsTable(d.models, 12)}
${recentTable(d.recent, d.waste.length > 0 ? 7 : 12)}
${wasteTable(d.waste, d.recent.length > 0 ? 5 : 12)}
${errorsTable(d.errors, 12)}
</main>

<!-- HIDDEN SHARE CARD (for PNG capture) -->
<div id="share-wrap" style="position:fixed;left:-9999px;top:0">
  <div id="share-card" class="share-card">
    <div class="sc-gradient"></div>
    <div class="sc-inner">
      <div class="sc-brand">
        <div class="sc-logo">π</div>
        <div class="sc-brand-text">
          <div class="sc-title">Today's Vibe Check</div>
          <div class="sc-date">${escHtml(date)}</div>
        </div>
      </div>
      <div class="sc-grid">
        <div class="sc-stat">
          <div class="sc-val">${fmtNum(d.today.inputs)}</div>
          <div class="sc-lbl">prompts shipped</div>
        </div>
        <div class="sc-stat">
          <div class="sc-val">${fmtNum(d.today.tokens)}</div>
          <div class="sc-lbl">tokens burned</div>
        </div>
        <div class="sc-stat">
          <div class="sc-val sc-cost">${fmt$(d.today.cost)}</div>
          <div class="sc-lbl">cost of vibes</div>
        </div>
        <div class="sc-stat">
          <div class="sc-val sc-streak">${d.streak}d 🔥</div>
          <div class="sc-lbl">streak</div>
        </div>
        <div class="sc-stat">
          <div class="sc-val">${fmtTime(d.today.timeMs)}</div>
          <div class="sc-lbl">active time</div>
        </div>
        <div class="sc-stat">
          <div class="sc-val sc-cache">${cachePct}</div>
          <div class="sc-lbl">cache hit</div>
        </div>
      </div>
      <div class="sc-foot">
        <span>π stats</span>
        <span>powered by mass-approving AI suggestions</span>
      </div>
    </div>
  </div>
</div>

<!-- FOOTER -->
<footer class="footer">
  <div class="footer-l">
    <div class="eyebrow">all-time</div>
    <div class="footer-stats">
      <div class="fs"><span class="v">${d.overall.totalSessions}</span><span class="l">sessions</span></div>
      <div class="fs"><span class="v">${d.overall.totalInputs}</span><span class="l">inputs</span></div>
      <div class="fs"><span class="v">${d.overall.totalTurns}</span><span class="l">turns</span></div>
      <div class="fs"><span class="v">${fmtNum(d.overall.totalTokens)}</span><span class="l">tokens</span></div>
      <div class="fs"><span class="v cost">${fmt$(d.overall.totalCost)}</span><span class="l">cost</span></div>
    </div>
  </div>
  <div class="footer-r">
    <div class="brand" style="font-size:13px;gap:6px"><span class="pi" style="font-size:15px">π</span><span class="brand-name">stats</span></div>
    <span class="dot">·</span>
    <span class="muted">${escHtml(d.generatedAt)}</span>
  </div>
</footer>

</div>

<script>
// Theme toggle
document.getElementById("theme-toggle").onclick=function(){
  var t=document.documentElement.dataset.theme==="dark"?"light":"dark";
  document.documentElement.dataset.theme=t;
  try{localStorage.setItem("pi.theme",t)}catch(e){}
};
try{var st=localStorage.getItem("pi.theme");if(st)document.documentElement.dataset.theme=st}catch(e){}

// Period toggle
document.querySelectorAll("[data-period]").forEach(function(btn){
  btn.onclick=function(){
    var p=btn.dataset.period;
    document.getElementById("hero-today").style.display=p==="today"?"":"none";
    document.getElementById("hero-week").style.display=p==="week"?"":"none";
    document.querySelectorAll("[data-period]").forEach(function(b){b.classList.toggle("on",b===btn)});
  };
});

// Share as PNG to clipboard
document.getElementById("share-btn").onclick=async function(){
  var btn=this;
  var wrap=document.getElementById("share-wrap");
  var card=document.getElementById("share-card");
  btn.textContent="↥ capturing…";
  try {
    // Briefly make visible for capture
    wrap.style.position="absolute";
    wrap.style.left="0";
    wrap.style.top="0";
    wrap.style.zIndex="-1";
    wrap.style.opacity="0";

    var dataUrl=await htmlToImage.toPng(card,{
      pixelRatio:2,
      cacheBust:true,
      backgroundColor:document.documentElement.dataset.theme==="light"?"#fbf1c7":"#1d2021"
    });

    wrap.style.position="fixed";
    wrap.style.left="-9999px";
    wrap.style.opacity="";
    wrap.style.zIndex="";

    var res=await fetch(dataUrl);
    var blob=await res.blob();
    await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
    btn.textContent="✓ copied!";
  } catch(e) {
    wrap.style.position="fixed";
    wrap.style.left="-9999px";
    btn.textContent="✗ failed";
    console.error(e);
  }
  setTimeout(function(){btn.textContent="↥ share"},2000);
};
</script>
</body>
</html>`;
}
