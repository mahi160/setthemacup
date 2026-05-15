import os from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// ── π sign (no surrounding whitespace; centring done at render) ───────────────
const PI_ART = [
  "████████████████",   // top bar
  "▄▄  ██    ██  ▄▄",   // bar → leg junction
  "██    ██",            // legs (×4)
  "██    ██",
  "██    ██",
  "██    ██",
];

// ── One witty quote per calendar day ─────────────────────────────────────────
const QUOTES = [
  "shipping beats perfection",
  "the best refactor is deletion",
  "naming things: still the second hardest problem",
  "git commit --amend is a lifestyle",
  "undefined is not a philosophy",
  "it works on my machine™",
  "measure twice, push once",
  "complexity is the enemy of reliability",
  "premature optimisation: the original sin",
  "have you tried turning it off and on?",
  "documentation is future self-care",
  "code never lies; comments sometimes do",
  "always code as if the next dev knows where you live",
  "make it work, make it right, make it fast",
  "the internet: duct tape and optimism",
  "every bug is a feature waiting to be understood",
  "you can't unit-test your way out of a bad design",
];

// ── Char-by-char gradient ─────────────────────────────────────────────────────
type Rgb = [number, number, number];
const RESET = "\x1b[0m";

function extractRgb(ansi: string): Rgb | null {
  const m = ansi.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function applyRgb([r, g, b]: Rgb, s: string): string {
  return `\x1b[38;2;${r};${g};${b}m${s}${RESET}`;
}
function samplePalette(pal: Rgb[], pos: number): Rgb {
  const w = ((pos % 1) + 1) % 1;
  const sc = w * pal.length;
  const i = Math.floor(sc);
  return mixRgb(pal[i]!, pal[(i + 1) % pal.length]!, sc - i);
}
/** Colour every non-space char with a smooth gradient sweep. */
function gradientLine(text: string, pal: Rgb[], phase: number): string {
  const chars = [...text];
  const span = Math.max(chars.length - 1, 1);
  return chars
    .map((c, i) => (c === " " ? c : applyRgb(samplePalette(pal, i / span + phase), c)))
    .join("");
}

/**
 * Build a 6-stop palette from the active theme's 24-bit RGB values.
 * Samples: accent → warning → error → syntaxNumber → mdLink → success
 * (yellow → orange → red → purple → blue → green in gruvbox-material).
 * Falls back to a gruvbox-material palette if the theme uses indexed colours.
 */
const FALLBACK_PALETTE: Rgb[] = [
  [216, 166,  87],  // #d8a657  yellow
  [231, 138,  78],  // #e78a4e  orange
  [234, 105,  98],  // #ea6962  red
  [211, 134, 155],  // #d3869b  purple
  [125, 174, 163],  // #7daea3  blue
  [137, 180, 130],  // #89b482  green
];
function buildPalette(theme: { fg(t: string, s: string): string }): Rgb[] {
  const tokens = ["accent", "warning", "error", "syntaxNumber", "mdLink", "success"];
  const pal = tokens.map(t => extractRgb(theme.fg(t, "x"))).filter(Boolean) as Rgb[];
  return pal.length >= 2 ? pal : FALLBACK_PALETTE;
}

// ── Layout helpers ────────────────────────────────────────────────────────────
/** Prepend spaces to visually centre `s` in `w` columns. */
function centerIn(s: string, w: number): string {
  const vw = visibleWidth(s);
  return vw >= w ? s : " ".repeat(Math.floor((w - vw) / 2)) + s;
}
/** Pad an ANSI string to exactly `w` visible columns. */
function padRight(s: string, w: number): string {
  const vw = visibleWidth(s);
  return vw < w ? s + " ".repeat(w - vw) : s;
}

// ── Number formatters ─────────────────────────────────────────────────────────
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fmtK    = (n: number) => COMPACT.format(n);
const fmtCost = (n: number) =>
  n <= 0 ? "$0.00" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;

// ── Stats (from stats/db, gracefully absent) ──────────────────────────────────
interface StatData {
  inputs: number; sessions: number;
  tokensIn: number; tokensOut: number;
  cost: number; topModel: string; streak: number;
}
const ZERO_STATS: StatData = {
  inputs: 0, sessions: 0, tokensIn: 0, tokensOut: 0, cost: 0, topModel: "—", streak: 0,
};
function fetchStats(): StatData {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./stats/db") as {
      getDb(): { prepare(sql: string): { get(...a: unknown[]): Record<string, unknown> | undefined } };
      getStreak(): number;
    };
    const db    = mod.getDb();
    const since = Date.now() - 86_400_000;
    const row = db.prepare(
      `SELECT COUNT(*)                        AS inputs,
              COUNT(DISTINCT session_id)      AS sessions,
              COALESCE(SUM(tokens_input),  0) AS tokensIn,
              COALESCE(SUM(tokens_output), 0) AS tokensOut,
              COALESCE(SUM(cost_usd),      0) AS cost
       FROM user_inputs WHERE started_at >= ? AND ended_at IS NOT NULL`,
    ).get(since);
    const mrow = db.prepare(
      `SELECT model_id FROM user_inputs
       WHERE started_at >= ? AND ended_at IS NOT NULL
       GROUP BY model_id ORDER BY COUNT(*) DESC LIMIT 1`,
    ).get(since);
    return {
      inputs:    Number(row?.inputs    ?? 0),
      sessions:  Number(row?.sessions  ?? 0),
      tokensIn:  Number(row?.tokensIn  ?? 0),
      tokensOut: Number(row?.tokensOut ?? 0),
      cost:      Number(row?.cost      ?? 0),
      topModel:  String(mrow?.model_id ?? "—"),
      streak:    mod.getStreak(),
    };
  } catch { return ZERO_STATS; }
}

