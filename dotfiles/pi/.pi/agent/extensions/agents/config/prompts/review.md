# Code Review

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc.
If not specified, default to `main`.

Run: `git diff <fixed-point>...HEAD` (three-dot merge-base diff)
Also run: `git log <fixed-point>..HEAD --oneline`
Also run: `git diff <fixed-point>...HEAD --name-status` to capture added/renamed/deleted files.

### 2. Identify standards sources

Look for: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CONTEXT.md`, `docs/adr/`, `.editorconfig`,
`eslint.config.*`, `biome.json`, `tsconfig.json`, `STYLE.md`, `STANDARDS.md`.

### 3. Identify the spec source

Check commit messages for issue refs (`#123`, `Closes #45`).
Look for a PRD/spec under `docs/`, `specs/`, `.scratch/` matching the branch name.
If none found, skip the Spec axis and note it.

### 4. Review — Standards axis

Read the standards docs. Read the diff (including new files/folders).
Report every violation: cite the standard file + rule. Distinguish hard violations from judgement calls.
Skip anything tooling already enforces. Under 400 words.

### 5. Review — Spec axis

Read the spec (if found). Read the diff.
Report: (a) requirements missing or partial; (b) scope creep; (c) requirements implemented incorrectly.
Quote the spec line for each finding. Under 400 words.

### 6. Output format

## Standards
<findings or "No violations found">

## Spec
<findings or "No spec available">

---
**Summary:** X Standards findings, Y Spec findings. Worst issue: <one line or "none">
