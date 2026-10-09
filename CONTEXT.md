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

## Reflex

**Reflex**:
The `pi-reflex` extension (`dotfiles/pi/.pi/agent/extensions/pi-reflex/`): puts Jev between the model and its tools as an always-on risk gate, and routes delegations to profiles. Replaces `pi-permissions`.
_Avoid_: jev extension, router, auto mode

**Jev**:
TypeSafe AI's System One model: an external API that takes a state plus typed questions (Choice, Score, Noul) and returns calibrated probabilities with confidence. It decides; it never generates text, plans, or calls tools.
_Avoid_: system one AI (the model class, not this model), router (that's the extension's job, not Jev's)

**Orchestrator**:
The main-session model (e.g. `opus-5` high) that plans and decides *when* a piece of work should be delegated. Jev never splits work — only the orchestrator does.
_Avoid_: main thread, planner

**Delegation**:
The orchestrator handing one self-contained subtask to a child pi process, with Jev choosing *which* model and thinking level runs it.
_Avoid_: subagent (the `pi-subagents` package's generic mechanism), fast command (fixed-model slash commands in `pi-spawn`)

**Risk gate**:
The check every tool call passes before it runs, in the main session and in every delegated child. Two layers: the hard floor first, then Jev for everything the floor doesn't decide.
_Avoid_: permission prompt (that's the old always-ask behaviour this replaces)

**Hard floor**:
The deterministic, model-free rules inside the risk gate that deny outright — secure paths (keys, `.env`, credentials) and a short list of irreversible commands. Jev can never override it, because Jev can be steered by adversarial content in tool arguments.
_Avoid_: blocklist, safety rules

**Verdict**:
The risk gate's outcome for one tool call: **allow** (runs silently), **flag** (asks the user), or **deny** (blocked, reason returned to the model). Low Jev confidence always yields flag, never allow.
_Avoid_: decision, result

**Profile**:
A named, user-defined bundle of model, thinking level, and tool allowlist (e.g. `scout` = haiku/low, read-only) that a delegation runs under. Jev picks one profile per delegation with a single Choice; the orchestrator may pin one instead, which skips Jev.
_Avoid_: tier, agent, persona

**Profile registry**:
`pi-reflex/profiles.json` — the ordered profile list, weakest first, one entry per profile: `{name, model, thinking, tools, description}`. `description` is the option text Jev reads. Starting set: `scout`, `commit`, `write`, `think`.
_Avoid_: profile config

**Escalation**:
When Jev's profile Choice has low confidence, the delegation runs under the stronger of the top two candidates. Profile strength is its position in the profile list, weakest first.
_Avoid_: fallback (that implies going weaker)

**Writer profile**:
A profile whose tool allowlist can mutate files or run bash. Writer delegations run one at a time; read-only profiles may run in parallel with each other.
_Avoid_: write profile (`write` is also the name of one specific profile)

**Delegation result**:
What a finished delegation returns to the orchestrator: the child's final answer plus the list of files it changed — never its full transcript.
_Avoid_: output, transcript

**Flag relay**:
How a flag verdict inside a delegated child reaches the user: the child's confirm request is shown immediately as a real dialog in the parent session, labelled with the child's profile and task; simultaneous flags queue. The child waits for the answer and resumes.
_Avoid_: ask-bridge (that's `pi-spawn`'s deferred `ctrl+shift+a` mechanism — Jev routing does not reuse it)

**Hazard question**:
One atomic Noul the risk gate asks Jev about a tool call (irreversible? outside project? network egress? shared/remote state? matches current task?), alongside one severity Score. Code — not Jev — combines them into a verdict, and a flag names the hazard questions that fired.
_Avoid_: risk check, safety question

**Fail closed**:
The rule for when Jev is unreachable, slow, or errors: the risk gate yields flag for anything the hard floor didn't decide, and delegation runs under the strongest profile. An outage costs convenience, never safety or capability.
_Avoid_: fallback mode, degraded mode

**Mutating call**:
Any tool call that is not on the known read-only list (`read`, `grep`, `find`, `ls`). Only mutating calls reach Jev; read-only calls pass the hard floor alone. Unknown tools are mutating by default, and `bash` is always mutating.
_Avoid_: write call, dangerous call

**Orchestrator mode**:
A per-session toggle that removes write, edit, and bash from the main session's model, leaving read-only tools plus `delegate`, so every change must go through a delegation. Off by default; the risk gate is always on regardless.
_Avoid_: auto mode, delegate mode

**Verdict log**:
An append-only JSONL file with one line per mutating call (tool, truncated args, hazard probabilities, severity, confidence, verdict, the user's answer to a flag) and one per delegation routing decision (task, profile, confidence, escalated or not). The audit trail for silent allows and the labelled data for tuning thresholds.
_Avoid_: audit log, save log (that's the tool-bank's)
