import type {
  DailyStat, DurationBucket, ModelEfficiency, ModelStat, OverallStats,
  ProjectStat, RecentSession, TokenWasteEntry, ToolStat, WeeklyStat,
} from "./db.js";
import type { StatsData } from "./render.js";
import { fmtTokens, fmtCost, fmtMs, fmtDate, fmtDateShort, escHtml } from "./format.js";

/* ─── chart builders ──────────────────────────────────────────────────────── */

function htmlLeaderboard(items: Array<{ label: string; value: number; unit?: string }>): string {
  if (!items.length) return `<p class="empty">No data yet</p>`;
  const medals = ["🥇", "🥈", "🥉"];
  return `<div class="leaderboard">${items.map((item, i) => {
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
  }).join("")}</div>`;
}

function svgBarChart(
  items: Array<{ label: string; value: number }>,
  opts: { width?: number; rowH?: number; color?: string },
): string {
  if (!items.length) return `<p class="empty">No data yet</p>`;
  const w = opts.width ?? 600, rowH = opts.rowH ?? 28;
  const color = opts.color ?? "var(--accent)";
  const max = Math.max(...items.map(i => i.value), 1);
  const labelW = 160, barArea = w - labelW - 64;
  const h = items.length * rowH + 8;

  const bars = items.map((item, i) => {
    const y = i * rowH + 4;
    const bw = Math.round((item.value / max) * barArea);
    return `
      <text x="${labelW - 8}" y="${y + rowH * 0.65}" fill="var(--text)" font-size="12"
            text-anchor="end" font-family="var(--mono)">${escHtml(item.label)}</text>
      <rect x="${labelW}" y="${y + 4}" width="${barArea}" height="${rowH - 12}" fill="var(--surface-2)" rx="4"/>
      <rect x="${labelW}" y="${y + 4}" width="${bw}" height="${rowH - 12}" fill="${color}" rx="4"/>
      <text x="${labelW + barArea + 8}" y="${y + rowH * 0.65}" fill="var(--muted)" font-size="11"
            font-family="var(--mono)">${item.value}</text>`;
  }).join("");
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function svgSparkline(items: DailyStat[], opts: { width?: number; height?: number }): string {
  if (items.length < 2) return "";
  const w = opts.width ?? 700, h = opts.height ?? 100;
  const max = Math.max(...items.map(d => d.tokens), 1);
  const px = 4, ah = h - px * 2 - 20, aw = w - px * 2;
  const pts = items.map((d, i) => {
    const x = px + (i / (items.length - 1)) * aw;
    const y = px + ah - (d.tokens / max) * ah;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [fx] = pts[0]!.split(",");
  const [lx] = pts.at(-1)!.split(",");
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="M${fx},${px + ah} L${pts.join(" L")} L${lx},${px + ah} Z" fill="url(#sparkGrad)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2"
                stroke-linejoin="round" stroke-linecap="round"/>
      <text x="${px}" y="${h - 2}" fill="var(--muted)" font-size="10" font-family="var(--mono)">${items[0]!.day}</text>
      <text x="${w - px}" y="${h - 2}" fill="var(--muted)" font-size="10" font-family="var(--mono)" text-anchor="end">${items.at(-1)!.day}</text>
    </svg>`;
}

function svgHistogram(buckets: DurationBucket[], opts: { width?: number }): string {
  if (!buckets.length || buckets.every(b => b.count === 0)) return `<p class="empty">No data yet</p>`;
  const w = opts.width ?? 480, barH = 28;
  const max = Math.max(...buckets.map(b => b.count), 1);
  const labelW = 70, barArea = w - labelW - 60;
  const h = buckets.length * barH + 8;
  const bars = buckets.map((b, i) => {
    const y = i * barH + 4;
    const bw = Math.round((b.count / max) * barArea);
    return `
      <text x="${labelW - 8}" y="${y + barH * 0.65}" fill="var(--text)" font-size="12"
            text-anchor="end" font-family="var(--mono)">${escHtml(b.label)}</text>
      <rect x="${labelW}" y="${y + 4}" width="${barArea}" height="${barH - 12}" fill="var(--surface-2)" rx="4"/>
      <rect x="${labelW}" y="${y + 4}" width="${bw}" height="${barH - 12}" fill="var(--yellow)" rx="4"/>
      <text x="${labelW + barArea + 8}" y="${y + barH * 0.65}" fill="var(--muted)" font-size="11"
            font-family="var(--mono)">${b.count}</text>`;
  }).join("");
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/* ─── efficiency table ────────────────────────────────────────────────────── */

function efficiencyTable(rows: ModelEfficiency[]): string {
  if (!rows.length) return `<p class="empty">No data yet</p>`;
  return `<table>
    <thead><tr>
      <th>model</th><th class="num">inputs</th><th class="num">avg tokens</th>
      <th class="num">avg time</th><th class="num">$/input</th><th class="num">total cost</th>
    </tr></thead>
    <tbody>${rows.map(e => `<tr>
      <td>${escHtml(e.provider)}/${escHtml(e.model_id)}</td>
      <td class="num">${e.inputs}</td>
      <td class="num">${fmtTokens(e.avgTokens)}</td>
      <td class="num time">${e.avgTimeSec}s</td>
      <td class="num">${fmtCost(e.costPerInput)}</td>
      <td class="num cost">${fmtCost(e.totalCost)}</td>
    </tr>`).join("")}</tbody></table>`;
}

/* ─── waste alerts ────────────────────────────────────────────────────────── */

function wasteTable(rows: TokenWasteEntry[]): string {
  if (!rows.length) return "";
  return `<section class="panel panel-warn">
    <h2>⚠ high-token no-action inputs <span class="h2-sub">no tool calls</span></h2>
    <table><thead><tr>
      <th>date</th><th>model</th><th class="num">tokens</th><th class="num">time</th>
    </tr></thead><tbody>${rows.map(w => `<tr>
      <td>${fmtDate(w.started_at)}</td>
      <td>${escHtml(w.provider)}/${escHtml(w.model_id)}</td>
      <td class="num warn">${fmtTokens(w.tokens_used)}</td>
      <td class="num">${fmtMs(w.time_ms)}</td>
    </tr>`).join("")}</tbody></table></section>`;
}

/* ─── share card canvas script ────────────────────────────────────────────── */

function buildShareScript(d: StatsData): string {
  const weekLabel = `${fmtDateShort(d.start)} – ${fmtDateShort(d.end)}`;
  const todayLabel = fmtDateShort(Date.now());

  const safe = (v: unknown) => Number(v) || 0;
  const data = JSON.stringify({
    weekly: {
      inputs: safe(d.weekly.inputs), sessions: safe(d.weekly.sessions),
      tokens: safe(d.weekly.tokens), timeMs: safe(d.weekly.timeMs), cost: safe(d.weekly.cost),
    },
    today: {
      inputs: safe(d.today.inputs), sessions: safe(d.today.sessions),
      tokens: safe(d.today.tokens), timeMs: safe(d.today.timeMs), cost: safe(d.today.cost),
    },
    overall: {
      totalSessions: safe(d.overall.totalSessions), totalTokens: safe(d.overall.totalTokens),
      totalCost: safe(d.overall.totalCost), totalTurns: safe(d.overall.totalTurns),
      totalInputs: safe(d.overall.totalInputs),
    },
    tools: d.tools.slice(0, 5).map(t => ({ tool: t.tool, total: safe(t.total) })),
    models: d.models.slice(0, 3).map(m => ({ label: `${m.provider}/${m.model_id}`, uses: safe(m.uses) })),
    daily: d.daily.map(x => safe(x.tokens)),
    streak: d.streak,
    weekLabel, todayLabel,
  });

  return `
<script>
(function() {
  var DATA = ${data};
  var DPR = Math.min(window.devicePixelRatio || 1, 3);
  var W = 660, H = 460;
  var mode = 'week'; // 'week' or 'today'

  var C = {
    bg:'#0d1117', surface:'#161b22', border:'#21262d',
    accent:'#58a6ff', text:'#e6edf3', muted:'#7d8590',
    green:'#3fb950', yellow:'#d29922', purple:'#a371f7', pink:'#f778ba',
  };
  var MONO = '"SF Mono","Cascadia Mono","Fira Code",monospace';
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif';

  function n(v){return Number(v)||0}
  function fT(v){v=n(v);if(v>=1e6)return(v/1e6).toFixed(1)+'M';if(v>=1e3)return Math.round(v/1e3)+'k';return''+v}
  function fC(v){v=n(v);if(v<=0)return'$0.00';if(v<.005)return'<$0.01';return'$'+v.toFixed(2)}
  function fM(v){v=n(v);if(!v)return'\\u2014';var s=Math.floor(v/1e3),m=Math.floor(s/60),h=Math.floor(m/60);if(h)return h+'h '+m%60+'m';if(m)return m+'m '+s%60+'s';return s+'s'}

  function rr(x,rx,ry,rw,rh,r){x.beginPath();x.moveTo(rx+r,ry);x.arcTo(rx+rw,ry,rx+rw,ry+rh,r);x.arcTo(rx+rw,ry+rh,rx,ry+rh,r);x.arcTo(rx,ry+rh,rx,ry,r);x.arcTo(rx,ry,rx+rw,ry,r);x.closePath()}

  function draw(cv){
    cv.width=W*DPR;cv.height=H*DPR;
    var x=cv.getContext('2d');x.scale(DPR,DPR);
    var src = mode==='today' ? DATA.today : DATA.weekly;
    var lbl = mode==='today' ? DATA.todayLabel : DATA.weekLabel;

    // bg + glow
    rr(x,0,0,W,H,20);x.fillStyle=C.bg;x.fill();
    var g1=x.createRadialGradient(W*.7,0,0,W*.7,0,W*.8);
    g1.addColorStop(0,C.accent+'10');g1.addColorStop(1,'transparent');x.fillStyle=g1;x.fill();
    var g2=x.createRadialGradient(0,H,0,0,H,W*.6);
    g2.addColorStop(0,C.purple+'08');g2.addColorStop(1,'transparent');x.fillStyle=g2;x.fill();

    // top line
    var tg=x.createLinearGradient(32,0,W-32,0);
    tg.addColorStop(0,'transparent');tg.addColorStop(.2,C.accent+'90');
    tg.addColorStop(.5,C.purple+'90');tg.addColorStop(.8,C.pink+'60');tg.addColorStop(1,'transparent');
    rr(x,32,1,W-64,2,1);x.fillStyle=tg;x.fill();

    // border
    rr(x,.5,.5,W-1,H-1,20);x.strokeStyle=C.border;x.lineWidth=1;x.stroke();

    // header
    x.font='bold 20px '+SANS;x.fillStyle=C.accent;x.fillText('pi stats',32,38);
    var tagW=mode==='today'?52:90;
    x.font='600 10px '+SANS;
    rr(x,110,22,tagW,20,10);x.fillStyle=C.accent+'20';x.fill();
    x.fillStyle=C.accent;x.fillText(mode==='today'?'TODAY':'THIS WEEK',118,36);
    x.font='500 11px '+SANS;x.fillStyle=C.muted;x.fillText(lbl,32,56);

    // streak
    if(DATA.streak>0){
      x.font='500 12px '+SANS;x.fillStyle=C.yellow;
      x.textAlign='right';x.fillText('\\uD83D\\uDD25 '+DATA.streak+'d streak',W-32,36);x.textAlign='left';
    }

    // stat pills
    var pills=[
      {l:'Inputs',v:''+src.inputs,c:C.text},
      {l:'Sessions',v:''+src.sessions,c:C.text},
      {l:'Tokens',v:fT(src.tokens),c:C.text},
      {l:'Active',v:fM(src.timeMs),c:C.yellow},
      {l:'Cost',v:fC(src.cost),c:C.green},
    ];
    var pw=(W-64-4*10)/5,py=72;
    pills.forEach(function(p,i){
      var px2=32+i*(pw+10);
      rr(x,px2,py,pw,50,10);x.fillStyle=C.surface;x.fill();
      rr(x,px2,py,pw,50,10);x.strokeStyle=C.border;x.lineWidth=.5;x.stroke();
      x.font='500 9px '+SANS;x.fillStyle=C.muted;x.fillText(p.l.toUpperCase(),px2+12,py+17);
      x.font='bold 17px '+SANS;x.fillStyle=p.c;x.fillText(p.v,px2+12,py+39);
    });

    // sparkline
    var sy=140,sh=48,sx=32,sw=W-64;
    x.font='600 9px '+SANS;x.fillStyle=C.muted;x.fillText('TOKEN USAGE',sx,sy);
    var vals=DATA.daily;
    if(vals.length>1){
      var mv=Math.max.apply(null,vals.concat([1]));var oy=sy+12;
      x.beginPath();x.moveTo(sx,oy+sh);
      vals.forEach(function(v,i){x.lineTo(sx+i/(vals.length-1)*sw,oy+sh-v/mv*sh)});
      x.lineTo(sx+sw,oy+sh);x.closePath();
      var sg=x.createLinearGradient(0,oy,0,oy+sh);
      sg.addColorStop(0,C.accent+'35');sg.addColorStop(1,C.accent+'03');x.fillStyle=sg;x.fill();
      x.beginPath();
      vals.forEach(function(v,i){var lx2=sx+i/(vals.length-1)*sw,ly=oy+sh-v/mv*sh;i?x.lineTo(lx2,ly):x.moveTo(lx2,ly)});
      x.strokeStyle=C.accent;x.lineWidth=2;x.lineJoin='round';x.lineCap='round';x.stroke();
    }

    // tools
    var cy=222;
    x.font='600 9px '+SANS;x.fillStyle=C.muted;x.fillText('TOP TOOLS',32,cy);
    var mt=DATA.tools[0]?DATA.tools[0].total:1;
    var tc=[C.accent,C.accent+'cc',C.accent+'aa',C.accent+'88',C.accent+'66'];
    DATA.tools.forEach(function(t,i){
      var ty=cy+14+i*24;
      x.font='11px '+MONO;x.fillStyle=C.text;x.fillText(t.tool,40,ty+12);
      var bx=120,bw=140,bh=8;
      rr(x,bx,ty+5,bw,bh,4);x.fillStyle=C.border;x.fill();
      var fw=Math.round(t.total/mt*bw);
      if(fw>0){rr(x,bx,ty+5,fw,bh,4);x.fillStyle=tc[i]||C.accent;x.fill()}
      x.font='500 10px '+MONO;x.fillStyle=C.muted;x.fillText(''+t.total,bx+bw+8,ty+13);
    });

    // models
    var mx=W/2+24;
    x.font='600 9px '+SANS;x.fillStyle=C.muted;x.fillText('TOP MODELS',mx,cy);
    var md=['\\uD83E\\uDD47','\\uD83E\\uDD48','\\uD83E\\uDD49'];
    DATA.models.forEach(function(m,i){
      var ty=cy+14+i*28;
      x.font='14px '+SANS;x.fillText(md[i]||'',mx+4,ty+14);
      x.font='11px '+MONO;x.fillStyle=C.text;
      var lb=m.label.length>22?m.label.slice(0,20)+'\\u2026':m.label;
      x.fillText(lb,mx+28,ty+12);
      x.font='bold 11px '+MONO;x.fillStyle=C.accent;x.fillText(''+m.uses,W-64,ty+12);
      x.font='500 9px '+SANS;x.fillStyle=C.muted;x.fillText('inputs',W-40,ty+12);
    });

    // all-time footer
    var fy=H-64;
    rr(x,32,fy,W-64,44,10);x.fillStyle=C.surface;x.fill();
    rr(x,32,fy,W-64,44,10);x.strokeStyle=C.border;x.lineWidth=.5;x.stroke();
    var at=[
      {l:'SESSIONS',v:''+DATA.overall.totalSessions,c:C.text},
      {l:'INPUTS',v:''+DATA.overall.totalInputs,c:C.text},
      {l:'TOKENS',v:fT(DATA.overall.totalTokens),c:C.text},
      {l:'EST. COST',v:fC(DATA.overall.totalCost),c:C.green},
    ];
    var aw2=(W-64-3*12)/4;
    at.forEach(function(a,i){
      var ax=44+i*(aw2+12);
      x.font='500 8px '+SANS;x.fillStyle=C.muted;x.fillText(a.l,ax,fy+16);
      x.font='bold 14px '+SANS;x.fillStyle=a.c;x.fillText(a.v,ax,fy+34);
    });

    // watermark
    x.font='500 9px '+SANS;x.fillStyle=C.muted+'50';x.textAlign='right';
    x.fillText('pi stats',W-32,H-10);x.textAlign='left';
  }

  var canvas=document.createElement('canvas');
  draw(canvas);

  // share button
  var btn=document.getElementById('share-btn');
  var icon=btn.querySelector('.share-icon');
  var label=btn.querySelector('.share-label');
  btn.addEventListener('click',function(){
    btn.disabled=true;
    canvas.toBlob(function(blob){
      if(!blob){btn.disabled=false;return}
      if(typeof ClipboardItem!=='undefined'&&navigator.clipboard&&navigator.clipboard.write){
        navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(function(){
          icon.textContent='\\u2713';label.textContent='Copied!';btn.classList.add('success');
          setTimeout(function(){icon.textContent='\\uD83D\\uDCCB';label.textContent='Copy share card';btn.classList.remove('success');btn.disabled=false},2200);
        }).catch(function(){fb(blob)});
      } else { fb(blob); }
    },'image/png');
  });
  function fb(blob){
    var a=document.createElement('a');
    a.download='pi-stats-'+new Date().toISOString().slice(0,10)+'.png';
    a.href=URL.createObjectURL(blob);a.click();
    icon.textContent='\\u2B07';label.textContent='Downloaded!';btn.classList.add('success');
    setTimeout(function(){icon.textContent='\\uD83D\\uDCCB';label.textContent='Copy share card';btn.classList.remove('success');btn.disabled=false},2200);
  }

  // #8: today/week toggle
  var tog=document.getElementById('share-toggle');
  if(tog) tog.addEventListener('click',function(){
    mode=mode==='week'?'today':'week';
    tog.textContent=mode==='today'?'\\uD83D\\uDCC5 Switch to week':'\\u2600\\uFE0F Switch to today';
    draw(canvas);
  });
})();
</script>`;
}

/* ─── main builder ────────────────────────────────────────────────────────── */

export function buildHtmlDashboard(data: StatsData): string {
  const { overall, weekly, today, tools, models, efficiency, projects, daily, recent,
          toolless, streak, histogram, waste, start, end } = data;

  const generated = new Date().toLocaleString();
  const weekLabel = `${fmtDateShort(start)} – ${fmtDateShort(end)}`;

  const toolsChart = svgBarChart(tools.map(t => ({ label: t.tool, value: t.total })), { width: 480 });
  const modelsBoard = htmlLeaderboard(models.map(m => ({ label: `${m.provider}/${m.model_id}`, value: m.uses })));
  const projectsChart = svgBarChart(projects.map(p => ({ label: p.project, value: p.inputs })), { width: 980, color: "var(--green)", rowH: 32 });
  const tokenGraph = svgSparkline(daily, { width: 980, height: 100 });
  const histChart = svgHistogram(histogram, { width: 480 });
  const effTable = efficiencyTable(efficiency);
  const wasteHtml = wasteTable(waste);

  const recentRows = recent.length
    ? recent.map(s => `<tr>
        <td>${fmtDate(s.started_at)}</td><td>${escHtml(s.cwd?.split("/").pop() ?? "—")}</td>
        <td class="num">${s.inputs ?? 0}</td><td class="num">${s.turns}</td>
        <td class="num">${fmtTokens(s.tokens)}</td><td class="num cost">${fmtCost(s.cost)}</td>
        <td class="num">${fmtMs(s.duration ?? 0)}</td></tr>`).join("")
    : `<tr><td colspan="7" class="empty">No sessions yet</td></tr>`;

  const card = (label: string, value: string, cls = "") =>
    `<div class="card"><span class="card-label">${label}</span><span class="card-value ${cls}">${value}</span></div>`;

  const atItem = (label: string, value: string, cls = "") =>
    `<div class="at-item"><span class="at-label">${label}</span><span class="at-value ${cls}">${value}</span></div>`;

  // toolless ratio
  const toolPct = toolless.total > 0 ? Math.round(((toolless.total - toolless.toolless) / toolless.total) * 100) : 0;
  const toollessHtml = toolless.total > 0
    ? `<div class="insight"><span class="insight-icon">🔧</span><span>${toolless.total - toolless.toolless}/${toolless.total} inputs used tools <span class="muted">(${100 - toolPct}% chat-only)</span></span></div>`
    : "";

  const streakHtml = streak > 0
    ? `<div class="insight"><span class="insight-icon">🔥</span><span>${streak}-day streak</span></div>`
    : "";

  // today mini-row
  const todayHtml = today.inputs > 0
    ? `<div class="today-strip">${[
        card("today inputs", String(today.inputs)),
        card("today tokens", fmtTokens(today.tokens)),
        card("today cost", fmtCost(today.cost), "cost"),
        card("today active", fmtMs(today.timeMs), "time"),
      ].join("")}</div>`
    : "";

  const shareScript = buildShareScript(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pi stats</title>
  <style>
    :root {
      --bg: #0d1117; --surface: #161b22; --surface-2: #1c2128;
      --border: #30363d; --border-subtle: #21262d;
      --accent: #58a6ff; --accent-soft: #58a6ff20;
      --text: #e6edf3; --text-secondary: #c9d1d9; --muted: #7d8590;
      --green: #3fb950; --yellow: #d29922; --red: #f85149;
      --mono: ui-monospace, "SF Mono", "Cascadia Mono", "Fira Code", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      --r: 12px; --r-sm: 8px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--sans);
           line-height: 1.5; -webkit-font-smoothing: antialiased; }
    .page { max-width: 1060px; margin: 0 auto; padding: 40px 28px 60px; }

    /* header */
    header { display: flex; align-items: center; gap: 14px; margin-bottom: 28px;
             padding-bottom: 24px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
    header h1 { font-size: 20px; font-weight: 700; color: var(--accent); letter-spacing: -0.02em; }
    .badge { background: var(--accent-soft); border: 1px solid var(--accent)30; border-radius: 100px;
             padding: 2px 14px; font-size: 12px; font-weight: 500; color: var(--accent); }
    .spacer { flex: 1; }
    .meta { color: var(--muted); font-size: 11px; }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .hdr-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--surface); color: var(--text-secondary);
      font-size: 12px; font-weight: 500; font-family: var(--sans); cursor: pointer;
      transition: all .15s ease; white-space: nowrap;
    }
    .hdr-btn:hover { background: var(--surface-2); border-color: var(--accent); color: var(--text); }
    .hdr-btn:active { transform: scale(.97); }
    .hdr-btn.success { background: var(--green); border-color: var(--green); color: #0d1117; }
    .hdr-btn:disabled { opacity: .7; cursor: wait; }

    /* insights strip */
    .insights { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .insight { display: flex; align-items: center; gap: 6px; font-size: 13px;
               color: var(--text-secondary); }
    .insight-icon { font-size: 15px; }
    .muted { color: var(--muted); }

    /* cards */
    .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
    .today-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .today-strip .card { border-left: 2px solid var(--yellow); }
    .card { background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--r);
            padding: 18px 16px; display: flex; flex-direction: column; gap: 6px; }
    .card-label { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .card-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .card-value.cost { color: var(--green); }
    .card-value.time { color: var(--yellow); }

    /* sections */
    h2 { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase;
         letter-spacing: 0.1em; margin-bottom: 16px; }
    .h2-sub { font-weight: 400; opacity: 0.7; text-transform: none; letter-spacing: 0; margin-left: 6px; }
    .panel { background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--r);
             padding: 20px; margin-bottom: 12px; overflow-x: auto; }
    .panel-warn { border-left: 3px solid var(--red); }
    .panel svg { display: block; max-width: 100%; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }

    /* leaderboard */
    .leaderboard { display: flex; flex-direction: column; }
    .lb-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); }
    .lb-row:last-child { border-bottom: none; }
    .lb-rank { width: 26px; text-align: center; font-size: 14px; flex-shrink: 0; }
    .rank-num { color: var(--muted); font-size: 11px; font-weight: 500; }
    .lb-label { flex: 1; font-family: var(--mono); font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lb-value { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent); flex-shrink: 0; font-size: 13px; }
    .lb-unit { color: var(--muted); font-size: 10px; flex-shrink: 0; }
    .lb-bar { width: 56px; height: 5px; background: var(--border-subtle); border-radius: 3px; flex-shrink: 0; overflow: hidden; }
    .lb-fill { height: 100%; background: var(--accent); border-radius: 3px; }

    /* table */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; color: var(--muted); font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border-subtle); }
    td { padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface-2); }
    .num { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); font-family: var(--mono); font-size: 12px; }
    .cost { color: var(--green) !important; }
    .time { color: var(--yellow) !important; }
    .warn { color: var(--red) !important; font-weight: 600; }

    /* all-time */
    .at-strip { display: flex; gap: 36px; align-items: center; flex-wrap: wrap; }
    .at-item { display: flex; flex-direction: column; gap: 3px; }
    .at-label { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .at-value { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

    .empty { color: var(--muted); text-align: center; padding: 16px 0; font-size: 13px; }
    footer { text-align: center; color: var(--muted); font-size: 11px; margin-top: 36px; padding-top: 20px; border-top: 1px solid var(--border-subtle); }

    @media (max-width: 720px) {
      .cards { grid-template-columns: repeat(2, 1fr); }
      .today-strip { grid-template-columns: repeat(2, 1fr); }
      .grid-2 { grid-template-columns: 1fr; }
      header { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <h1>pi stats</h1>
      <span class="badge">${escHtml(weekLabel)}</span>
      <span class="spacer"></span>
      <div class="header-actions">
        <button id="share-toggle" class="hdr-btn" type="button">☀️ Switch to today</button>
        <button id="share-btn" class="hdr-btn" type="button">
          <span class="share-icon">📋</span>
          <span class="share-label">Copy share card</span>
        </button>
      </div>
      <span class="meta">${escHtml(generated)}</span>
    </header>

    <div class="insights">
      ${streakHtml}
      ${toollessHtml}
    </div>

    <section class="cards">
      ${card("inputs", String(weekly.inputs))}
      ${card("sessions", String(weekly.sessions))}
      ${card("tokens", fmtTokens(weekly.tokens))}
      ${card("active time", fmtMs(weekly.timeMs), "time")}
      ${card("est. cost", fmtCost(weekly.cost), "cost")}
    </section>

    ${todayHtml}

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
      <h2>model efficiency</h2>
      ${effTable}
    </section>

    <section class="panel">
      <h2>top projects</h2>
      ${projectsChart}
    </section>

    <section class="panel">
      <h2>token usage — last ${daily.length} days</h2>
      ${tokenGraph || `<p class="empty">Not enough data yet</p>`}
    </section>

    <section class="grid-2">
      <div class="panel">
        <h2>response time distribution</h2>
        ${histChart}
      </div>
      <div class="panel">
        <h2>recent sessions</h2>
        <table><thead><tr>
          <th>date</th><th>project</th>
          <th class="num">inputs</th><th class="num">turns</th><th class="num">tokens</th>
          <th class="num">cost</th><th class="num">dur.</th>
        </tr></thead><tbody>${recentRows}</tbody></table>
      </div>
    </section>

    ${wasteHtml}

    <section class="panel">
      <div class="at-strip">
        ${atItem("all-time sessions", String(overall.totalSessions))}
        ${atItem("all-time inputs", String(overall.totalInputs))}
        ${atItem("all-time tokens", fmtTokens(overall.totalTokens))}
        ${atItem("all-time turns", String(overall.totalTurns))}
        ${atItem("all-time est. cost", fmtCost(overall.totalCost), "cost")}
      </div>
    </section>

    <footer>pi stats · generated by the stats extension</footer>
  </div>

  ${shareScript}
</body>
</html>`;
}
