import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Config ────────────────────────────────────────────────────────────────────

const BUDGET_PATH = join(homedir(), ".pi", "agent", "budget.json");
const DB_PATH = join(homedir(), ".pi", "agent", "stats.db");

interface BudgetConfig {
  mode: "auto" | "cost" | "messages";
  dailyUsd: number;
  softUsd: number;
  windowHours: number;
  windowMessages: number;
  softWindow: number;
  weeklyMessages: number;
  softWeekly: number;
  cycleStartDay: number; // 0=Sun
}

const DEFAULTS: BudgetConfig = {
  mode: "auto",
  dailyUsd: 20,
  softUsd: 15,
  windowHours: 5,
  windowMessages: 200,
  softWindow: 150,
  weeklyMessages: 1500,
  softWeekly: 1100,
  cycleStartDay: 0,
};

function loadConfig(): BudgetConfig {
  if (!existsSync(BUDGET_PATH)) return { ...DEFAULTS };
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(readFileSync(BUDGET_PATH, "utf-8")),
    } as BudgetConfig;
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(cfg: BudgetConfig): void {
  mkdirSync(join(homedir(), ".pi", "agent"), { recursive: true });
  writeFileSync(BUDGET_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

// ── SQLite queries (read-only) ────────────────────────────────────────────────

// Dynamic require avoids TS resolution errors for built-in node:sqlite
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    prepare(sql: string): {
      get(...p: unknown[]): Record<string, unknown> | undefined;
    };
  };
};

interface DayTotals {
  cost: number;
  inputs: number;
  requests: number;
}

function queryTotals(sinceMs: number): DayTotals {
  if (!existsSync(DB_PATH)) return { cost: 0, inputs: 0, requests: 0 };
  try {
    const db = new DatabaseSync(DB_PATH);
    const row = db
      .prepare(
        `
      SELECT COALESCE(SUM(cost_usd), 0)      AS cost,
             COUNT(*)                          AS inputs,
             COALESCE(SUM(request_count), 0)  AS requests
      FROM user_inputs WHERE started_at >= ? AND ended_at IS NOT NULL
    `,
      )
      .get(sinceMs) as DayTotals | undefined;
    return row ?? { cost: 0, inputs: 0, requests: 0 };
  } catch {
    return { cost: 0, inputs: 0, requests: 0 };
  }
}

