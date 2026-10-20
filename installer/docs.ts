/**
 * Builds docs/index.html (GitHub Pages) from the installer's own data:
 * steps, apps, defaults, keybinds and private fields. Run: pnpm run docs
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { apps, type AppKind } from './data/apps.ts';
import { defaults, manualSettings } from './data/defaults.ts';
import { keybinds } from './data/keybinds.ts';
import { FIELDS } from './lib/private.ts';
import { HELP } from './plan.ts';
import { steps } from './steps/index.ts';

const REPO = resolve(import.meta.dirname, '..');
const ONE_LINER = 'curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Escape, then render `code` spans */
const md = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const short = (name: string) => name.split('/').pop()!;

const DOTFILES: [string, string][] = [
  ['zsh', 'oh-my-zsh with the custom two-line <code>mahi</code> theme, fnm, fzf, z, autosuggestions, syntax highlighting'],
  ['ghostty', 'Terminal: Cascadia Code, blur, Pokemon background, theme overlay'],
  ['tmux', 'Prefix C-a, vim pane keys, native status bar (git, now playing, Claude usage), flowd autostart'],
  ['nvim', 'LazyVim, oil, theme from <code>~/.config/theme</code>'],
  ['git', '<code>.gitconfig</code> (delta, sane defaults, identity in <code>~/.gitconfig.local</code>) and a global ignore'],
  ['ssh', '<code>~/.ssh/config</code>: Keychain, GitHub host; work host in <code>config.local</code>'],
  ['lazygit', 'Config + theme overlay'],
  ['fastfetch', 'System info layout'],
  ['pi', 'The whole <code>~/.pi</code>: extensions, settings, themes, MCP servers'],
  ['stow', 'Global ignore rules for stow (Perl regex)'],
];

function stepsSection(): string {
  const cards = steps
    .map(
      (s, i) => `
      <li class="card step">
        <div class="step-head"><span class="num">${i + 1}</span><h3>${esc(s.title)}</h3><code class="id">${s.id}</code>${s.required ? '<span class="pill">always runs</span>' : ''}</div>
        <p class="lead">${md(s.summary)}</p>
        <ul>${s.details.map((d) => `<li>${md(d)}</li>`).join('')}</ul>
        ${s.requires?.length ? `<p class="muted">Needs: ${s.requires.map((r) => `<code>${r}</code>`).join(' ')}</p>` : ''}
      </li>`,
    )
    .join('');
  return `<section id="steps"><h2>What it does</h2>
    <p>Homebrew always runs; everything else is a checkbox, all on by default. Each step checks what's already done, so re-running is safe.</p>
    <ol class="steps">${cards}</ol></section>`;
}

function packagesSection(): string {
  const block = (kind: AppKind, title: string) => {
    const list = apps.filter((a) => a.kind === kind);
    const cats = [...new Set(list.map((a) => a.category))];
    return `<h3>${title} <span class="muted">(${list.length})</span></h3><div class="grid">${cats
      .map(
        (c) => `<div class="card"><h4>${esc(c)}</h4><dl>${list
          .filter((a) => a.category === c)
          .map((a) => `<dt><code>${esc(short(a.name))}</code></dt><dd>${md(a.desc)}</dd>`)
          .join('')}</dl></div>`,
      )
      .join('')}</div>`;
  };
  return `<section id="packages"><h2>Packages</h2>
    <p>From <code>installer/data/apps.ts</code>. One batched <code>brew install</code> per kind; third-party taps are tapped first.</p>
    ${block('formula', 'CLI tools')}${block('cask', 'GUI apps')}</section>`;
}

