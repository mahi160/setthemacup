# Runner skeleton: checklist, flags, logging, legacy fallback

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)

## What
- `package.json` (pinned deps, `packageManager: pnpm@12.x.y`), `pnpm-lock.yaml`, `tsconfig.json` with `erasableSyntaxOnly`, `.node-version` not used (LTS).
- `installer/index.ts`: parse flags (`--yes --only --skip --dry-run --list`), build the plan, multiselect checklist (all selected; Homebrew locked), run, summary table.
- `installer/lib/`: `sh` (exec + capture to log, dry-run aware), `log` (`~/.setup/logs/<timestamp>.log`), `ui` (spinner per sub-action, output shown only on failure), `sudo` (prompt once + keepalive), `brew` (`ensureFormulae(names)` used for step dependencies).
- Step type: `{ id, title, desc, actions[], requires: { formulae? }, critical?, check(), run(ctx) }`.
- Legacy fallback: steps not ported yet run `setup/NN-*.sh` through bash.
- `bin/setup` wrapper → `node ~/.setup/installer/index.ts "$@"`, symlinked to `~/.local/bin/setup`.

## Done when
- `setup --list` shows every item with its status.
- `setup --dry-run --yes` prints the full plan and runs nothing.
- `setup --only <legacy-step>` runs the old `.sh` step successfully.

## "What's next" screen
After the summary table, show a checklist of manual steps.

- **Source:** each step exports `nextSteps: string[]`, filtered by status, so only selected steps contribute. Items already done (e.g. `gh auth status` succeeds) are skipped.
- **Also written to:** `~/.setup/logs/next-steps.md`, and shown on the HTML page.
- **Ends with:** "Restart now? (Y/n)" (some defaults only apply after a logout).

Draft content, by step:

| Step | Next steps |
|---|---|
| macOS | Restart or log out (Spaces, key repeat and menu bar spacing apply then). System Settings: Liquid Glass set to the most opaque option, Apple Intelligence off if unused, Menu Bar items, Login Items & Extensions, notification summaries off. |
| GUI apps | Open Tinycast, grant Accessibility, set its hotkey to ⌘Space. Sign in to Slack, WhatsApp, Telegram, Brave sync, Tailscale. Open OrbStack once. Open the Obsidian vault. |
| Git + SSH | If the upload was skipped: `gh auth login`, then add the printed keys to both GitHub accounts. Test with `ssh -T git@github.com` and `ssh -T git@qp.github.com`. |
| Dotfiles | Open a new Ghostty window (new shell + theme). Grant Ghostty Accessibility for live theme reload. |
| Neovim | Run `v` once and let Mason finish installing. |
| AI | Run `a` (pi) and `/login`. |
| Extras | `vpn` → pick a gateway → finish SSO in the browser. Then check `scutil --dns`. |
| Always | `setup --list` shows what's installed; `setup --only <step>` re-runs one step. |

## Resolution
`installer/index.ts`, `plan.ts`, `lib/`. Changes from the plan: no legacy fallback (all ported); "Restart now?" defaults to **No**, so a stray Enter can't restart with unsaved work; private values are asked for on the first run.
