import type {
  DailyStat, DurationBucket, ModelEfficiency, ModelStat, OverallStats,
  ProjectStat, RecentSession, TokenWasteEntry, ToolStat, WeeklyStat,
} from "./db.js";
import { fmtTokens, fmtCost, fmtMs, fmtDate, fmtDateShort } from "./format.js";

/* ─── config ──────────────────────────────────────────────────────────────── */

export const STATS_CONFIG = {
  weekDays: 7,
  topToolsLimit: 10,
  topModelsLimit: 6,
  topProjectsLimit: 8,
  tokenGraphDays: 30,
  recentSessionsLimit: 6,
};

/* ─── data bundle ─────────────────────────────────────────────────────────── */

export interface StatsData {
  overall: OverallStats;
  weekly: WeeklyStat;
  today: WeeklyStat;
  tools: ToolStat[];
  models: ModelStat[];
  efficiency: ModelEfficiency[];
  projects: ProjectStat[];
  daily: DailyStat[];
  recent: RecentSession[];
  toolless: { total: number; toolless: number };
  streak: number;
  histogram: DurationBucket[];
  waste: TokenWasteEntry[];
  start: number;
  end: number;
}

/* ─── ANSI helpers ────────────────────────────────────────────────────────── */

const DIM   = "\x1b[2m";
const BOLD  = "\x1b[1m";
const RESET = "\x1b[0m";
const CYAN  = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE  = "\x1b[34m";
const RED   = "\x1b[31m";
const MAGENTA = "\x1b[35m";

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function vw(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function pad(s: string, n: number): string {
  const extra = n - vw(s);
  return extra > 0 ? s + " ".repeat(extra) : s.slice(0, n + (s.length - vw(s)));
}

function rpad(s: string, n: number): string {
  const extra = n - vw(s);
  return extra > 0 ? " ".repeat(extra) + s : s;
}

function divider(width: number): string {
  return DIM + "─".repeat(width) + RESET;
}

function bar(value: number, max: number, width = 16): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return CYAN + "█".repeat(filled) + RESET + DIM + "░".repeat(width - filled) + RESET;
}

function sparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values.map(v => {
    const idx = Math.min(7, Math.floor((v / max) * 8));
    return CYAN + (SPARK[idx] ?? "▁") + RESET;
  }).join("");
}

/* ─── main renderer ───────────────────────────────────────────────────────── */

