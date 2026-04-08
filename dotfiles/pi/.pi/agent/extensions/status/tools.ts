import process from "node:process";

const TOOL_BG: Record<string, string> = {
  bash: "\x1b[48;5;140m",
  read: "\x1b[48;5;73m",
  write: "\x1b[48;5;174m",
  edit: "\x1b[48;5;179m",
};

const FG_DARK = "\x1b[38;5;232m";
const RESET = "\x1b[0m";

export function formatTool(name: string, count: number): string {
  const bg = TOOL_BG[name] ?? "\x1b[47m";
  return `${bg}${FG_DARK} ${count} ${RESET}`;
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function buildLine(left: string, right: string): string {
  if (!right) return left;
  const width = (process.stdout.columns ?? 80) - 2;
  const pad = Math.max(
    1,
    width - stripAnsi(left).length - stripAnsi(right).length,
  );
  return left + " ".repeat(pad) + right;
}
