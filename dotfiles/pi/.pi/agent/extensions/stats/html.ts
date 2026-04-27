import type { StatsData } from "./render.js";
import { fmtTokens, fmtCost, fmtMs, fmtDate, fmtDateShort, escHtml } from "./format.js";

/* ─── friendly model names ────────────────────────────────────────────────── */

const MODEL_NAMES: Record<string, { name: string; emoji: string }> = {
  "claude-sonnet-4-6": { name: "Sonnet 4.6", emoji: "🎵" },
  "claude-opus-4-6": { name: "Opus 4.6", emoji: "🎼" },
  "claude-haiku-4-5": { name: "Haiku 4.5", emoji: "🌸" },
  "claude-sonnet-4-20250514": { name: "Sonnet 4", emoji: "🎵" },
  "claude-opus-4-20250514": { name: "Opus 4", emoji: "🎼" },
  "claude-3-5-sonnet-20241022": { name: "Sonnet 3.5", emoji: "🎶" },
  "claude-3-5-haiku-20241022": { name: "Haiku 3.5", emoji: "🍃" },
  "gpt-4.1": { name: "GPT 4.1", emoji: "🧠" },
  "gpt-5-mini": { name: "GPT 5 Mini", emoji: "⚡" },
  gemma4: { name: "Gemma 4", emoji: "💎" },
  "deepseek-r1": { name: "DeepSeek R1", emoji: "🔍" },
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic", openai: "OpenAI", "github-copilot": "Copilot", ollama: "Ollama", google: "Google",
};

function pretty(provider: string, modelId: string) {
  const m = MODEL_NAMES[modelId];
  const prov = PROVIDER_LABELS[provider] ?? provider;
  if (m) return { label: m.name, emoji: m.emoji, prov };
  const clean = modelId.replace(/^claude-/, "").replace(/^gpt-/, "GPT ").replace(/-\d{8}$/, "");
  return { label: clean, emoji: "🤖", prov };
}

function pct(v: number, max: number): number { return max > 0 ? Math.round((v / max) * 100) : 0; }

/* ─── share card canvas ───────────────────────────────────────────────────── */

