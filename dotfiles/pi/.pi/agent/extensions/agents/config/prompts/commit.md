1. Run `git diff --cached` to get staged changes.
2. If empty, stop — tell the user to stage changes first.
3. Analyze the staged diff.
4. Generate a conventional commit:
   - Format: `type(scope): subject`
   - Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
   - Subject: imperative mood, lowercase, no period, max 50 chars
   - Body (if needed): wrap at 72 chars, explain _why_ not _how_, one liner preferred
   - Footer: `BREAKING CHANGE:` if applicable
5. If there are multiple unrelated changes, do multiple commits.
6. Run `git commit` with the generated message.
7. If a repo-level commit convention exists in `.agents/` or `AGENTS.md`, follow it over these instructions.
