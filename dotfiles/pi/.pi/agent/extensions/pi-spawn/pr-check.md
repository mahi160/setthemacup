Audit a PR. Output one HTML file. No fillers, fewest words that stay clear.

Precision over recall. A false finding costs more than a missed nit: the author (often an agent) will act on it. Report only issues you can prove from code. Zero issues is a normal, good result.

Delegate bulk reading and other non-thinking work (reading changed files, grepping usages, collecting context, installing deps, taking screenshots) to a cheap child: `pi -p --no-session --model anthropic/claude-haiku-5-5:high "<task>"`; add `--tools read,grep,find,ls` for read-only tasks. Keep judgment (finding and rating issues) in this session; only step 3b verification runs in children.

Target from user input (additional context):
- PR number or URL given → that PR.
- nothing given → PR of current branch (`gh pr view --json number`). No PR → audit `git diff main...HEAD`.
- "post 1 2 3" → skip audit, post those numbered issues from the last `/tmp/pr-check-<n>.html` as inline review comments (step 7).

1. Gather: `gh pr view <n> --json number,title,body,author,baseRefName,headRefName,headRefOid,files,additions,deletions` + `gh pr diff <n>` + `gh pr checks <n>` + existing review comments (`gh api repos/{owner}/{repo}/pulls/<n>/comments`). Read changed files in full and the callers of changed functions; a diff alone hides most bugs. Read linked issue if the body references one.
   - Re-run on same PR and `/tmp/pr-check-<n>.html` records an older `audited <sha>` → review only `git diff <old sha>..<new sha>`; do not repeat earlier findings.
1b. Never touch the user's current checkout. Never create branches or worktrees outside `/tmp`.
2. Repo has `REVIEW.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, or lint/style config → judge against those; `REVIEW.md` wins (skip paths it lists, follow its definition of failure). Flag a change that makes a line in those files out of date.
3. Find candidate issues. First ask: does the change solve what the PR body/issue says? Bug fix → does it fix the root cause or only the symptom? Then look for: bugs, logic errors, security, perf, missing error handling, data loss, broken contracts (API/types/migrations). Never: code style, naming, formatting, cleanup, refactor wishes, praise, anything CI already reports (`gh pr checks`), anything an existing review comment already raised.
   - UI diff (see 4b) → visual style is in scope, code style is not. Look for: hardcoded colors/spacing/radii/font sizes where the repo has tokens, theme vars, or a scale; a new component or CSS that duplicates an existing one; values inconsistent with sibling components; broken responsive behavior (fixed widths, overflow, missing breakpoints); missing hover/focus-visible/disabled/loading/empty/error states; dark-mode breakage; accessibility (contrast, labels, alt, keyboard reach, focus order, `prefers-reduced-motion`); layout shift. Evidence = the token, existing component, or sibling it breaks from (file:line), or a screenshot. Never personal taste.
   - Evidence = real file:line plus the concrete input or path that fails. Never infer behavior from a name; open the definition.
   - Same bug class in several places → one issue listing every location.
   - `git blame` the cited lines on base: bug exists before this PR → tag `pre-existing`, else `new`.
3b. Verify every candidate in a fresh context before reporting. Per candidate, run in parallel (`&` + `wait`): `pi -p --no-session --model anthropic/claude-sonnet-5-5:high --tools read,grep,find,ls,bash "<claim, file:line, diff hunk>. Try to refute this. Read the code. Reply CONFIRMED or REFUTED, then one line of evidence."`. `high` candidates get 2 verifiers; keep only if all say CONFIRMED. Refuted → drop silently. Never report an unverified issue.
4. Severity: `high` (breaks prod, security, data loss), `med` (bug in edge path, perf, visible UI breakage, a11y blocker), `low` (risk, small gap, token/design-system drift). Sort high → low. Number issues 1..N in that order.
4b. Screenshots — only if diff touches UI (`.tsx .jsx .vue .svelte .astro .html .css .scss`, components, pages, styles). Else skip.
   - Pick pages/routes the changed components render on (grep usages, router files). Max 5.
   - Mode by change: existing UI altered → before (base) vs after (head). New page/feature → after only.
   - Run: `git fetch origin pull/<n>/head <base>`. Head = `git worktree add --detach /tmp/pr-check-<n>-head <head sha>`. Base (only if before/after) = `git worktree add --detach /tmp/pr-check-<n>-base origin/<base>`. Install deps in each (lockfile's package manager). Start the `dev` (else `start`) script from `package.json` in background, read port from its output. When done, even on failure: kill servers, `git worktree remove --force` both, `git worktree prune`.
   - Capture with Playwright (`npx -y playwright screenshot --full-page --viewport-size=<w,h> <url> <file>`; `npx -y playwright install chromium` if browser missing). Viewports: desktop 1440,900 and mobile 390,844. Save to `/tmp/pr-check-<n>-shots/`.
   - Needs auth, env vars, or backend you can't start → skip, say why in the HTML. Never fake shots.
   - Visible breakage in a shot (overflow, overlap, missing content) → add as a numbered issue citing the shot.
5. Write `/tmp/pr-check-<n>.html` (no PR number → branch name with `/` replaced by `-`). Single self-contained file, inline CSS, no JS libs, no external fonts. Clean light theme: white bg, `#1f2328` text, system-ui font, max-width 860px, generous spacing, monospace code blocks on `#f6f8fa`, severity pills (high `#cf222e`, med `#bf8700`, low `#57606a`). Sections:
   - **Header**: PR title, #n, author, base ← head, +adds/−dels, CI status, `audited <head sha>`.
   - **Summary**: first line is the count, e.g. "2 issues (1 high, 1 med)" or "No issues found."
   - **What it's about**: 2-3 plain lines. What changes, why.
   - **Test locally**: `gh pr checkout <n> && <pm> install && <pm> run dev`.
   - **Files to check**: ordered list, most important first. Each: path + one line on why to look. Skip lockfiles/generated.
   - **Issues**: per issue a card:
     - `#N` big + severity pill + `new`/`pre-existing` tag + `file:line` (all locations if bug class)
     - **What?** one line.
     - **Why?** one-two lines, the concrete failure.
     - **How?** fix in one line + code snippet (before/after or suggested code).
   - **Screenshots** (if taken): per page, route + viewport label; before/after side by side, or after only. `<img>` with relative paths to the shots dir, click opens full size.
   - No issues → say "No issues found." Nothing else.
   - **Footer**: "Run `/pr-check <n> post 1 3` to comment on GitHub."
6. `open /tmp/pr-check-<n>.html`. Reply in chat: HTML path, count line, then one line per issue (`#N sev new|pre-existing file:line — what`). Nothing more.
7. Posting (only when asked): for each requested number, `gh api repos/{owner}/{repo}/pulls/<n>/comments -f body=... -f commit_id=<head sha> -f path=<file> -F line=<line> -f side=RIGHT`. First list existing comments (`gh api repos/{owner}/{repo}/pulls/<n>/comments`); if one already covers the issue, reply to it with only the new point (`.../comments/<id>/replies`) instead of a new comment. Body: max 3 short lines, `**<sev>:** problem. Impact. Fix: ...` (sev becomes `<sev>, pre-existing` if tagged); no preamble, no restating code. Use a ```suggestion``` block only for a direct line replacement. Line not in diff → fall back to `gh pr comment <n> --body ...` with `file:line` prefix. Never post unrequested numbers. Report posted URLs.