function defaultsSection(): string {
  const rows = defaults
    .map(
      (d) => `<tr data-search="${esc(`${d.group} ${d.desc} ${d.domain} ${d.key}`.toLowerCase())}">
        <td>${esc(d.group)}</td><td>${esc(d.desc)}</td>
        <td><code>${d.currentHost ? '-currentHost ' : ''}${esc(d.domain)}</code><br><code>${esc(d.key)}</code></td>
        <td><code>${esc(String(d.value))}</code></td></tr>`,
    )
    .join('');
  return `<section id="macos"><h2>macOS settings <span class="muted">(${defaults.length})</span></h2>
    <p>Only values that differ are written; only affected apps restart. Protected ones need Full Disk Access for the terminal.</p>
    <input id="filter" type="search" placeholder="Filter settings — e.g. dock, trackpad, finder" aria-label="Filter settings">
    <div class="table-wrap"><table id="defaults"><thead><tr><th>Group</th><th>What</th><th>Domain / key</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3>By hand (no reliable key)</h3><ul>${manualSettings.map((m) => `<li>System Settings → ${md(m)}</li>`).join('')}</ul></section>`;
}

function dotfilesSection(): string {
  const keys = Object.entries(keybinds)
    .map(
      ([group, list]) => `<div class="card"><h4>${esc(group)}</h4><dl class="keys">${list
        .map((k) => `<dt><kbd>${esc(k.keys)}</kbd></dt><dd>${esc(k.action)}</dd>`)
        .join('')}</dl></div>`,
    )
    .join('');
  return `<section id="dotfiles"><h2>Dotfiles</h2>
    <p>Linked from <code>dotfiles/&lt;package&gt;</code> into <code>$HOME</code> with GNU stow. Real files in the way go to <code>~/.setup-backup/&lt;date&gt;/</code>.</p>
    <dl class="defs">${DOTFILES.map(([p, d]) => `<dt><code>${p}</code></dt><dd>${d}</dd>`).join('')}</dl>
    <h3 id="keybinds">Keybinds</h3><div class="grid">${keys}</div></section>`;
}

function privateSection(): string {
  return `<section id="private"><h2>Private values</h2>
    <p>This repo is public. Personal values live in <code>~/.config/setthemacup/private.env</code>, asked for on the first run and never committed (template: <code>private.env.example</code>). Machine-only aliases go in <code>~/.config/zsh/local.zsh</code>.</p>
    <dl class="defs">${FIELDS.map((f) => `<dt><code>${f.key}</code></dt><dd>${esc(f.message)}</dd>`).join('')}</dl></section>`;
}

function usageSection(): string {
  return `<section id="usage"><h2>Re-running</h2><pre>${esc(HELP.split('\nDetails:')[0]!)}</pre>
    <p>After the run, a checklist of manual steps is shown and saved to <code>~/.setup/logs/next-steps.md</code>.</p></section>`;
}

