1. Run `git remote get-url origin` to identify the repo.
2. Run `git diff main...HEAD` for all changes on this branch.
3. Run `git log main...HEAD --oneline` for commit history.
4. Run the `thermo-nuclear-code-quality-review` skill against the diff before drafting anything. Presumptive blockers found (file-size explosion, spaghetti branching, code-judo opportunity, etc.) — surface them to the user and ask whether to fix first or proceed as-is. Don't silently skip this, don't silently block on it either.
5. Look for a PR template — check `.github/PULL_REQUEST_TEMPLATE.md`, `.github/pull_request_template.md`, `docs/pull_request_template.md`, `pull_request_template.md` (repo root). First one found wins. Template found = it outranks steps 7-8: keep every section and heading exactly as-is, in order, don't invent your own, don't drop a section even if empty (write "N/A"). Fill sections tersely (caveman rules from step 8 still apply inside each section).
6. If the user gave additional instructions, fold them in — they take priority over inferred content.
7. No template found → write:
   - **Title**: imperative, max 72 chars.
   - **Body**: 1-line summary + 3-6 bullets grouped by change, not by commit (never one bullet per commit). Add a **Notes** section only if the reviewer needs it (breaking change, migration, manual setup, follow-up) — omit otherwise.
8. Write for the reviewer, not a changelog — caveman style, max signal per word:
   - Under ~100 words total unless told otherwise. Shorter always wins over longer.
   - What changed + why. Skip how, unless it affects review.
   - Fragments over sentences. Drop articles (a/an/the) and filler words where meaning still lands.
   - One line per bullet, active voice, noun phrases not full sentences.
   - No filler ("This PR", "basically", "in order to", "in this change"), no hedging, no marketing language, no commit list, no restating filenames/diffs already visible on the PR page.
   - Every sentence must earn its place — if a bullet can lose a word and still be clear, lose it.
9. Run `gh pr create --title "..." --body "..."`.
