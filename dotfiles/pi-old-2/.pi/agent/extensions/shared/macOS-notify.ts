/**
 * macOS-notify.ts — shared notification helper for pi extensions.
 * Used by: notifier.ts, safe-bash.ts
 *
 * Delivery: terminal-notifier → native Notification Center banner.
 *   - π icon on the left (terminal-notifier.app bundle patched by pi-notify-icon.sh)
 *   - Click-to-focus activates Ghostty
 *   - Sound via afplay delayed by SOUND_DELAY_MS to align with banner slide-in
 *   - Groups by title so stale banners are replaced (e.g. answered ask_user)
 *
 * Fallback: osascript if terminal-notifier is not installed (e.g. bootstrap).
 *
 * Setup (once, handled by setup/04-dotfiles.sh on fresh installs):
 *   brew install terminal-notifier
 *   bash ~/.setup/scripts/pi-notify-icon.sh
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

const GHOSTTY_BUNDLE = "com.mitchellh.ghostty";

// Sound fires via afplay after this delay so it lands when the banner is
// fully visible, not before it slides in (~500ms covers terminal-notifier
// spawn + macOS banner animation).
const SOUND_DELAY_MS = 500;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a macOS Notification Center banner.
 * Falls back to osascript if terminal-notifier is not installed.
 *
 * @param title    Heading shown in the banner  (e.g. "π ✓")
 * @param subtitle Secondary line               (e.g. "myproject · 8.3s")
 * @param body     Body text
 * @param sound    macOS sound name ("Hero" / "Basso" / "Ping" / "")
 */
export function notifyMacOS(
  title: string,
  subtitle: string,
  body: string,
  sound: string,
): void {
  const tn = terminalNotifierPath();
  if (tn) {
    notifyViaTerminalNotifier(tn, title, subtitle, body, sound);
  } else {
    notifyViaOsascript(title, subtitle, body, sound);
  }
}

// ── terminal-notifier ────────────────────────────────────────────────────────

/** Resolved binary path, cached after first lookup. */
let _tnPath: string | null | undefined = undefined;

function terminalNotifierPath(): string | null {
  if (_tnPath !== undefined) return _tnPath;
  for (const p of [
    "/opt/homebrew/bin/terminal-notifier",
    "/usr/local/bin/terminal-notifier",
  ]) {
    if (existsSync(p)) return (_tnPath = p);
  }
  return (_tnPath = null);
}

function notifyViaTerminalNotifier(
  bin: string,
  title: string,
  subtitle: string,
  body: string,
  sound: string,
): void {
  execFile(bin, [
    "-title",    title,
    "-subtitle", subtitle,
    "-message",  body || " ",
    "-activate", GHOSTTY_BUNDLE,
    "-group",    `pi-${title.replace(/\s+/g, "-")}`,
  ], { timeout: 5_000 }, () => {});

  if (sound) {
    setTimeout(() => {
      execFile("afplay", [`/System/Library/Sounds/${sound}.aiff`], { timeout: 3_000 }, () => {});
    }, SOUND_DELAY_MS);
  }
}

// ── osascript fallback ───────────────────────────────────────────────────────

function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function notifyViaOsascript(
  title: string,
  subtitle: string,
  body: string,
  sound: string,
): void {
  const soundClause = sound ? ` sound name "${sound}"` : "";
  const script =
    `display notification "${escapeAppleScript(body)}" ` +
    `with title "${escapeAppleScript(title)}" ` +
    `subtitle "${escapeAppleScript(subtitle)}"` +
    soundClause;
  execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
}
