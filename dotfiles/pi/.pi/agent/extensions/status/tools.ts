const TEXT: Record<string, string> = {
  bash:  "\x1b[32m", // green text
  read:  "\x1b[34m", // blue text
  write: "\x1b[31m", // red text
  edit:  "\x1b[31m", // red text
};

const BG: Record<string, string> = {
  bash:  "\x1b[42m", // green bg
  read:  "\x1b[44m", // blue bg
  write: "\x1b[41m", // red bg
  edit:  "\x1b[41m", // red bg
};

export function formatTool(name: string, count: number, active: boolean): string {
  const color = active ? (BG[name] ?? "\x1b[47m") : (TEXT[name] ?? "\x1b[37m");
  const label = count > 1 ? `${name} \u00d7${count}` : name;
  return `${color}${active ? ` ${label} ` : label}\x1b[0m`;
}
