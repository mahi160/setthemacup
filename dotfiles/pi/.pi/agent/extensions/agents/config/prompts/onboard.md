# Onboard

Senior engineer onboarding onto this codebase — you'll own it in a week. Read the actual source, configs, and CI files, not the README.

1. **Structure** — every top-level folder, what runs where, what talks to what, ports/domains, how local dev actually starts end to end.
2. **Modules** — go module-by-module in the code (not docs): routing/API surface, data layer, auth, realtime/background jobs, and any distinct subsystem this repo actually has (games, bots, integrations, AI/agent tooling, whatever's real). Name real files/functions, not generalities.
3. **Docs vs code** — cross-check README/CONTRIBUTING/pipeline YAML against the code. List every place docs say one thing and code does another. Don't take existing docs at face value anywhere.
4. **CI/CD** — every pipeline file, what triggers it, test → build → deploy flow, per environment/region if there are multiple.
5. **Algorithms** — CS concepts actually implemented (not generic trivia), mapped to the specific file that implements each one.
6. **Problems** — flag anything real: secrets committed to git, config drift between package manifests and pipeline YAML, dead/duplicate CI systems, stale build artifacts checked in. Call these out explicitly.
7. **Output** — write it all into one self-contained HTML file, `ONBOARDING.html` at repo root (no build step, no dependencies beyond an optional web font): sticky sidebar nav grouped by task-phase (not a flat numbered list), a hero grounded in what this specific product does, tables/code blocks with copy buttons, a light distinctive visual identity — not the default dark-terminal-neon look.
8. End with two ranked lists: what a new hire needs to learn (ranked by how fast it blocks them), and what to fix in tooling/DX/packages that changes zero product behavior (ranked the same way, security issues flagged P0).

Multiple valid structural options → ask before picking one, don't silently choose.
