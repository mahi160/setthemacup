# MIGRATE.md — merge `dotfiles/pi-old/` into `dotfiles/pi/`

Goal: one pi config tree at `dotfiles/pi/`. Delete `pi-old/` when done.

---

## Why this exists

Names are backwards. `pi-old/` is the **newer** tree.

Verified from git:

- `pi-old/` == exact content of `dotfiles/pi/` at `a7029bb` (tip−1) — the curated, evolved config.
- `58740a2 "chore: clean up"` reverted `dotfiles/pi/` shared files to their `07af2c1` state (5 commits back) **and** resurrected extensions that `6ee2e89 "retire fast-commands, prune skills"` had deliberately deleted (they had survived untracked on disk — mtimes Jul 6–8).
- `~/.pi → .setup/dotfiles/pi/.pi`, so the reverted tree is what runs today.

Rule of thumb for the merge:

| Category | Winner |
|---|---|
| Files both trees have | `pi-old` (always the later revision) |
| Extensions only `pi` has | case-by-case, see table below |
| Extensions only `pi-old` has | keep `agents-skills.ts`, `fzf-file.ts`, `shared/notify.ts`; drop `fast-commands/` |
| `settings.json` | `pi` as base, re-add 2 lost keys |

---

## Decisions

### Keep from `pi/`

| Path | Why |
|---|---|
| `extensions/agents/` (+ `config/agents.json`, `config/prompts/*.md`) | Best asset in either tree. 6 user commands **plus** 4 AI-callable subagent tools (`scout`, `diff_review`, `tests`, `security`) with `guidelines[]` injected into the system prompt. Strict superset of `fast-commands/`. |
| `extensions/shared/spawn-subagent.ts` | Required by `agents/`. |
| `prompts/tools.md` | `/tools` command, referenced by `APPEND_SYSTEM.md`. |
| `extensions/budget-guard.ts` | Daily/weekly USD + message caps via `budget.json`. No equivalent in `pi-old`. |
| `extensions/herdr-agent-state.ts` | Vendor-generated. Keep **only if herdr is still in use**, else delete. |
| `settings.json` | Richer: `compaction`, `retry`, `doubleEscapeAction`, `treeFilterMode`, `editorPaddingX`, `collapseChangelog`, `enableInstallTelemetry`, `autocompleteMaxVisible`, `branchSummary`, `images`. |

### Take from `pi-old/`

| Path | Replaces | Why |
|---|---|---|
| `extensions/footer/{format,index,models,render,state}.ts` | same paths in `pi` | `visibleWidth()`-correct justify (nerd-font/wide chars); `ctx.modelRegistry.getProviderDisplayName()` instead of a hand-maintained `MODEL_NAMES` table that already drifted; `safe()` teardown guard; no dead plannotator polling. |
| `extensions/shared/git.ts` | same | One generic `cachedGit(ttl, args, parse)` + `seed()` vs two duplicated module-global cache blocks. |
| `extensions/safe-bash.ts` | same | `/yolo` session toggle + cp/mv source-exemption (staging in `/tmp` then copying into a real path no longer blocked). |
| `extensions/notifier.ts` | same | Portable `notify()`, `ask_user` prompt bridge, doc-comment matches behaviour. |
| `extensions/stats/*` | same | Native `getSessionId()`, skill tracking via `read` on `SKILL.md` (no event bus), auto-compact action. |
| `extensions/shared/notify.ts` | `shared/macOS-notify.ts` | Cross-platform. |
| `extensions/agents-skills.ts` | `extensions/skills.ts` + 47 `skills/*` symlinks | 19 LOC, `resources_discover` → `skillPaths`, native `/skill:*` commands, zero symlinks. |
| `extensions/fzf-file.ts` | — | fd+fzf ranked `@file` autocomplete with fallback. No equivalent in `pi`. |
| `APPEND_SYSTEM.md` | same | Identical prose, prettier-formatted. Must re-add `pi`'s `# Tools` header block. |

