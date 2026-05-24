/**
 * title.ts — Gruvbox-material gradient ASCII header for mahi.
 *
 * Displays block-font "mahi" logo with a gruvbox color cycle gradient.
 * Subtitle shows current model, project name, and a daily rotating quote.
 * No DB queries, no timers — pure visual.
 */

import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// ── Types ─────────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

// ── Gruvbox-material palette (accent cycle) ───────────────────────────────────

const PALETTE: Rgb[] = [
  [216, 166,  87],  // yellow
  [231, 138,  78],  // orange
  [234, 105,  98],  // red
  [211, 134, 155],  // purple
  [125, 174, 163],  // blue
  [137, 180, 130],  // aqua
  [169, 182, 101],  // green
];

// ── ASCII art: "mahi" ─────────────────────────────────────────────────────────

const TITLE_LINES = [
  "  ███╗   ███╗  █████╗  ██╗  ██╗ ██╗  ",
  "  ████╗ ████║ ██╔══██╗ ██║  ██║ ██║  ",
  "  ██╔████╔██║ ███████║ ███████║ ██║  ",
  "  ██║╚██╔╝██║ ██╔══██║ ██╔══██║ ██║  ",
  "  ██║ ╚═╝ ██║ ██║  ██║ ██║  ██║ ██║  ",
  "  ╚═╝     ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ",
];

// ── Quotes (one per day, cycles) ──────────────────────────────────────────────

const QUOTES = [
  "tokens go brrr",
  "sudo make me a sandwich",
  "it works on my machine™",
  "there are 10 kinds of people…",
  "!false — it's funny because it's true",
  "my code doesn't have bugs, it has features",
  "git push --force and pray",
  "99 bugs in the code, fix one, 127 bugs in the code",
  "AI wrote this. I just mass approve.",
  "semicolons are just emotional crutches",
  "undefined is not a function (of my patience)",
  "works on my machine. ship my machine.",
  "there is no place like 127.0.0.1",
  "chmod 777 and hope for the best",
  "// TODO: actually fix this later",
  "NaN !== NaN and I'm not okay",
  "segfault (core vibes dumped)",
  "I don't always test my code, but when I do, I do it in production",
  "rm -rf / — yolo",
  "my other car is a recursive function",
  "the cloud is just someone else's computer",
  "there are only two hard problems: cache invalidation, naming things, and off-by-one errors",
  "welcome to prompt engineering (it's turtles all the way down)",
  "the AI hallucinated? nah, it's just creative nonfiction",
  "stack overflow: where copy-paste engineers are born",
  "async/await? more like async/a-pray",
  "my code review feedback: LGTM (didn't read)",
  "I use vim btw (and I can't exit)",
  "0 errors, 847 warnings — close enough",
  "prod is the final staging environment",
];

// ── Gradient helpers ──────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";

function mix(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function sampleGradient(position: number): Rgb {
  const wrapped = ((position % 1) + 1) % 1;
  const scaled  = wrapped * PALETTE.length;
  const index   = Math.floor(scaled);
  const next    = (index + 1) % PALETTE.length;
  const t       = scaled - index;
  const a       = PALETTE[index]!;
  const b       = PALETTE[next]!;
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function fgRgb([r, g, b]: Rgb, text: string): string {
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

function gradientText(text: string, phase: number): string {
  const chars = [...text];
  const span  = Math.max(chars.length - 1, 1);
  return chars
    .map((ch, i) => (ch === " " ? ch : fgRgb(sampleGradient(i / span + phase), ch)))
    .join("");
}

function center(text: string, width: number): string {
  const len = [...text].length;
  if (len >= width) return text;
  return " ".repeat(Math.floor((width - len) / 2)) + text;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderHeader(
  width: number,
  modelId: string,
  cwd: string,
  quote: string,
): string[] {
  const lines = TITLE_LINES.map((line, row) =>
    gradientText(center(line, width), row * 0.045),
  );

  const proj     = basename(cwd) || "session";
  const subtitle = `${modelId}  ·  ${proj}  ·  "${quote}"`;
  const divider  = "─".repeat(Math.max(0, Math.min(subtitle.length + 4, width - 4)));

  return [
    "",
    ...lines,
    `${BOLD}${gradientText(center(subtitle, width), 0.18)}${RESET}`,
    DIM + center(divider, width) + RESET,
    "",
  ];
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let requestRender: (() => void) | undefined;
  let currentModelId = "";
  let currentCwd     = "";

  const dailyQuote = QUOTES[Math.floor(Date.now() / 86_400_000) % QUOTES.length]!;

  function installHeader(ctx: ExtensionContext): void {
    ctx.ui.setHeader((tui) => {
      requestRender = () => tui.requestRender();
      return {
        render(width: number): string[] {
          return renderHeader(width, currentModelId || "—", currentCwd, dailyQuote);
        },
        invalidate() {
          tui.requestRender();
        },
      };
    });
  }

  pi.on("session_start", (_, ctx) => {
    currentModelId = ctx.model?.id ?? "";
    currentCwd     = ctx.cwd ?? "";
    if (ctx.hasUI) installHeader(ctx);
  });

  pi.on("model_select", (event) => {
    currentModelId = event.model.id;
    requestRender?.();
  });

  pi.on("session_shutdown", (_, ctx) => {
    requestRender = undefined;
    if (ctx.hasUI) ctx.ui.setHeader(undefined);
  });
}
