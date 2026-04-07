import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

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

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function rightAlign(text: string): string {
  const width = process.stdout.columns ?? 80;
  const visible = stripAnsi(text).length;
  return " ".repeat(Math.max(0, width - visible)) + text;
}

export class ToolWidget {
  private ctx: ExtensionContext;
  private counts = new Map<string, number>();
  private active = new Set<string>();

  constructor(ctx: ExtensionContext) {
    this.ctx = ctx;
  }

  start(name: string): void {
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
    this.active.add(name);
    this.render();
  }

  end(name: string): void {
    this.active.delete(name);
    this.render();
  }

  clearActive(): void {
    this.active.clear();
    this.render();
  }

  private render(): void {
    if (this.counts.size === 0) {
      this.ctx.ui.setWidget("tool-calls", undefined, { placement: "belowEditor" });
      return;
    }

    const text = [...this.counts.entries()]
      .map(([name, count]) => formatTool(name, count, this.active.has(name)))
      .join("  ");

    this.ctx.ui.setWidget("tool-calls", [rightAlign(text)], { placement: "belowEditor" });
  }
}
