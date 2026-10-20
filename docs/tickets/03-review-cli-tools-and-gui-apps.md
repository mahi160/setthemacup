# Review: CLI tools and GUI apps

- **Status:** done
- **Owner:** human
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)

Go through every package and decide: keep, remove, add, and which category it belongs to.

## Known issues
- `localsend` is listed twice.
- `zsh` and `git` formulae duplicate the system versions. Keep them for the newer versions?
- `fnm` moves to bootstrap.
- `rust` is only needed by nvim.12's blink.cmp (nvim.12 is being removed).
- Raycast Beta and FortiClient DMGs → casks (`raycast`, `forticlient-vpn`?). Confirm the casks exist.
- `mas` list is empty.

## Formulae (38)
zsh, eza, bat, coreutils, fastfetch, onefetch, starship, fzf, mas, catimg, neovim, tmux, lazygit, lazysql, stow, git, gh, tree-sitter-cli, cobra-cli, ripgrep, fd, yazi, ffmpeg, uv, docker-compose, tailscale, rust, git-delta, lazydocker, atuin, tealdeer, jq, zsh-completions, zsh-autosuggestions, zsh-syntax-highlighting, zoxide, nowplaying-cli, terminal-notifier

## Casks (25)
brave-browser, zen, ghostty, slack, whatsapp, telegram, localsend, alt-tab, caffeine, mos, doll, stats, localsend, shottr, obsidian, iina, stremioservice, jellyfin-media-player, calibre, qbittorrent, affinity, orbstack, font-jetbrains-mono-nerd-font, font-monaspace-nf, font-cascadia-code-nf

## Output
The final list with a category and description for each package, written as a comment on this ticket.

## Result (2026-10-20)
Applied to `setup/apps.json`; it carries over into `apps.ts`.

- **Shell:** oh-my-zsh replaces starship, zoxide (the OMZ `z` plugin), atuin (fzf Ctrl-R), eza and the brew zsh plugins (cloned by OMZ instead).
- **Formulae removed:** zsh, coreutils, catimg, rust, docker-compose, mas, tailscale, atuin, bat, yazi, jq, ffmpeg, tealdeer, cobra-cli, starship, zoxide, eza, zsh-autosuggestions, zsh-syntax-highlighting, zsh-completions.
- **Formulae added:** openfortivpn. It supports SAML since 1.23 (`sudo openfortivpn <gw> --saml-login`, then open `https://<gw>/remote/saml/start?redirect=1`), replacing the FortiClient DMG.
- **Casks removed:** caffeine (use `caffeinate`), stremioservice, jellyfin-media-player, calibre, affinity, qbittorrent, zen, font-monaspace-nf, the duplicate localsend.
- **Casks added:** `abue-ammar/tinycast/tinycast` (replaces Raycast), transmission, tailscale-app.
- **DMGs:** none left.
- **Fonts:** Cascadia Code NF (active) and JetBrains Mono NF.

- **Follow-up (same day):**
  - `uv` dropped.
  - `lazysql` kept (MySQL, PostgreSQL, SQLite, MSSQL).
  - `mole` added: run by hand for `mo analyze` (disk usage) and `mo uninstall` (removes app leftovers). Never scheduled.
  - `mahi160/tbis/tbis` cask added.

## Still open
- **flowd:** comes from a local zip. Its source, and how to install it, are still unknown.

## Resolution
Done.
