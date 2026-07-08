#!/usr/bin/env bash
# check-pr — senior-dev line-by-line PR review via pi, posts inline GitHub comments.
# Usage: check-pr <pr-number>   (run from inside the repo)

set -euo pipefail

[[ $# -eq 1 ]] || { echo "Usage: check-pr <pr-number>"; exit 1; }
PR="$1"

command -v gh >/dev/null || { echo "check-pr: gh not found"; exit 1; }
command -v pi >/dev/null || { echo "check-pr: pi not found"; exit 1; }

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
SHA=$(gh pr view "$PR" --json headRefOid -q .headRefOid)
DIFF=$(gh pr diff "$PR")

[[ -z "$DIFF" ]] && { echo "check-pr: no diff for PR #$PR"; exit 0; }

PROMPT="You are a senior dev doing a real code review. Caveman style: terse, fragments ok, no fluff, no pleasantries. Ponytail style: only flag real bugs, regressions, edge cases, security issues — skip nitpicks and style. Review this diff line by line, right side (new code) only.
Output ONLY lines matching exactly: path/to/file.ext:LINE: comment
One per real issue. If nothing worth flagging, output nothing at all. No preamble, no markdown, no other text.

DIFF:
$DIFF"

REVIEW=$(pi -p --no-tools --no-extensions --no-skills --thinking low "$PROMPT")

if [[ -z "$REVIEW" ]]; then
  echo "check-pr: no issues found — PR #$PR clean"
  exit 0
fi

# ponytail: line numbers pi picks may not exist in the diff hunks — gh api rejects those, we just skip+report
echo "$REVIEW" | while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file="${line%%:*}"
  rest="${line#*:}"
  lineno="${rest%%:*}"
  comment="${rest#*: }"
  [[ "$lineno" =~ ^[0-9]+$ ]] || continue

  if gh api "repos/$REPO/pulls/$PR/comments" \
    -f body="$comment" -f commit_id="$SHA" -f path="$file" -F line="$lineno" -f side=RIGHT \
    >/dev/null 2>&1; then
    echo "commented: $file:$lineno"
  else
    echo "skipped (not in diff): $file:$lineno — $comment"
  fi
done

echo "check-pr: done — PR #$PR"
