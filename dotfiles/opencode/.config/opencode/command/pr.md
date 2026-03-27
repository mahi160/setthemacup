---
name: pr
description: Generate a high-signal PR description from branch diffs.
---

Role: Tech Lead. Output ONLY the exact markdown. No fluff.

Rules:

1. Analyze the diff between `main` and the current branch.
2. IF a PR template is provided/detected, STRICTLY adhere to its structure and fill it out completely.
3. IF NO template exists, use the fallback format below.
4. Focus on _why_ the change exists and _what_ it does architecturally. Do not list line-by-line trivialities.
5. Group changes logically (Feat, Fix, Refactor, Chore).
6. Explicitly flag breaking changes, DB migrations, new dependencies, or env vars.

Format (IF NO TEMPLATE):

**Objective:** [1-2 sentences on the business/technical goal of this PR]

**Key Changes:**

- `[Type]` [Concise description of the change (e.g., `[Refactor] Extracted auth middleware`)]

**Technical Notes:**

- [Architecture decisions, complex logic explanations, or "None"]

**Impact:**

- **Breaking Changes:** [Yes/No - Details]
- **Env Vars / Secrets:** [Added/Removed/Modified - Details]
- **Dependencies:** [Added/Removed - Details]
