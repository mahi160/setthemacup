import type {
  DailyStat, ModelStat, OverallStats, ProjectStat, RecentSession, ToolStat, WeeklyStat,
} from "./db.js";

/* ─── config (edit freely) ────────────────────────────────────────────────── */

export const STATS_CONFIG = {
  /** How many past days count as "this week" in the summary header. */
  weekDays: 7,
  /** Max tools to display. */
  topToolsLimit: 10,
  /** Max models to display. */
  topModelsLimit: 6,
  /** Max projects to display. */
  topProjectsLimit: 8,
  /** Days of history for the token sparkline. */
  tokenGraphDays: 30,
  /** Recent sessions to show. */
  recentSessionsLimit: 6,
};

/* ─── ANSI helpers ────────────────────────────────────────────────────────── */

const DIM    = "\x1b[2m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";
const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE   = "\x1b[34m";
const MAGENTA = "\x1b[35m";

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/* ─── formatters ──────────────────────────────────────────────────────────── */

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function fmtCost(usd: number): string {
  if (usd <= 0)    return "$0.00";
  if (usd < 0.005) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function fmtMs(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtDuration(ms: number | null): string {
  return fmtMs(ms ?? 0);
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function fmtDateShort(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
}

/* ─── drawing helpers ─────────────────────────────────────────────────────── */

/** Visible width of a string (strips ANSI codes). */
function vw(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function pad(s: string, n: number): string {
  const raw = s.replace(/\x1b\[[0-9;]*m/g, "");
  const extra = n - raw.length;
  return extra > 0 ? s + " ".repeat(extra) : s.slice(0, n + (s.length - raw.length));
}

function rpad(s: string, n: number): string {
  const raw = s.replace(/\x1b\[[0-9;]*m/g, "");
  const extra = n - raw.length;
  return extra > 0 ? " ".repeat(extra) + s : s;
}

function divider(width: number, char = "─"): string {
  return DIM + char.repeat(width) + RESET;
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

export function renderStats(
  overall:  OverallStats,
  weekly:   WeeklyStat,
  tools:    ToolStat[],
  models:   ModelStat[],
  projects: ProjectStat[],
  daily:    DailyStat[],
  recent:   RecentSession[],
  width:    number,
  weekStart: number,
): string[] {
  const lines: string[] = [];
  const push = (...strs: string[]) => lines.push(...strs);
  const div  = () => push(divider(width));

  const weekLabel = `${fmtDateShort(weekStart)} – ${fmtDateShort(Date.now())}`;

  /* ── header ────────────────────────────────────────────────────────────── */
  push(
    "",
    `  ${BOLD}${CYAN}pi stats${RESET}   ${DIM}${weekLabel}${RESET}`,
    "",
  );

  /* ── week summary ───────────────────────────────────────────────────────── */
  const wCols = [
    `${BOLD}${weekly.inputs}${RESET} inputs`,
    `${BOLD}${weekly.sessions}${RESET} sessions`,
    `${BOLD}${fmtTokens(weekly.tokens)}${RESET} tokens`,
    `${BOLD}${fmtMs(weekly.timeMs)}${RESET} active`,
    `${BOLD}${GREEN}${fmtCost(weekly.cost)}${RESET} est.`,
  ];
  push(`  ${wCols.join(`   `)}`, "");
  div();

  /* ── tools (last 7d) + model leaderboard side by side ──────────────────── */
  const halfW     = Math.floor((width - 4) / 2);
  const barW      = Math.max(8, halfW - 24);
  const leftTools = tools.slice(0, STATS_CONFIG.topToolsLimit);
  const rankModels = models.slice(0, STATS_CONFIG.topModelsLimit);
  const maxTools  = leftTools[0]?.total ?? 1;
  const rows      = Math.max(leftTools.length, rankModels.length);

  // Rank medals / numbers
  const RANKS = ["#1", "#2", "#3", "#4", "#5", "#6", "#7", "#8"];
  const RANK_COLORS = [YELLOW, YELLOW, CYAN, CYAN, CYAN, DIM, DIM, DIM];

  push(
    "",
    `  ${CYAN}tools${RESET} ${DIM}last 7d${RESET}` +
    " ".repeat(Math.max(0, halfW - vw(`  tools last 7d`))) +
    `  ${CYAN}models${RESET} ${DIM}leaderboard${RESET}`,
    "",
  );

  for (let i = 0; i < rows; i++) {
    const t = leftTools[i];
    const m = rankModels[i];

    const countStr  = t ? `${BOLD}${CYAN}${rpad(String(t.total), 4)}${RESET}` : "";
    const leftStr   = t
      ? `  ${pad(t.tool, 8)}  ${bar(t.total, maxTools, barW)}  ${countStr}`
      : "";

    const rankCol   = m ? `${RANK_COLORS[i] ?? DIM}${RANKS[i] ?? "  "}${RESET}` : "  ";
    const modelLabel = m ? `${m.provider}/${m.model_id}` : "";
    const usesStr   = m ? `  ${BOLD}${rpad(String(m.uses), 4)}${RESET} ${DIM}inputs${RESET}` : "";
    const rightStr  = m
      ? `  ${rankCol}  ${pad(modelLabel, 28)}${usesStr}`
      : "";

    const leftPadded = pad(leftStr, halfW + 2);
    push(leftPadded + "  " + rightStr);
  }

  push("");
  div();

  /* ── top projects ───────────────────────────────────────────────────────── */
  if (projects.length > 0) {
    const maxProj = projects[0]!.inputs;
    const projBarW = Math.max(8, width - 36);

    push("", `  ${CYAN}top projects${RESET} ${DIM}by inputs${RESET}`, "");
    for (const p of projects) {
      const nameCol  = pad(p.project, 18);
      const barCol   = bar(p.inputs, maxProj, projBarW);
      const countCol = rpad(String(p.inputs), 5);
      push(`  ${nameCol}  ${barCol}  ${DIM}${countCol}${RESET}`);
    }
    push("");
    div();
  }

  /* ── token sparkline ────────────────────────────────────────────────────── */
  if (daily.length > 1) {
    const values   = daily.map(d => d.tokens);
    const firstDay = daily[0]!.day;
    const lastDay  = daily[daily.length - 1]!.day;
    const spark    = sparkline(values);

    push("", `  ${CYAN}tokens / day${RESET}  ${DIM}(${STATS_CONFIG.tokenGraphDays}d)${RESET}`, "");
    push(`  ${DIM}${firstDay}${RESET}  ${spark}  ${DIM}${lastDay}${RESET}`);
    push("");
    div();
  }

  /* ── recent sessions ────────────────────────────────────────────────────── */
  if (recent.length > 0) {
    push("", `  ${CYAN}recent sessions${RESET}`, "");
    push(
      `  ${DIM}${"date".padEnd(12)}${"project".padEnd(18)}${"inputs".padStart(6)}  ${"turns".padStart(5)}  ${"tokens".padStart(6)}  ${"cost".padStart(7)}  ${"time".padStart(8)}${RESET}`,
    );
    push(`  ${DIM}${"─".repeat(Math.min(width - 4, 68))}${RESET}`);

    for (const s of recent) {
      const date    = fmtDate(s.started_at).padEnd(12);
      const project = pad(s.cwd?.split("/").pop() ?? "—", 18);
      const inputs  = rpad(String(s.inputs ?? 0), 6);
      const turns   = rpad(String(s.turns), 5);
      const tokens  = rpad(fmtTokens(s.tokens), 6);
      const cost    = rpad(fmtCost(s.cost), 7);
      const dur     = rpad(fmtDuration(s.duration), 8);

      push(
        `  ${DIM}${date}${RESET}${project}` +
        `${BLUE}${inputs}${RESET}  ${DIM}${turns}  ${tokens}${RESET}  ${GREEN}${cost}${RESET}  ${DIM}${dur}${RESET}`,
      );
    }
    push("");
  }

  /* ── footer hint ────────────────────────────────────────────────────────── */
  push(
    `  ${DIM}${BOLD}enter${RESET}${DIM} open in browser   ${BOLD}esc${RESET}${DIM} / ${BOLD}q${RESET}${DIM} close${RESET}`,
    "",
  );

  return lines;
}