const CSS = `
:root{--bg:#f7f5f0;--surface:#fffdf8;--text:#24221d;--muted:#6d685d;--line:#e2ddd2;--accent:#2f6f5e;--accent-soft:#e3efe9;--code:#efeadf;
--mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,monospace;--sans:-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#16181a;--surface:#1e2124;--text:#e7e4dc;--muted:#9a968d;--line:#2e3236;--accent:#7cc4ad;--accent-soft:#1f302b;--code:#262a2e}}
:root[data-theme="dark"]{--bg:#16181a;--surface:#1e2124;--text:#e7e4dc;--muted:#9a968d;--line:#2e3236;--accent:#7cc4ad;--accent-soft:#1f302b;--code:#262a2e}
*{box-sizing:border-box}p,li,dd,td{overflow-wrap:anywhere}body{overflow-x:hidden;margin:0;background:var(--bg);color:var(--text);font:16px/1.6 var(--sans)}
main,header .wrap,nav .wrap{max-width:1040px;margin:0 auto;padding:0 16px}
header{padding:56px 0 32px;border-bottom:1px solid var(--line)}h1{font-size:clamp(2rem,5vw,3rem);margin:0 0 8px;letter-spacing:-.02em}
.tag{color:var(--muted);font-size:1.15rem;margin:0 0 24px;max-width:640px}
.cmd{display:flex;gap:8px;align-items:stretch;max-width:100%}.cmd pre{flex:1;min-width:0;margin:0;overflow-x:auto}
button{font:inherit;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:8px;padding:0 14px;cursor:pointer}button:hover{border-color:var(--accent)}
nav{position:sticky;top:0;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);z-index:1}
nav .wrap{display:flex;gap:20px;overflow-x:auto;padding-top:10px;padding-bottom:10px}nav a{color:var(--muted);text-decoration:none;white-space:nowrap;font-size:.95rem}nav a:hover{color:var(--accent)}
section{padding:40px 0 8px}h2{font-size:1.6rem;margin:0 0 8px;letter-spacing:-.01em}h3{margin:28px 0 12px}h4{margin:0 0 10px;font-size:.95rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.muted{color:var(--muted);font-weight:400}code,kbd,pre{font-family:var(--mono);font-size:.88em}code{background:var(--code);padding:1px 5px;border-radius:4px}
pre{background:var(--code);padding:14px 16px;border-radius:10px;overflow-x:auto;line-height:1.5}
kbd{border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:1px 6px;background:var(--surface);white-space:nowrap}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px}
.steps{list-style:none;padding:0;display:grid;gap:14px}.step ul{margin:8px 0 0;padding-left:20px}.step li{margin:3px 0}
.step-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.step-head h3{margin:0;font-size:1.15rem}
.num{width:28px;height:28px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-weight:600;font-size:.9rem;flex:none}
.id{color:var(--muted)}.pill{font-size:.75rem;background:var(--accent);color:var(--bg);border-radius:99px;padding:1px 9px}.lead{margin:8px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:14px}
dl{margin:0;display:grid;grid-template-columns:max-content 1fr;gap:6px 14px}dd{margin:0}.keys dt{text-align:right}
.defs{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px}
input[type=search]{width:100%;font:inherit;padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);margin:8px 0 12px}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}table{border-collapse:collapse;width:100%;font-size:.92rem}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{position:sticky;top:0;background:var(--surface);color:var(--muted);font-weight:600}tr:last-child td{border-bottom:0}
footer{color:var(--muted);text-align:center;padding:48px 16px;font-size:.9rem}
@media (max-width:600px){dl{grid-template-columns:1fr}.keys dt{text-align:left}dd{margin-bottom:6px}header{padding-top:36px}}`;

const JS = `
const f=document.getElementById('filter');f&&f.addEventListener('input',()=>{const q=f.value.trim().toLowerCase();for(const r of document.querySelectorAll('#defaults tbody tr'))r.hidden=q&&!r.dataset.search.includes(q)});
const b=document.getElementById('copy');b&&b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.cmd);b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1500)}catch{}});`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>setthemacup</title>
<meta name="description" content="One command from a fresh Mac to a full dev environment: what it installs and changes.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍎</text></svg>">
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap">
  <h1>setthemacup</h1>
  <p class="tag">One command from a fresh Mac to my full dev environment. Everything it installs and changes is on this page.</p>
  <div class="cmd"><pre>${esc(ONE_LINER)}</pre><button id="copy" data-cmd="${esc(ONE_LINER)}">Copy</button></div>
</div></header>
<nav><div class="wrap"><a href="#steps">Steps</a><a href="#packages">Packages</a><a href="#macos">macOS settings</a><a href="#dotfiles">Dotfiles</a><a href="#keybinds">Keybinds</a><a href="#private">Private values</a><a href="#usage">Re-running</a></div></nav>
<main>
${stepsSection()}
${packagesSection()}
${defaultsSection()}
${dotfilesSection()}
${privateSection()}
${usageSection()}
</main>
<footer>Generated from the installer's data by <code>pnpm run docs</code> · <a href="https://github.com/mahi160/setthemacup">github.com/mahi160/setthemacup</a></footer>
<script>${JS}</script>
</body>
</html>
`;

writeFileSync(join(REPO, 'docs/index.html'), html);
writeFileSync(join(REPO, 'docs/.nojekyll'), '');
console.log('docs/index.html written');