Identical in both, no action: `keybindings.json`, `themes/*.json`, `extensions/title.ts`, `extensions/stats/format.ts`.

### Delete

| Path | Why |
|---|---|
| `pi/extensions/claude/` (incl. `node_modules/`, 1.7 MB) | Local Anthropic-OAuth patch extension. AGENTS.md hard rule: *"Do not reintroduce a local extension for this"* — `npm:@gotgenes/pi-anthropic-auth` owns this. Sees the OAuth token, ships a pnpm store into git, and its `pi-claude-code-use.json` aliases `mcp__subagents__*` tools that no longer exist. |
| `pi/extensions/skills.ts` + `pi/skills/*` (47 symlinks) | Superseded by `agents-skills.ts`. |
| `pi/extensions/shared/macOS-notify.ts` | Superseded by `shared/notify.ts`. |
| `pi/extensions/shared/bus.ts` | Only consumers were `skills.ts` and stats v3. Confirm zero references after phase 2, then delete. |
| `pi-old/extensions/fast-commands/` | Superseded by `agents/`. Never lands. |
| `pi-old/` (whole tree) | After phase 4. |

### Open question — pick one, not both

`ask-user`: local `pi/extensions/ask-user/index.ts` (346 LOC, maintain forever) **or** npm `@juicesharp/rpiv-ask-user-question` (used by `pi-old`, and `pi-old/notifier.ts` bridges its `rpiv:ask-user:prompt` event).

Local is currently live and working. npm is less code to own. If npm wins, pin it exactly and keep `pi-old`'s `notifier.ts` bridge; if local wins, strip the bridge from `notifier.ts` after restoring it.

---

## Phases

Ordered lowest-risk first. Each phase ends in a working config.

### Phase 0 — safety net

```bash
cd ~/.setup
git status --short            # must be clean apart from known drift
git switch -c chore/pi-merge
```

Rollback at any point: `git checkout -- dotfiles/pi` (nothing here is committed until you ask).

### Phase 1 — pure deletion (zero behaviour risk)

1. `rm -rf dotfiles/pi/.pi/agent/extensions/claude`
2. `.gitignore` += `**/trust.json` and `**/extensions/**/node_modules/`
3. `git rm --cached dotfiles/pi-old/.pi/agent/trust.json`

**Verify:** `pi` starts; model list still works via `@gotgenes/pi-anthropic-auth` (added in phase 4 — if OAuth breaks before then, do phase 4 first).

### Phase 2 — skills consolidation

1. Copy `pi-old/.pi/agent/extensions/agents-skills.ts` → `pi/.pi/agent/extensions/`
2. `rm dotfiles/pi/.pi/agent/extensions/skills.ts`
3. `rm dotfiles/pi/.pi/agent/skills/*` (the 47 symlinks; keep the dir if `~/.agents/skills` is the only root)
4. `grep -rn "shared/bus" dotfiles/pi/.pi/agent/extensions` → if empty after phase 3, `rm shared/bus.ts`

**Verify:** `/skill:` autocompletes and lists ~47 skills; `/skill:tdd` loads.

### Phase 3 — restore the newer shared files (highest risk)

Copy from `pi-old/.pi/agent/` → `pi/.pi/agent/`:

```
extensions/footer/format.ts
extensions/footer/index.ts
extensions/footer/models.ts
extensions/footer/render.ts
extensions/footer/state.ts
extensions/shared/git.ts
extensions/shared/notify.ts
extensions/safe-bash.ts
extensions/notifier.ts
extensions/stats/db.ts
extensions/stats/html.ts
extensions/stats/index.ts
extensions/stats/package.json
extensions/stats/themes/gruvbox.css.ts
extensions/stats/themes/kanagawa.css.ts
APPEND_SYSTEM.md
```

Then:

