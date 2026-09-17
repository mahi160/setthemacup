# Ship

## Debug

1. **Reproduce.** Smallest repro, one command. Can't reproduce → that's the bug you're working on now.
2. **Read the actual error.** Whole stack, real line, real values. Not the guess.
3. **Locate.** `git log -S`, `git bisect`, or read the path end to end. Last working state vs now.
4. **One hypothesis at a time**, with the evidence it predicts. Log the boundary values, run, compare.
5. **Wrong hypothesis → write it off in one line.** Keep a running "ruled out" list.
6. Three dead hypotheses → your model of the system is wrong. Re-read the code path from entry to exit. Stop guessing.
7. **Fix the cause.** Adding `?.`, `try/catch`, a retry, or a default to make the symptom vanish is not a fix.
8. Turn the repro into a test. Then delete the instrumentation.

No shotgun edits. One variable at a time. No speculative fixes.

## Tests

Behavior, not implementation. Real inputs, no mock of the thing under test. "Was called" asserts prove nothing.
Priority: the bug you just fixed → boundaries → error and async paths → integration seams. Skip the rest.
Match the repo's framework, file location, and naming. Never add a second test framework.
Test-first when the task is a bug or has a clear invariant.

## Review

Others' PR → `/pr-check <n>`. My unstaged work → `/roast`. Standards + spec pass → `/review`.
This file only sets the bar those must clear:

- Assume the diff is wrong until it proves otherwise.
- Only real findings: bugs, regressions, edge cases, security, missing checks. No style nits, no praise, no invented problems.
- Every finding: `file:line`, what's wrong, the concrete runtime consequence, the trigger, the smallest fix.
- Investigate on sight: new abstraction, new dep, `useEffect`, `any`/casts, swallowed errors, huge refactor, unrelated cleanup, tests edited to go green.
- Scope check first: does the diff match the task? 200 lines for a 10-line problem?
- End with `VERDICT: SHIP | SHIP WITH FIXES | DO NOT SHIP` + one-line top concern.
- Compiling, passing tests, and looking clean are not evidence. "Can I construct a realistic scenario where this breaks?" Yes → report it.

## Commit

Only when I ask. `/commit` does it.
Conventional, imperative subject ≤60 chars, one logical change per commit. Body only when the why isn't obvious from the diff. No "and also".

## Docs

Write only what someone would otherwise have to re-derive: what it is, how to run it, decisions + why, the gotchas.
`CONTEXT.md` gets new domain vocabulary (term, definition, _avoid_ pair). `docs/adr/` gets architectural decisions (context, decision, consequence).
No feature tours, no "Introduction", no restating code, no doc for a self-evident function.
Docs that lie are worse than no docs — changed the behavior, update or delete the doc in the same change.
