import process from "node:process";

const BG: Record<string, string> = {
  bash:  "\x1b[48;5;140m", // muted violet
  read:  "\x1b[48;5;73m",  // dusty teal
  write: "\x1b[48;5;174m", // dusty rose
  edit:  "\x1b[48;5;179m", // warm gold
};

export function formatTool(name: string, count: number): string {
  const bg = BG[name] ?? "\x1b[47m";
  return `${bg}\x1b[38;5;232m ${count} \x1b[0m`;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function buildBottomLine(left: string, right: string): string {
  if (!right) return left;
  const width = (process.stdout.columns ?? 80) - 2;
  const pad = Math.max(1, width - stripAnsi(left).length - stripAnsi(right).length);
  return left + " ".repeat(pad) + right;
}
