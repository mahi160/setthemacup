Audit a PR. Output one HTML file. No fillers, fewest words that stay clear.

Delegate bulk reading and other non-thinking work (reading changed files, grepping usages, collecting context, installing deps, taking screenshots) to a cheap child: `pi -p --no-session --model anthropic/claude-haiku-5-5:high "<task>"`; add `--tools read,grep,find,ls` for read-only tasks. Keep judgment (finding and rating issues) in this session.

Target from user input (additional context):
- PR number or URL given → that PR.
- nothing given → PR of current branch (`gh pr view --json number`). No PR → audit `git diff main...HEAD`.
- "post 1 2 3" → skip audit, post those numbered issues from the last `/tmp/pr-check-<n>.html` as inline review comments (step 7).

1. Gather: `gh pr view <n> --json number,title,body,author,baseRefName,headRefName,files,additions,deletions` + `gh pr diff <n>`. Read changed files in full where the diff alone lacks context. Read linked issue if the body references one.
1b. Local worktree for testing: `git fetch origin pull/<n>/head:pr-<n>` then `git worktree add ../<repo>-pr-<n> pr-<n>` (sibling of repo root). Exists already → `git fetch origin pull/<n>/head` + `git -C <path> merge --ff-only FETCH_HEAD`; dirty or not fast-forward → leave it, tell user. Install deps there (lockfile's package manager). Keep it — user tests there. Never touch the user's current checkout.
2. Repo has `AGENTS.md`, `CONTRIBUTING.md`, or lint/style config → judge against those.
3. Find issues. Only: bugs, logic errors, security, perf, missing error handling, data loss, broken contracts (API/types/migrations). No style nits, no praise. Unsure → mark `unverified`, say what evidence is missing. Every issue cites real file + line from the diff.
4. Severity: `high` (breaks prod, security, data loss), `med` (bug in edge path, perf), `low` (risk, small gap). Sort high → low. Number issues 1..N in that order.
4b. Screenshots — only if diff touches UI (`.tsx .jsx .vue .svelte .astro .html .css .scss`, components, pages, styles). Else skip.
   - Pick pages/routes the changed components render on (grep usages, router files). Max 5.
   - Mode by change: existing UI altered → before (base) vs after (head). New page/feature → after only.
   - Run: head = step 1b worktree. Base (only if before/after) = `git worktree add /tmp/pr-check-<n>-base <base>` + install deps. Start the `dev` (else `start`) script from `package.json` in background, read port from its output. Kill servers and remove the base worktree when done, even on failure. Keep the head worktree.
   - Capture with Playwright (`npx -y playwright screenshot --full-page --viewport-size=<w,h> <url> <file>`; `npx -y playwright install chromium` if browser missing). Viewports: desktop 1440,900 and mobile 390,844. Save to `/tmp/pr-check-<n>-shots/`.
   - Needs auth, env vars, or backend you can't start → skip, say why in the HTML. Never fake shots.
   - Visible breakage in a shot (overflow, overlap, missing content) → add as a numbered issue citing the shot.
5. Write `/tmp/pr-check-<n>.html` (branch name if no PR number). Single self-contained file, inline CSS, no JS libs, no external fonts. Clean light theme: white bg, `#1f2328` text, system-ui font, max-width 860px, generous spacing, monospace code blocks on `#f6f8fa`, severity pills (high `#cf222e`, med `#bf8700`, low `#57606a`). Sections:
   - **Header**: PR title, #n, author, base ← head, +adds/−dels.
   - **What it's about**: 2-3 plain lines. What changes, why.
   - **Test locally**: worktree path + `cd <path> && <pm> run dev`. Remove later: `git worktree remove <path> && git branch -D pr-<n>`.
   - **Files to check**: ordered list, most important first. Each: path + one line on why to look. Skip lockfiles/generated.
   - **Issues**: per issue a card:
     - `#N` big + severity pill + `file:line`
     - **What?** one line.
     - **Why?** one-two lines, the concrete failure.
     - **How?** fix in one line + code snippet (before/after or suggested code).
   - **Screenshots** (if taken): per page, route + viewport label; before/after side by side, or after only. `<img>` with relative paths to the shots dir, click opens full size.
   - No issues → say "No issues found." Nothing else.
   - **Footer**: "Reply `post 1 3` to comment on GitHub."
6. `open /tmp/pr-check-<n>.html`. Reply in chat: HTML path, worktree path, one line per issue (`#N sev file:line — what`). Nothing more.
7. Posting (only when asked): for each requested number, `gh api repos/{owner}/{repo}/pulls/<n>/comments -f body=... -f commit_id=<head sha> -f path=<file> -F line=<line> -f side=RIGHT`. First list existing comments (`gh api repos/{owner}/{repo}/pulls/<n>/comments`); if one already covers the issue, reply to it with only the new point (`.../comments/<id>/replies`) instead of a new comment. Body: max 3 short lines, `**<sev>:** problem. Impact. Fix: ...`; no preamble, no restating code. Use a ```suggestion``` block only for a direct line replacement. Line not in diff → fall back to `gh pr comment <n> --body ...` with `file:line` prefix. Never post unrequested numbers. Report posted URLs.
