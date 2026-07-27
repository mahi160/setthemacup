/**
 * shared/notify.ts — OS notification API with a clean platform seam.
 * macOS implemented now. Linux/Windows: add a backend, wire into getBackend().
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

export type NotifySound = "success" | "error" | "question" | "none";

export interface NotifyOptions {
  title: string;
  subtitle?: string;
  body?: string;
  sound?: NotifySound;
}

interface NotifyBackend {
  send(opts: NotifyOptions): void;
}

// ── macOS backend ────────────────────────────────────────────────────────────
// Delivery: terminal-notifier (π icon, click-to-focus Ghostty, groups by title
// so stale banners get replaced). Falls back to osascript if not installed.

const GHOSTTY_BUNDLE = "com.mitchellh.ghostty";
const SOUND_DELAY_MS = 500; // let the banner slide in before the sound fires

const MAC_SOUNDS: Record<NotifySound, string> = {
  success: "Hero",
  error: "Basso",
  question: "Ping",
  none: "",
};

let _terminalNotifierPath: string | null | undefined;
function terminalNotifierPath(): string | null {
  if (_terminalNotifierPath !== undefined) return _terminalNotifierPath;
  for (const p of ["/opt/homebrew/bin/terminal-notifier", "/usr/local/bin/terminal-notifier"]) {
    if (existsSync(p)) return (_terminalNotifierPath = p);
  }
  return (_terminalNotifierPath = null);
}

function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const macBackend: NotifyBackend = {
  send({ title, subtitle = "", body = "", sound = "none" }) {
    const soundName = MAC_SOUNDS[sound];
    const tn = terminalNotifierPath();

    if (tn) {
      execFile(tn, [
        "-title", title,
        "-subtitle", subtitle,
        "-message", body || " ",
        "-activate", GHOSTTY_BUNDLE,
        "-group", `pi-${title.replace(/\s+/g, "-")}`,
      ], { timeout: 5_000 }, () => {});
      if (soundName) {
        setTimeout(() => {
          execFile("afplay", [`/System/Library/Sounds/${soundName}.aiff`], { timeout: 3_000 }, () => {});
        }, SOUND_DELAY_MS);
      }
      return;
    }

    const soundClause = soundName ? ` sound name "${soundName}"` : "";
    const script =
      `display notification "${escapeAppleScript(body)}" ` +
      `with title "${escapeAppleScript(title)}" ` +
      `subtitle "${escapeAppleScript(subtitle)}"` +
      soundClause;
    execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
  },
};

// ── No-op backend — Linux/Windows not ported yet ────────────────────────────
// ponytail: stub. Linux -> notify-send, Windows -> PowerShell toast, when needed.

const noopBackend: NotifyBackend = { send() {} };

function getBackend(): NotifyBackend {
  return process.platform === "darwin" ? macBackend : noopBackend;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function notify(opts: NotifyOptions): void {
  getBackend().send(opts);
}

// ── Self-check ───────────────────────────────────────────────────────────────
// Run directly (`node shared/notify.ts` style) to sanity-check the sound table
// and backend wiring without firing a real notification.
if (process.argv[1]?.endsWith("notify.ts")) {
  console.assert(Object.keys(MAC_SOUNDS).length === 4, "sound map incomplete");
  console.assert(typeof getBackend().send === "function", "backend missing send()");
  console.log("notify self-check: OK");
}
