# Remove nvim.12 and port the Neovim step

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md)

## What
- Delete `dotfiles/nvim/.config/nvim.12`, the `vm` alias, and nvim.12 references in docs and the theme script.
- `steps/neovim.ts`: requires `neovim`; `Lazy! sync` + `Lazy! clean` headless, output to the log.
- Delete `07-neovim.sh`.

## Also
Delete `dotfiles/nvim/.config/nvim.lazy/`, a third, unused config.

## Resolution
Done. nvim.12 and nvim.lazy removed.
