Only staged files. Never `git add`/unstage files the user didn't already stage.

1. `git diff --cached`. Empty → stop, tell user to stage first.
2. Group staged files by scope (dir/package/module name: `auth`, `ui`, `api`, `config`). File spans 2 scopes → pick the one with more changed lines.
3. One commit per (scope, type) pair. Same scope, mixed types (feat+fix) → split by type. Never merge unrelated scopes into one commit.
4. Format: `type(scope): subject`
   - types: feat fix docs style refactor perf test build ci chore revert
   - subject: imperative, lowercase, no trailing period, ≤50 chars
   - body: only if subject can't carry the "why" — 1 line, ≤72 chars, skip for trivial changes
   - `BREAKING CHANGE:` footer only if it truly breaks callers
5. Commit each group: `git commit -m "type(scope): subject"`. For multi-commit, stage only that group's files (already-staged files only — `git restore --staged <f>` to hold back, `git add <f>` to bring back), commit, repeat.
6. Repo has its own convention (`AGENTS.md`, `.agents/`, `CONTRIBUTING.md`)? Follow that instead.

Example — staged: `src/auth/login.ts` (fix), `src/ui/Button.tsx` (feat), `README.md` (docs):
```
fix(auth): handle expired token on login
feat(ui): add Button loading state
docs: update install steps
```
