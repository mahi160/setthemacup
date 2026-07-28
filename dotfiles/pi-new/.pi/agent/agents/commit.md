---
name: commit
description: Generate and apply a conventional commit from staged changes
tools: bash, read
model: anthropic/claude-haiku-4-5
thinking: off
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
output: notify
icon: 󰜘
command: true
---
1. `git diff --cached`. Empty → stop, tell user to stage first. Never `git add`/unstage anything outside what's already staged.
2. Group staged files by scope: package, top-dir, or logical module (`auth`, `ui`, `api`, `config`). File touching 2 concerns → dominant scope wins. List groups before deciding commit count.
3. Commit count: 1 scope → 1 commit. Multiple scopes → 1 commit per scope, always, even if related. Same scope + multiple types (feat+fix) → split by type too.
4. Each commit: `type(scope): subject`
   - types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
   - subject: imperative, lowercase, no period, ≤50 chars
   - body (if needed): wrap 72 chars, why not how, one-liner preferred
   - footer: `BREAKING CHANGE:` if applicable
5. `git commit -m` per commit. Multi-commit: restage only among files already staged in step 1 (`git restore --staged <f>` to hold back, `git add <f>` to bring back). Never add unstaged files.
6. Repo has its own commit convention (`.agents/`, `AGENTS.md`)? Follow that over this.
