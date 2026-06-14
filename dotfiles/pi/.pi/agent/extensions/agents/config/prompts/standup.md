1. Run `git log --since="24 hours ago" --oneline --author="$(git config user.name)"`.
2. Run `git diff HEAD~5...HEAD --stat` for recent file changes.
3. Summarize:
   - **Yesterday**: what was done (from commits)
   - **Today**: what's next (infer from WIP or last commit)
   - **Blockers**: none unless context suggests otherwise
4. Keep it short — 3-5 bullets max.
