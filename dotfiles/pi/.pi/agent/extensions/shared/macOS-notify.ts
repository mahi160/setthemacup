/**
 * Shared macOS notification utilities for pi extensions.
 * Used by: notifier.ts, safe-bash.ts, etc.
 */

import { execFile } from "node:child_process";

/**
 * Escape string for safe embedding in AppleScript double-quoted strings.
 */
export function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Send a macOS Notification Center alert.
 * Silently fails on non-macOS systems.
 */
export function notifyMacOS(
  title: string,
  subtitle: string,
  body: string,
  sound: string,
): void {
  const script = `display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}" subtitle "${escapeAppleScript(subtitle)}" sound name "${sound}"`;
  execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
}
