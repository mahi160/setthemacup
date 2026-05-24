/**
 * auto-name.ts — Auto-generates a 3-5 word session title after the first agent run.
 *
 * Uses pi's own model system (spawns `pi -p`) instead of raw provider API calls.
 * Auth, retries, and provider selection are all handled by pi — no fetch, no API keys here.
 *
 * Subprocess flags keep it lean:
 *   --no-session        don't persist the naming session
 *   --no-tools          no tools needed for a title
 *   --no-extensions     skip loading stats, footer, etc.
 *   --no-context-files  skip AGENTS.md — saves tokens
 *   --thinking off      no extended thinking for a 5-word title
 *
 * Fallback chain (tries in order):
 *   1. google/gemini-flash-lite-latest — fast & cheap
 *   2. anthropic/claude-haiku-4-5 — reliable fallback
 *   3. First 50 chars of user message — no API call
 *
 * Big model intentionally skipped — overkill for a title.
 *
 * To change models: edit NAMING_MODELS.
 * To change title format: edit NAMING_PROMPT.
 */

import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const NAMING_PROMPT = (text: string): string =>
  `Create a 3-5 word title for this request (no quotes, no punctuation): ${text.slice(0, 200)}`;

const NAMING_MODELS = [
  "google/gemini-flash-lite-latest",
  "anthropic/claude-haiku-4-5",
] as const;

/**
 * Spawns a minimal pi process to generate a title.
 * Returns the first line of stdout, or undefined on failure/abort.
 */
function callPiForName(
  modelFlag: string,
  text: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let output = "";

    const proc = spawn(
      "pi",
      [
        "--model",
        modelFlag,
        "--no-session",
        "--no-tools",
        "--no-extensions",
        "--no-context-files",
        "--thinking",
        "off",
        "-p",
        NAMING_PROMPT(text),
      ],
      { stdio: ["ignore", "pipe", "pipe"], env: process.env },
    );

    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.on("close", (code) => {
      const name = output.trim().split("\n")[0]?.trim();
      resolve(code === 0 && name ? name : undefined);
    });

    signal.addEventListener(
      "abort",
      () => {
        proc.kill("SIGTERM");
        resolve(undefined);
      },
      { once: true },
    );
  });
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

  pi.on("agent_end", async (event) => {
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
      for (const model of NAMING_MODELS) {
        if (controller.signal.aborted) return;
        const name = await callPiForName(model, text, controller.signal);
        if (name) {
          pi.setSessionName(name.replace(/["']/g, ""));
          return;
        }
      }
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
