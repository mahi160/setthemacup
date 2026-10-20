# Port dotfiles + theme step

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md), [05](05-review-dotfile-packages-and-theme.md)

## What
- `steps/dotfiles.ts`: requires `stow`. For each package: `stow --simulate`, move conflicting files to `~/.setup-backup/<date>/` keeping their paths, then stow. List any backups in the summary.
- Run `bin/toggle-theme --no-reload <current or kanagawa-wave>`.
- The pokemon background and pi notify icon move to Extras.
- `check()`: every package fully linked.
- Delete `04-dotfiles.sh`.

## Resolution
`steps/dotfiles.ts`.
