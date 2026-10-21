/**
 * Builds docs/index.html (GitHub Pages) from the installer's own data:
 * steps, apps, pnpm globals, skills, defaults, keybinds and private fields.
 * Run: pnpm run docs
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { apps, pnpmGlobals, type AppKind } from './data/apps.ts';
import { defaults, manualSettings } from './data/defaults.ts';
import { keybinds } from './data/keybinds.ts';
import { skills } from './data/skills.ts';
import { writeArgs } from './lib/defaults.ts';
import { FIELDS } from './lib/private.ts';
import { HELP } from './plan.ts';
import { steps } from './steps/index.ts';

const REPO = resolve(import.meta.dirname, '..');
const WORDS: Record<number, string> = { 9: 'Nine', 10: 'Ten', 11: 'Eleven', 12: 'Twelve', 13: 'Thirteen' };
const ONE_LINER = 'curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash';
const GITHUB = 'https://github.com/mahi160/setthemacup';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Escape, then render `code` spans */
const md = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const short = (name: string) => name.split('/').pop()!;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shellArg = (s: string) => (/^[\w@%+=:,./~-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

const DOTFILES: [string, string, string][] = [
  ['zsh', '~/.zshrc · ~/.config/zsh', 'oh-my-zsh with the two-line <code>mahi</code> prompt, fnm, fzf history, <code>z</code>, autosuggestions, syntax highlighting'],
  ['ghostty', '~/.config/ghostty', 'Cascadia Code, background blur, a Pokemon in the corner, theme overlay'],
  ['tmux', '~/.config/tmux', 'Prefix C-a, vim pane keys, a native status bar (git, now playing, Claude usage), flowd autostart'],
  ['nvim', '~/.config/nvim', 'LazyVim with oil; the colorscheme follows <code>theme</code>'],
  ['git', '~/.gitconfig', 'delta diffs and sane defaults; identity lives in <code>~/.gitconfig.local</code>'],
  ['ssh', '~/.ssh/config', 'Keychain-backed keys and the GitHub host; work host in <code>config.local</code>'],
  ['lazygit', '~/.config/lazygit', 'Config plus a theme overlay'],
  ['fastfetch', '~/.config/fastfetch', 'System info layout'],
  ['pi', '~/.pi', 'The whole agent directory: extensions, settings, themes, MCP servers'],
  ['stow', '~/.stow-global-ignore', 'What stow never links'],
];

// ── Hero: the installer as you see it ──────────────────────────────────────
function terminal(): string {
  const optional = steps.filter((s) => !s.required);
  const width = Math.max(...optional.map((s) => s.title.length));
  const rows = optional
    .map((s) => `<span class="t-bar">│</span>  <span class="t-on">◼</span> ${esc(s.title.padEnd(width))}  <span class="t-dim">${esc(clip(s.summary.split(' (')[0]!, 40))}</span>`)
    .join('\n');
  return `<figure class="term" aria-label="The installer's checklist">
<figcaption><span>~/.setup</span><span>setup</span></figcaption>
<pre><span class="t-bar">┌</span>  <span class="t-title"> setthemacup </span>
<span class="t-bar">│</span>
<span class="t-ok">◇</span>  Checked this Mac
<span class="t-bar">│</span>
<span class="t-act">◆</span>  Choose what to set up <span class="t-dim">(Homebrew always runs)</span>
${rows}
<span class="t-bar">└</span></pre>
</figure>`;
}

// ── The run ────────────────────────────────────────────────────────────────
function stepsSection(): string {
  const items = steps
    .map(
      (s, i) => `
      <li class="step" id="step-${s.id}">
        <div class="step-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</div>
        <div class="step-body">
          <h3>${esc(s.title)} <code class="step-id">--only ${s.id}</code>${s.required ? ' <span class="tag">always runs</span>' : ''}</h3>
          <p class="step-sum">${md(s.summary)}</p>
          <ul>${s.details.map((d) => `<li>${md(d)}</li>`).join('')}</ul>
          ${s.requires?.length ? `<p class="needs">Pulls in <span>${s.requires.map((r) => `<code>${r}</code>`).join(' ')}</span></p>` : ''}
        </div>
      </li>`,
    )
    .join('');
  return `<section id="run" aria-labelledby="run-h">
    <header class="sec-head"><p class="eyebrow">The run</p><h2 id="run-h">${WORDS[steps.length] ?? steps.length} steps, in this order</h2>
    <p class="lede">You answer everything in the first few minutes: your Mac password, the checklist, a GitHub login in Brave and SSH passphrases. Then it runs on its own. Homebrew always runs; everything else is a checkbox, all on by default. Each step checks what's already done, so running it again only fills the gaps.</p></header>
    <ol class="steps">${items}</ol></section>`;
}

// ── Packages ───────────────────────────────────────────────────────────────
function packageGroup(kind: AppKind, title: string, note: string): string {
  const list = apps.filter((a) => a.kind === kind);
  const cats = [...new Set(list.map((a) => a.category))];
  return `<div class="pkg">
    <h3>${title} <span class="count">${list.length}</span></h3><p class="note">${note}</p>
    <div class="cats">${cats
      .map(
        (c) => `<div class="cat"><h4>${esc(c)}</h4><dl>${list
          .filter((a) => a.category === c)
          .map((a) => `<div><dt>${esc(short(a.name))}${a.name.includes('/') ? `<span class="tap">${esc(a.name.split('/').slice(0, 2).join('/'))}</span>` : ''}</dt><dd>${md(a.desc)}</dd></div>`)
          .join('')}</dl></div>`,
      )
      .join('')}</div></div>`;
}

function packagesSection(): string {
  const skillRows = skills
    .map((s) => `<div><dt>${esc(s.repo)}</dt><dd>${s.skills.map((n) => `<code>${esc(n)}</code>`).join(' ')}</dd></div>`)
    .join('');
  return `<section id="packages" aria-labelledby="pkg-h">
    <header class="sec-head"><p class="eyebrow">What gets installed</p><h2 id="pkg-h">Packages</h2>
    <p class="lede">The lists live in <code>installer/data/*.json</code>. Each kind installs in one batched <code>brew install</code>; third-party taps are added first.</p></header>
    ${packageGroup('formula', 'CLI tools', 'Homebrew formulae')}
    ${packageGroup('cask', 'Apps', 'Homebrew casks, including fonts')}
    <div class="pkg pkg-pair">
      <div><h3>pnpm globals <span class="count">${pnpmGlobals.length}</span></h3><p class="note">Always the latest version</p>
        <dl class="flat">${pnpmGlobals.map((p) => `<div><dt>${esc(p.name)}</dt><dd>${md(p.desc)}</dd></div>`).join('')}</dl></div>
      <div><h3>Agent skills <span class="count">${skills.flatMap((s) => s.skills).length}</span></h3><p class="note">For pi, in <code>~/.agents/skills</code></p>
        <dl class="flat">${skillRows}</dl></div>
    </div>
    <aside class="callout" id="sync">
      <h3>The lists keep themselves current</h3>
      <p>Every day at noon, <code>setup --sync</code> compares what's installed with the day before. Something you <code>brew install</code>, <code>pnpm add -g</code> or <code>npx skills add</code> by hand is appended under <strong>Inbox</strong> with its description. Something you uninstall drops out. A notification tells you what changed, and you commit when you're ready.</p>
    </aside></section>`;
}

// ── macOS settings ─────────────────────────────────────────────────────────
function defaultsSection(): string {
  const groups = [...new Set(defaults.map((d) => d.group))];
  const body = groups
    .map((g) => {
      const rows = defaults.filter((d) => d.group === g);
      return `<tbody data-group="${slug(g)}"><tr class="grp"><th colspan="2" scope="rowgroup">${esc(g)} <span class="count">${rows.length}</span></th></tr>${rows
        .map((d) => {
          const cmd = writeArgs(d, '~').map(shellArg).join(' ');
          return `<tr data-q="${esc(`${g} ${d.desc} ${d.domain} ${d.key}`.toLowerCase())}"><td>${esc(d.desc)}${d.optional ? ' <span class="tag tag-soft">needs Full Disk Access</span>' : ''}</td><td><code class="cmd"><span class="dim">defaults</span> ${esc(cmd)}</code></td></tr>`;
        })
        .join('')}</tbody>`;
    })
    .join('');
  const chips = [
    `<button type="button" class="chip" aria-pressed="true" data-g="">All ${defaults.length}</button>`,
    ...groups.map((g) => `<button type="button" class="chip" aria-pressed="false" data-g="${slug(g)}">${esc(g)}</button>`),
  ].join('');
  return `<section id="macos" aria-labelledby="mac-h">
    <header class="sec-head"><p class="eyebrow">System settings</p><h2 id="mac-h">macOS, the way it should feel</h2>
    <p class="lede">${defaults.length} settings. A run reads each one first and writes only those that drifted, then restarts just the apps that need it (Dock, Finder, SystemUIServer).</p></header>
    <div class="filters"><label class="search" for="q"><span class="visually-hidden">Filter settings</span><input id="q" type="search" placeholder="Filter: dock, trackpad, finder…" autocomplete="off"></label>
    <div class="chips" role="group" aria-label="Setting groups">${chips}</div></div>
    <div class="table-wrap"><table class="settings"><thead><tr><th scope="col">What it does</th><th scope="col">Command</th></tr></thead>${body}</table>
    <p class="empty" id="empty" hidden>No setting matches that filter.</p></div>
    <div class="also"><div><h3>Also set</h3><ul>
      <li>Caps Lock works as Control (a <code>hidutil</code> LaunchAgent, no Karabiner)</li>
      <li>⌘Space is freed from Spotlight for Tinycast</li>
      <li>No startup chime</li>
      <li>Display scaling: the largest HiDPI mode of the built-in screen ("More Space")</li></ul></div>
    <div><h3>Left for you</h3><p class="note">No reliable setting exists for these, so the run lists them at the end.</p><ul>${manualSettings.map((m) => `<li>${md(m)}</li>`).join('')}</ul></div></div>
    </section>`;
}

// ── Dotfiles + keybinds ────────────────────────────────────────────────────
function dotfilesSection(): string {
  const keys = Object.entries(keybinds)
    .map(
      ([group, list]) => `<div class="keys"><h4>${esc(group)}</h4><dl>${list
        .map((k) => `<div><dt>${k.keys.split(' / ').map((part) => `<kbd>${esc(part)}</kbd>`).join('<span class="sep">/</span>')}</dt><dd>${esc(k.action)}</dd></div>`)
        .join('')}</dl></div>`,
    )
    .join('');
  return `<section id="dotfiles" aria-labelledby="dot-h">
    <header class="sec-head"><p class="eyebrow">Configuration</p><h2 id="dot-h">Dotfiles</h2>
    <p class="lede">GNU stow links each folder in <code>dotfiles/</code> into your home folder. A real file in the way moves to <code>~/.setup-backup/&lt;date&gt;/</code> first; nothing is overwritten.</p></header>
    <div class="table-wrap"><table class="dots"><thead><tr><th scope="col">Package</th><th scope="col">Lands at</th><th scope="col">What it sets up</th></tr></thead><tbody>${DOTFILES.map(
      ([p, where, what]) => `<tr><th scope="row"><code>${p}</code></th><td><code class="path">${esc(where)}</code></td><td>${what}</td></tr>`,
    ).join('')}</tbody></table></div>
    <h3 id="keybinds" class="sub">Keybinds</h3>
    <div class="keygrid">${keys}</div></section>`;
}

// ── Private values + commands ──────────────────────────────────────────────
function privateSection(): string {
  return `<section id="private" aria-labelledby="priv-h">
    <header class="sec-head"><p class="eyebrow">Kept out of the repo</p><h2 id="priv-h">Private values</h2>
    <p class="lede">This repo is public. Git identity, work folder, notes vaults, SMB shares, VPN gateways and machine-only aliases live in a separate <strong>private</strong> GitHub repo, <code>&lt;you&gt;/setthemacup-private</code>, cloned to <code>~/.config/setthemacup</code>. On a new Mac the Private settings step logs in with <code>gh</code> and clones it, so there's nothing to type. The very first time, it asks each value below once and creates that repo for you. The daily sync pushes any edits.</p></header>
    <div class="table-wrap"><table class="vars"><tbody>${FIELDS.map((f) => `<tr><th scope="row"><code>${f.key}</code></th><td>${esc(f.message)}${f.required ? ' <span class="tag tag-soft">required</span>' : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function usageSection(): string {
  const usage = HELP.split('\nDetails:')[0]!.split('\n').slice(2).join('\n').trim();
  return `<section id="usage" aria-labelledby="use-h">
    <header class="sec-head"><p class="eyebrow">Afterwards</p><h2 id="use-h">Running it again</h2>
    <p class="lede"><code>setup</code> is on your PATH once the first run finishes. The end of every run shows a short list of things only a person can do (sign-ins, permissions, a restart), also saved to <code>~/.setup/logs/next-steps.md</code>.</p></header>
    <pre class="code">${esc(usage)}</pre></section>`;
}

// ── Page ───────────────────────────────────────────────────────────────────
const LIGHT = '--bg:#f5f1d6;--surface:#faf7e6;--sunk:#ece5c0;--line:#dcd5ae;--fg:#43436c;--muted:#5f5f78;--faint:#8a8980;--accent:#4d699b;--accent-ink:#f7f2cf;--warm:#836f2a;--green:#6f894e;color-scheme:light';

const CSS = `
/* Layout: a sticky contents rail beside one reading column; the hero pairs the pitch with the real installer checklist.
   Palette: the repo's own default theme, Kanagawa (Wave dark first, Lotus light). */
:root{
  --bg:#1f1f28;--surface:#2a2a37;--sunk:#16161d;--line:#363646;
  --fg:#dcd7ba;--muted:#a3a08f;--faint:#727169;
  --accent:#7e9cd8;--accent-ink:#16161d;--warm:#e6c384;--green:#98bb6c;
  --display:"Bricolage Grotesque","Avenir Next",system-ui,sans-serif;
  --body:"Instrument Sans",-apple-system,"Helvetica Neue",sans-serif;
  --mono:"JetBrains Mono","SF Mono",Menlo,monospace;
  --step:clamp(1rem,.95rem + .25vw,1.0625rem);
  color-scheme:dark;
}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){${LIGHT}}}
:root[data-theme="light"]{${LIGHT}}

*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:72px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--fg);font:400 var(--step)/1.6 var(--body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);background:var(--bg);z-index:10}
a{color:var(--accent);text-underline-offset:3px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
code,kbd,pre{font-family:var(--mono);font-size:.86em}
p code,li code,dd code,td code,.lede code{background:var(--sunk);padding:.1em .38em;border-radius:5px;overflow-wrap:anywhere}
h1,h2,h3,h4{font-family:var(--display);text-wrap:balance;margin:0;font-weight:600}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{max-width:1180px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}

/* Hero */
.hero{padding-block:clamp(40px,7vw,88px) clamp(32px,5vw,56px);border-bottom:1px solid var(--line)}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:clamp(28px,5vw,64px);align-items:center}
.brand{font:500 .8rem/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 18px;display:flex;gap:10px;align-items:center}
.brand i{width:9px;height:9px;border-radius:2px;background:var(--accent);display:inline-block}
h1{font-size:clamp(2.6rem,1.6rem + 4.2vw,4.6rem);line-height:.98;letter-spacing:-.035em;font-weight:700}
h1 em{font-style:normal;color:var(--warm)}
.pitch{font-size:1.15rem;color:var(--muted);max-width:34rem;margin:20px 0 28px}
.oneliner{display:flex;align-items:stretch;border:1px solid var(--line);border-radius:10px;background:var(--sunk);max-width:100%}
.oneliner code{flex:1;min-width:0;overflow-x:auto;white-space:nowrap;padding:14px 16px;font-size:.84rem;background:none}
.oneliner code::before{content:"$ ";color:var(--faint)}
.copy{font:600 .82rem var(--body);border:0;border-left:1px solid var(--line);background:var(--surface);color:var(--fg);padding:0 18px;border-radius:0 10px 10px 0;cursor:pointer}
.copy:hover{color:var(--accent)}
.hero-links{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:18px;font-size:.92rem}
.hero-links a{color:var(--muted)}.hero-links a:hover{color:var(--accent)}

.term{margin:0;border:1px solid var(--line);border-radius:12px;background:var(--sunk);overflow:hidden;min-width:0;box-shadow:0 24px 60px -30px rgb(0 0 0 / .55)}
.term figcaption{display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--line);font:500 .75rem var(--mono);color:var(--faint)}
.term pre{margin:0;padding:18px 18px 20px;overflow-x:auto;font-size:.8rem;line-height:1.7;color:var(--fg)}
.t-bar,.t-dim{color:var(--faint)}.t-ok,.t-on{color:var(--green)}.t-act{color:var(--accent)}
.t-title{background:var(--fg);color:var(--sunk);font-weight:700}
.term pre{line-height:1.55}

/* Body grid with a contents rail */
.layout{display:grid;grid-template-columns:200px minmax(0,1fr);gap:56px;padding-block:40px 80px}
.toc{position:sticky;top:calc(env(safe-area-inset-top,0px) + 32px);align-self:start;font-size:.9rem}
.toc p{font:500 .72rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin:0 0 12px}
.toc ol{list-style:none;margin:0;padding:0;display:grid;gap:2px;border-left:1px solid var(--line)}
.toc a{display:block;padding:5px 0 5px 14px;margin-left:-1px;border-left:2px solid transparent;color:var(--muted);text-decoration:none}
.toc a:hover,.toc a[aria-current="true"]{color:var(--fg);border-left-color:var(--accent)}
main{min-width:0;display:grid;gap:clamp(56px,8vw,96px)}
section{min-width:0}
.sec-head{max-width:44rem;margin-bottom:28px}
.eyebrow{font:500 .74rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--warm);margin:0 0 10px}
h2{font-size:clamp(1.75rem,1.3rem + 1.6vw,2.4rem);letter-spacing:-.02em;line-height:1.1}
.lede{color:var(--muted);margin:14px 0 0}
h3{font-size:1.15rem;letter-spacing:-.01em}
h3.sub{margin:44px 0 18px}
.count{font:500 .72rem var(--mono);color:var(--faint);vertical-align:.2em;margin-left:4px}
.note{color:var(--faint);font-size:.9rem;margin:4px 0 0}
.tag{font:600 .68rem var(--mono);letter-spacing:.04em;text-transform:uppercase;background:var(--accent);color:var(--accent-ink);border-radius:4px;padding:2px 7px;vertical-align:.25em;white-space:nowrap}
.tag-soft{background:var(--sunk);color:var(--muted);border:1px solid var(--line)}

/* Steps: a real sequence, so numbered */
.steps{list-style:none;margin:0;padding:0;display:grid}
.step{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px 20px;padding:24px 0;border-top:1px solid var(--line)}
.step:last-child{border-bottom:1px solid var(--line)}
.step-n{font:700 1.6rem/1 var(--display);color:var(--faint);letter-spacing:-.02em;padding-top:2px}
.step:hover .step-n{color:var(--accent)}
.step-body h3{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px}
.step-id{font-size:.74rem;color:var(--faint);font-weight:400}
.step-sum{margin:6px 0 10px}
.step ul{margin:0;padding-left:1.1rem;color:var(--muted);display:grid;gap:4px;max-width:46rem}
.step li::marker{color:var(--faint)}
.needs{margin:12px 0 0;font-size:.85rem;color:var(--faint)}
.needs span{display:inline-flex;flex-wrap:wrap;gap:6px;margin-left:6px}

/* Packages */
.pkg{margin-top:36px}
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:28px 40px;margin-top:18px}
.cat h4,.keys h4{font:500 .74rem var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:6px}
dl{margin:0}
.cat dl>div,.flat>div{display:grid;grid-template-columns:minmax(0,9.5rem) minmax(0,1fr);gap:12px;padding:6px 0;font-size:.92rem}
.cat dt,.flat dt{font-family:var(--mono);font-size:.84rem;overflow-wrap:anywhere}
.cat dd,.flat dd{margin:0;color:var(--muted)}
.tap{display:block;font-size:.7rem;color:var(--faint)}
.pkg-pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:28px 48px}
.flat{margin-top:12px}.flat>div{grid-template-columns:minmax(0,14rem) minmax(0,1fr);border-top:1px solid var(--line)}
.flat dd code{margin:0 4px 4px 0;display:inline-block}
.callout{margin-top:40px;padding:22px 24px;border-radius:12px;background:var(--surface);border:1px solid var(--line);max-width:52rem}
.callout h3{margin-bottom:8px}.callout p{margin:0;color:var(--muted)}

/* Settings */
.filters{display:flex;flex-direction:column;gap:12px;margin-bottom:16px}
.search input{width:100%;max-width:28rem;font:inherit;font-size:.95rem;padding:10px 14px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--fg)}
.search input::placeholder{color:var(--faint)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font:500 .8rem var(--body);padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}
.chip:hover{color:var(--fg);border-color:var(--faint)}
.chip[aria-pressed="true"]{background:var(--fg);border-color:var(--fg);color:var(--bg)}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{text-align:left;vertical-align:top;padding:10px 16px;border-top:1px solid var(--line)}
thead th{border-top:0;font:500 .72rem var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.settings td:first-child{min-width:14rem}
.grp th{background:var(--sunk);font:600 .9rem var(--display)}
.cmd{background:none!important;padding:0!important;font-size:.8rem;white-space:nowrap}
.cmd .dim{color:var(--faint)}
.empty{padding:20px 16px;margin:0;color:var(--muted)}
.also{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:28px 48px;margin-top:32px}
.also ul{margin:10px 0 0;padding-left:1.1rem;color:var(--muted);display:grid;gap:6px}

/* Dotfiles + keys */
.dots th[scope="row"] code,.vars th code{background:none;padding:0;color:var(--warm);font-size:.85rem}
.dots td,.vars td{color:var(--muted)}
.path{background:none!important;padding:0!important;color:var(--fg);white-space:nowrap}
.vars th{width:15rem;font-weight:400}
.keygrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:28px 40px}
.keys dl>div{display:grid;grid-template-columns:minmax(0,8.5rem) minmax(0,1fr);gap:12px;padding:6px 0;font-size:.9rem;align-items:baseline}
.keys dt{display:flex;flex-wrap:wrap;gap:4px;align-items:baseline}
.keys dd{margin:0;color:var(--muted)}
kbd{display:inline-block;font-size:.76rem;padding:2px 7px;border-radius:5px;border:1px solid var(--line);border-bottom-width:2px;background:var(--surface);white-space:nowrap}
.sep{color:var(--faint);font-size:.8rem}

pre.code{margin:0;padding:18px 20px;border-radius:12px;background:var(--sunk);border:1px solid var(--line);overflow-x:auto;line-height:1.65;font-size:.84rem}

footer{border-top:1px solid var(--line);padding-block:28px 40px;color:var(--faint);font-size:.88rem}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}

@media (max-width:980px){
  .hero .wrap{grid-template-columns:minmax(0,1fr)}
  .layout{grid-template-columns:minmax(0,1fr);gap:0;padding-top:0}
  .toc{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--line);margin:0 calc(-1 * max(16px,env(safe-area-inset-left,0px))) 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .toc p{display:none}
  .toc ol{display:flex;gap:4px;border:0;overflow-x:auto;scrollbar-width:none}
  .toc a{padding:12px 10px;border-left:0;margin-left:0;border-bottom:2px solid transparent;white-space:nowrap}
  .toc a:hover,.toc a[aria-current="true"]{border-bottom-color:var(--accent)}
}
@media (max-width:560px){
  .step{grid-template-columns:minmax(0,1fr)}
  .step-n{font-size:1.1rem}
  .cat dl>div,.flat>div,.keys dl>div{grid-template-columns:minmax(0,1fr);gap:2px}
  .vars th{width:auto}
}`;

const JS = `
(() => {
  const copy = document.getElementById('copy');
  copy?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copy.dataset.cmd); copy.textContent = 'Copied'; }
    catch { const r = document.createRange(); r.selectNodeContents(document.getElementById('cmd')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent = 'Press ⌘C'; }
    setTimeout(() => (copy.textContent = 'Copy'), 1800);
  });

  // Settings: text filter + group chips
  const q = document.getElementById('q'), chips = [...document.querySelectorAll('.chip')], empty = document.getElementById('empty');
  let group = '';
  const apply = () => {
    const term = q.value.trim().toLowerCase(); let shown = 0;
    for (const tb of document.querySelectorAll('.settings tbody')) {
      let n = 0;
      for (const tr of tb.querySelectorAll('tr[data-q]')) {
        const ok = (!group || tb.dataset.group === group) && (!term || tr.dataset.q.includes(term));
        tr.hidden = !ok; if (ok) n++;
      }
      tb.hidden = n === 0; shown += n;
    }
    empty.hidden = shown > 0;
  };
  q.addEventListener('input', apply);
  for (const c of chips) c.addEventListener('click', () => { group = c.dataset.g; chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c))); apply(); });

  // Contents rail follows the reader
  const links = new Map([...document.querySelectorAll('.toc a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { links.forEach((a) => a.removeAttribute('aria-current')); links.get(e.target.id)?.setAttribute('aria-current', 'true'); }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('main > section').forEach((s) => io.observe(s));
})();`;

const TOC: [string, string][] = [
  ['run', 'The run'],
  ['packages', 'Packages'],
  ['macos', 'macOS settings'],
  ['dotfiles', 'Dotfiles & keys'],
  ['private', 'Private values'],
  ['usage', 'Running it again'],
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>setthemacup</title>
<meta name="description" content="One command from a fresh Mac to a full dev environment. Everything it installs and changes.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%231f1f28'/><path d='M8 11l6 5-6 5' stroke='%237e9cd8' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='M16 22h8' stroke='%23e6c384' stroke-width='3' stroke-linecap='round'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<header class="hero"><div class="wrap">
  <div>
    <p class="brand"><i></i>setthemacup</p>
    <h1>A fresh Mac, <em>set up</em> in one command.</h1>
    <p class="pitch">My whole dev environment: tools, apps, dotfiles, keys and ${defaults.length} macOS settings. You pick what runs from a checklist, and every change it makes is listed below.</p>
    <div class="oneliner"><code id="cmd">${esc(ONE_LINER)}</code><button type="button" class="copy" id="copy" data-cmd="${esc(ONE_LINER)}">Copy</button></div>
    <p class="hero-links"><a href="#run">See every step</a><a href="#macos">Browse the settings</a><a href="${GITHUB}">Source on GitHub</a></p>
  </div>
  ${terminal()}
</div></header>
<div class="wrap layout">
  <nav class="toc" aria-label="Contents"><p>On this page</p><ol>${TOC.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ol></nav>
  <main>
${stepsSection()}
${packagesSection()}
${defaultsSection()}
${dotfilesSection()}
${privateSection()}
${usageSection()}
  </main>
</div>
<footer><div class="wrap"><span>Generated from the installer's own data with <code>pnpm run docs</code>.</span><a href="${GITHUB}">github.com/mahi160/setthemacup</a></div></footer>
<script>${JS}</script>
</body>
</html>
`;

writeFileSync(join(REPO, 'docs/index.html'), html);
writeFileSync(join(REPO, 'docs/.nojekyll'), '');
console.log('docs/index.html written');
