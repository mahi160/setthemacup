Mode: inbox

Goal: process quick-capture items with minimal ceremony. Do not over-organize, do not create new files.

1. bash `date +%Y-%m-%d` for today. Read `Daily/<today>.md`, specifically its `## Inbox` section.
2. If yesterday's Daily note exists (`date -v-1d +%Y-%m-%d` on macOS) and still has un-triaged Inbox lines, read that too.
3. For each Inbox line, classify:
   - Project: LivePolls or Wick UI (an `LP:`/`WU:` prefix makes this explicit; infer if there's no prefix)
   - Kind: task, question, decision (already made), note, or follow-up
4. Where it clearly belongs, move it:
   - Question → append one line under the right heading in `Projects/<Project>/Questions.md` (LivePolls headings: Product/Design/Backend/Frontend/Sales; Wick UI: no fixed headings, just append)
   - Decision already made → append a stub entry to `Projects/<Project>/Decisions.md` using the `## YYYY-MM-DD — title` / Decision / Why / Alternatives / Owner format — fill only what you actually know, leave the rest blank for the user rather than guessing
   - Task/note/follow-up → leave it in the Daily note. That's a fine home for it. If it clearly belongs in the LivePolls README's "working on" or "blocked" lists, say so as a suggestion — don't edit the README yourself.
5. After moving a line into Questions.md or Decisions.md, delete that line from the Daily note's Inbox section (edit tool).
6. If an item is ambiguous, leave it in Inbox untouched and explain why in your output.

Report: what moved where, and what's left in Inbox and why.
