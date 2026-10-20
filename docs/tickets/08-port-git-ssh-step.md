# Port git + SSH step

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md), [07](07-review-git-config-and-ssh-hosts.md)

## What
- Tracked `dotfiles/git/.gitconfig` with `[include] path = ~/.gitconfig.local` and `includeIf "gitdir:<work>/"` → work identity file.
- The step writes `~/.gitconfig.local` and the work identity file when missing (not tracked).
- Delta's syntax theme follows `~/.config/theme` (`toggle-theme` updates it).
- `dotfiles/ssh/.ssh/config` stowed; check permissions.
- Keys `id_ed25519` and `qp_ed25519`: prompt for a passphrase, `ssh-add --apple-use-keychain`. Existing keys are skipped.
- Optional: "Upload to GitHub now?" for each account → `gh auth login` + `gh ssh-key add`; otherwise print the public keys.
- Delete `05-git.sh` and `10-ssh.sh`.

## Resolution
`steps/git-ssh.ts`. Work host alias and key name come from `WORK_SSH_HOST` / `WORK_SSH_KEY` in private.env.
