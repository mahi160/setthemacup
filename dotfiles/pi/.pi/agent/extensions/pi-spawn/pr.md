Open a PR. No fillers, fewest words that stay clear.

Branches from user input (additional context):
- "from X to Y" → head=X, base=Y.
- "to Y" / "into Y" only → head=current branch, base=Y.
- nothing given → head=current branch, base=`main`.

1. `git status` — uncommitted changes on current branch → stop, tell user to commit first.
2. Push head: `git push -u origin <head>` (skip if already pushed, no new commits). head ≠ current branch → `git switch <head>` first (or `git fetch origin <head>` if it only exists remotely), fail loud if it doesn't exist.
3. Find a PR template: `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/pull_request_template.md`, or `PULL_REQUEST_TEMPLATE/*.md`. Found → fill its exact sections/checkboxes, drop empty ones. None found → use:
   ```
   ## What
   <1-2 lines>

   ## Why
   <1 line, skip if obvious from What>

   ## Testing
   <how verified, or "n/a">
   ```
4. Title: `type(scope): subject` — types: feat fix docs style refactor perf test build ci chore revert. Imperative, lowercase, ≤50 chars.
5. Body from `git log <base>..<head>` + `git diff <base>...<head>` — summarize what changed, not the diff itself. Breaking change → add `BREAKING CHANGE:` line.
6. Create: `gh pr create --base <base> --head <head> --title "<title>" --body "<body>"` (add `--draft` if user asked for draft). No `gh`/no remote → print title+body, tell user to open PR manually.
7. Repo has its own PR convention (`AGENTS.md`, `CONTRIBUTING.md`) → follow that over steps above.
