Mode: default focus check (`/qp` with no argument)

Question to answer: "What should I be focusing on right now?"

Read (skip silently if missing/empty):
- `Projects/LivePolls/README.md`
- `Projects/LivePolls/Decisions.md`
- `Projects/LivePolls/Questions.md`
- `Projects/WickUI/README.md`
- Today's Daily note: run `date +%Y-%m-%d` via bash, read `Daily/<that-date>.md` if it exists

LivePolls dominates — it's 80% of the work. Only include the Wick UI section if something in its README/Questions genuinely needs attention right now (an open PR review, a real blocker, an architecture risk). Otherwise say "Nothing needs me today" or omit the section, whichever is shorter.

Output exactly these headers, nothing before or after:

## Focus
1–3 things, ranked. Only what's genuinely important right now — not a task list.

## Do not work on
Tempting distractions to explicitly avoid.

## Blocked
What's stuck, and on whom.

## Decisions
Decisions needing attention soon (pull from Questions.md / README, not resolved ones already in Decisions.md).

## Delegate
Things that should go to backend / design / sales / the Wick UI developer instead of the user.

## Wick UI
Only if something genuinely needs attention (see rule above).

Do not invent information not present in the files you read.
