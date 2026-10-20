# flowd: install and restore the journal

- **Status:** done
- **Owner:** agent
- **Parent:** [00-rewrite-setup-as-a-node-installer.md](00-rewrite-setup-as-a-node-installer.md)
- **Blocked by:** [01](01-runner-skeleton.md)

flowd (github.com/mahi160/flowd) tracks focused coding time in tmux and commits summaries to a private journal repo. It goes in the **Extras** checklist item.

## What
1. **Install:** `curl -fsSL https://raw.githubusercontent.com/mahi160/flowd/main/install.sh | sh`, which installs `fw` to `/usr/local/bin` (needs sudo). Skip if `fw` exists.
2. **Journal:** clone `$FLOWD_JOURNAL_REMOTE` (from `private.env`) to `~/.local/share/flowd/journal`. If the variable is unset, skip with a warning.
3. **Restore the database** (optional): if `~/flowd-backup.zip` exists, extract `flowd/$FLOWD_MACHINE/flowd.db*` into `<journal>/$FLOWD_MACHINE/`. The db is gitignored in the journal, so the zip is its only backup. Never overwrite an existing db.
4. **Config:** generate `~/.config/flowd/config.yaml`. Not tracked, because it names the private repo.
   ```yaml
   repo_path: ~/.local/share/flowd/journal
   git_remote: <FLOWD_JOURNAL_REMOTE>
   branch: main
   machine_name: <FLOWD_MACHINE>
   ai_enabled: true
   ai_command: "pi -p --model anthropic/claude-haiku-5-5:low"   # latest Haiku, low thinking
   ai_prompt: "Summarize this coding session in 2 short sentences."
   ai_session_paths:
     pi: ~/.pi/agent/sessions
   ```
5. **Autostart:** add to `tmux.conf`: `if-shell 'command -v fw' 'run-shell -b "fw start"'`. Don't let `fw init` edit `~/.tmux.conf`, since our config lives in `~/.config/tmux/`.
6. **check():** `fw status` succeeds, the journal is cloned, and the config exists.

## Notes
- Bump `ai_command` whenever a newer Haiku ships. Pinning `claude-haiku-5-5` (not the `haiku` pattern) keeps it on purpose.
- The `ai_command` model is the same one `/commit` uses in `pi-spawn/commands.json`.

## Resolution
`steps/flowd.ts`, its own checklist item. `fw` installs to `~/.local/bin` (no sudo, via `FLOWD_INSTALL_DIR`).
