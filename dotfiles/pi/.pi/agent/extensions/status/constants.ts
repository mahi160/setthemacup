import type { Provider } from "./types.js";

export const MODELS: Record<string, string> = {
  // Anthropic
  "claude-opus-4-6": "Opus 4.6",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
};

export const PROVIDERS: Record<string, Provider> = {
  anthropic: {
    name: "Anthropic",
    icon: " ",
    color: "\x1b[38;5;196m", // bright red
  },

  openai: {
    name: "OpenAI",
    icon: " ",
    color: "\x1b[38;5;226m", // bright yellow
  },

  "google-gemini-cli": {
    name: "Google",
    icon: " ",
    color: "\x1b[38;5;201m", // bright magenta
  },

  ollama: {
    name: "Ollama",
    icon: " ",
    color: "\x1b[38;5;51m", // bright cyan
  },

  "github-copilot": {
    name: "Copilot",
    icon: " ",
    color: "\x1b[38;5;202m", // bright orange
  },

  "openai-codex": {
    name: "Codex",
    icon: " ",
    color: "\x1b[38;5;129m", // bright purple
  },
};

export const EMPTY_PROVIDER: Provider = {
  name: "Unknown",
  icon: "",
  color: "\x1b[0m",
};
