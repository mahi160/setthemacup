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
import { KANAGAWA_CSS } from "./themes/kanagawa.css.js";

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
  weekCacheRatio: CacheRatio;
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

function heroSection(id: string, label: string, data: WeeklyStat, streak: number, cachePct: string): string {
  const stats: Array<{ label: string; value: string; cls: string; tip: string }> = [
    { label: "inputs",    value: fmtNum(data.inputs),   cls: "",            tip: "User messages sent in this period" },
    { label: "sessions",  value: String(data.sessions), cls: "",            tip: "Sessions with at least one message in this period" },
    { label: "tokens",    value: fmtNum(data.tokens),   cls: "",            tip: "Total tokens across all API calls: input + output + cache read + cache write" },
    { label: "cost",      value: fmt$(data.cost),        cls: "stat-hi",     tip: "Estimated cost billed for this period" },
    { label: "active",    value: fmtTime(data.timeMs),  cls: "",            tip: "Total wall-clock time waiting for model responses" },
    { label: "streak",    value: `${streak}d`,           cls: "stat-accent", tip: "Consecutive days with at least one message" },
    { label: "cache hit", value: cachePct,               cls: "stat-good",   tip: "Cache read ÷ (cache read + fresh input). Higher means more context re-use — Anthropic bills cache reads at ~10% of fresh input cost" },
  ];
  const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `<section class="hero" id="${id}"><div class="hero-head"><div class="eyebrow">${escHtml(label)}</div><div class="hero-date">${escHtml(date)}</div></div><div class="hero-grid">${stats.map(s =>
    `<div class="stat ${s.cls}" title="${escHtml(s.tip)}"><div class="stat-val">${escHtml(s.value)}</div><div class="stat-lbl">${escHtml(s.label)}</div></div>`
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
        return pct > 0
          ? `<div class="tok-seg" style="width:${pct.toFixed(1)}%;background:${s.color}" title="${escHtml(s.label)}: ${fmtNum(s.value)} (${pct.toFixed(1)}%)"></div>`
          : "";
      }).join("")}</div>
      <div class="tok-legend">${segs.filter(s => s.value > 0).map(s => {
        const pct = ((s.value / total) * 100).toFixed(0);
        return `<div class="tok-legend-item"><div class="tok-dot" style="background:${s.color}"></div>${escHtml(s.label)}: ${fmtNum(s.value)} <span class="muted">${pct}%</span></div>`;
      }).join("")}</div>`
    : `<div class="muted" style="margin-bottom:8px">No token data yet</div>`;

  const cacheColor = cache.ratio > 0.5 ? "var(--green)" : cache.ratio > 0.2 ? "var(--yellow)" : "var(--mute)";
  const compColor  = comp.tokensSaved > 0 ? "var(--aqua)" : "var(--mute)";
  const errColor   = errSum.total === 0 ? "var(--green)" : errSum.today > 0 ? "var(--red)" : "var(--orange)";

  const tiles = [
    {
      val:   fmtPct(cache.ratio),
      lbl:   "cache hit",
      sub:   `${fmtNum(cache.cacheRead)} tokens from cache`,
      color: cacheColor,
      tip:   "Cache read ÷ (cache read + fresh input) for today. Anthropic bills cache reads at ~10% of fresh input cost — higher is cheaper.",
    },
    {
      val:   comp.tokensSaved > 0 ? fmtNum(comp.tokensSaved) : "—",
      lbl:   "tokens saved",
      sub:   `${comp.total} compaction${comp.total !== 1 ? "s" : ""}`,
      color: compColor,
      tip:   "Tokens avoided by context compaction (all-time). Compaction summarises long context to free up space without losing session continuity.",
    },
    {
      val:   errSum.total > 0 ? String(errSum.total) : "clean",
      lbl:   "errors",
      sub:   errSum.today > 0 ? `${errSum.today} today` : "none today",
      color: errColor,
      tip:   "Failed or aborted model requests (all-time). See the errors table below for details.",
    },
  ];

  const highlights = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0 2px">${
    tiles.map(t =>
      `<div style="padding:10px 12px;background:var(--bg2);border-radius:6px;border-left:3px solid ${t.color}" title="${escHtml(t.tip)}">
        <div style="font-size:20px;font-weight:700;color:${t.color};line-height:1.1;letter-spacing:-.02em">${escHtml(t.val)}</div>
        <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin-top:3px">${escHtml(t.lbl)}</div>
        <div style="font-size:11px;color:var(--fg3);margin-top:4px">${escHtml(t.sub)}</div>
      </div>`
    ).join("")
  }</div>`;

  return card("tokens & efficiency", "today · cache · health", bar + highlights, span);
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
  const head = `<tr>
    <th style="width:15%">provider</th>
    <th style="width:22%">model</th>
    <th class="r" style="width:10%" title="Number of user inputs that used this model">inputs</th>
    <th class="r" style="width:13%" title="Average total tokens per input (input + output + cache)">avg tok</th>
    <th class="r" style="width:13%" title="Average wall-clock time waiting for a response">avg time</th>
    <th class="r" style="width:12%" title="Average estimated cost per input">$/inp</th>
    <th class="r" style="width:15%" title="Total estimated cost across all inputs for this model">total</th>
  </tr>`;
  const rows = models.map(m =>
    `<tr><td class="muted">${escHtml(m.provider)}</td><td>${escHtml(m.model_id)}</td><td class="r">${m.inputs}</td><td class="r">${fmtNum(m.avgTokens)}</td><td class="r">${m.avgTimeSec.toFixed(1)}s</td><td class="r">${m.costPerInput < 0.01 && m.costPerInput > 0 ? "&lt;$0.01" : fmt$(m.costPerInput)}</td><td class="r cost">${fmt$(m.totalCost)}</td></tr>`
  ).join("");
  return card("models", "ranked by inputs", `<div class="t-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`, span);
}

