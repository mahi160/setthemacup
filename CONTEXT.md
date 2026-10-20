# setthemacup

Full macOS dev-environment setup repo (bootstrap script, dotfiles, agent config). Single context — see `docs/adr/` for decisions.

## Language

**Fast command**:
One of the 5 personal slash commands (`/commit`, `/pr`, `/pr-check`, `/review`, `/css-audit`), registered via `pi.registerCommand` by `dotfiles/pi/.pi/agent/extensions/pi-spawn/index.ts` — the same extension that owns `/spawn <task>`. Each handler looks itself up by name in the Command registry, then spawns `pi --mode rpc --model <model>:<thinking>` (full tool access, not the read-only restriction `/spawn` uses) as a direct child process with the matching prompt file's contents (wrapped in an imperative "execute this now" preamble — the raw file is passive numbered steps, and a bare child model just describes them without that wrapper) as the prompt — a self-owned, directly-spawned isolated subprocess, not routed through the `pi-subagents` package.
_Avoid_: subagent (that's the generic, general-purpose delegation the `pi-subagents` package still provides for everything else — chains, parallel, async, the `research`/`code-review` skills)

**Command registry**:
`dotfiles/pi/.pi/agent/extensions/pi-spawn/commands.json` — one entry per Fast command: `{name, model, thinking, prompt}`. `prompt` is a filename resolved relative to the `pi-spawn/` folder (e.g. `"commit.md"`), not a path elsewhere. `model` is a full `provider/id` string. Current entries: `commit` → `haiku-5-5` + `low`; `pr`/`css-audit` → `sonnet-5-5` + `medium`; `pr-check`/`review` → `opus-5-5` + `high`. `pr-check` and `review` prompts tell the model to hand bulk reading to a `haiku-5-5:high` child `pi -p` process.
_Avoid_: agents/*.md frontmatter (superseded — model/thinking live in the registry, prompt files are plain instructions, same shape as today's `commit.md`)

**Ask-bridge**:
The mechanism letting a running command's RPC child relay a genuine `extension_ui_request` back to the real user. It does not auto-pop a dialog: the run enters the Pending question state and the widget waits; pressing `ctrl+shift+a` opens the real prompt (`ctx.ui.select`/`confirm`/`input`), sends the answer back over the RPC channel, and the child resumes — no rerun, no sentinel text (see ADR 0004; supersedes the original `ASK:`-sentinel-and-rerun design from ADR 0001).
_Avoid_: clarifying question (a fast command must never just say something ambiguous and stop as its final answer — that's the bug the ask-bridge exists to catch)

**Pending question**:
The state a run enters when its child emits an `extension_ui_request`. Only one run is ever active at a time (no background scheduler), so there's at most one pending question. While pending, the feedback widget shows a “❓ press ctrl+shift+a” indicator instead of the last log lines; the same key answers it.
_Avoid_: prompt, dialog (those are what the keybinding opens — “pending question” is the waiting state before that)

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

## Orca

**Orca**:
The `pi-orca` extension (`dotfiles/pi/.pi/agent/extensions/pi-orca/`): gives the main session a `delegate` tool that hands one self-contained subtask to a child pi on a cheaper model. On by default; `/orca` toggles it. The orchestrator keeps every tool, including `edit` and `write` (ADR 0007).
_Avoid_: subagent (generic delegation), orchestrator mode (Orca never removes edit/write)

**Role**:
One of four fixed worker setups a `delegate` call names: `scout` (Haiku, read-only), `tester` (Haiku, runs checks, no edits), `coder` (Sonnet, full tools, one at a time), `reviewer` (Sonnet, reviews the uncommitted diff). Model, thinking, tools, and prompt are fixed in `pi-orca/index.ts`; the orchestrator picks the role, no router model involved.
_Avoid_: profile, agent

**Child runner**:
`extensions/lib/child-pi.ts`, shared by pi-spawn and pi-orca: spawns `pi --mode rpc`, streams progress, relays asks through a caller-supplied `onAsk`, and returns the final text plus usage. Every child gets `PI_CHILD=1`, which turns pi-orca off inside it, so delegation never nests.
_Avoid_: ask-bridge (pi-spawn's deferred answer mechanism built on top of it)
