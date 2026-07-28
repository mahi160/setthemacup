# setthemacup

Full macOS dev-environment setup repo (bootstrap script, dotfiles, agent config). Single context — see `docs/adr/` for decisions.

## Language

**Fast command**:
One of the 6 personal git-workflow slash commands (`/commit`, `/pr`, `/pr-check`, `/standup`, `/review`, `/test`) implemented by `dotfiles/pi/.pi/agent/extensions/fast-commands/`, each backed by one `dotfiles/pi/.pi/agent/agents/*.md` frontmatter file. Runs as a self-owned, directly-spawned isolated subprocess — not routed through the `pi-subagents` package.
_Avoid_: subagent (that's the generic, general-purpose delegation the `pi-subagents` package still provides for everything else — chains, parallel, async, the `research`/`code-review` skills)

**Ask-bridge**:
The mechanism letting a fast command's isolated subprocess ask the real user a question mid-run: it emits `ASK: <question>` as its entire output, the parent session pauses and shows the question via the real `ask_user` overlay, then re-runs the fast command with the answer folded into the prompt (capped at 3 rounds).
_Avoid_: clarifying question (a fast command must never just say something ambiguous and stop as its final answer — that's the bug the ask-bridge exists to catch)
