# The risk gate keeps a deterministic hard floor below Jev

`pi-reflex` uses Jev to decide verdicts for mutating tool calls, but a small set of rules runs first and denies outright, with no model involved: secure paths (keys, `.env`, credentials — the old `pi-permissions` `SECURE_PATTERNS`) and a short list of irreversible commands (`rm -rf` outside the project, force-push, piping a download into a shell, SQL `DROP`). Jev can never override these. The reason is that Jev's own documentation (jev-1.13 jaggedness notes) states that adversarial content in the state can move its answers, and tool arguments routinely carry text from the repository, so a prompt-injected README could talk a Jev-only gate into allowing anything.

## Considered Options

- **Jev only** — rejected: a single successful injection would run any command.
- **Jev as advisor to `pi-permissions`** — rejected: keeps the always-ask prompts that motivated the change.

## Consequences

The floor is deliberately short. Anything added to it can never be allowed by Jev, even when the user wants it in auto mode, so entries should be limited to actions that leak secrets or cannot be undone.