1. `rm dotfiles/pi/.pi/agent/extensions/shared/macOS-notify.ts`
2. Re-add the `# Tools` header block to `APPEND_SYSTEM.md` (present in `pi`'s copy, absent in `pi-old`'s) — it documents `/tools`, subagents, `mcp__ask_user`, plannotator.
3. `grep -rn "macOS-notify\|MODEL_NAMES\|plannotator" dotfiles/pi/.pi/agent/extensions` → expect zero hits outside `agents/`.
4. stats regression check: the restored stats drops the `qna` table, `toolless` inputs, and `requestCount`. `scripts/pi-qna.sh` does **not** read `stats.db` — confirmed safe. Existing `stats.db` keeps the extra columns; they just stop being written.

**Verify:**
- footer aligns with nerd-font glyphs at narrow widths
- footer shows the real model name for `claude-opus-5` (not the raw id)
- `/yolo` exists and toggles safe-bash off
- `/stats` renders; notifications still fire on `agent_end`

### Phase 4 — settings + packages

`settings.json` = `pi`'s file, plus:

```jsonc
"steeringMode": "all",
"packages": [
  "npm:@gotgenes/pi-anthropic-auth@<exact>",   // required by AGENTS.md
  "npm:@plannotator/pi-extension@<exact>",
  "npm:pi-web-access@<exact>"
  // + "npm:@juicesharp/rpiv-ask-user-question@<exact>" only if npm ask-user wins
]
```

Pin every entry to an exact version in both `settings.json` and `npm/package.json` — AGENTS.md: unpinned `npm:` floats, and provider-overriding extensions see your OAuth token. Resolve `<exact>` with `npm view <pkg> version`.

**Verify:** `pi` startup installs nothing unexpected; Anthropic OAuth (Pro/Max) still authenticates; `plannotator_submit_plan` still registered.

### Phase 5 — extras

1. `fzf-file.ts`: copy from `pi-old`, confirm `fd` and `fzf` are in `apps.json` formulae.
2. `herdr-agent-state.ts`: keep or delete based on whether herdr is still used.
3. `ask-user`: resolve the open question above.
4. `rm -rf dotfiles/pi-old` (needs explicit approval — destructive).

### Phase 6 — docs

- `AGENTS.md`: pi section — `fast-commands` → `extensions/agents/`; note `claude/` removed and why; note skills come from `~/.agents/skills` via `agents-skills.ts`, not committed symlinks.
- `CONTEXT.md`: same drift.
- `docs/adr/0002-fast-commands-json-registry.md`: supersede or amend — the registry now lives at `extensions/agents/config/agents.json` with `type: user | ai`.
- New ADR: "single pi config tree; agents/ replaces fast-commands; OAuth compat is npm-owned."
- Delete this file.

---

## Post-merge shape

```
dotfiles/pi/.pi/agent/
├── APPEND_SYSTEM.md          # pi-old prose + pi's # Tools block
├── keybindings.json
├── settings.json             # pi's + steeringMode + pinned packages
├── prompts/tools.md
├── themes/{github-dark,gruvbox-material,kanagawa-wave}.json
└── extensions/
    ├── agents/               # from pi  — user commands + AI subagents
    ├── ask-user/             # from pi  — OR the npm package, not both
    ├── agents-skills.ts      # from pi-old
    ├── budget-guard.ts       # from pi
    ├── fzf-file.ts           # from pi-old
    ├── footer/               # from pi-old
    ├── herdr-agent-state.ts  # from pi  — if herdr still used
    ├── notifier.ts           # from pi-old
    ├── safe-bash.ts          # from pi-old
    ├── stats/                # from pi-old
    ├── title.ts              # identical
    └── shared/
        ├── git.ts            # from pi-old
        ├── notify.ts         # from pi-old
        └── spawn-subagent.ts # from pi
```

Extensions dir: 2.0 MB → ~200 KB.

---

## Known non-goals

- Not touching `sessions/`, `stats.db*`, `auth.json`, `models-store.json` — runtime state, already gitignored.
- Not migrating stats schema; extra v3 columns are left in place, unwritten.
- No commits without explicit approval (AGENTS.md hard rule).
