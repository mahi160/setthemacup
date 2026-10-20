# Review: pi setup and AI skills

- **Status:** done
- **Owner:** human
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)

## Decide
- pi packages in `settings.json` (pi-web-access, context7-pi, pi-fzf-files, pi-anthropic-auth): keep, add, remove?
- Which skills go in the `npx skills add` list (currently empty)?
- Extensions in `dotfiles/pi/.pi/agent/extensions/`: still all wanted?

## Decided skills (2026-10-20)
All installed with `npx -y skills add <repo> --skill <name> -g -y`.

| Repo | Skills |
|---|---|
| `vercel-labs/skills` | `find-skills` |
| `Leonxlnx/taste-skill` | `design-taste-frontend` |
| `GoogleChrome/modern-web-guidance` | `modern-web-guidance` |
| `mattpocock/skills` | grill-me, to-spec, to-tickets, tdd, diagnosing-bugs, triage, implement, code-review, improve-codebase-architecture, setup-matt-pocock-skills |

The Matt Pocock set is still to be confirmed. The repo has 38 skills, and installing all of them bloats every agent's skill list.

## Resolution
Done. The skills list is in `installer/data/skills.ts`.
