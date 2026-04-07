const COLORS: Record<string, string> = {
  bash:  "\x1b[42m", // green bg
  read:  "\x1b[44m", // blue bg
  write: "\x1b[41m", // red bg
  edit:  "\x1b[41m", // red bg
};

export function formatTool(name: string, count: number): string {
  const color = COLORS[name] ?? "\x1b[47m";
  const label = count > 1 ? `${name} \u00d7${count}` : name;
  return `${color} ${label} \x1b[0m`;
}
