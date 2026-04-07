import process from "node:process";

const TEXT: Record<string, string> = {
  bash: "\x1b[32m", // green text
  read: "\x1b[34m", // blue text
  write: "\x1b[31m", // red text
  edit: "\x1b[33m", // yellow text
};

const BG: Record<string, string> = {
  bash:  "\x1b[48;5;99m",  // indigo
  read:  "\x1b[48;5;37m",  // teal
  write: "\x1b[48;5;203m", // coral
  edit:  "\x1b[48;5;214m", // amber
};

export function formatTool(
  name: string,
  count: number,
  active: boolean,
): string {
  const text = TEXT[name] ?? "\x1b[37m";
  const bg = BG[name] ?? "\x1b[47m";
  const nameStr = active
    ? `\x1b[1m${text}${name}\x1b[0m`
    : `${text}${name}\x1b[0m`;
  return `${bg}\x1b[38;5;232m ${count} \x1b[0m`;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function buildBottomLine(left: string, right: string): string {
  if (!right) return left;
  const width = (process.stdout.columns ?? 80) - 2;
  const pad = Math.max(
    1,
    width - stripAnsi(left).length - stripAnsi(right).length,
  );
  return left + " ".repeat(pad) + right;
}