function buildShareScript(d: StatsData): string {
  const weekLabel = `${fmtDateShort(d.start)} – ${fmtDateShort(d.end)}`;
  const todayLabel = fmtDateShort(Date.now());
  const s = (v: unknown) => Number(v) || 0;
  const data = JSON.stringify({
    weekly: { inputs: s(d.weekly.inputs), sessions: s(d.weekly.sessions), tokens: s(d.weekly.tokens), timeMs: s(d.weekly.timeMs), cost: s(d.weekly.cost) },
    today: { inputs: s(d.today.inputs), sessions: s(d.today.sessions), tokens: s(d.today.tokens), timeMs: s(d.today.timeMs), cost: s(d.today.cost) },
    overall: { totalSessions: s(d.overall.totalSessions), totalTokens: s(d.overall.totalTokens), totalCost: s(d.overall.totalCost), totalTurns: s(d.overall.totalTurns), totalInputs: s(d.overall.totalInputs) },
    tools: d.tools.slice(0, 5).map(t => ({ tool: t.tool, total: s(t.total) })),
    models: d.models.slice(0, 3).map(m => { const p = pretty(m.provider, m.model_id); return { label: `${p.emoji} ${p.label}`, uses: s(m.uses) }; }),
    daily: d.daily.map(x => s(x.tokens)), streak: d.streak, weekLabel, todayLabel,
  });

  return `<script>
(function(){
var D=${data},DPR=Math.min(devicePixelRatio||1,3),W=660,H=460,mode='week';
var C={bg:'#1a1f16',surface:'#242a1e',border:'#3a4230',accent:'#7cb342',text:'#e8e4d9',muted:'#8a8672',green:'#81c784',yellow:'#dce775',purple:'#b39ddb',pink:'#f48fb1'};
var MO='"SF Mono","Cascadia Mono","Fira Code",monospace',SA='-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif';
function n(v){return Number(v)||0}
function fT(v){v=n(v);if(v>=1e6)return(v/1e6).toFixed(1)+'M';if(v>=1e3)return Math.round(v/1e3)+'k';return''+v}
function fC(v){v=n(v);if(v<=0)return'$0.00';if(v<.005)return'<$0.01';return'$'+v.toFixed(2)}
function fM(v){v=n(v);if(!v)return'\\u2014';var s=Math.floor(v/1e3),m=Math.floor(s/60),h=Math.floor(m/60);if(h)return h+'h '+m%60+'m';if(m)return m+'m '+s%60+'s';return s+'s'}
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
function draw(cv){
  cv.width=W*DPR;cv.height=H*DPR;var x=cv.getContext('2d');x.scale(DPR,DPR);
  var src=mode==='today'?D.today:D.weekly,lbl=mode==='today'?D.todayLabel:D.weekLabel;
  rr(x,0,0,W,H,20);x.fillStyle=C.bg;x.fill();
  var g1=x.createRadialGradient(W*.7,0,0,W*.7,0,W*.8);g1.addColorStop(0,C.accent+'12');g1.addColorStop(1,'transparent');x.fillStyle=g1;x.fill();
  var tg=x.createLinearGradient(32,0,W-32,0);tg.addColorStop(0,'transparent');tg.addColorStop(.3,C.accent+'70');tg.addColorStop(.7,C.green+'50');tg.addColorStop(1,'transparent');
  rr(x,32,1,W-64,2,1);x.fillStyle=tg;x.fill();
  rr(x,.5,.5,W-1,H-1,20);x.strokeStyle=C.border;x.lineWidth=1;x.stroke();
  x.font='bold 20px '+SA;x.fillStyle=C.accent;x.fillText('pi stats',32,38);
  var tw=mode==='today'?52:90;x.font='600 10px '+SA;rr(x,110,22,tw,20,10);x.fillStyle=C.accent+'20';x.fill();x.fillStyle=C.accent;x.fillText(mode==='today'?'TODAY':'THIS WEEK',118,36);
  x.font='500 11px '+SA;x.fillStyle=C.muted;x.fillText(lbl,32,56);
  if(D.streak>0){x.font='500 12px '+SA;x.fillStyle=C.yellow;x.textAlign='right';x.fillText('\\uD83D\\uDD25 '+D.streak+'d streak',W-32,36);x.textAlign='left'}
  var pills=[{l:'Inputs',v:''+src.inputs,c:C.text},{l:'Sessions',v:''+src.sessions,c:C.text},{l:'Tokens',v:fT(src.tokens),c:C.text},{l:'Active',v:fM(src.timeMs),c:C.yellow},{l:'Cost',v:fC(src.cost),c:C.green}];
  var pw=(W-64-4*10)/5,py=72;pills.forEach(function(p,i){var px=32+i*(pw+10);rr(x,px,py,pw,50,10);x.fillStyle=C.surface;x.fill();rr(x,px,py,pw,50,10);x.strokeStyle=C.border;x.lineWidth=.5;x.stroke();x.font='500 9px '+SA;x.fillStyle=C.muted;x.fillText(p.l.toUpperCase(),px+12,py+17);x.font='bold 17px '+SA;x.fillStyle=p.c;x.fillText(p.v,px+12,py+39)});
  var sy=140,sh=48,sx=32,sw=W-64;x.font='600 9px '+SA;x.fillStyle=C.muted;x.fillText('TOKEN USAGE',sx,sy);
  var vals=D.daily;if(vals.length>1){var mv=Math.max.apply(null,vals.concat([1]));var oy=sy+12;x.beginPath();x.moveTo(sx,oy+sh);vals.forEach(function(v,i){x.lineTo(sx+i/(vals.length-1)*sw,oy+sh-v/mv*sh)});x.lineTo(sx+sw,oy+sh);x.closePath();var sg=x.createLinearGradient(0,oy,0,oy+sh);sg.addColorStop(0,C.accent+'35');sg.addColorStop(1,C.accent+'05');x.fillStyle=sg;x.fill();x.beginPath();vals.forEach(function(v,i){var lx=sx+i/(vals.length-1)*sw,ly=oy+sh-v/mv*sh;i?x.lineTo(lx,ly):x.moveTo(lx,ly)});x.strokeStyle=C.accent;x.lineWidth=2;x.lineJoin='round';x.lineCap='round';x.stroke()}
  var cy=222;x.font='600 9px '+SA;x.fillStyle=C.muted;x.fillText('TOP TOOLS',32,cy);var mt=D.tools[0]?D.tools[0].total:1;
  D.tools.forEach(function(t,i){var ty=cy+14+i*24;x.font='11px '+MO;x.fillStyle=C.text;x.fillText(t.tool,40,ty+12);var bx=120,bw=140,bh=8;rr(x,bx,ty+5,bw,bh,4);x.fillStyle=C.border;x.fill();var fw=Math.round(t.total/mt*bw);if(fw>0){rr(x,bx,ty+5,fw,bh,4);x.fillStyle=C.accent;x.fill()}x.font='500 10px '+MO;x.fillStyle=C.muted;x.fillText(''+t.total,bx+bw+8,ty+13)});
  var mx=W/2+24;x.font='600 9px '+SA;x.fillStyle=C.muted;x.fillText('TOP MODELS',mx,cy);
  D.models.forEach(function(m,i){var ty=cy+14+i*28;x.font='13px '+SA;x.fillStyle=C.text;x.fillText(m.label,mx+4,ty+12);x.font='bold 11px '+MO;x.fillStyle=C.accent;x.fillText(''+m.uses,W-64,ty+12);x.font='500 9px '+SA;x.fillStyle=C.muted;x.fillText('inputs',W-40,ty+12)});
  var fy=H-64;rr(x,32,fy,W-64,44,10);x.fillStyle=C.surface;x.fill();rr(x,32,fy,W-64,44,10);x.strokeStyle=C.border;x.lineWidth=.5;x.stroke();
  [{l:'SESSIONS',v:''+D.overall.totalSessions,c:C.text},{l:'INPUTS',v:''+D.overall.totalInputs,c:C.text},{l:'TOKENS',v:fT(D.overall.totalTokens),c:C.text},{l:'EST. COST',v:fC(D.overall.totalCost),c:C.green}].forEach(function(a,i){var aw=(W-64-3*12)/4,ax=44+i*(aw+12);x.font='500 8px '+SA;x.fillStyle=C.muted;x.fillText(a.l,ax,fy+16);x.font='bold 14px '+SA;x.fillStyle=a.c;x.fillText(a.v,ax,fy+34)});
  x.font='500 9px '+SA;x.fillStyle=C.muted+'50';x.textAlign='right';x.fillText('pi stats',W-32,H-10);x.textAlign='left';
}
var cv=document.createElement('canvas');draw(cv);
var btn=document.getElementById('share-btn');
btn.addEventListener('click',function(){btn.disabled=true;cv.toBlob(function(b){if(!b){btn.disabled=false;return}if(typeof ClipboardItem!=='undefined'&&navigator.clipboard&&navigator.clipboard.write){navigator.clipboard.write([new ClipboardItem({'image/png':b})]).then(function(){btn.textContent='\\u2713 Copied!';setTimeout(function(){btn.textContent='\\uD83D\\uDCCB Copy card';btn.disabled=false},2200)}).catch(function(){fb(b)})}else{fb(b)}},'image/png')});
function fb(b){var a=document.createElement('a');a.download='pi-stats-'+new Date().toISOString().slice(0,10)+'.png';a.href=URL.createObjectURL(b);a.click();btn.textContent='\\u2B07 Downloaded!';setTimeout(function(){btn.textContent='\\uD83D\\uDCCB Copy card';btn.disabled=false},2200)}

// Theme toggle — init text and wire click
var tb=document.getElementById('theme-btn');
tb.textContent=document.documentElement.classList.contains('dark')?'\\u2600\\uFE0F Light':'\\uD83C\\uDF19 Dark';
tb.addEventListener('click',function(){
  var h=document.documentElement;
  h.classList.toggle('dark');
  localStorage.setItem('pi-theme',h.classList.contains('dark')?'dark':'light');
  this.textContent=h.classList.contains('dark')?'\\u2600\\uFE0F Light':'\\uD83C\\uDF19 Dark';
});

// Period toggle — swap visible stat sections
document.getElementById('period-btn').addEventListener('click',function(){
  var wk=document.getElementById('stats-week'),td=document.getElementById('stats-today');
  var isWeek=!wk.classList.contains('hidden');
  wk.classList.toggle('hidden',isWeek);td.classList.toggle('hidden',!isWeek);
  this.textContent=isWeek?'\\uD83D\\uDCC5 This Week':'\\u2600\\uFE0F Today';
  mode=isWeek?'today':'week';draw(cv);
});
})();
<\/script>`;
}