export function renderStats(data: StatsData, width: number): string[] {
  const { overall, weekly, today, tools, models, efficiency, projects, daily, recent,
          toolless, streak, histogram, waste, start } = data;

  const lines: string[] = [];
  const push = (...s: string[]) => lines.push(...s);
  const div = () => push(divider(width));

  const weekLabel = `${fmtDateShort(start)} – ${fmtDateShort(Date.now())}`;

  /* header */
  const streakStr = streak > 0 ? `  ${YELLOW}🔥 ${streak}d streak${RESET}` : "";
  push("", `  ${BOLD}${CYAN}pi stats${RESET}   ${DIM}${weekLabel}${RESET}${streakStr}`, "");

  /* week summary */
  push(`  ${[
    `${BOLD}${weekly.inputs}${RESET} inputs`,
    `${BOLD}${weekly.sessions}${RESET} sessions`,
    `${BOLD}${fmtTokens(weekly.tokens)}${RESET} tokens`,
    `${BOLD}${fmtMs(weekly.timeMs)}${RESET} active`,
    `${BOLD}${GREEN}${fmtCost(weekly.cost)}${RESET} est.`,
  ].join("   ")}`, "");

  /* today highlight */
  if (today.inputs > 0) {
    push(`  ${DIM}today:${RESET} ${BOLD}${today.inputs}${RESET} inputs  ${BOLD}${fmtTokens(today.tokens)}${RESET} tokens  ${BOLD}${GREEN}${fmtCost(today.cost)}${RESET} cost  ${BOLD}${fmtMs(today.timeMs)}${RESET} active`, "");
  }

  /* toolless ratio */
  if (toolless.total > 0) {
    const pct = Math.round((toolless.toolless / toolless.total) * 100);
    push(`  ${DIM}tool usage:${RESET} ${toolless.total - toolless.toolless}/${toolless.total} inputs used tools  ${DIM}(${pct}% chat-only)${RESET}`, "");
  }

  div();

  /* tools + models side by side */
  const halfW = Math.floor((width - 4) / 2);
  const barW = Math.max(8, halfW - 24);
  const maxTools = tools[0]?.total ?? 1;
  const rows = Math.max(tools.length, models.length);
  const RANK_COLORS = [YELLOW, YELLOW, CYAN, CYAN, CYAN, DIM, DIM, DIM];

  push(
    "",
    `  ${CYAN}tools${RESET} ${DIM}last 7d${RESET}` +
    " ".repeat(Math.max(0, halfW - vw("  tools last 7d"))) +
    `  ${CYAN}models${RESET} ${DIM}leaderboard${RESET}`,
    "",
  );

  for (let i = 0; i < rows; i++) {
    const t = tools[i];
    const m = models[i];
    const leftStr = t
      ? `  ${pad(t.tool, 8)}  ${bar(t.total, maxTools, barW)}  ${BOLD}${CYAN}${rpad(String(t.total), 4)}${RESET}`
      : "";
    const rightStr = m
      ? `  ${RANK_COLORS[i] ?? DIM}#${i + 1}${RESET}  ${pad(`${m.provider}/${m.model_id}`, 28)}  ${BOLD}${rpad(String(m.uses), 4)}${RESET} ${DIM}inputs${RESET}`
      : "";
    push(pad(leftStr, halfW + 2) + "  " + rightStr);
  }

  push("");
  div();

  /* #2: model efficiency */
  if (efficiency.length > 0) {
    push("", `  ${CYAN}model efficiency${RESET}`, "");
    push(`  ${DIM}${"model".padEnd(30)}${"inputs".padStart(7)}  ${"avg tok".padStart(8)}  ${"avg time".padStart(8)}  ${"$/input".padStart(8)}  ${"total $".padStart(8)}${RESET}`);
    push(`  ${DIM}${"─".repeat(Math.min(width - 4, 75))}${RESET}`);

    for (const e of efficiency) {
      const name = `${e.provider}/${e.model_id}`;
      push(
        `  ${pad(name, 30)}` +
        `${BLUE}${rpad(String(e.inputs), 7)}${RESET}  ` +
        `${DIM}${rpad(fmtTokens(e.avgTokens), 8)}${RESET}  ` +
        `${YELLOW}${rpad(e.avgTimeSec + "s", 8)}${RESET}  ` +
        `${DIM}${rpad(fmtCost(e.costPerInput), 8)}${RESET}  ` +
        `${GREEN}${rpad(fmtCost(e.totalCost), 8)}${RESET}`,
      );
    }
    push("");
    div();
  }

  /* top projects */
  if (projects.length > 0) {
    const maxProj = projects[0]!.inputs;
    const projBarW = Math.max(8, width - 36);
    push("", `  ${CYAN}top projects${RESET} ${DIM}by inputs${RESET}`, "");
    for (const p of projects) {
      push(`  ${pad(p.project, 18)}  ${bar(p.inputs, maxProj, projBarW)}  ${DIM}${rpad(String(p.inputs), 5)}${RESET}`);
    }
    push("");
    div();
  }

  /* token sparkline */
  if (daily.length > 1) {
    const spark = sparkline(daily.map(d => d.tokens));
    push(
      "", `  ${CYAN}tokens / day${RESET}  ${DIM}(${STATS_CONFIG.tokenGraphDays}d)${RESET}`, "",
      `  ${DIM}${daily[0]!.day}${RESET}  ${spark}  ${DIM}${daily.at(-1)!.day}${RESET}`,
      "",
    );
    div();
  }

  /* #9: duration histogram */
  if (histogram.some(b => b.count > 0)) {
    const maxH = Math.max(...histogram.map(b => b.count), 1);
    const hBarW = Math.max(8, width - 28);
    push("", `  ${CYAN}response time distribution${RESET}`, "");
    for (const b of histogram) {
      push(`  ${pad(b.label, 8)}  ${bar(b.count, maxH, hBarW)}  ${DIM}${rpad(String(b.count), 4)}${RESET}`);
    }
    push("");
    div();
  }

  /* #10: token waste */
  if (waste.length > 0) {
    push("", `  ${RED}⚠ high-token no-action inputs${RESET} ${DIM}(no tool calls)${RESET}`, "");
    for (const w of waste) {
      push(
        `  ${DIM}${fmtDate(w.started_at)}${RESET}  ${pad(`${w.provider}/${w.model_id}`, 28)}  ` +
        `${MAGENTA}${rpad(fmtTokens(w.tokens_used), 6)}${RESET} tokens  ${DIM}${fmtMs(w.time_ms)}${RESET}`,
      );
    }
    push("");
    div();
  }

  /* recent sessions */
  if (recent.length > 0) {
    push("", `  ${CYAN}recent sessions${RESET}`, "");
    push(`  ${DIM}${"date".padEnd(12)}${"project".padEnd(18)}${"inputs".padStart(6)}  ${"turns".padStart(5)}  ${"tokens".padStart(6)}  ${"cost".padStart(7)}  ${"time".padStart(8)}${RESET}`);
    push(`  ${DIM}${"─".repeat(Math.min(width - 4, 68))}${RESET}`);

    for (const s of recent) {
      push(
        `  ${DIM}${fmtDate(s.started_at).padEnd(12)}${RESET}${pad(s.cwd?.split("/").pop() ?? "—", 18)}` +
        `${BLUE}${rpad(String(s.inputs ?? 0), 6)}${RESET}  ${DIM}${rpad(String(s.turns), 5)}  ${rpad(fmtTokens(s.tokens), 6)}${RESET}  ${GREEN}${rpad(fmtCost(s.cost), 7)}${RESET}  ${DIM}${rpad(fmtMs(s.duration ?? 0), 8)}${RESET}`,
      );
    }
    push("");
  }

  /* footer */
  push(
    `  ${DIM}${BOLD}enter${RESET}${DIM} open in browser   ${BOLD}esc${RESET}${DIM} / ${BOLD}q${RESET}${DIM} close${RESET}`,
    "",
  );

  return lines;
}
