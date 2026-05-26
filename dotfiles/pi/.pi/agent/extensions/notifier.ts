/**
 * notifier.ts — macOS Notification Center alert on agent completion.
 *
 * Fires when the agent finishes a run so you know it's ready even if the
 * terminal is in the background.
 *
 * Features:
 *   - Sound: "Glass" on success, "Basso" on error (audible even in background)
 *   - Duration shown in subtitle: "setthemacup · 12.4s"
 *   - Error detection: different title + sound when agent errors or aborts
 *   - Last assistant text shown as body (first 100 chars) — preview of what pi did
 *   - Skips runs shorter than MIN_DURATION_MS (fast commands, instant responses)
 *   - Proper AppleScript escaping — safe against special chars in paths/messages
 *
 * macOS only — execFile("osascript") will silently fail on Linux/Windows.
 * Sound names are from /System/Library/Sounds/ (no extension needed).
 * To change sounds: edit SUCCESS_SOUND / ERROR_SOUND.
 * To change the skip threshold: edit MIN_DURATION_MS.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { execFile } from "node:child_process";
import { basename } from "node:path";

const MIN_DURATION_MS = 3_000;
const SUCCESS_SOUND = "Glass";
const ERROR_SOUND = "Basso";

/** Escapes a string for safe embedding inside AppleScript double-quoted strings. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Formats milliseconds as "8.3s" or "2m 4s". */
function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function notify(
  title: string,
  subtitle: string,
  body: string,
  sound: string,
): void {
  const script = `display notification "${esc(body)}" with title "${esc(title)}" subtitle "${esc(subtitle)}" sound name "${sound}"`;
  execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
}

export default function (pi: ExtensionAPI): void {
  let agentStartedAt = 0;

  pi.on("agent_start", () => {
    agentStartedAt = Date.now();
  });

  pi.on("agent_end", (event, ctx: ExtensionContext) => {
    const durationMs = Date.now() - agentStartedAt;
    if (durationMs < MIN_DURATION_MS) return;

    const project = basename(ctx.cwd ?? "unknown");
    const duration = fmtDuration(durationMs);
    const subtitle = `${project} · ${duration}`;

    const lastAssistant = (event.messages as AssistantMessage[])
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    const isError =
      lastAssistant?.stopReason === "error" ||
      lastAssistant?.stopReason === "aborted";

    if (isError) {
      const errMsg = (lastAssistant?.errorMessage ?? "unknown error").slice(
        0,
        100,
      );
      notify("π ✗", subtitle, errMsg, ERROR_SOUND);
    } else {
      const content = lastAssistant?.content;
      const rawPreview = Array.isArray(content)
        ? (content as Array<{ type: string; text?: string }>)
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text!)
            .join(" ")
            .trim()
        : "";
      const preview = rawPreview
        .replace(/\*\*Touched:\*\*[\s\S]*$/, "")
        .trimEnd()
        .slice(0, 100);

      notify("π ✓", subtitle, preview || "Ready for input", SUCCESS_SOUND);
    }
  });
}
