# Fast-commands use a JSON registry, not per-file frontmatter, and cap at sonnet-5

`extensions/fast-commands/commands.json` holds one `{name, model, thinking, prompt}` entry per command, instead of putting `model`/`thinking` as YAML frontmatter on each prompt `.md` file. A single registry is easier to scan/tune all 6 commands' cost-vs-quality tradeoff at once, and keeps the prompt files themselves as plain instructions (matching the existing `commit.md` shape) rather than mixed frontmatter+instructions.

Model/thinking is tiered by task weight: `commit`/`standup` (mechanical) get `haiku-4-5` + `low`; `pr`/`pr-check`/`test` (need judgment) get `sonnet-5` + `medium`; `review` (deepest analysis) gets `sonnet-5` + `high`. `review` deliberately does not use `opus-5`, even though it's already in `enabledModels` — start cheaper across the board and revisit per-command if a command's output quality disappoints in practice, rather than defaulting to the biggest model up front.

The registry and its prompt `.md` files live together in `extensions/fast-commands/` (not a root-level `prompts/` or `agents/` dir) so the whole feature is one self-contained folder.
