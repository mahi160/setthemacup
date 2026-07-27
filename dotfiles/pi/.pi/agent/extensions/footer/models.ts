// Provider icon lookup. Display names come from ctx.model.name and
// ctx.modelRegistry.getProviderDisplayName() (pi >=0.82) instead of
// hand-maintained tables that inevitably drift out of date.
export const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "\u{f06a9}", // 󰚩
  "openai-codex": "\u{f06a9}", // 󰚩
  google: "\u{f02ad}", // 󰊭
  "github-copilot": "\u{f02a4}", // 󰊤
};

export function getProviderIcon(provider: string | undefined): string {
  if (!provider) return "";
  return PROVIDER_ICONS[provider] ?? "";
}
