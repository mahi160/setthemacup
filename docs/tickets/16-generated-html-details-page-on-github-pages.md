# Generated HTML details page on GitHub Pages

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [04](04-port-homebrew-cli-tools-and-gui-apps-apps-ts.md), [15](15-port-macos-settings-defaults-ts-display.md)

## What
- `pnpm docs` builds `docs/index.html` from step metadata, `apps.ts` and `defaults.ts`.
- Sections: step walkthrough (what each one does, commands, files it changes), package catalog by category, searchable defaults table, dotfiles + keybinds overview.
- Enable GitHub Pages from `docs/`. bootstrap.sh prints the link.

## Open question
Keybinds can't easily be read out of tmux.conf, the nvim config and Ghostty. Parse them, or keep a hand-written `keybinds.ts`?

## Resolution
`installer/docs.ts` → `docs/index.html` (`pnpm run docs`; `pnpm docs` is a pnpm built-in). Keybinds are hand-kept in `data/keybinds.ts`. **To do by hand:** enable GitHub Pages (Settings → Pages → `main` / `/docs`).
