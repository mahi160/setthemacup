# bootstrap.sh: CLT, clone, fnm, Node LTS, pnpm, hand-off

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md)

## What
Rewrite `bootstrap.sh` as described in the parent. Delete `bootstrap.js` and `setup/setup.js`. Update the one-liner in README/AGENTS to `curl … bootstrap.sh | bash`.

## Notes
- Read input from `/dev/tty` (stdin is the pipe).
- Set `PNPM_HOME` and `PATH` for the current process; `.zshenv` gets the same.
- Look up and pin the latest pnpm 12.x.y at implementation time.
- Remove `fnm` from the brew package list.

## Done when
- A clean run in a fresh user account reaches the checklist.
- A second run skips CLT, fnm, Node and pnpm and reaches the checklist.

## Resolution
Done. bootstrap.sh never rewrites an existing fnm `default` alias (an early version did and created an alias loop).
