# Global instructions

Loaded in every session, any repo (`~/.pi/agent/AGENTS.md`).

## Fast commands — delegate, don't hand-roll

`extensions/fast-commands.ts` registers `/commit`, `/pr`, `/pr-check`, `/standup`,
`/review`, `/test` — each backed by a dedicated agent in `agents/*.md` with its
own conventions (commit grouping/type-splitting rules, PR body format, etc.).

When asked to do one of these (commit staged changes, open a PR, review a
diff, write a standup, write tests) and no other agent was specified: call
`subagent(agent: "<name>")` for that agent instead of running `git`/`gh`
directly yourself. Slash commands are UI-only and can't be triggered
programmatically — the subagent tool is the equivalent path and hits the same
`agents/*.md` definition. Only fall back to raw `git`/`gh` if the subagent
call fails.