function detectMode(cfg: BudgetConfig): "cost" | "messages" {
  if (cfg.mode !== "auto") return cfg.mode;
  if (!existsSync(DB_PATH)) return "messages";
  try {
    const db = new DatabaseSync(DB_PATH);
    const row = db
      .prepare(
        `
      SELECT COALESCE(SUM(cost_usd), 0) AS totalCost
      FROM (SELECT cost_usd FROM user_inputs WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 50)
    `,
      )
      .get() as { totalCost: number } | undefined;
    return (row?.totalCost ?? 0) > 0 ? "cost" : "messages";
  } catch {
    return "messages";
  }
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let bypass = false;
  let detectedMode: "cost" | "messages" = "messages";

  pi.on("session_start", () => {
    bypass = false;
    if (process.env.PI_BUDGET_OVERRIDE === "1") {
      bypass = true;
      return;
    }
    const cfg = loadConfig();
    detectedMode = detectMode(cfg);
  });

  pi.on("before_agent_start", async (_, ctx: ExtensionContext) => {
    if (bypass || process.env.PI_BUDGET_OVERRIDE === "1") return;

    const cfg = loadConfig();
    const now = Date.now();

    if (detectedMode === "cost") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { cost } = queryTotals(startOfDay.getTime());

      if (cost >= cfg.dailyUsd) {
        const ok = await ctx.ui.confirm(
          `Budget cap hit ($${cost.toFixed(2)} / $${cfg.dailyUsd})`,
          "Continue anyway? This will exceed your daily budget.",
        );
        if (!ok) throw new Error("Budget guard: user declined to continue.");
        bypass = true;
      } else if (cost >= cfg.softUsd) {
        const pct = Math.round((cost / cfg.dailyUsd) * 100);
        ctx.ui.notify(
          `⚠ Budget ${pct}% ($${cost.toFixed(2)} / $${cfg.dailyUsd})`,
          "warning",
        );
      }
    } else {
      const windowStart = now - cfg.windowHours * 3_600_000;
      const { requests: windowReq } = queryTotals(windowStart);

      const today = new Date();
      const daysAgo = (today.getDay() - cfg.cycleStartDay + 7) % 7;
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - daysAgo);
      weekStart.setHours(0, 0, 0, 0);
      const { requests: weeklyReq } = queryTotals(weekStart.getTime());

      const windowPct = windowReq / cfg.windowMessages;
      const weeklyPct = weeklyReq / cfg.weeklyMessages;
      const softWindowPct = cfg.softWindow / cfg.windowMessages;
      const softWeeklyPct = cfg.softWeekly / cfg.weeklyMessages;

      const hitWindow = windowPct >= 1;
      const hitWeekly = weeklyPct >= 1;
      const softWindow = windowPct >= softWindowPct && !hitWindow;
      const softWeekly = weeklyPct >= softWeeklyPct && !hitWeekly;

      if (hitWindow || hitWeekly) {
        const label = hitWindow
          ? `${windowReq}/${cfg.windowMessages} (${cfg.windowHours}h window)`
          : `${weeklyReq}/${cfg.weeklyMessages} (weekly)`;
        const ok = await ctx.ui.confirm(
          `Message cap hit (${label})`,
          "You may be rate-limited. Continue anyway?",
        );
        if (!ok) throw new Error("Budget guard: user declined to continue.");
        bypass = true;
      } else if (softWindow || softWeekly) {
        if (softWindow) {
          const pct = Math.round(windowPct * 100);
          ctx.ui.notify(
            `⚠ ${pct}% of ${cfg.windowHours}h window (${windowReq}/${cfg.windowMessages})`,
            "warning",
          );
        } else {
          const pct = Math.round(weeklyPct * 100);
          ctx.ui.notify(
            `⚠ ${pct}% of weekly cap (${weeklyReq}/${cfg.weeklyMessages})`,
            "warning",
          );
        }
      }
    }
  });

  // ── /budget command ──────────────────────────────────────────────────────

  pi.registerCommand("budget", {
    description:
      "Show budget usage or set caps. Usage: /budget [set <key> <N>] [mode <cost|messages|auto>]",
    handler: async (args, ctx: ExtensionContext) => {
      const cfg = loadConfig();
      const mode = detectedMode;

      if (!args || args.trim() === "") {
        const now = Date.now();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const windowStart = now - cfg.windowHours * 3_600_000;
        const today = new Date();
        const daysAgo = (today.getDay() - cfg.cycleStartDay + 7) % 7;
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - daysAgo);
        weekStart.setHours(0, 0, 0, 0);

        const dayData = queryTotals(startOfDay.getTime());
        const winData = queryTotals(windowStart);
        const weekData = queryTotals(weekStart.getTime());

        const lines: string[] = [
          `Mode: ${cfg.mode} → ${mode}`,
          mode === "cost"
            ? `Cost today: $${dayData.cost.toFixed(2)} / soft $${cfg.softUsd} / hard $${cfg.dailyUsd}`
            : `${cfg.windowHours}h window: ${winData.requests} / soft ${cfg.softWindow} / hard ${cfg.windowMessages}`,
          mode === "messages"
            ? `Weekly: ${weekData.requests} / soft ${cfg.softWeekly} / hard ${cfg.weeklyMessages}`
            : "",
          bypass ? "(bypass active — won't prompt again this session)" : "",
        ].filter(Boolean);

        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      const parts = args.trim().split(/\s+/);
      if (parts[0] === "mode" && parts[1]) {
        const newMode = parts[1] as "auto" | "cost" | "messages";
        if (!["auto", "cost", "messages"].includes(newMode)) {
          ctx.ui.notify("Valid modes: auto cost messages", "warning");
          return;
        }
        cfg.mode = newMode;
        saveConfig(cfg);
        detectedMode = detectMode(cfg);
        ctx.ui.notify(
          `Budget mode set to: ${newMode} (effective: ${detectedMode})`,
          "success",
        );
        return;
      }

      if (parts[0] === "set" && parts[1] && parts[2]) {
        const key = parts[1] as keyof BudgetConfig;
        const val = Number(parts[2]);
        if (isNaN(val)) {
          ctx.ui.notify("Value must be a number", "warning");
          return;
        }
        const allowed: (keyof BudgetConfig)[] = [
          "dailyUsd",
          "softUsd",
          "windowHours",
          "windowMessages",
          "softWindow",
          "weeklyMessages",
          "softWeekly",
        ];
        if (!allowed.includes(key)) {
          ctx.ui.notify(`Valid keys: ${allowed.join(" ")}`, "warning");
          return;
        }
        (cfg as Record<string, unknown>)[key] = val;
        saveConfig(cfg);
        ctx.ui.notify(`Budget.${key} = ${val}`, "success");
        return;
      }

      ctx.ui.notify(
        "Usage: /budget | /budget set <key> <N> | /budget mode <cost|messages|auto>",
        "info",
      );
    },
  });
}
