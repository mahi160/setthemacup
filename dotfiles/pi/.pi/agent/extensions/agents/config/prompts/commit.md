1. Run `git diff --cached` to get staged changes.
2. If empty, stop — tell the user to stage changes first.
3. Analyze the staged diff — group changed files by scope:
   - Derive scope from: package name, top-level directory, or logical module (e.g. `auth`, `ui`, `api`, `config`)
   - A single file that touches two concerns = still one scope (use the dominant one)
   - List each scope group before deciding commit count
4. Decide commit count:
   - **One scope** → single commit
   - **Multiple scopes** → one commit per scope, always — even if changes feel related
   - **Same scope, multiple types** (e.g. feat + fix in `auth`) → split by type too
5. For each commit, generate a conventional commit:
   - Format: `type(scope): subject`
   - Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
   - Subject: imperative mood, lowercase, no period, max 50 chars
   - Body (if needed): wrap at 72 chars, explain _why_ not _how_, one liner preferred
   - Footer: `BREAKING CHANGE:` if applicable
6. Use `git commit` with `-m` for each. Multi-commit: stage per-file groups with `git add <files>` before each commit, unstaging others if needed (`git restore --staged`).
7. If a repo-level commit convention exists in `.agents/` or `AGENTS.md`, follow it over these instructions.
