import type {
  DailyStat,
  ModelStat,
  OverallStats,
  ProjectStat,
  RecentSession,
  ToolStat,
  WeeklyStat,
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

/* ─── ANSI helpers ────────────────────────────────────────────────────────── */

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/** Visible width (strips ANSI). */
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
  return (
    CYAN + "█".repeat(filled) + RESET + DIM + "░".repeat(width - filled) + RESET
  );
}

function sparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values
    .map((v) => {
      const idx = Math.min(7, Math.floor((v / max) * 8));
      return CYAN + (SPARK[idx] ?? "▁") + RESET;
    })
    .join("");
}

/* ─── main renderer ───────────────────────────────────────────────────────── */

export function renderStats(
  overall: OverallStats,
  weekly: WeeklyStat,
  tools: ToolStat[],
  models: ModelStat[],
  projects: ProjectStat[],
  daily: DailyStat[],
  recent: RecentSession[],
  width: number,
  weekStart: number,
): string[] {
  const lines: string[] = [];
  const push = (...s: string[]) => lines.push(...s);
  const div = () => push(divider(width));

  const weekLabel = `${fmtDateShort(weekStart)} – ${fmtDateShort(Date.now())}`;

  /* header */
  push("", `  ${BOLD}${CYAN}pi stats${RESET}   ${DIM}${weekLabel}${RESET}`, "");

  /* week summary */
  push(
    `  ${[
      `${BOLD}${weekly.inputs}${RESET} inputs`,
      `${BOLD}${weekly.sessions}${RESET} sessions`,
      `${BOLD}${fmtTokens(weekly.tokens)}${RESET} tokens`,
      `${BOLD}${fmtMs(weekly.timeMs)}${RESET} active`,
      `${BOLD}${GREEN}${fmtCost(weekly.cost)}${RESET} est.`,
    ].join("   ")}`,
    "",
  );
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

  /* top projects */
  if (projects.length > 0) {
    const maxProj = projects[0]!.inputs;
    const projBarW = Math.max(8, width - 36);

    push("", `  ${CYAN}top projects${RESET} ${DIM}by inputs${RESET}`, "");
    for (const p of projects) {
      push(
        `  ${pad(p.project, 18)}  ${bar(p.inputs, maxProj, projBarW)}  ${DIM}${rpad(String(p.inputs), 5)}${RESET}`,
      );
    }
    push("");
    div();
  }

  /* token sparkline */
  if (daily.length > 1) {
    const spark = sparkline(daily.map((d) => d.tokens));
    push(
      "",
      `  ${CYAN}tokens / day${RESET}  ${DIM}(${STATS_CONFIG.tokenGraphDays}d)${RESET}`,
      "",
      `  ${DIM}${daily[0]!.day}${RESET}  ${spark}  ${DIM}${daily.at(-1)!.day}${RESET}`,
      "",
    );
    div();
  }

  /* recent sessions */
  if (recent.length > 0) {
    push("", `  ${CYAN}recent sessions${RESET}`, "");
    push(
      `  ${DIM}${"date".padEnd(12)}${"project".padEnd(18)}${"inputs".padStart(6)}  ${"turns".padStart(5)}  ${"tokens".padStart(6)}  ${"cost".padStart(7)}  ${"time".padStart(8)}${RESET}`,
    );
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
