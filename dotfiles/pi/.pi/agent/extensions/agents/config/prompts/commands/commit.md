1. Run `git diff --cached` to get staged changes.
2. If empty, ask the user to stage changes and stop.
3. Analyze the staged diff.
4. Generate a conventional commit:
   - Format: `type(scope): subject`
   - Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
   - Subject: imperative mood, lowercase, no period, max 50 chars
   - Body (if needed): wrap at 72 chars, explain _why_ not _how_, one liner preferred
   - Footer: `BREAKING CHANGE:` if needed
5. If there are multiple non related changes, do multiple commits.
6. Commit with the generated message with caveman ultra clean
7. If there is a skill/instruction for commit in the repo, follow that more than this instruction (look into
   .agents/.claude folder)
