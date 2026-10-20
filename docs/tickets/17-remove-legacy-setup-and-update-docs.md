# Remove legacy setup/ and update docs

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [02](02-bootstrap-sh-clt-clone-fnm-node-lts-pnpm-hand-off.md), [04](04-port-homebrew-cli-tools-and-gui-apps-apps-ts.md), [06](06-port-dotfiles-theme-step.md), [08](08-port-git-ssh-step.md), [09](09-remove-nvim-12-and-port-the-neovim-step.md), [11](11-port-ai-step-pi-skills.md), [13](13-port-extras-step-bin-swift-smb-launchd.md), [15](15-port-macos-settings-defaults-ts-display.md), [16](16-generated-html-details-page-on-github-pages.md)

## What
- Delete `setup/` (`main.sh`, `lib.sh`, any leftovers) and the legacy fallback in the runner.
- Rewrite the setup sections in AGENTS.md and README for the new layout, steps, flags and one-liner.

## Resolution
Done. `setup/` deleted; AGENTS.md and README rewritten.
