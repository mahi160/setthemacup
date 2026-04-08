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

/* ─── ANSI ────────────────────────────────────────────────────────────────── */

const DIM   = "\x1b[2m";
const BOLD  = "\x1b[1m";
const R     = "\x1b[0m";
const CYAN  = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE  = "\x1b[34m";

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function vw(s: string): number { return s.replace(/\x1b\[[0-9;]*m/g, "").length; }

function pad(s: string, n: number): string {
  const e = n - vw(s);
  return e > 0 ? s + " ".repeat(e) : s.slice(0, n + (s.length - vw(s)));
}

function rpad(s: string, n: number): string {
  const e = n - vw(s);
  return e > 0 ? " ".repeat(e) + s : s;
}

function bar(value: number, max: number, width = 16): string {
  const f = max > 0 ? Math.round((value / max) * width) : 0;
  return CYAN + "█".repeat(f) + R + DIM + "░".repeat(width - f) + R;
}

function sparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values.map(v => CYAN + (SPARK[Math.min(7, Math.floor((v / max) * 8))] ?? "▁") + R).join("");
}

/* ─── TUI renderer — essentials only ──────────────────────────────────────── */

export function renderStats(data: StatsData, width: number): string[] {
  const { weekly, today, tools, models, daily, recent, streak, start } = data;
  const lines: string[] = [];
  const push = (...s: string[]) => lines.push(...s);
  const div = () => push(DIM + "─".repeat(width) + R);

  const weekLabel = `${fmtDateShort(start)} – ${fmtDateShort(Date.now())}`;
  const streakStr = streak > 0 ? `  ${YELLOW}🔥 ${streak}d${R}` : "";

  /* ── header + week summary ──────────────────────────────────────────────── */
  push("", `  ${BOLD}${CYAN}pi stats${R}   ${DIM}${weekLabel}${R}${streakStr}`, "");
  push(`  ${[
    `${BOLD}${weekly.inputs}${R} inputs`,
    `${BOLD}${weekly.sessions}${R} sessions`,
    `${BOLD}${fmtTokens(weekly.tokens)}${R} tokens`,
    `${BOLD}${fmtMs(weekly.timeMs)}${R} active`,
    `${BOLD}${GREEN}${fmtCost(weekly.cost)}${R} est.`,
  ].join("   ")}`, "");

  if (today.inputs > 0) {
    push(`  ${DIM}today:${R} ${BOLD}${today.inputs}${R} inputs  ${BOLD}${fmtTokens(today.tokens)}${R} tokens  ${GREEN}${fmtCost(today.cost)}${R}  ${fmtMs(today.timeMs)}`, "");
  }
  div();

  /* ── tools + models side-by-side ────────────────────────────────────────── */
  const halfW = Math.floor((width - 4) / 2);
  const barW = Math.max(8, halfW - 24);
  const maxT = tools[0]?.total ?? 1;
  const rows = Math.max(tools.length, models.length);
  const RC = [YELLOW, YELLOW, CYAN, CYAN, CYAN, DIM, DIM, DIM];

  push("",
    `  ${CYAN}tools${R} ${DIM}last 7d${R}` +
    " ".repeat(Math.max(0, halfW - vw("  tools last 7d"))) +
    `  ${CYAN}models${R} ${DIM}leaderboard${R}`, "");

  for (let i = 0; i < rows; i++) {
    const t = tools[i];
    const m = models[i];
    const left = t ? `  ${pad(t.tool, 8)}  ${bar(t.total, maxT, barW)}  ${BOLD}${CYAN}${rpad(String(t.total), 4)}${R}` : "";
    const right = m ? `  ${RC[i] ?? DIM}#${i + 1}${R}  ${pad(`${m.provider}/${m.model_id}`, 28)}  ${BOLD}${rpad(String(m.uses), 4)}${R} ${DIM}inputs${R}` : "";
    push(pad(left, halfW + 2) + "  " + right);
  }
  push("");
  div();

  /* ── token sparkline ────────────────────────────────────────────────────── */
  if (daily.length > 1) {
    push("", `  ${CYAN}tokens / day${R}  ${DIM}(${STATS_CONFIG.tokenGraphDays}d)${R}`, "",
      `  ${DIM}${daily[0]!.day}${R}  ${sparkline(daily.map(d => d.tokens))}  ${DIM}${daily.at(-1)!.day}${R}`, "");
    div();
  }

  /* ── recent sessions ────────────────────────────────────────────────────── */
  if (recent.length > 0) {
    push("", `  ${CYAN}recent sessions${R}`, "");
    push(`  ${DIM}${"date".padEnd(12)}${"project".padEnd(18)}${"inputs".padStart(6)}  ${"turns".padStart(5)}  ${"tokens".padStart(6)}  ${"cost".padStart(7)}  ${"time".padStart(8)}${R}`);
    push(`  ${DIM}${"─".repeat(Math.min(width - 4, 68))}${R}`);
    for (const s of recent) {
      push(
        `  ${DIM}${fmtDate(s.started_at).padEnd(12)}${R}${pad(s.cwd?.split("/").pop() ?? "—", 18)}` +
        `${BLUE}${rpad(String(s.inputs ?? 0), 6)}${R}  ${DIM}${rpad(String(s.turns), 5)}  ${rpad(fmtTokens(s.tokens), 6)}${R}  ${GREEN}${rpad(fmtCost(s.cost), 7)}${R}  ${DIM}${rpad(fmtMs(s.duration ?? 0), 8)}${R}`,
      );
    }
    push("");
  }

  /* ── footer ─────────────────────────────────────────────────────────────── */
  push(`  ${DIM}${BOLD}enter${R}${DIM} open in browser   ${BOLD}esc${R}${DIM} / ${BOLD}q${R}${DIM} close${R}`, "");
  return lines;
}
