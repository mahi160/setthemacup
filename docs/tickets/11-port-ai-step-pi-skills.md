# Port AI step (pi + skills)

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md), [10](10-review-pi-setup-and-ai-skills.md)

## What
- `steps/ai.ts`: `pnpm add -g @earendil-works/pi-coding-agent` (unpinned). pi installs its own packages on first start.
- `npx --yes skills add <source>` for each entry in `installer/data/skills.ts`.
- Delete `08-pi.sh` and `09-ai.sh`.

## Resolution
`steps/ai.ts`. Skills install with `--agent pi` into `~/.agents/skills` (outside the repo).
