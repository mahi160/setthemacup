1. Run `git remote get-url origin` to identify the repo.
2. Run `git diff main...HEAD` for all changes on this branch.
3. Run `git log main...HEAD --oneline` for commit history.
4. Look for pr_template.
5. Generate a PR (use template if found, else):
   - **Title**: concise, imperative, max 72 chars
   - **Body**: ## What (summary) / ## Why (motivation) / ## How (key decisions) / ## Testing
6. Run `gh pr create --title "..." --body "..."`.