function recentTable(recent: RecentSession[], span: number): string {
  if (!recent.length) return "";
  const head = `<tr>
    <th>date</th>
    <th>project</th>
    <th class="r" title="Agent turns — each turn is one round-trip to the model">turns</th>
    <th class="r" title="Total tokens consumed across all turns in this session (input + output + cache)">tokens</th>
    <th class="r" title="Estimated cost for this session">cost</th>
    <th class="r" title="Total wall-clock duration of the session">dur</th>
  </tr>`;
  const rows = recent.map(s =>
    `<tr><td class="muted">${fmtDate(s.started_at)}</td><td>${escHtml(s.cwd?.split("/").pop() ?? "—")}</td><td class="r">${s.turns}</td><td class="r">${fmtNum(s.tokens)}</td><td class="r cost">${fmt$(s.cost)}</td><td class="r muted">${fmtMs(s.duration ?? 0)}</td></tr>`
  ).join("");
  return card("recent sessions", "", `<div class="t-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`, span);
}

function wasteTable(waste: TokenWasteEntry[], span: number): string {
  if (!waste.length) return "";
  const head = `<tr>
    <th>date</th>
    <th>model</th>
    <th class="r" title="Total tokens consumed by this input (≥5k with no tool calls)">tokens</th>
    <th class="r" title="Wall-clock time for this input">time</th>
  </tr>`;
  const rows = waste.map(w =>
    `<tr><td class="muted">${fmtDate(w.started_at)}</td><td>${escHtml(w.model_id)}</td><td class="r warn">${fmtNum(w.tokens_used)}</td><td class="r muted">${fmtMs(w.time_ms)}</td></tr>`
  ).join("");
  return card("high-token no-tool inputs", "≥5k tok, 0 tool calls", `<div class="t-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`, span);
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
  const cachePct     = fmtPct(d.cacheRatio.ratio);
  const weekCachePct = fmtPct(d.weekCacheRatio.ratio);
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
<style>${KANAGAWA_CSS}</style>
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
${heroSection("hero-today", "today's usage", d.today, d.streak, cachePct)}

<!-- HERO: week (hidden by default) -->
<div id="hero-week" style="display:none">
${heroSection("hero-week-inner", "this week", d.week, d.streak, weekCachePct)}
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
      <div class="fs" title="Total sessions ever recorded"><span class="v">${d.overall.totalSessions}</span><span class="l">sessions</span></div>
      <div class="fs" title="Total user messages ever recorded"><span class="v">${d.overall.totalInputs}</span><span class="l">inputs</span></div>
      <div class="fs" title="Total agent turns (model round-trips) ever"><span class="v">${d.overall.totalTurns}</span><span class="l">turns</span></div>
      <div class="fs" title="Total tokens consumed ever (sum of all API calls)"><span class="v">${fmtNum(d.overall.totalTokens)}</span><span class="l">tokens</span></div>
      <div class="fs" title="Total estimated cost ever"><span class="v cost">${fmt$(d.overall.totalCost)}</span><span class="l">cost</span></div>
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
      backgroundColor:document.documentElement.dataset.theme==="light"?"#f2ecbc":"#16161d"
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