// ── Extension ─────────────────────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | undefined;

  function installHeader(ctx: ExtensionContext) {
    ctx.ui.setHeader((tui, theme) => {
      requestRender = () => tui.requestRender();

      // Palette cache — busted on invalidate() so theme switches take effect
      let palette: Rgb[] | null = null;
      const getPalette = () => palette ?? (palette = buildPalette(theme));

      // Stats cache — refreshed at most once per minute
      let statsCache = ZERO_STATS;
      let statsCacheAt = 0;
      const getStats = (): StatData => {
        const now = Date.now();
        if (now - statsCacheAt < 60_000) return statsCache;
        statsCache = fetchStats();
        statsCacheAt = now;
        return statsCache;
      };

      return {
        render(width: number): string[] {
          const pal   = getPalette();
          const stats = getStats();
          const user  = os.userInfo().username;
          const quote = QUOTES[Math.floor(Date.now() / 86_400_000) % QUOTES.length]!;
          const cmds  = pi.getCommands();
          const extCnt = new Set(
            cmds.filter(c => c.source === "extension").map(c => c.sourceInfo.path),
          ).size;
          const cmdCnt = cmds.filter(c => c.source === "extension").length;

          // ── Narrow: centred π art only ───────────────────────────────────
          if (width < 56) {
            return [
              "",
              ...PI_ART.map((ln, i) => centerIn(gradientLine(ln, pal, i * 0.05), width)),
              "",
            ];
          }

          // ── True 50/50 column split ──────────────────────────────────────
          const LEFT_W  = Math.floor((width - 3) / 2);
          const RIGHT_W = width - LEFT_W - 3;
          const div     = theme.fg("borderMuted", " │ ");

          // ── Left column: π art + one-liner quote ─────────────────────────
          const L: string[] = [""];
          for (let i = 0; i < PI_ART.length; i++) {
            L.push(centerIn(gradientLine(PI_ART[i]!, pal, i * 0.05), LEFT_W));
          }
          L.push("");
          // Quote + "— name" truncated to fit, then centred
          L.push(centerIn(
            theme.fg("muted", truncateToWidth(`"${quote}"  — ${user}`, LEFT_W - 1, "…")),
            LEFT_W,
          ));
          L.push("");

          // ── Right column: build rows, then centre the block ──────────────
          const h    = (s: string) => theme.fg("accent", theme.bold(s));
          const d    = (s: string) => theme.fg("dim",    s);
          const m    = (s: string) => theme.fg("muted",  s);
          const LPAD = 9;
          const lbl  = (s: string) => m(s.padEnd(LPAD));
          const fire = stats.streak > 0
            ? "🔥".repeat(Math.min(3, Math.max(1, Math.floor(stats.streak / 5))))
            : "";

          const rows: string[] = [];
          rows.push("");
          rows.push(h("◆ last 24 hours"));
          if (stats.inputs > 0) {
            rows.push(`${lbl("prompts")}${stats.inputs}  ${d("·")}  ${stats.sessions} ${d("sessions")}`);
            rows.push(`${lbl("tokens")}${d("↑")} ${fmtK(stats.tokensIn)}   ${d("↓")} ${fmtK(stats.tokensOut)}`);
            rows.push(`${lbl("cost")}${fmtCost(stats.cost)}`);
            rows.push(`${lbl("model")}${stats.topModel}`);
          } else {
            rows.push(d("no activity yet"));
            rows.push(""); rows.push(""); rows.push("");
          }
          rows.push("");
          rows.push(h("◆ this session"));
          rows.push(`${lbl("loaded")}${extCnt} ${d("ext")}  ${d("·")}  ${cmdCnt} ${d("cmds")}`);
          rows.push(stats.streak > 0
            ? `${lbl("streak")}${stats.streak} ${d(stats.streak !== 1 ? "days" : "day")}  ${fire}`
            : `${lbl("streak")}${d("—  start today")}`);
          rows.push("");

          // Centre the block as a unit: shift every line by the same offset
          const maxRw  = rows.reduce((mx, r) => Math.max(mx, visibleWidth(r)), 0);
          const offset = " ".repeat(Math.max(0, Math.floor((RIGHT_W - maxRw) / 2)));
          const R      = rows.map(r => visibleWidth(r) > 0 ? offset + r : r);

          // ── Zip columns ──────────────────────────────────────────────────
          const len = Math.max(L.length, R.length);
          return Array.from({ length: len }, (_, i) =>
            truncateToWidth(
              padRight(L[i] ?? "", LEFT_W) + div + truncateToWidth(R[i] ?? "", RIGHT_W),
              width,
            ),
          );
        },

        invalidate() {
          palette = null; // rebuild from new theme on next render
          tui.requestRender();
        },
      };
    });
  }

  pi.on("session_start", (_event, ctx) => { if (!ctx.hasUI) return; installHeader(ctx); });
  pi.on("model_select",  ()           => { requestRender?.(); });
  pi.on("session_shutdown", (_event, ctx) => { if (ctx.hasUI) ctx.ui.setHeader(undefined); });

  pi.registerCommand("flow-title", {
    description: "Enable the two-column π session header",
    handler: async (_args, ctx) => { installHeader(ctx); ctx.ui.notify("Flow title enabled", "info"); },
  });
  pi.registerCommand("flow-title-builtin", {
    description: "Restore pi's built-in header",
    handler: async (_args, ctx) => { ctx.ui.setHeader(undefined); ctx.ui.notify("Built-in header restored", "info"); },
  });
}
