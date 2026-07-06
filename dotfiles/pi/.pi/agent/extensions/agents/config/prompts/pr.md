1. Run `git remote get-url origin` to identify the repo.
2. Run `git diff main...HEAD` for all changes on this branch.
3. Run `git log main...HEAD --oneline` for commit history.
4. Look for a PR template — check `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/pull_request_template.md`, and `pull_request_template.md` (repo root). Use the first one found.
5. If the user gave additional instructions (extra context, focus areas, what to emphasize), fold them into the body — they take priority over inferred content.
6. Generate a PR — fill the template if found, otherwise use:
   - **Title**: concise, imperative, max 72 chars
   - **Body**: ## What (summary) / ## Why (motivation) / ## How (key decisions) / ## Testing
7. Run `gh pr create --title "..." --body "..."`.
