# Rewrite setup as a Node installer

- **Status:** done
- **Owner:** map

Replace `setup/*.sh` with a TypeScript installer run directly by Node. `bootstrap.sh` stays as the only shell entry point.

## Decisions
**bootstrap.sh**
- `curl -fsSL …/bootstrap.sh | bash`. All prompts read from `/dev/tty`.
- Intro banner, short summary, GitHub Pages link, "Press Enter to continue".
- Xcode CLT → clone (or `git pull --ff-only`) to `~/.setup`.
- fnm via its official script into `~/.local/share/fnm` (fnm is not installed by brew).
- `fnm install --lts`, then `npm i -g pnpm@12.x.y` at an exact version. `PNPM_HOME=~/Library/pnpm`.
- `pnpm install --frozen-lockfile`, then `exec node installer/index.ts`.
- Everything already present is skipped on re-run.

**Runner**
- TypeScript run directly by Node (`erasableSyntaxOnly`), small pinned deps.
- Layout: `installer/{index.ts,lib/,steps/,data/}`, `bin/` (was `scripts/`), `docs/index.html`.
- Step contract: `check()` returns done, partial or missing; `run()` is safe to repeat; metadata feeds the HTML page.
- Checklist: everything selected by default, Homebrew locked on. Each step installs just the brew tools it needs.
- Flags: `--yes`, `--only`, `--skip`, `--dry-run`, `--list`. A `setup` wrapper in `~/.local/bin`.
- sudo is asked for once at the start. A Homebrew failure aborts; anything else continues. Spinner per sub-action, log in `~/.setup/logs/`, summary table at the end.

**Order**
Homebrew → CLI tools → Dotfiles + theme → Git + SSH → Neovim → AI → Extras → GUI apps → macOS settings

**Rollout**
Directly on main, one step at a time, tested with `--dry-run`. The runner falls back to the legacy `setup/NN-*.sh` for steps not ported yet. Each port deletes its `.sh` file.

## Flow
For each area: a **review** ticket (human: add, remove or update the contents), then a **port** ticket (agent).

## Tickets
- [x] [01 — Runner skeleton: checklist, flags, logging, legacy fallback](01-runner-skeleton.md)
- [x] [02 — bootstrap.sh: CLT, clone, fnm, Node LTS, pnpm, hand-off](02-bootstrap-sh-clt-clone-fnm-node-lts-pnpm-hand-off.md)
- [x] [03 — Review: CLI tools and GUI apps](03-review-cli-tools-and-gui-apps.md)
- [x] [04 — Port Homebrew, CLI tools and GUI apps (apps.ts)](04-port-homebrew-cli-tools-and-gui-apps-apps-ts.md)
- [x] [05 — Review: dotfile packages and theme](05-review-dotfile-packages-and-theme.md)
- [x] [06 — Port dotfiles + theme step](06-port-dotfiles-theme-step.md)
- [x] [07 — Review: git config and SSH hosts](07-review-git-config-and-ssh-hosts.md)
- [x] [08 — Port git + SSH step](08-port-git-ssh-step.md)
- [x] [09 — Remove nvim.12 and port the Neovim step](09-remove-nvim-12-and-port-the-neovim-step.md)
- [x] [10 — Review: pi setup and AI skills](10-review-pi-setup-and-ai-skills.md)
- [x] [11 — Port AI step (pi + skills)](11-port-ai-step-pi-skills.md)
- [x] [12 — Review: helper scripts, SMB shares, scheduled jobs](12-review-helper-scripts-smb-shares-scheduled-jobs.md)
- [x] [13 — Port Extras step (bin/, Swift, SMB, launchd)](13-port-extras-step-bin-swift-smb-launchd.md)
- [x] [14 — Review: macOS defaults](14-review-macos-defaults.md)
- [x] [15 — Port macOS settings (defaults.ts + display)](15-port-macos-settings-defaults-ts-display.md)
- [x] [16 — Generated HTML details page on GitHub Pages](16-generated-html-details-page-on-github-pages.md)
- [x] [17 — Remove legacy setup/ and update docs](17-remove-legacy-setup-and-update-docs.md)
- [x] [18 — flowd: install and restore the journal](18-flowd-install-and-restore-journal.md)

## Resolution
All tickets landed in one pass. The legacy fallback was never needed because every step was ported at once.
