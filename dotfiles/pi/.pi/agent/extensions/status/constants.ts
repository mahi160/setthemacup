import type { Provider } from "./types.js";

export const MODELS: Record<string, string> = {
  // Anthropic
  "claude-opus-4-6": "Opus 4.6",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "gpt-5.5": "GPT 5.5",
  "gemini-3.1-flash-lite-preview": "Gemini 3.1 (FL)",
};

export const PROVIDERS: Record<string, Provider> = {
  anthropic: {
    name: "Anthropic",
    icon: "",
    color: "\x1b[38;5;208m", // warm orange (gruvbox yellow-orange)
  },

  openai: {
    name: "OpenAI",
    icon: "󰚩", // swirl-like AI mark
    color: "\x1b[38;5;142m", // gruvbox green
  },

  "google-gemini-cli": {
    name: "Google",
    icon: "󰊭", // sparkle / gemini style
    color: "\x1b[38;5;109m", // gruvbox aqua-blue
  },

  ollama: {
    name: "Ollama",
    icon: "󰳆", // llama/alpaca-ish
    color: "\x1b[38;5;108m", // muted cyan-green
  },

  "github-copilot": {
    name: "Copilot",
    icon: "󰊤", // github/octocat-ish
    color: "\x1b[38;5;175m", // gruvbox purple
  },

  "openai-codex": {
    name: "Codex",
    icon: "󰚩", // same OpenAI family
    color: "\x1b[38;5;214m", // gruvbox orange
  },
};

export const EMPTY_PROVIDER: Provider = {
  name: "Unknown",
  icon: "",
  color: "\x1b[0m",
};
