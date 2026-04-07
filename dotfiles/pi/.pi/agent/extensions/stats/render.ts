import type {
  DailyStat, ModelStat, OverallStats, RecentSession, ToolStat,
} from "./db.js";

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const DIM   = "\x1b[2m";
const BOLD  = "\x1b[1m";
const RESET = "\x1b[0m";
const ACCENT = "\x1b[36m";  // cyan

function bar(value: number, max: number, width = 18): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return "█".repeat(filled) + DIM + "░".repeat(width - filled) + RESET;
}

function sparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values.map(v => SPARK[Math.min(7, Math.floor((v / max) * 8))] ?? "▁").join("");
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function fmtCost(usd: number): string {
  return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0)  return `${h}h ${m % 60}m`;
  if (m > 0)  return `${m}m`;
  return `${s}s`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function divider(width: number): string {
  return DIM + "─".repeat(width) + RESET;
}

function pad(s: string, n: number): string {
  return s.slice(0, n).padEnd(n);
}

function rpad(s: string, n: number): string {
  return s.slice(0, n).padStart(n);
}

export function renderStats(
  overall:  OverallStats,
  tools:    ToolStat[],
  models:   ModelStat[],
  daily:    DailyStat[],
  recent:   RecentSession[],
  width:    number,
): string[] {
  const lines: string[] = [];
  const push = (...strs: string[]) => lines.push(...strs);
  const div = divider(width);

  // header
  push("", `  ${BOLD}${ACCENT}pi stats${RESET}`, "");

  // summary
  push(
    `  ${BOLD}${overall.totalSessions}${RESET} sessions   ` +
    `${BOLD}${fmtTokens(overall.totalTokens)}${RESET} tokens   ` +
    `${BOLD}${overall.totalTurns}${RESET} turns   ` +
    `${BOLD}${fmtCost(overall.totalCost)}${RESET} est. cost`,
    "",
    div,
  );

  // tool calls
  if (tools.length > 0) {
    const maxCount = tools[0]!.total;
    push("", `  ${ACCENT}tool calls${RESET}`, "");
    for (const t of tools) {
      const name  = pad(t.tool, 8);
      const chart = bar(t.total, maxCount);
      const count = rpad(String(t.total), 5);
      push(`  ${name}  ${chart}  ${DIM}${count}${RESET}`);
    }
    push("", div);
  }

  // models
  if (models.length > 0) {
    const maxUses = models[0]!.uses;
    push("", `  ${ACCENT}models${RESET}`, "");
    for (const m of models) {
      const label = pad(`${m.provider} / ${m.model_id}`, 30);
      const chart = bar(m.uses, maxUses, 12);
      const count = rpad(`${m.uses} sess`, 9);
      push(`  ${label}  ${chart}  ${DIM}${count}${RESET}`);
    }
    push("", div);
  }

  // sparkline
  if (daily.length > 1) {
    const values = daily.map(d => d.tokens);
    push("", `  ${ACCENT}tokens / day (30d)${RESET}`, "");
    push(`  ${sparkline(values)}`);
    push("", div);
  }

  // recent sessions
  if (recent.length > 0) {
    push("", `  ${ACCENT}recent sessions${RESET}`, "");
    for (const s of recent) {
      const date    = fmtDate(s.started_at);
      const project = pad(s.cwd?.split("/").pop() ?? "—", 16);
      const turns   = rpad(`${s.turns}t`, 5);
      const tokens  = rpad(fmtTokens(s.tokens), 6);
      const cost    = rpad(fmtCost(s.cost), 7);
      const dur     = fmtDuration(s.duration);
      push(`  ${DIM}${date}${RESET}  ${project}  ${turns}  ${tokens}  ${cost}  ${DIM}${dur}${RESET}`);
    }
    push("");
  }

  push(`  ${DIM}esc to close${RESET}`, "");

  return lines;
}
