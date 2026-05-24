export const MODEL_NAMES: Record<string, string> = {
  "claude-opus-4-6": "Opus 4.6",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "gpt-5.5": "GPT 5.5",
  "gemini-flash-lite-latest": "Flash Lite",
};

export const PROVIDER_NAMES: Record<string, { name: string; icon: string }> = {
  anthropic: { name: "Anthropic", icon: "󰚩" },
  "openai-codex": { name: "OpenAI", icon: "󰚩" },
  google: { name: "Google", icon: "󰊭" },
  "github-copilot": { name: "Copilot", icon: "󰊤" },
};

export function getModelDisplayName(id: string | undefined): string {
  if (!id) return "—";
  return MODEL_NAMES[id.toLowerCase()] ?? id;
}

export function getProviderDisplay(provider: string | undefined): { name: string; icon: string } | undefined {
  if (!provider) return undefined;
  return PROVIDER_NAMES[provider];
}
