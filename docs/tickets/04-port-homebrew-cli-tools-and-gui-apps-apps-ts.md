# Port Homebrew, CLI tools and GUI apps (apps.ts)

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md), [03](03-review-cli-tools-and-gui-apps.md)

## What
- `installer/data/apps.ts`: `{ name, desc, kind: 'formula'|'cask'|'mas', category }` from the review result. `setup/apps.json` is removed.
- `steps/homebrew.ts`: install when missing, write `brew shellenv` to `.zprofile`, critical.
- `steps/cli-tools.ts` and `steps/gui-apps.ts`: diff against `brew list` once, then one batched `brew install` per kind. If the batch fails, retry each package on its own and report the failures.
- Delete `01-homebrew.sh`, `02-apps.sh`, `03-store-apps.sh` and the DMG helper.

## Done when
`check()` reports missing packages accurately, and a re-run installs nothing.

## Notes from review
- **Tinycast:** comes from a third-party tap and may need `brew trust --tap abue-ammar/tinycast` before install. It needs macOS 26+ and Accessibility permission.
- **Homebrew permissions:** run `chmod g-w,o-w "$(brew --prefix)/share"` after installing Homebrew, or oh-my-zsh's compaudit warns on every shell.
- **Third-party taps:** Homebrew refuses to install from an untapped third-party tap ("If you trust this tap, tap it explicitly"). `apps.ts` needs a `taps` list, applied before the batched installs: `mahi160/tbis`, `abue-ammar/tinycast`. The legacy `02-apps.sh` already taps on demand.

## Resolution
`installer/data/apps.ts` + `steps/packages.ts`. Taps are derived from tap-qualified names.
