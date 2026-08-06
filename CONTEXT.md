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
