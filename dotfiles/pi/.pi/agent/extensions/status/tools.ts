import process from "node:process";

const TEXT: Record<string, string> = {
  bash:  "\x1b[32m", // green text
  read:  "\x1b[34m", // blue text
  write: "\x1b[31m", // red text
  edit:  "\x1b[33m", // yellow text
};

const BG: Record<string, string> = {
  bash:  "\x1b[42m", // green bg
  read:  "\x1b[44m", // blue bg
  write: "\x1b[41m", // red bg
  edit:  "\x1b[43m", // yellow bg
};

export function formatTool(name: string, count: number, active: boolean): string {
  const text = TEXT[name] ?? "\x1b[37m";
  const bg   = BG[name]   ?? "\x1b[47m";
  const nameStr = active ? `\x1b[1m${text}${name}\x1b[0m` : `${text}${name}\x1b[0m`;
  return `${nameStr} ${bg} ${count} \x1b[0m`;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function buildBottomLine(left: string, right: string): string {
  if (!right) return left;
  const width = (process.stdout.columns ?? 80) - 1;
  const pad = Math.max(1, width - stripAnsi(left).length - stripAnsi(right).length);
  return left + " ".repeat(pad) + right;
}
