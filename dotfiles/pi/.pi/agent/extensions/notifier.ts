/**
 * notifier.ts — macOS Notification Center alerts for agent events.
 *
 * Fires notifications for:
 *   - User asks (input events): "Ping" sound — know pi heard your question
 *   - Agent completion: "Glass" on success, "Basso" on error
 *
 * Features:
 *   - Input notification: Shows user's prompt (first 100 chars) + "Ping" sound
 *   - Completion sound: "Glass" on success, "Basso" on error (audible in background)
 *   - Duration shown in subtitle: "setthemacup · 12.4s"
 *   - Error detection: different title + sound when agent errors or aborts
 *   - Last assistant text shown as body (first 100 chars) — preview of what pi did
 *   - Skips completion runs shorter than MIN_DURATION_MS (fast commands, instant responses)
 *   - Proper AppleScript escaping — safe against special chars in paths/messages
 *
 * macOS only — execFile("osascript") will silently fail on Linux/Windows.
 * Sound names are from /System/Library/Sounds/ (no extension needed).
 * To change sounds: edit INPUT_SOUND / SUCCESS_SOUND / ERROR_SOUND.
 * To change the skip threshold: edit MIN_DURATION_MS.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { notifyMacOS, escapeAppleScript } from "./shared/macOS-notify.js";
import { basename } from "node:path";

const MIN_DURATION_MS = 3_000;
const INPUT_SOUND = "Ping";       // Notification when user asks
const SUCCESS_SOUND = "Glass";    // Notification on agent success
const ERROR_SOUND = "Basso";      // Notification on agent error

/** Formats milliseconds as "8.3s" or "2m 4s". */
function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function (pi: ExtensionAPI): void {
  let agentStartedAt = 0;

  // Notify on user input (asks)
  pi.on("input", (event, ctx: ExtensionContext) => {
    const project = basename(ctx.cwd ?? "unknown");
    // Extract text from input
    const inputText = Array.isArray(event.text)
      ? event.text
          .map((item) => (typeof item === "string" ? item : item.text || ""))
          .join(" ")
          .slice(0, 100)
      : String(event.text).slice(0, 100);
    const preview = inputText || "(no text)";
    notifyMacOS("π ?", project, preview, INPUT_SOUND);
  });

  pi.on("agent_start", () => {
    agentStartedAt = Date.now();
  });

  pi.on("agent_end", (event, ctx: ExtensionContext) => {
    // Don't notify on auto-retried failures — wait for the final outcome
    if ((event as unknown as { willRetry?: boolean }).willRetry) return;

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
      notifyMacOS("π ✗", subtitle, errMsg, ERROR_SOUND);
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

      notifyMacOS("π ✓", subtitle, preview || "Ready for input", SUCCESS_SOUND);
    }
  });
}
