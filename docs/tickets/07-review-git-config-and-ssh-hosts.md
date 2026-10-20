# Review: git config and SSH hosts

- **Status:** done
- **Owner:** human
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)

## Decide
- Which folder holds work repos for `includeIf` (e.g. `~/work/`)?
- Git settings to keep, drop or add (current: editor nvim, pull.rebase false, autoSetupRemote, fetch.prune, rebase.autoStash, delta side-by-side + line numbers).
- SSH hosts: `github.com` (personal key), `qp.github.com` (work key). Any others?

## Output
Final settings, written as a comment on this ticket.

## Decided
Work repos live in `$WORK_DIR` (from `~/.config/setthemacup/private.env`), used for `includeIf`.

## Resolution
Done. delta uses `syntax-theme = ansi`, so it follows the terminal theme without touching `theme`.
