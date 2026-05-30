1. Run `git diff --cached` for staged changes, or `git diff main...HEAD` if nothing staged.
2. Review for: bugs, security, error handling, performance, naming, test gaps.
3. Format:
   - `[CRITICAL]` — must fix before merge
   - `[SUGGEST]` — worth changing
   - `[NIT]` — minor style/preference
4. End with one-line verdict: approve / request changes / needs discussion.
