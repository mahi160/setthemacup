/**
 * title.ts — Flashy nerdy header with aggregate stats + daily quote.
 *
 * Shows today's usage + all-time totals + streak + a rotating
 * nerdy one-liner. 4 lines including padding.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { getDb, getStreak } from "./stats/db.js";

// ── Nerdy quotes (one per day, cycles) ────────────────────────────────────────

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

// ── Formatters ────────────────────────────────────────────────────────────────

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fmtK = (n: number) => COMPACT.format(n);
const fmtCost = (n: number) =>
  n <= 0 ? "$0" : n < 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;

// ── Stats queries ─────────────────────────────────────────────────────────────

interface AggrStats {
  today: { inputs: number; tokens: number; cost: number };
  allTime: { sessions: number; tokens: number; cost: number };
  streak: number;
}

const ZERO: AggrStats = {
  today: { inputs: 0, tokens: 0, cost: 0 },
  allTime: { sessions: 0, tokens: 0, cost: 0 },
  streak: 0,
};

function fetchStats(): AggrStats {
  try {
    const db = getDb();
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const t = db.prepare(`
      SELECT COUNT(*) AS inputs,
             COALESCE(SUM(tokens_used), 0) AS tokens,
             COALESCE(SUM(cost_usd), 0)    AS cost
      FROM user_inputs WHERE started_at >= ? AND ended_at IS NOT NULL
    `).get(sod) as { inputs: number; tokens: number; cost: number } | undefined;

    const a = db.prepare(`
      SELECT COUNT(*) AS sessions,
             COALESCE(SUM(tokens), 0) AS tokens,
             COALESCE(SUM(cost), 0)   AS cost
      FROM sessions WHERE ended_at IS NOT NULL AND turns > 0
    `).get() as { sessions: number; tokens: number; cost: number } | undefined;

    return {
      today:   { inputs: Number(t?.inputs ?? 0), tokens: Number(t?.tokens ?? 0), cost: Number(t?.cost ?? 0) },
      allTime: { sessions: Number(a?.sessions ?? 0), tokens: Number(a?.tokens ?? 0), cost: Number(a?.cost ?? 0) },
      streak:  getStreak(),
    };
  } catch {
    return ZERO;
  }
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let requestRender: (() => void) | undefined;

  function installHeader(ctx: ExtensionContext): void {
    ctx.ui.setHeader((tui, theme) => {
      requestRender = () => tui.requestRender();

      let cache: AggrStats | null = null;
      let cacheAt = 0;

      function stats(): AggrStats {
        const now = Date.now();
        if (cache && now - cacheAt < 60_000) return cache;
        cache = fetchStats();
        cacheAt = now;
        return cache;
      }

      return {
        render(width: number): string[] {
          const { today: td, allTime: at, streak } = stats();
          const h  = (s: string) => theme.fg("accent", theme.bold(s));
          const v  = (s: string) => theme.bold(s);
          const m  = (s: string) => theme.fg("muted", s);
          const d  = (s: string) => theme.fg("dim", s);
          const w  = (s: string) => theme.fg("warning", s);
          const ok = (s: string) => theme.fg("success", s);

          const sep = d("  ·  ");
          const pipe = d("  │  ");

          // Pick quote for today
          const quote = QUOTES[Math.floor(Date.now() / 86_400_000) % QUOTES.length]!;

          // Line 1: brand + nerdy quote + date
          const brand = h("⟨π⟩") + " " + v("stats");
          const quoteStr = d(`"${quote}"`);
          const date = m(new Date().toLocaleDateString(undefined, {
            month: "short", day: "numeric", year: "numeric",
          }));

          let line1: string;
          const brandAndQuote = brand + sep + quoteStr;
          const bqWidth = visibleWidth(brandAndQuote);
          const dateWidth = visibleWidth(date);
          if (bqWidth + dateWidth + 4 <= width) {
            const gap = Math.max(2, width - bqWidth - dateWidth);
            line1 = brandAndQuote + " ".repeat(gap) + date;
          } else {
            const gap = Math.max(2, width - visibleWidth(brand) - dateWidth);
            line1 = brand + " ".repeat(gap) + date;
          }

          // Line 2: today | all-time | streak
          const todayPart = td.inputs > 0
            ? h("▲") + m(" today ") + v(String(td.inputs)) + m(" inp") + sep + v(fmtK(td.tokens)) + m(" tok") + sep + w(fmtCost(td.cost))
            : h("▲") + m(" today ") + d("—");

          const allPart = h("◆") + m(" all ") + v(String(at.sessions)) + m(" sess") + sep
            + v(fmtK(at.tokens)) + m(" tok") + sep + w(fmtCost(at.cost));

          const fire = streak > 0
            ? "🔥" + ok(` ${streak}d`)
            : d("no streak");

          const line2 = todayPart + pipe + allPart + pipe + fire;

          // Narrow fallback
          if (width < 60) {
            const shortLine = h("⟨π⟩") + sep + w(fmtCost(td.cost)) + sep + fire;
            return ["", truncateToWidth(shortLine, width), ""];
          }

          return [
            "",
            truncateToWidth(line1, width),
            truncateToWidth(line2, width),
            "",
          ];
        },

        invalidate() {
          tui.requestRender();
        },
      };
    });
  }

  pi.on("session_start", (_, ctx) => { if (ctx.hasUI) installHeader(ctx); });
  pi.on("agent_end",     ()       => { requestRender?.(); });
  pi.on("session_shutdown", (_, ctx) => { if (ctx.hasUI) ctx.ui.setHeader(undefined); });
}
