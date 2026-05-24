/**
 * auto-name.ts — Auto-generates a 3-5 word session title after the first agent run.
 *
 * Uses pi's configured API keys (via ctx.modelRegistry) — no hardcoded credentials.
 *
 * Fallback chain (tries in order, skips on error or missing key):
 *   1. "big pickle" — current session model (whatever the user has active)
 *   2. google/gemini-flash-lite-latest — fast & cheap
 *   3. anthropic/claude-haiku-4-5 — reliable fallback
 *   4. First 50 chars of user message — last resort, no API call
 *
 * Only fires once per session (stops after first successful name).
 * In-flight requests are aborted on session change or shutdown.
 *
 * To add a new provider: add a case to callModel().
 * To change the fallback order: edit the chain array in agent_end handler.
 * To change title length: edit NAMING_PROMPT.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const NAMING_PROMPT = (text: string): string =>
  `Create a 3-5 word title for this request (no quotes, no punctuation): ${text.slice(0, 200)}`;

// ── Per-provider callers ──────────────────────────────────────────────────────

async function callAnthropic(
  modelId: string,
  text: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 20,
      messages: [{ role: "user", content: NAMING_PROMPT(text) }],
    }),
    signal,
  });
  if (!res.ok) return undefined;
  const data = await res.json() as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim();
}

async function callGoogle(
  modelId: string,
  text: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: NAMING_PROMPT(text) }] }],
        generationConfig: { maxOutputTokens: 20, temperature: 0.2 },
      }),
      signal,
    },
  );
  if (!res.ok) return undefined;
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

/** Dispatches to the right API based on provider. Returns undefined on any failure. */
async function callModel(
  provider: string,
  modelId: string,
  text: string,
  ctx: ExtensionContext,
  signal: AbortSignal,
): Promise<string | undefined> {
  try {
    if (provider === "anthropic") {
      const key = await ctx.modelRegistry.getApiKeyForProvider("anthropic");
      if (!key) return undefined;
      return await callAnthropic(modelId, text, key, signal);
    }
    if (provider === "google") {
      const key = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!key) return undefined;
      return await callGoogle(modelId, text, key, signal);
    }
    // Other providers (openai-codex, etc.) not wired up for naming — skip to next
    return undefined;
  } catch {
    return undefined;
  }
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let named = false;
  let abortController: AbortController | undefined;

  pi.on("session_start", () => {
    named = false;
    abortController?.abort();
    abortController = undefined;
  });

  pi.on("agent_end", async (event, ctx) => {
    if (named || pi.getSessionName()) {
      named = true;
      return;
    }

    // Extract first user message text
    const firstUser = event.messages.find((m) => m.role === "user");
    if (!firstUser) return;

    let text = "";
    if (typeof firstUser.content === "string") {
      text = firstUser.content;
    } else if (Array.isArray(firstUser.content)) {
      text = (firstUser.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text!)
        .join(" ");
    }
    text = text.trim();
    if (!text) return;

    named = true;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    try {
      // Build chain: current model ("big pickle") → flash-lite → haiku
      const cur = ctx.model;
      const chain: Array<{ provider: string; id: string }> = [];

      if (cur) chain.push({ provider: cur.provider, id: cur.id });

      // Add fallbacks only if not already in chain
      if (!chain.some((m) => m.provider === "google" && m.id === "gemini-flash-lite-latest"))
        chain.push({ provider: "google", id: "gemini-flash-lite-latest" });

      if (!chain.some((m) => m.provider === "anthropic" && m.id === "claude-haiku-4-5"))
        chain.push({ provider: "anthropic", id: "claude-haiku-4-5" });

      for (const model of chain) {
        if (controller.signal.aborted) return;
        const name = await callModel(model.provider, model.id, text, ctx, controller.signal);
        if (name) {
          pi.setSessionName(name.replace(/["']/g, ""));
          return;
        }
      }

      // All models failed — fall back to truncated text
      pi.setSessionName(text.slice(0, 50));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      pi.setSessionName(text.slice(0, 50));
    } finally {
      if (abortController === controller) abortController = undefined;
    }
  });

  pi.on("session_shutdown", () => {
    abortController?.abort();
    abortController = undefined;
  });
}
