/**
 * auto-name.ts — Auto-name sessions from first message context.
 *
 * After the first agent turn, generates a 3-5 word descriptive name
 * from the first user message + git branch using Gemini Flash Lite
 * (or Anthropic Haiku as fallback). Skips if session already named.
 *
 * Cost: ~0.00001 USD per session (Gemini Flash Lite pricing).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";

// ── Git branch ────────────────────────────────────────────────────────────────

function getGitBranch(cwd: string): string {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8", timeout: 2_000, cwd,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// ── Name generation ───────────────────────────────────────────────────────────

const SYSTEM = "You generate ultra-short session names for a coding agent. Given a user message, output 3-5 words in Title Case that capture the task. No punctuation, no quotes. Examples: 'Fix Auth Token Expiry', 'Refactor Database Layer', 'Add Dark Mode Toggle', 'Debug Websocket Handler'.";

async function generateWithGemini(
  userMsg: string,
  branch: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const context = branch ? `Branch: ${branch}\n\n${userMsg}` : userMsg;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ parts: [{ text: context.slice(0, 600) }] }],
        generationConfig: { maxOutputTokens: 15, temperature: 0.2 },
      }),
      signal,
    },
  );

  if (!res.ok) return null;

  const data = await res.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

async function generateWithAnthropic(
  userMsg: string,
  branch: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const context = branch ? `Branch: ${branch}\n\n${userMsg}` : userMsg;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 15,
      system: SYSTEM,
      messages: [{ role: "user", content: context.slice(0, 600) }],
    }),
    signal,
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    content?: Array<{ type: string; text: string }>;
  };

  return data.content?.find(b => b.type === "text")?.text?.trim() ?? null;
}

async function generateName(
  userMsg: string,
  branch: string,
  ctx: ExtensionContext,
): Promise<string | null> {
  // Try Google Gemini first (plain key, cheapest)
  try {
    const googleKey = await ctx.modelRegistry.getApiKeyForProvider("google");
    if (googleKey) {
      const name = await generateWithGemini(userMsg, branch, googleKey, ctx.signal);
      if (name) return name;
    }
  } catch { /* skip */ }

  // Fallback: Anthropic plain API key (not OAuth)
  try {
    const anthropicKey = await ctx.modelRegistry.getApiKeyForProvider("anthropic");
    if (anthropicKey) {
      const name = await generateWithAnthropic(userMsg, branch, anthropicKey, ctx.signal);
      if (name) return name;
    }
  } catch { /* skip */ }

  return null;
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let named = false;

  pi.on("session_start", () => { named = false; });

  pi.on("agent_end", async (event, ctx) => {
    // Only run once, skip if already named or resumed session with existing name
    if (named || pi.getSessionName()) {
      named = true;
      return;
    }
    named = true;

    // Extract first user message text from this agent run
    const userMsg = event.messages.find(m => m.role === "user");
    if (!userMsg) return;

    let text = "";
    const content = (userMsg as { content: string | Array<{ type: string; text?: string }> }).content;
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .filter(b => b.type === "text" && b.text)
        .map(b => b.text!)
        .join(" ");
    }

    text = text.trim();
    if (!text) return;

    const branch = getGitBranch(ctx.cwd ?? ".");
    const name = await generateName(text, branch, ctx);
    if (name) {
      pi.setSessionName(name);
    }
  });
}
