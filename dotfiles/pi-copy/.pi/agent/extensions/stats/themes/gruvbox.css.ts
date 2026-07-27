export const GRUVBOX_CSS = `
/* ═══════════════ Gruvbox tokens ═══════════════ */
:root[data-theme="dark"] {
  --bg0: #1d2021; --bg1: #282828; --bg2: #32302f; --bg3: #3c3836; --bg4: #504945;
  --line: #3c3836; --line-soft: #2a2725;
  --fg0: #fbf1c7; --fg1: #ebdbb2; --fg2: #d5c4a1; --fg3: #bdae93; --mute: #928374;
  --yellow: #fabd2f; --yellow-d: #d79921; --orange: #fe8019; --orange-d: #d65d0e;
  --red: #fb4934; --green: #b8bb26; --aqua: #8ec07c; --blue: #83a598; --purple: #d3869b;
  --accent: var(--yellow); --cost: var(--yellow); --warn: var(--orange);
  --shadow: 0 1px 0 rgba(0,0,0,0.4), 0 0 0 1px var(--line);
}
:root[data-theme="light"] {
  --bg0: #fbf1c7; --bg1: #f9f5d7; --bg2: #f2e5bc; --bg3: #ebdbb2; --bg4: #d5c4a1;
  --line: #d5c4a1; --line-soft: #ebdbb2;
  --fg0: #282828; --fg1: #3c3836; --fg2: #504945; --fg3: #665c54; --mute: #7c6f64;
  --yellow: #b57614; --yellow-d: #af3a03; --orange: #af3a03; --orange-d: #d65d0e;
  --red: #9d0006; --green: #79740e; --aqua: #427b58; --blue: #076678; --purple: #8f3f71;
  --accent: var(--yellow); --cost: var(--yellow-d); --warn: var(--orange);
  --shadow: 0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px var(--line);
}

/* ═══════════════ Base ═══════════════ */
*{box-sizing:border-box}
html,body{background:var(--bg0);color:var(--fg1)}
body{margin:0;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-feature-settings:"calt" 0;font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}
.page{max-width:1240px;margin:0 auto;padding:28px 32px 80px}
.muted{color:var(--mute)}.cost{color:var(--cost)}.warn{color:var(--warn)}.r{text-align:right}.dot{color:var(--mute);margin:0 8px}

/* ═══════════════ Topbar ═══════════════ */
.brand{display:inline-flex;align-items:baseline;gap:8px;font-weight:700;font-size:18px}
.brand .pi{color:var(--accent);font-size:22px;line-height:1}
.brand-name{color:var(--fg0)}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--bg1);border:1px solid var(--line);border-radius:8px;margin-bottom:24px}
.topbar-l,.topbar-r{display:flex;align-items:center;gap:10px;white-space:nowrap}
.topbar-r{gap:8px}
.toggle{appearance:none;background:var(--bg2);border:1px solid var(--line);color:var(--fg2);font:inherit;font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;transition:background .12s}
.toggle:hover{background:var(--bg3);color:var(--fg0)}
.toggle.on{background:var(--bg3);color:var(--fg0);box-shadow:inset 0 0 0 1px var(--line)}

/* ═══════════════ Hero ═══════════════ */
.hero{background:var(--bg1);border:1px solid var(--line);border-radius:10px;padding:24px 26px 28px;margin-bottom:22px}
.hero-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.hero-date{color:var(--mute);font-size:12px}
.hero-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:22px}
.stat{display:flex;flex-direction:column;gap:4px;padding-left:14px;border-left:1px solid var(--line)}
.stat-val{font-size:28px;font-weight:700;color:var(--fg0);letter-spacing:-.02em;line-height:1.1}
.stat-lbl{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--mute)}
.stat-hi .stat-val{color:var(--cost)}
.stat-accent .stat-val{color:var(--orange)}
.stat-good .stat-val{color:var(--green)}

/* ═══════════════ Grid + Cards ═══════════════ */
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:18px;margin-bottom:22px}
.card{background:var(--bg1);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;min-width:0}
.card-head{display:flex;align-items:baseline;justify-content:space-between;padding:14px 18px 8px}
.card-head h3{margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--fg2);font-weight:600}
.card-hint{font-size:11px;color:var(--mute);letter-spacing:.05em}
.card-body{padding:6px 18px 18px;flex:1}
.card-body.scroll{max-height:280px;overflow:auto}

/* ═══════════════ Bar list ═══════════════ */
.bar-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.bar-row{display:grid;grid-template-columns:92px 1fr 56px;align-items:center;gap:12px}
.bar-label{color:var(--fg1);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-value{color:var(--fg2);text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums}
.bar-track{height:8px;background:var(--bg2);border-radius:2px;position:relative;overflow:hidden}
.bar-fill{height:100%;border-radius:2px}
.bar-yellow{background:var(--yellow)}.bar-orange{background:var(--orange)}.bar-aqua{background:var(--aqua)}
.bar-blue{background:var(--blue)}.bar-green{background:var(--green)}.bar-purple{background:var(--purple)}

/* ═══════════════ Tables ═══════════════ */
.t-wrap{overflow-x:auto;max-height:340px;overflow-y:auto}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums;table-layout:fixed}
.tbl th{text-align:left;font-weight:500;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);padding:6px 12px 8px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--bg1);z-index:1}
.tbl td{padding:8px 12px;border-bottom:1px solid var(--line-soft);color:var(--fg1);white-space:nowrap}
.tbl tbody tr:last-child td{border-bottom:0}
.tbl tbody tr:hover td{background:var(--bg2)}
.tbl th:first-child,.tbl td:first-child{padding-left:0}
.tbl th:last-child,.tbl td:last-child{padding-right:0}
.tbl th.r,.tbl td.r{text-align:right}

/* ═══════════════ Daily chart ═══════════════ */
.daily-wrap{display:flex;flex-direction:column;gap:10px;padding-top:6px}
.daily-chart{display:flex;gap:3px;height:110px;align-items:end}
.dc-col{flex:1;height:100%;display:flex;align-items:end}
.dc-bar{width:100%;background:var(--bg4);border-radius:2px;transition:background .15s}
.dc-col:hover .dc-bar{background:var(--yellow-d)}
.dc-bar.today{background:var(--yellow);box-shadow:0 0 0 1px var(--yellow)}
.daily-axis{display:flex;justify-content:space-between;font-size:11px;color:var(--mute)}

/* ═══════════════ Mini stat row ═══════════════ */
.mini-stats{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
.mini-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line-soft)}
.mini-row:nth-child(n+5){border-bottom:0}
.mini-label{color:var(--fg2);font-size:12.5px}
.mini-value{font-weight:600;color:var(--fg0);font-size:13px;font-variant-numeric:tabular-nums}

/* ═══════════════ Token breakdown ═══════════════ */
.tok-bar{display:flex;height:18px;border-radius:4px;overflow:hidden;gap:1px;margin-bottom:12px}
.tok-seg{min-width:2px}
.tok-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11.5px}
.tok-legend-item{display:flex;align-items:center;gap:5px}
.tok-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}

/* ═══════════════ Footer ═══════════════ */
.footer{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 22px;background:var(--bg1);border:1px solid var(--line);border-radius:10px}
.footer-l{display:flex;flex-direction:column;gap:10px}
.footer-stats{display:flex;gap:28px;flex-wrap:wrap}
.fs{display:flex;align-items:baseline;gap:8px}
.fs .v{font-size:20px;font-weight:700;color:var(--fg0);letter-spacing:-.01em}
.fs .v.cost{color:var(--cost)}
.fs .l{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.footer-r{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mute)}

/* ═══════════════ Share card (hidden, for PNG capture) ═══════════════ */
.share-btn{background:var(--accent)!important;color:var(--bg0)!important;font-weight:600!important;border-color:var(--accent)!important}
.share-btn:hover{filter:brightness(1.08)}
.share-card{width:540px;height:540px;border-radius:24px;position:relative;overflow:hidden;font-family:"Space Grotesk","JetBrains Mono",sans-serif;background:var(--bg0)}
.sc-gradient{position:absolute;inset:0;border-radius:24px;padding:3px;background:linear-gradient(135deg,var(--yellow),var(--orange) 40%,var(--red) 70%,var(--purple));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.sc-inner{position:relative;height:100%;padding:40px 44px 32px;display:flex;flex-direction:column;box-sizing:border-box}
.sc-brand{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.sc-logo{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--orange),var(--yellow));color:var(--bg0);font-weight:700;font-size:28px;display:flex;align-items:center;justify-content:center;font-family:"JetBrains Mono",monospace}
.sc-brand-text{}
.sc-title{font-size:24px;font-weight:700;color:var(--fg0);letter-spacing:-.02em}
.sc-date{font-size:13px;color:var(--mute);margin-top:2px}
.sc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;flex:1;align-content:center}
.sc-stat{text-align:center;padding:16px 12px;background:var(--bg1);border:1px solid var(--line);border-radius:14px}
.sc-val{font-size:32px;font-weight:700;color:var(--fg0);letter-spacing:-.02em;line-height:1.1}
.sc-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--mute);margin-top:6px}
.sc-cost{color:var(--yellow)}
.sc-streak{color:var(--orange)}
.sc-cache{color:var(--green)}
.sc-foot{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--mute);padding-top:16px;border-top:1px solid var(--line);font-family:"JetBrains Mono",monospace;letter-spacing:.02em}

/* ═══════════════ Responsive ═══════════════ */
@media(max-width:900px){.page{padding:18px}.grid>.card{grid-column:span 12!important}.footer{flex-direction:column;align-items:flex-start}}
@media(max-width:560px){.hero-grid{grid-template-columns:repeat(2,1fr)}.topbar{flex-direction:column;align-items:stretch;gap:12px}.topbar-r{justify-content:space-between;flex-wrap:wrap}}
`;
