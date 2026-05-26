import { type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// ── Handlers ─────────────────────────────────────────────────────────────────

interface ErrorHandler {
  name: string;
  match: (text: string) => boolean;
  format: (text: string, theme: Theme) => string[];
}

const HANDLERS: ErrorHandler[] = [
  {
    name: "JSON Error",
    match: (t) => t.trim().startsWith("{"),
    format: (t, theme) => {
      try {
        const obj = JSON.parse(t);
        return [
          theme.fg("error", "JSON Error:"),
          ...Object.entries(obj).map(([k, v]) => `${theme.fg("muted", k)}: ${v}`)
        ];
      } catch { return ["Invalid JSON"]; }
    }
  },
  {
    name: "Generic",
    match: () => true,
    format: (t, theme) => [theme.fg("error", "Error:"), ...t.split("\n")]
  }
];

// ── TUI Component ────────────────────────────────────────────────────────────

class ErrorPresenter implements Component {
  private lines: string[];
  private theme: Theme;
  
  constructor(text: string, theme: Theme) {
    this.theme = theme;
    const handler = HANDLERS.find(h => h.match(text)) ?? HANDLERS[1]!;
    this.lines = handler.format(text, theme);
  }

  render(width: number): string[] {
    const border = (s: string) => this.theme.fg("borderMuted", s);
    const innerW = Math.max(0, width - 4);
    
    return [
      border("╭" + "─".repeat(width - 2) + "╮"),
      ...this.lines.map(l => {
        const d = truncateToWidth(l, innerW);
        return border("│ ") + d + " ".repeat(Math.max(0, innerW - visibleWidth(d))) + border(" │");
      }),
      border("╰" + "─".repeat(width - 2) + "╯")
    ];
  }
  
  invalidate(): void {}
  handleInput?(data: string): void {}
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("view-error", {
    description: "Render error text nicely",
    handler: async (args, ctx) => {
      const text = args || "Unknown error";
      await ctx.ui.custom((tui, theme, kb, done) => {
        return new ErrorPresenter(text, theme);
      }, { 
        overlay: true,
        overlayOptions: { width: "60%", anchor: "center" }
      });
    }
  });
}
