# Review: dotfile packages and theme

- **Status:** done
- **Owner:** human
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)

Go through every package in `dotfiles/` and decide what stays, goes or changes.

## Packages
fastfetch, ghostty, git, lazygit, nvim, pi, starship, stow, tmux, yazi, zsh. Plus a new `ssh` package (host config).

## Known issues
- `04-dotfiles.sh` stows `pi-new`, which doesn't exist.
- `dotfiles/nvim` contains nvim.12 (being removed).
- The default theme is kanagawa-wave. Keep it?

## Output
The final package list, plus a list of config changes (each can be its own follow-up ticket).

## Resolution
Done. pi-new dropped; starship and yazi removed; ssh added (linked by Git + SSH).
