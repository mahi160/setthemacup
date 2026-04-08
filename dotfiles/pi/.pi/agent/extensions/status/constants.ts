import type { Provider } from "./types.js";

export const MODELS: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "gpt-4.1": "GPT 4.1",
  "gpt-5-mini": "GPT 5 Mini",
};

export const PROVIDERS: Record<string, Provider> = {
  anthropic: { name: "Anthropic", icon: "󰚩", color: "\x1b[38;5;208m" },
  "github-copilot": { name: "Copilot", icon: "", color: "\x1b[94m" },
};

export const EMPTY_PROVIDER: Provider = { name: "", icon: "", color: "" };
