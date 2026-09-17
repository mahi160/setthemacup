# setthemacup

Full macOS dev-environment setup repo (bootstrap script, dotfiles, agent config). Single context — see `docs/adr/` for decisions.

## Language

**Fast command**:
One of the 6 personal git-workflow slash commands (`/commit`, `/pr`, `/pr-check`, `/standup`, `/review`, `/test`), registered via `pi.registerCommand` by `dotfiles/pi/.pi/agent/extensions/fast-commands/index.ts`. Each handler looks itself up by name in the Command registry, then spawns `pi -p --model <model> --thinking <thinking>` (default text mode — its stdout is exactly the final assistant text, verified in print-mode.js, no JSON event parsing needed) as a direct child process with the matching prompt file's contents (wrapped in an imperative "execute this now" preamble — the raw file is passive numbered steps, and a bare child model just describes them without that wrapper) as the prompt — a self-owned, directly-spawned isolated subprocess, not routed through the `pi-subagents` package.
_Avoid_: subagent (that's the generic, general-purpose delegation the `pi-subagents` package still provides for everything else — chains, parallel, async, the `research`/`code-review` skills)

**Command registry**:
`dotfiles/pi/.pi/agent/extensions/fast-commands/commands.json` — one entry per Fast command: `{name, model, thinking, prompt}`. `prompt` is a filename resolved relative to the `fast-commands/` folder (e.g. `"commit.md"`), not a path elsewhere. `model` is a full `provider/id` string. Current entries: `commit`/`standup` → `haiku-4-5` + `low`; `pr`/`pr-check`/`test` → `sonnet-5` + `medium`; `review` → `sonnet-5` + `high` (capped below `opus-5` deliberately — see ADR 0002).
_Avoid_: agents/*.md frontmatter (superseded — model/thinking live in the registry, prompt files are plain instructions, same shape as today's `commit.md`)

**Ask-bridge**:
The mechanism letting a fast command's isolated subprocess ask the real user a question mid-run: it emits `ASK: <question>` as its entire output, the parent session pauses and shows the question via the real `ask_user` overlay, then re-runs the fast command with the answer folded into the prompt (capped at 3 rounds).
_Avoid_: clarifying question (a fast command must never just say something ambiguous and stop as its final answer — that's the bug the ask-bridge exists to catch)

## Tool-bank

**Tool-bank**:
The extension letting an agent author small deterministic bash-backed tools mid-session and persist them so any later session can call them without re-deriving the logic. Global registry at `~/.pi/agent/`, built on pi's own `registerTool`/`setActiveTools`/`search_tools` mechanism.
_Avoid_: dynamic tooling, dynamic tool loading (that's pi's own built-in *activation* mechanism this extension is built on top of — not this extension itself)

**Saved tool**:
A single bash-backed tool, authored by the agent via `save_tool` and persisted in the tool-bank registry. Registered globally with `pi.registerTool()` at startup, kept inactive until a `search_tools`-style loader activates it for the current task. Code is always a bash script or command — a saved tool that needs Python shells out to `python3` itself rather than declaring a separate runtime.
_Avoid_: snippet, script (implies something not independently callable)

**Tool-bank registry**:
The JSON file holding every saved tool (name, description, parameter schema, bash code), global across all projects, not per-project.
_Avoid_: tool config, tool cache

**save_tool**:
The tool-bank tool an agent calls to persist a new saved tool. Rejects the call if the name already exists in the registry — no silent overwrite.

**Save log**:
An append-only plain-text file the tool-bank writes one line to on every successful `save_tool` call (name, timestamp, description), plus a live `ctx.ui.notify()` toast. Exists because saving has no human-approval gate — this is the only audit trail for what got persisted.
_Avoid_: audit log (no structured format, just a scannable trail)
