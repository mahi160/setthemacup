1. Run `git remote get-url origin` to identify the repo.
2. Run `git diff main...HEAD` for all changes on this branch.
3. Run `git log main...HEAD --oneline` for commit history.
4. Look for a PR template — check `.github/PULL_REQUEST_TEMPLATE.md`, `.github/pull_request_template.md`, `docs/pull_request_template.md`, `pull_request_template.md` (repo root). First one found wins — fill its sections exactly, do not invent your own headings.
5. If the user gave additional instructions, fold them in — they take priority over inferred content.
6. No template found → write:
   - **Title**: imperative, max 72 chars.
   - **Body**: 1-line summary + 3-6 bullets grouped by change, not by commit (never one bullet per commit). Add a **Notes** section only if the reviewer needs it (breaking change, migration, manual setup, follow-up) — omit otherwise.
7. Write for the reviewer, not a changelog:
   - Under ~150 words total unless told otherwise.
   - What changed + why. Skip how, unless it affects review.
   - One line per bullet, active voice, noun phrases over sentences.
   - No filler ("This PR", "basically", "in order to"), no marketing language, no commit list, no restating filenames/diffs already visible on the PR page.
8. Run `gh pr create --title "..." --body "..."`.