/* ─── main builder ────────────────────────────────────────────────────────── */

export function buildHtmlDashboard(data: StatsData): string {
  const { overall, weekly, today, tools, models, efficiency, projects, daily, recent,
          toolless, streak, histogram, waste, start, end } = data;

  const generated = new Date().toLocaleString();
  const weekLabel = `${fmtDateShort(start)} – ${fmtDateShort(end)}`;
  const todayLabel = fmtDateShort(Date.now());

  const pm = models.map(m => ({ ...m, ...pretty(m.provider, m.model_id) }));
  const pe = efficiency.map(e => ({ ...e, ...pretty(e.provider, e.model_id) }));
  const pw = waste.map(w => ({ ...w, ...pretty(w.provider, w.model_id) }));

  const maxTool = tools[0]?.total ?? 1;
  const maxModel = pm[0]?.uses ?? 1;
  const maxProj = projects[0]?.inputs ?? 1;
  const maxHist = Math.max(...histogram.map(b => b.count), 1);
  const toolUsed = toolless.total - (toolless.toolless ?? 0);
  const chatPct = toolless.total > 0 ? Math.round(((toolless.toolless ?? 0) / toolless.total) * 100) : 0;

  const spark = daily.length >= 2 ? (() => {
    const w = 900, h = 80, max = Math.max(...daily.map(d => d.tokens), 1);
    const px = 2, ah = h - px * 2, aw = w - px * 2;
    const pts = daily.map((d, i) => `${(px + (i / (daily.length - 1)) * aw).toFixed(1)},${(px + ah - (d.tokens / max) * ah).toFixed(1)}`);
    const [fx] = pts[0]!.split(","), [lx] = pts.at(-1)!.split(",");
    return `<svg viewBox="0 0 ${w} ${h}" class="w-full h-20" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7cb342" stop-opacity=".25"/><stop offset="100%" stop-color="#7cb342" stop-opacity="0"/></linearGradient></defs>
      <path d="M${fx},${px + ah} L${pts.join(" L")} L${lx},${px + ah} Z" fill="url(#sg)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="#7cb342" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  })() : "";

  const medals = ["🥇", "🥈", "🥉"];

  const statCard = (label: string, value: string | number, color = "") =>
    `<div class="card"><div class="card-label">${label}</div><div class="card-value ${color}">${value}</div></div>`;

  const shareScript = buildShareScript(data);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>pi stats</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
<style type="text/tailwindcss">
@custom-variant dark (&:where(.dark, .dark *));
@theme {
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", "Fira Code", monospace;
  --color-forest-50: #f4f7f0;
  --color-forest-100: #e8eee1;
  --color-forest-200: #d4dfc8;
  --color-forest-300: #b5c9a1;
  --color-forest-400: #8baa6e;
  --color-forest-500: #7cb342;
  --color-forest-600: #5a8a2a;
  --color-forest-700: #3d6b1a;
  --color-forest-800: #2a4d14;
  --color-forest-900: #1a2f0e;
  --color-forest-950: #0f1c08;
  --color-bark-50: #faf8f5;
  --color-bark-100: #f0ece5;
  --color-bark-200: #e0d8cb;
  --color-bark-300: #c9bda8;
  --color-bark-400: #a89578;
  --color-bark-500: #8a7a5e;
  --color-bark-600: #6b5e47;
  --color-bark-700: #4d4434;
  --color-bark-800: #332e24;
  --color-bark-900: #1f1c16;
  --color-bark-950: #13110e;
  --color-moss-50: #f0f5ee;
  --color-moss-100: #dfe9db;
  --color-moss-200: #c2d6ba;
  --color-moss-300: #9bbc8e;
  --color-moss-400: #6d9a5c;
  --color-moss-500: #4a7c3a;
  --color-moss-600: #36602a;
  --color-moss-700: #27461e;
  --color-moss-800: #1c3216;
  --color-moss-900: #121f0e;
  --color-moss-950: #0a1308;
  --color-terra: #c17850;
  --color-moonlight: #e8e4d9;
}
.card { @apply rounded-2xl p-5 transition-all; }
.card-label { @apply text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5; }
.card-value { @apply text-2xl font-bold tabular-nums tracking-tight; }
/* Light card */
.card {
  background: white;
  border: 1px solid var(--color-forest-200);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.card-label { color: var(--color-bark-400); }
.card-value { color: var(--color-bark-800); }
/* Dark card — glassmorphism */
:where(.dark) .card {
  background: rgba(36, 42, 30, 0.7);
  border: 1px solid rgba(124, 179, 66, 0.12);
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}
:where(.dark) .card-label { color: var(--color-bark-400); }
:where(.dark) .card-value { color: var(--color-moonlight); }
.val-green { color: var(--color-moss-500) !important; }
:where(.dark) .val-green { color: var(--color-moss-300) !important; }
.val-amber { color: var(--color-terra) !important; }
:where(.dark) .val-amber { color: #dce775 !important; }
.val-rose { color: #c0392b !important; }
:where(.dark) .val-rose { color: #ef9a9a !important; }
</style>
<script>
  // Restore theme before paint
  if(localStorage.getItem('pi-theme')==='light'){document.documentElement.classList.remove('dark')}
<\/script>
</head>
<body class="bg-forest-50 text-bark-800 dark:bg-bark-950 dark:text-moonlight antialiased transition-colors duration-300 min-h-screen">

<!-- subtle bg pattern -->
<div class="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04]" style="background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%2220%22 fill=%22none%22 stroke=%22%237cb342%22 stroke-width=%220.5%22/></svg>')"></div>

<div class="relative max-w-[1080px] mx-auto px-5 py-10 sm:px-8">

  <!-- header -->
  <header class="flex flex-wrap items-center gap-3 pb-6 mb-8 border-b border-forest-200 dark:border-forest-900">
    <h1 class="text-xl font-bold tracking-tight">
      <span class="text-forest-500">🌿 pi</span><span class="text-bark-600 dark:text-bark-300"> stats</span>
    </h1>
    <span class="px-3 py-1 text-xs font-medium rounded-full bg-forest-100 text-forest-600 dark:bg-forest-500/15 dark:text-forest-400">${escHtml(weekLabel)}</span>
    ${streak > 0 ? `<span class="px-3 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 animate-pulse">🔥 ${streak}-day streak</span>` : ""}
    <span class="flex-1"></span>

    <!-- prominent toggle group -->
    <div class="flex rounded-xl overflow-hidden border border-forest-200 dark:border-forest-800 bg-white dark:bg-bark-900 shadow-sm">
      <button id="period-btn" class="px-4 py-2 text-xs font-semibold bg-forest-500 text-white dark:bg-forest-600 hover:bg-forest-600 dark:hover:bg-forest-500 transition-colors cursor-pointer">☀️ Today</button>
      <button id="theme-btn" class="px-4 py-2 text-xs font-semibold text-bark-600 dark:text-bark-300 hover:bg-forest-50 dark:hover:bg-bark-800 transition-colors cursor-pointer border-l border-forest-200 dark:border-forest-800">☀️ Light</button>
      <button id="share-btn" class="px-4 py-2 text-xs font-semibold text-bark-600 dark:text-bark-300 hover:bg-forest-50 dark:hover:bg-bark-800 transition-colors cursor-pointer border-l border-forest-200 dark:border-forest-800">📋 Copy card</button>
    </div>
    <span class="text-[10px] text-bark-400 dark:text-bark-600 w-full sm:w-auto text-right">${escHtml(generated)}</span>
  </header>

  ${toolless.total > 0 ? `<div class="flex flex-wrap gap-4 mb-5 text-xs text-bark-500 dark:text-bark-400">
    <span class="flex items-center gap-1.5">🔧 <span class="font-medium">${toolUsed}/${toolless.total}</span> used tools <span class="text-bark-400 dark:text-bark-500">· ${chatPct}% chat-only</span></span>
  </div>` : ""}

  <!-- WEEK stats (default visible) -->
  <div id="stats-week">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs font-semibold uppercase tracking-widest text-forest-500 dark:text-forest-400">📅 This Week</span>
      <span class="text-[10px] text-bark-400 dark:text-bark-500">${escHtml(weekLabel)}</span>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      ${statCard("Inputs", weekly.inputs)}
      ${statCard("Sessions", weekly.sessions)}
      ${statCard("Tokens", fmtTokens(weekly.tokens))}
      ${statCard("Active Time", fmtMs(weekly.timeMs), "val-amber")}
      ${statCard("Est. Cost", fmtCost(weekly.cost), "val-green")}
    </div>
  </div>

  <!-- TODAY stats (hidden by default) -->
  <div id="stats-today" class="hidden">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs font-semibold uppercase tracking-widest text-terra dark:text-amber-300">☀️ Today</span>
      <span class="text-[10px] text-bark-400 dark:text-bark-500">${escHtml(todayLabel)}</span>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      ${statCard("Inputs", today.inputs)}
      ${statCard("Sessions", today.sessions)}
      ${statCard("Tokens", fmtTokens(today.tokens))}
      ${statCard("Active Time", fmtMs(today.timeMs), "val-amber")}
      ${statCard("Est. Cost", fmtCost(today.cost), "val-green")}
    </div>
  </div>

  <!-- tools + models -->
  <div class="grid sm:grid-cols-2 gap-3 mb-3">
    <div class="card">
      <h2 class="card-label mb-4">🌿 Tools — last 7 days</h2>
      ${tools.length ? tools.map(t => `<div class="flex items-center gap-3 py-1.5">
        <span class="w-14 text-xs font-mono text-bark-600 dark:text-bark-300 truncate">${escHtml(t.tool)}</span>
        <div class="flex-1 h-2 rounded-full bg-forest-100 dark:bg-forest-900/60 overflow-hidden"><div class="h-full rounded-full bg-forest-400 dark:bg-forest-500 transition-all" style="width:${pct(t.total, maxTool)}%"></div></div>
        <span class="w-8 text-right text-xs tabular-nums font-semibold text-forest-600 dark:text-forest-400">${t.total}</span>
      </div>`).join("") : `<p class="text-xs text-bark-400">No data yet</p>`}
    </div>
    <div class="card">
      <h2 class="card-label mb-4">🏆 Models</h2>
      ${pm.length ? pm.map((m, i) => `<div class="flex items-center gap-3 py-2.5 ${i < pm.length - 1 ? "border-b border-forest-100 dark:border-forest-900/40" : ""}">
        <span class="w-6 text-center text-sm shrink-0">${medals[i] ?? `<span class="text-bark-400 text-[10px]">#${i + 1}</span>`}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${m.emoji} ${escHtml(m.label)}</div>
          <div class="text-[10px] text-bark-400 dark:text-bark-500">${escHtml(m.prov)}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-bold tabular-nums text-forest-600 dark:text-forest-400">${m.uses}</div>
          <div class="text-[10px] text-bark-400">inputs</div>
        </div>
        <div class="w-12 h-1.5 rounded-full bg-forest-100 dark:bg-forest-900/60 overflow-hidden shrink-0"><div class="h-full rounded-full bg-forest-400" style="width:${pct(m.uses, maxModel)}%"></div></div>
      </div>`).join("") : `<p class="text-xs text-bark-400">No data yet</p>`}
    </div>
  </div>

  <!-- efficiency -->
  <div class="card mb-3 overflow-x-auto">
    <h2 class="card-label mb-4">⚡ Model Efficiency</h2>
    ${pe.length ? `<table class="w-full text-xs"><thead><tr class="border-b border-forest-100 dark:border-forest-900/40">
      ${["Model", "Inputs", "Avg Tokens", "Avg Time", "$/input", "Total"].map((h, i) =>
        `<th class="${i ? "text-right" : "text-left"} py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-bark-400">${h}</th>`).join("")}
    </tr></thead><tbody>${pe.map(e => `<tr class="border-b border-forest-50 dark:border-forest-900/20 hover:bg-forest-50/50 dark:hover:bg-forest-900/30">
      <td class="py-2.5 px-2">${e.emoji} ${escHtml(e.label)} <span class="text-bark-400">· ${escHtml(e.prov)}</span></td>
      <td class="text-right py-2.5 px-2 tabular-nums font-medium">${e.inputs}</td>
      <td class="text-right py-2.5 px-2 tabular-nums font-mono text-bark-500 dark:text-bark-400">${fmtTokens(e.avgTokens)}</td>
      <td class="text-right py-2.5 px-2 tabular-nums val-amber">${e.avgTimeSec}s</td>
      <td class="text-right py-2.5 px-2 tabular-nums font-mono text-bark-500 dark:text-bark-400">${fmtCost(e.costPerInput)}</td>
      <td class="text-right py-2.5 px-2 tabular-nums font-medium val-green">${fmtCost(e.totalCost)}</td>
    </tr>`).join("")}</tbody></table>` : `<p class="text-xs text-bark-400">No data yet</p>`}
  </div>

  <!-- projects -->
  <div class="card mb-3">
    <h2 class="card-label mb-4">📁 Top Projects</h2>
    ${projects.length ? projects.map(p => `<div class="flex items-center gap-3 py-1.5">
      <span class="w-32 text-xs font-mono text-bark-600 dark:text-bark-300 truncate">${escHtml(p.project)}</span>
      <div class="flex-1 h-2 rounded-full bg-forest-100 dark:bg-forest-900/60 overflow-hidden"><div class="h-full rounded-full bg-moss-400 dark:bg-moss-500" style="width:${pct(p.inputs, maxProj)}%"></div></div>
      <span class="w-8 text-right text-xs tabular-nums text-bark-500">${p.inputs}</span>
    </div>`).join("") : `<p class="text-xs text-bark-400">No data yet</p>`}
  </div>

  <!-- sparkline -->
  <div class="card mb-3">
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="card-label">📈 Token Usage</h2>
      ${daily.length >= 2 ? `<div class="flex gap-4 text-[10px] font-mono text-bark-400"><span>${daily[0]!.day}</span><span>${daily.at(-1)!.day}</span></div>` : ""}
    </div>
    ${spark || `<p class="text-xs text-bark-400 text-center py-4">Not enough data yet</p>`}
  </div>

  <!-- histogram + recent -->
  <div class="grid sm:grid-cols-2 gap-3 mb-3">
    <div class="card">
      <h2 class="card-label mb-4">⏱ Response Time</h2>
      ${histogram.some(b => b.count > 0) ? histogram.map(b => `<div class="flex items-center gap-3 py-1">
        <span class="w-12 text-right text-xs font-mono text-bark-500 dark:text-bark-400">${escHtml(b.label)}</span>
        <div class="flex-1 h-2 rounded-full bg-forest-100 dark:bg-forest-900/60 overflow-hidden"><div class="h-full rounded-full bg-amber-400 dark:bg-amber-500" style="width:${pct(b.count, maxHist)}%"></div></div>
        <span class="w-6 text-right text-xs tabular-nums text-bark-400">${b.count}</span>
      </div>`).join("") : `<p class="text-xs text-bark-400">No data yet</p>`}
    </div>
    <div class="card overflow-x-auto">
      <h2 class="card-label mb-4">🕓 Recent Sessions</h2>
      ${recent.length ? `<table class="w-full text-xs"><thead><tr class="border-b border-forest-100 dark:border-forest-900/40">
        ${["Date", "Project", "In", "Tok", "Cost"].map((h, i) =>
          `<th class="${i < 2 ? "text-left" : "text-right"} py-1.5 text-[10px] font-semibold text-bark-400">${h}</th>`).join("")}
      </tr></thead><tbody>${recent.map(s => `<tr class="border-b border-forest-50/50 dark:border-forest-900/20">
        <td class="py-1.5 tabular-nums text-bark-400">${fmtDate(s.started_at).slice(5)}</td>
        <td class="py-1.5 truncate max-w-[100px]">${escHtml(s.cwd?.split("/").pop() ?? "—")}</td>
        <td class="text-right py-1.5 tabular-nums">${s.inputs ?? 0}</td>
        <td class="text-right py-1.5 tabular-nums font-mono text-bark-400">${fmtTokens(s.tokens)}</td>
        <td class="text-right py-1.5 tabular-nums val-green">${fmtCost(s.cost)}</td>
      </tr>`).join("")}</tbody></table>` : `<p class="text-xs text-bark-400">No sessions yet</p>`}
    </div>
  </div>

  ${pw.length ? `<!-- waste -->
  <div class="card mb-3" style="border-left:3px solid var(--color-terra)">
    <h2 class="card-label mb-4 val-rose">⚠ High-Token No-Action <span class="font-normal opacity-60 normal-case tracking-normal">no tool calls</span></h2>
    <table class="w-full text-xs"><thead><tr class="border-b border-forest-100 dark:border-forest-900/40">
      ${["Date", "Model", "Tokens", "Time"].map((h, i) =>
        `<th class="${i < 2 ? "text-left" : "text-right"} py-1.5 text-[10px] font-semibold text-bark-400">${h}</th>`).join("")}
    </tr></thead><tbody>${pw.map(w => `<tr class="border-b border-forest-50/50 dark:border-forest-900/20">
      <td class="py-1.5 tabular-nums text-bark-400">${fmtDate(w.started_at)}</td>
      <td class="py-1.5">${w.emoji} ${escHtml(w.label)}</td>
      <td class="text-right py-1.5 tabular-nums font-semibold val-rose">${fmtTokens(w.tokens_used)}</td>
      <td class="text-right py-1.5 tabular-nums text-bark-400">${fmtMs(w.time_ms)}</td>
    </tr>`).join("")}</tbody></table>
  </div>` : ""}

  <!-- all-time -->
  <div class="card mb-3">
    <div class="flex flex-wrap gap-8">
      ${[
        { l: "All-time Sessions", v: overall.totalSessions },
        { l: "All-time Inputs", v: overall.totalInputs },
        { l: "All-time Tokens", v: fmtTokens(overall.totalTokens) },
        { l: "All-time Turns", v: overall.totalTurns },
        { l: "All-time Cost", v: fmtCost(overall.totalCost), c: "val-green" },
      ].map(a => `<div><div class="card-label mb-1">${a.l}</div><div class="text-lg font-bold tabular-nums ${a.c ?? ""}">${a.v}</div></div>`).join("")}
    </div>
  </div>

  <footer class="text-center text-[10px] text-bark-400 dark:text-bark-600 mt-10 pt-5 border-t border-forest-200 dark:border-forest-900">
    🌿 pi stats · generated by the stats extension
  </footer>
</div>
${shareScript}
</body>
</html>`;
}
