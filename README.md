# setthemacup

One command from a fresh Mac to my full dev environment.

```bash
curl -fsSL https://raw.githubusercontent.com/mahi160/setthemacup/main/bootstrap.sh | bash
```

**Everything it installs and changes: [mahi160.github.io/setthemacup](https://mahi160.github.io/setthemacup/)**

---

## How it works

1. **`bootstrap.sh`** explains what's coming, then installs only what the installer needs: Xcode Command Line Tools, this repo (→ `~/.setup`), fnm, Node.js LTS and pnpm.
2. **The installer** (`installer/`, TypeScript run directly by Node) asks for your private values once, then shows a checklist — everything selected by default:

| Step | What |
|---|---|
| Homebrew | Always runs |
| CLI tools | git, gh, neovim, tmux, fzf, lazygit, delta, ripgrep, fd, … |
| Dotfiles + theme | oh-my-zsh, then zsh, git, ghostty, tmux, nvim, lazygit, fastfetch and pi configs via GNU stow |
| Git + SSH | Identity (personal + work via `includeIf`), SSH keys with Keychain passphrase, optional upload to GitHub |
| Neovim | LazyVim plugins |
| AI | pi coding agent + agent skills |
| Extras | Helper commands, Swift tools, SMB auto-mount, weekly cleanup jobs |
| flowd | Coding-time tracker + journal restore |
| GUI apps | Ghostty, Brave, Tinycast, Slack, OrbStack, fonts, … |
| macOS settings | 100+ defaults, Caps Lock → Control, ⌘Space for Tinycast, display scaling |

3. **At the end** you get a summary and a "What's next" checklist of the few things that need a human (sign-ins, permissions, a restart). It's also saved to `~/.setup/logs/next-steps.md`.

Every step checks what's already done, so re-running is safe. Real files in the way are moved to `~/.setup-backup/<date>/`, never overwritten.

## Re-running

```bash
setup                  # checklist
setup --list           # what's done
setup --only git,nvim  # just these (Homebrew always runs)
setup --dry-run        # show the commands, change nothing
setup --yes            # everything, no prompts
```

## Private values

This repo is public. Git identity, work folder, notes vaults, SMB shares and private repos live in `~/.config/setthemacup/private.env` — the installer asks for them on the first run ([template](private.env.example)). Machine-only shell aliases go in `~/.config/zsh/local.zsh`.

## Layout

```
bootstrap.sh          entry point
installer/            the installer: steps/, lib/, data/ (apps, macOS defaults, skills, keybinds)
bin/                  helper commands, linked into ~/.local/bin
src/swift/            Swift tools compiled on install
dotfiles/             configs, stowed into $HOME
docs/                 the generated details page, ADRs, tickets
```

Change the package list in `installer/data/apps.ts` and macOS settings in `installer/data/defaults.ts`, then `pnpm run docs` to refresh the page.

## Commands it adds

| Command | What |
|---|---|
| `v` | Neovim (LazyVim) |
| `lg` / `ld` | lazygit / lazydocker |
| `dev` | tmux dev session for a project |
| `a` | pi coding agent |
| `vpn` | FortiGate VPN with SSO (`vpn <name>`, or pick with fzf) |
| `theme` | cycle the terminal/editor theme |
| `note` | quick note to your notes folder |
| `pokemon-bg` / Alt+Q | new Ghostty background |
| `z <dir>` | jump to a frequent directory |
| `update` | pull this repo, relink dotfiles, reload the shell |
